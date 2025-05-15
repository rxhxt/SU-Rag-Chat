from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.utils import secure_filename
import os
from pypdf import PdfReader
from typing import List
import pinecone
from sentence_transformers import SentenceTransformer
import torch

app = Flask(__name__)
CORS(app)

# Configure upload folder
UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'pdf'}
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# Initialize Pinecone
pinecone.init(
    api_key=os.getenv("PINECONE_API_KEY"),
    environment=os.getenv("PINECONE_ENVIRONMENT")
)
index_name = "su-rag-pipeline"
index = pinecone.Index(index_name)

# Initialize the embedding model
model = SentenceTransformer('all-MiniLM-L6-v2')

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def extract_text_from_pdf(file_path: str) -> List[str]:
    reader = PdfReader(file_path)
    text_chunks = []
    
    for page in reader.pages:
        text = page.extract_text()
        # Split text into smaller chunks (e.g., paragraphs)
        chunks = text.split('\n\n')
        text_chunks.extend([chunk.strip() for chunk in chunks if chunk.strip()])
    
    return text_chunks

def embed_and_upload_to_pinecone(text_chunks: List[str], metadata: dict):
    batch_size = 100
    for i in range(0, len(text_chunks), batch_size):
        batch = text_chunks[i:i + batch_size]
        
        # Generate embeddings
        embeddings = model.encode(batch)
        
        # Prepare vectors for Pinecone
        vectors = []
        for j, embedding in enumerate(embeddings):
            vector_id = f"{metadata['doc_id']}_{i+j}"
            vectors.append((vector_id, embedding.tolist(), {
                **metadata,
                'chunk_id': i+j,
                'text': batch[j]
            }))
        
        # Upsert to Pinecone
        index.upsert(vectors=vectors)

@app.route('/api/upload-documents', methods=['POST'])
def upload_documents():
    if 'documents' not in request.files:
        return jsonify({'error': 'No documents part'}), 400
    
    files = request.files.getlist('documents')
    
    if not os.path.exists(UPLOAD_FOLDER):
        os.makedirs(UPLOAD_FOLDER)
    
    processed_files = []
    
    try:
        for file in files:
            if file and allowed_file(file.filename):
                filename = secure_filename(file.filename)
                file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                file.save(file_path)
                
                # Extract text from PDF
                text_chunks = extract_text_from_pdf(file_path)
                
                # Prepare metadata
                metadata = {
                    'doc_id': filename,
                    'filename': filename,
                    'upload_date': datetime.now().isoformat()
                }
                
                # Upload to Pinecone
                embed_and_upload_to_pinecone(text_chunks, metadata)
                
                processed_files.append(filename)
                
                # Clean up uploaded file
                os.remove(file_path)
        
        return jsonify({
            'message': 'Documents processed successfully',
            'processed_files': processed_files
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)