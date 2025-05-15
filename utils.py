from firebase_admin import credentials, firestore, initialize_app
from google.cloud.firestore_v1 import SERVER_TIMESTAMP
import os
from dotenv import load_dotenv
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
import logging
from typing import List
from werkzeug.utils import secure_filename
from pypdf import PdfReader
import pinecone
from sentence_transformers import SentenceTransformer

load_dotenv(dotenv_path=".env.local")

cred_path = os.getenv("FIREBASE_CREDENTIALS_PATH")
project_id = os.getenv("FIREBASE_PROJECT_ID")
cred = credentials.Certificate(cred_path)
initialize_app(cred, {"projectId": project_id})


db = firestore.client()
COLLECTION = "chat_logs"
USERS_COL = "users"
# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize the embedding model
model = SentenceTransformer('all-MiniLM-L6-v2')

def get_all_chat_ids() -> list[str]:
    """Return a list of all chat document IDs in Firestore."""
    docs = db.collection(COLLECTION).stream()
    return [doc.id for doc in docs]

def create_user(email: str, password: str,name:str, role: str = "user"):
    """Add a new user doc with hashed password and role."""
    user_ref = db.collection(USERS_COL).document(email)
    if user_ref.get().exists:
        raise ValueError("User already exists")
    pw_hash = generate_password_hash(password)
    user_ref.set({
        "email": email,
        "password_hash": pw_hash,
        "role": role,
        "name": name,  
        "created_at": SERVER_TIMESTAMP
    })
    
def authenticate_user(email: str, password: str) -> dict:
    """Verify credentials, return user dict if OK, else None."""
    doc = db.collection(USERS_COL).document(email).get()
    if not doc.exists:
        return None
    data = doc.to_dict()
    if check_password_hash(data["password_hash"], password):
        return {
            "email": data["email"], 
            "role": data["role"],
            "name": data.get("name", "Unknown")  # Add name to returned data
        }
    return None

def get_user_role(email: str) -> str | None:
    """Return the role of the user with the given email."""
    doc = db.collection(USERS_COL).document(email).get()
    if not doc.exists:
        return None
    data = doc.to_dict()
    return data.get("role", None)



def create_chat_log(chat_id: str, user_id: str, user_name: str, created_at: datetime = None):
    """Create a new chat log in Firestore."""
    if created_at is None:
        created_at = datetime.utcnow()
        
    db.collection(COLLECTION).document(chat_id).set({
        "userId": user_id,
        "userName": user_name,
        "created_at": created_at,
        "favorite": False,
        "chat": []
    })

def delete_chat_log(chat_id: str) -> None:
    """Delete the Firestore doc for this chat."""
    db.collection(COLLECTION).document(chat_id).delete()


def add_message_to_log(chat_id: str, role: str, text: str) -> None:
    """
    Append a single-turn message to the `chat` array.
    We store it as a map whose single key is the role, so:
      { "user": "Hello" }  or  { "assistant": "Hi there" }
    """
    # First get a reference to the document
    doc_ref = db.collection(COLLECTION).document(chat_id)
    
    # Create the message object
    msg = {role: text}
    
    # Use a transaction to update both the chat array and timestamp
    @firestore.transactional
    def update_in_transaction(transaction, doc_ref):
        # Add message to chat array
        transaction.update(doc_ref, {
            "chat": firestore.ArrayUnion([msg]),
            "updated_at": SERVER_TIMESTAMP
        })

    # Start a transaction
    transaction = db.transaction()
    update_in_transaction(transaction, doc_ref)
    
    logger.info(f"Added {role} message to chat {chat_id}")


def get_chat_history(chat_id: str) -> list[dict]:
    """
    Fetch the raw `chat` array from Firestore, e.g.
      [ { "system": "Welcome" }, { "user": "Hi..." }, … ]
    """
    doc = db.collection(COLLECTION).document(chat_id).get()
    if not doc.exists:
        return []
    return doc.to_dict().get("chat", [])

def init_document_settings():
    """Initialize document upload settings"""
    UPLOAD_FOLDER = 'uploads'
    ALLOWED_EXTENSIONS = {'pdf'}
    
    if not os.path.exists(UPLOAD_FOLDER):
        os.makedirs(UPLOAD_FOLDER)
        
    return UPLOAD_FOLDER, ALLOWED_EXTENSIONS

