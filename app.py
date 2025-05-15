from flask import Flask, request, jsonify, abort
import uuid
from flask_cors import CORS
import logging
from typing import Dict, Any
from datetime import datetime, timedelta
from dotenv import load_dotenv
import os
import time
import random
from functools import wraps
import jwt

# Import your RAG-chatbot module
from chatbot import (
    init_embedding_settings,
    init_pinecone_client,
    load_index,
    init_gemini_client,
    init_chat_session,
    answer_query,
    retrieve_relevant_context,  # Add this
    build_prompt,               # Add this
    PINECONE_API_KEY,
    INDEX_NAME,
    GEMINI_API_KEY,
)
from firebase_admin import firestore
from utils import (
    get_all_chat_ids,
    create_chat_log,
    delete_chat_log,
    create_user,
    authenticate_user,
    add_message_to_log,
    get_chat_history,
    init_document_settings,
    allowed_file,
    process_document,
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize RAG components and embedding settings
init_embedding_settings()
pinecone_client = init_pinecone_client(PINECONE_API_KEY)
index = load_index(pinecone_client, INDEX_NAME)
gemini_client = init_gemini_client(GEMINI_API_KEY)
db = firestore.client()
USERS_COL = "users"
CHATS_COL = "chat_logs"

# In-memory store for active chat sessions
chats: Dict[str, Any] = {}

app = Flask(__name__)
CORS(app, origins=["http://localhost:3000"])

load_dotenv(".env.local")
JWT_SECRET = os.getenv("JWT_SECRET")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
JWT_EXP = int(os.getenv("JWT_EXP_DELTA_SECONDS", 3600))

# Initialize document upload settings
UPLOAD_FOLDER, ALLOWED_EXTENSIONS = init_document_settings()
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

def generate_token(user: dict):
    payload = {
        "sub": user["email"],
        "role": user["role"],
        "name": user.get("name"),  # Include name in token
        "exp": datetime.utcnow() + timedelta(seconds=JWT_EXP)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def auth_required(f):
    @wraps(f)
    def decorated(*args, **kw):
        auth = request.headers.get("Authorization", None)
        if not auth or not auth.startswith("Bearer "):
            abort(401)
        token = auth.split(" ",1)[1]
        try:
            data = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            request.user = {
                "email": data["sub"], 
                "role": data["role"],
                "name": data.get("name")  # Get name from token
            }
        except jwt.ExpiredSignatureError:
            abort(401, "Token expired")
        except Exception:
            abort(401)
        return f(*args, **kw)
    return decorated

# Auth endpoints
#
@app.route("/auth/signup", methods=["POST"])
def signup():
    data = request.json or {}
    email = data.get("email")
    password = data.get("password")
    name = data.get("name")    
    role = data.get("role", "user")
    if not email or not password:
        abort(400, "Email+password required")
    try:
        create_user(email, password, name, role)
    except ValueError as e:
        abort(400, str(e))
    token = generate_token({"email": email, "role": role, "name": name})
    return jsonify({"token": token})

@app.route("/auth/login", methods=["POST"])
def login():
    data = request.json or {}
    email = data.get("email")
    password = data.get("password")
    if not email or not password:
        abort(400, "Email+password required")
    user = authenticate_user(email, password)
    if not user:
        abort(401, "Invalid credentials")
    token = generate_token(user)
    return jsonify({"token": token})

#Chat endpoints

@app.route("/chats", methods=["POST"])
@auth_required
def create_chat():
    """Create a new chat session and return its ID."""
    chat_id = str(uuid.uuid4())
    
    # Initialize the chat session in memory
    chats[chat_id] = init_chat_session(gemini_client)
    
    # Get user info from token data
    user_email = request.user["email"]
    user_name = request.user.get("name", "Unknown")  # This should now work
    print(f"User email: {user_email}, User name: {user_name}")
    # Create chat log with timestamp
    created_at = datetime.utcnow()
    create_chat_log(
        chat_id,
        user_email,
        user_name,
        created_at=created_at
    )
    
    return jsonify({
        "chat_id": chat_id,
        "userId": user_email,
        "userName": user_name,
        "created_at": created_at.isoformat(),
        "favorite": False
    }), 201

@app.route("/chats", methods=["GET"])
@auth_required
def list_chats():
    """
    Return list of chat metadata for the current user only, sorted newest first.
    """
    try:
        # Get current user email from the auth token
        current_user_email = request.user["email"]
        
        try:
            # Try with ordering (this will work once the index is created)
            docs = (
                db.collection(CHATS_COL)
                .where("userId", "==", current_user_email)
                .order_by("created_at", direction=firestore.Query.DESCENDING)
                .stream()
            )
            
            out = []
            for doc in docs:
                d = doc.to_dict()
                out.append({
                    "id": doc.id,
                    "created_at": d["created_at"].isoformat(),
                    "userId": d.get("userId"),
                    "userName": d.get("userName"),
                    "favorite": d.get("favorite", False),
                })
                
        except Exception as index_error:
            logger.warning(f"Index error, falling back to client-side sorting: {index_error}")
            # Fallback: get data without ordering and sort client-side
            docs = (
                db.collection(CHATS_COL)
                .where("userId", "==", current_user_email)
                .stream()
            )
            
            out = []
            for doc in docs:
                d = doc.to_dict()
                out.append({
                    "id": doc.id,
                    "created_at": d["created_at"].isoformat(),
                    "userId": d.get("userId"),
                    "userName": d.get("userName"),
                    "favorite": d.get("favorite", False),
                })
            
            # Sort manually
            out.sort(key=lambda x: x["created_at"], reverse=True)
        
        logger.info(f"Retrieved {len(out)} chats for user {current_user_email}")
        return jsonify({"chats": out})
        
    except Exception as e:
        logger.error(f"Error listing chats: {e}")
        return jsonify({"error": "Failed to list chats", "details": str(e)}), 500

@app.route("/chats/<chat_id>/favorite", methods=["POST"])
@auth_required
def favorite_chat(chat_id):
    """
    Toggle favorite flag. Expects JSON {favorite: true/false}.
    """
    fav = request.json.get("favorite")
    if fav is None:
        abort(400, "Missing 'favorite'")
    db.collection(CHATS_COL).document(chat_id).update({
        "favorite": bool(fav)
    })
    return jsonify({"favorite": fav})


@app.route("/chats/<chat_id>/message", methods=["POST"])
@auth_required
def send_message(chat_id: str):
    """Send a user message to the specified chat and return the assistant's reply."""
    logger.info(f"Received message for chat {chat_id}")
    logger.info(f"Active chats: {list(chats.keys())}")
    
    if chat_id not in chats:
        logger.error(f"Chat {chat_id} not found in active sessions")
        abort(404, description="Chat not found.")
    
    payload = request.get_json()
    if not payload or "message" not in payload:
        abort(400, description="Missing 'message' in request body.")
    
    user_msg = payload["message"]
    add_message_to_log(chat_id, "user", user_msg)
    
    # Initialize context array
    combined_context = []
    
    # First check document pipeline
    try:
        doc_index = load_index(pinecone_client, "su-rag-doc")
        doc_context = retrieve_relevant_context(doc_index, user_msg, top_k=3)
        combined_context.extend(doc_context)
        logger.info(f"Found {len(doc_context)} relevant documents in uploaded content")
    except Exception as e:
        logger.warning(f"Could not load or query su-rag-doc index: {e}")
    
    # Only query the website index if we don't have enough context from documents
    if len(combined_context) < 3:
        try:
            # Calculate how many more results we need
            additional_results_needed = 3 - len(combined_context)
            logger.info(f"Retrieving {additional_results_needed} additional results from website data")
            
            # Get additional context from the website data
            main_context = retrieve_relevant_context(
                index, 
                user_msg, 
                namespace="poc_rag", 
                top_k=additional_results_needed
            )
            combined_context.extend(main_context)
        except Exception as e:
            logger.warning(f"Error retrieving context from main index: {e}")
    
    # Use the chat session to answer with combined context
    chat_session = chats[chat_id]
    
    # Build a custom prompt with the combined context
    prompt = build_prompt(user_msg, combined_context)
    
    # Send to Gemini with retry logic
    max_retries = 3
    retry_delay = 1
    
    for attempt in range(max_retries):
        try:
            response = chat_session.send_message(prompt)
            reply = response.text
            break
        except Exception as e:
            if attempt < max_retries - 1:
                sleep_time = retry_delay * (2 ** attempt) + (random.random())
                logger.warning(f"Gemini API error. Retrying in {sleep_time:.1f}s. ({attempt+1}/{max_retries})")
                time.sleep(sleep_time)
            else:
                logger.error(f"Failed after {max_retries} attempts: {e}")
                reply = "I'm sorry, I'm having trouble responding right now. Please try again shortly."
    
    add_message_to_log(chat_id, "assistant", reply)
    return jsonify({"response": reply})

@app.route("/chats/<chat_id>/history", methods=["GET"])
@auth_required
def get_history(chat_id: str):
    """Return nicely formatted history from Firestore."""
    if chat_id not in chats:
        chats[chat_id] = init_chat_session(gemini_client)
      
    raw = get_chat_history(chat_id)
    history = []
    for entry in raw:
        for role, text in entry.items():
            if role == "timestamp":
                continue
            history.append({"role": role, "text": text})
    return jsonify({"history": history})

@app.route("/chats/<chat_id>", methods=["DELETE"])
@auth_required
def delete_chat(chat_id: str):
    """Remove both the in-memory session and the Firestore log."""
    if chat_id in chats:
        chats.pop(chat_id)
    delete_chat_log(chat_id)
    logger.info("Deleted chat %s", chat_id)
    return jsonify({"message": "deleted"})

@app.route("/user/profile", methods=["GET"])
@auth_required
def get_profile():
    """Get user profile from Firestore"""
    doc = db.collection(USERS_COL).document(request.user["email"]).get()
    if not doc.exists:
        abort(404)
    data = doc.to_dict()
    return jsonify({
        "email": data["email"],
        "name": data.get("name", ""),
        "role": data["role"],
        "degree": data.get("degree", ""),
        "department": data.get("department", ""),
        "createdAt": data["created_at"].isoformat() if data.get("created_at") else None
    })

@app.route("/user/profile", methods=["PUT"])
@auth_required
def update_profile():
    """Update user profile in Firestore"""
    data = request.get_json()
    
    # Only allow updating certain fields
    allowed_updates = {
        "name": data.get("name"),
        "degree": data.get("degree"),
        "department": data.get("department")
    }
    
    db.collection(USERS_COL).document(request.user["email"]).update(allowed_updates)
    
    return get_profile()

@app.route('/api/upload-documents', methods=['POST'])
@auth_required
def upload_documents():
    """Handle document upload request"""
    if 'documents' not in request.files:
        return jsonify({'error': 'No documents part'}), 400
    
    files = request.files.getlist('documents')
    processed_files = []
    
    try:
        # Load document index
        doc_index = load_index(pinecone_client, "su-rag-doc")
        
        # Get user details from Firestore
        user_doc = db.collection(USERS_COL).document(request.user["email"]).get()
        if not user_doc.exists:
            return jsonify({'error': 'User not found'}), 404
        
        # Convert DocumentSnapshot to dict first
        user_data = user_doc.to_dict()
        
        # Prepare user metadata
        user_metadata = {
            'email': request.user["email"],
            'name': request.user.get("name", ""),
            'role': request.user.get("role", ""),
            'department': user_data.get('department') if user_data else "",
        }
        
        for file in files:
            if file and allowed_file(file.filename, ALLOWED_EXTENSIONS):
                filename = process_document(
                    file, 
                    app.config['UPLOAD_FOLDER'], 
                    doc_index,  # Pass VectorStoreIndex - our function will extract pinecone_index
                    user_metadata
                )
                processed_files.append(filename)
        
        return jsonify({
            'message': 'Documents processed successfully',
            'processed_files': processed_files,
            'uploader': user_metadata
        }), 200
        
    except Exception as e:
        logger.error(f"Error processing documents: {str(e)}")
        return jsonify({'error': str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5050, debug=True)
