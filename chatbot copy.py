import os
from dotenv import load_dotenv

# Load environment variables from .env.local file
load_dotenv(dotenv_path='.env.local')

# Get Pinecone API key
PINECONE_API_KEY = os.getenv('PINECONE_API_KEY')
PINECONE_ENVIRONMENT = os.getenv('PINECONE_ENV')
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
from llama_index.embeddings.huggingface import HuggingFaceEmbedding
from pinecone import Pinecone, ServerlessSpec
from llama_index.core import VectorStoreIndex, ServiceContext
from llama_index.core import Document
from llama_index.core import Settings
from llama_index.vector_stores.pinecone import PineconeVectorStore
from google import genai

from llama_index.llms.gemini import Gemini

INDEX_NAME = "su-rag-pipeline"
DIMENSION = 384  
def initialize_pinecone():
    # Initialize the Pinecone client.
    pc = Pinecone(api_key=PINECONE_API_KEY)
    # Ensure the target index exists.
    print(pc.list_indexes())
    # if INDEX_NAME not in pc.list_indexes():
    #     print(f"Index '{INDEX_NAME}' does not exist. Please create and populate the index first.")
    #     exit(1)
    return pc.Index(INDEX_NAME)

def load_index(pinecone_index):
    # Set up the embedding model using all-MiniLM-L6-v2
    embedding_model = HuggingFaceEmbedding(model_name="all-MiniLM-L6-v2")
    
    # Configure settings with the embedding model
    Settings.embed_model = embedding_model
    Settings.chunk_size = 1024
    Settings.chunk_overlap = 20
    
    # Wrap the existing Pinecone index into a LlamaIndex vector store
    vector_store = PineconeVectorStore(index_name=INDEX_NAME, pinecone_index=pinecone_index)
    
    # Create a LlamaIndex that uses the Pinecone vector store with existing data
    index = VectorStoreIndex.from_vector_store(
        vector_store=vector_store
    )
    return index

def stream_gemini_response(prompt):
    """
    Calls the Gemini API with streaming enabled and prints chunks as they arrive.
    (Adjust this function per the Gemini API client’s requirements.)
    """
    # Initialize the Gemini client.
    gemini_client = genai.Client(api_key=GEMINI_API_KEY)
    # Start the streaming generation; the API is assumed to support a generate_stream() method.
    stream = gemini_client.models.generate_content_stream(  model="gemini-2.0-flash",
    contents=["Explain how AI works"])
    print("\nGemini Streaming Response:")
    for chunk in stream:
        print(chunk, end='', flush=True)
    print()

def get_gemini_response(prompt):
    """
    Calls the Gemini API without streaming and returns the complete response.
    """
    # Initialize the Gemini client
    gemini_client = genai.Client(api_key=GEMINI_API_KEY)
    
    # Generate content with the complete prompt
    response = gemini_client.models.generate_content(
        model="gemini-2.0-flash",
        contents=prompt
    )
    
    return response.text

def main():
    # Initialize Pinecone and load the LlamaIndex
    pinecone_index = initialize_pinecone()
    embedding_model = HuggingFaceEmbedding(model_name="all-MiniLM-L6-v2")
    
    # index = load_index(pinecone_index)c
    
    # Create query engine
    # query_engine = index.as_query_engine()
    
    print("Chatbot is ready. Type your query below (or type 'exit' to quit).")
    
    while True:
        user_query = input("\nYou: ")
        if user_query.lower() == "exit":
            break
            
        # Get embeddings and query Pinecone
        embedding = embedding_model.get_text_embedding(user_query)
        retrieval_result = pinecone_index.query(
            namespace="poc_rag",
            vector=embedding,
            top_k=3,
            include_values=False,
            include_metadata=True
        )
        
        # Prepare prompt and get response
        context = str(retrieval_result)
        prompt = f"User Query: {user_query}\n\nRelevant Context: {context}\n\nAnswer:"
        response = get_gemini_response(prompt)
        
        print("\nResponse:", response)

if __name__ == "__main__":
    main()