def allowed_file(filename: str, allowed_extensions: set) -> bool:
    """Check if file has an allowed extension"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in allowed_extensions

def extract_text_from_pdf(file_path: str, max_chunk_size: int = 1000) -> List[str]:
    """
    Extract text from PDF and split into chunks of appropriate size
    
    Args:
        file_path: Path to the PDF file
        max_chunk_size: Maximum characters in a chunk
    """
    reader = PdfReader(file_path)
    raw_text = ""
    
    # Extract text from all pages
    for page in reader.pages:
        page_text = page.extract_text()
        if page_text:
            raw_text += page_text + "\n\n"
    
    # Create chunks of appropriate size
    text_chunks = []
    paragraphs = raw_text.split("\n\n")
    
    current_chunk = ""
    for paragraph in paragraphs:
        # If adding this paragraph would exceed max size, store current chunk and start a new one
        if len(current_chunk) + len(paragraph) > max_chunk_size and current_chunk:
            text_chunks.append(current_chunk.strip())
            current_chunk = paragraph
        else:
            if current_chunk:
                current_chunk += "\n\n" + paragraph
            else:
                current_chunk = paragraph
    
    # Don't forget the last chunk
    if current_chunk:
        text_chunks.append(current_chunk.strip())
    
    return text_chunks

def embed_and_upload_to_pinecone(text_chunks: List[str], metadata: dict, index: pinecone.Index):
    """Generate embeddings and upload to Pinecone"""
    batch_size = 100
    
    # Clean metadata to ensure no null values
    clean_metadata = {}
    for key, value in metadata.items():
        if value is not None:
            clean_metadata[key] = value
        else:
            clean_metadata[key] = ""  # Replace null with empty string
    
    for i in range(0, len(text_chunks), batch_size):
        batch = text_chunks[i:i + batch_size]
        
        # Generate embeddings
        embeddings = model.encode(batch)
        
        # Prepare vectors for Pinecone
        vectors = []
        for j, embedding in enumerate(embeddings):
            chunk_id = i + j
            vector_id = f"{clean_metadata['doc_id']}_{chunk_id}"
            
            # Create chunk-specific metadata
            chunk_metadata = {
                **clean_metadata,  # Use the cleaned metadata
                'chunk_id': chunk_id,
                'chunk_text': batch[j],
                'total_chunks': len(text_chunks)
            }
            
            vectors.append((vector_id, embedding.tolist(), chunk_metadata))
        
        # Upsert to Pinecone
        index.upsert(vectors=vectors)
        print(f"Uploaded batch {i//batch_size + 1}/{(len(text_chunks) + batch_size - 1)//batch_size}")

def process_document(file, upload_folder: str, index, user_data: dict) -> str:
    """
    Process a single document file
    
    Args:
        file: The uploaded file object
        upload_folder: Path to save temporary files
        index: Pinecone Index or VectorStoreIndex 
        user_data: Dictionary containing user details
    """
    filename = secure_filename(file.filename)
    file_path = os.path.join(upload_folder, filename)
    file.save(file_path)
    
    # Extract text from PDF with controlled chunk size
    text_chunks = extract_text_from_pdf(file_path, max_chunk_size=1000)
    
    # Prepare base metadata with user details - ensure no null values
    metadata = {
        'doc_id': filename,
        'filename': filename,
        'upload_date': datetime.now().isoformat(),
        'uploader_email': user_data.get('email') or "",
        'uploader_name': user_data.get('name') or "",
        'uploader_department': user_data.get('department') or "",
        'uploader_role': user_data.get('role') or ""
    }
    
    # Get the actual Pinecone index from the VectorStoreIndex if needed
    if hasattr(index, 'pinecone_index'):
        pinecone_index = getattr(index, 'pinecone_index')
    else:
        # If it's already a Pinecone index, use it directly
        pinecone_index = index
    
    # Upload to Pinecone with text in metadata
    embed_and_upload_to_pinecone(text_chunks, metadata, pinecone_index)
    
    # Clean up uploaded file
    os.remove(file_path)
    
    return filename