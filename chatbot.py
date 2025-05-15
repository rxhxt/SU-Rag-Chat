import os
import logging
import time
from typing import List, Optional, Dict, Any
import re
from dotenv import load_dotenv
from pinecone import Pinecone, ServerlessSpec
from llama_index.embeddings.huggingface import HuggingFaceEmbedding
from llama_index.core import VectorStoreIndex, Settings
from llama_index.vector_stores.pinecone import PineconeVectorStore
from google import genai
from boilerpy3 import extractors
extractor = extractors.DefaultExtractor()
from google.genai import types

# Load environment variables
load_dotenv(dotenv_path=".env.local")

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Environment variables
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
PINECONE_ENVIRONMENT = os.getenv("PINECONE_ENV")
INDEX_NAME = os.getenv("PINECONE_INDEX", "su-rag-pipeline")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# System instruction for Gemini chat
SYSTEM_INSTRUCTION = """
You are the **Seattle University Knowledge Assistant**, an authoritative and friendly guide powered by Seattle University’s official data and publications. When you answer:

1. Source restriction:
   – Base every fact solely on Seattle University–provided materials (webpages, catalogs, official announcements).
   – Do not draw from external institutions.

2. Citations:
   – Cite specific SU sources (e.g., “(SU Course Catalog 2024–25, p. 42)”) or official SU URLs.
   – If SU has no info on the query, reply: “I’m sorry, I don’t have that information in Seattle University’s official resources.”

3. Tone & Style:
   – Professional, helpful, inclusive.
   – Use clear structure: headings or bullet points where helpful.

4. Error handling:
   – For non‑SU queries, remind: “I’m only able to provide information about Seattle University.”

5. Confidentiality:
   – Only use publicly available SU data.
   
   Give the output in markdown format.
   Provide links to urls if possible.
   """


def init_embedding_settings(
    model_name: str = "all-MiniLM-L6-v2",
    chunk_size: int = 1024,
    chunk_overlap: int = 20
) -> None:
    """
    Configure global llama_index Settings for embeddings and chunking.
    """
    Settings.embed_model = HuggingFaceEmbedding(model_name=model_name)
    Settings.chunk_size = chunk_size
    Settings.chunk_overlap = chunk_overlap
    logger.info("Settings set: %s, chunk_size=%d, chunk_overlap=%d",
                model_name, chunk_size, chunk_overlap)


def init_pinecone_client(api_key: str) -> Pinecone:
    """
    Initialize and return a Pinecone client.
    """
    client = Pinecone(api_key=api_key)
    logger.info("Found Pinecone indexes: %s", client.list_indexes())
    return client


def create_or_get_index(client: Pinecone, index_name: str, dimension: int = 384) -> str:
    """
    Create a Pinecone index if it doesn't exist, or return existing one.
    
    Args:
        client: Pinecone client instance
        index_name: Name of the index to create/get
        dimension: Dimension of vectors (default 384 for all-MiniLM-L6-v2)
    """
    # List existing indexes
    existing_indexes = client.list_indexes()
    
    # Check if index already exists
    if index_name not in [index.name for index in existing_indexes]:
        logger.info(f"Creating new Pinecone index: {index_name}")
        # Create index with proper spec format according to new Pinecone API
        client.create_index(
            name=index_name,
            spec= ServerlessSpec(cloud="aws", region="us-east-1"),
            dimension=dimension
        )
        # Wait for index to be ready
        while True:
            try:
                index_info = client.describe_index(index_name)
                if index_info.status.get("ready"):
                    break
                time.sleep(1)
            except Exception as e:
                logger.warning(f"Index not ready yet: {e}")
                time.sleep(2)
    
    return index_name


def load_index(client: Pinecone, index_name: str) -> VectorStoreIndex:
    """
    Wrap an existing Pinecone index in a LlamaIndex VectorStoreIndex.
    """
    # Ensure index exists
    index_name = create_or_get_index(client, index_name)
    
    pinecone_index = client.Index(index_name)
    vs = PineconeVectorStore(pinecone_index=pinecone_index)
    index = VectorStoreIndex.from_vector_store(vector_store=vs)
    setattr(index, 'pinecone_index', pinecone_index)
    logger.info("Loaded index '%s'", index_name)
    return index


def init_gemini_client(api_key: str) -> genai.Client:
    """
    Initialize and return a Gemini client.
    """
    return genai.Client(api_key=api_key)


def init_chat_session(
    client: genai.Client,
    model: str = "gemini-2.0-flash",
    system_instruction: str = SYSTEM_INSTRUCTION
) -> Any:
    """
    Create a new Gemini chat session with a system instruction.
    """
    config = types.GenerateContentConfig(system_instruction=system_instruction)
    return client.chats.create(model=model, config=config)

def clean_text(text):

    text_no_punct = re.sub(r'[^\w\s]', '', text)
    normalized_text = re.sub(r'\s+', ' ', text_no_punct).strip()
    cleaned_text = normalized_text.lower()
    return cleaned_text


def add_urls_to_vecotor_store(
    index: VectorStoreIndex,
    url: str,
):
    """
    Add URLs to the vector store index.
    """
    # Assuming `urls` is a list of URLs
    try:
        content = extractor.get_content_from_url(url)
        pc = Pinecone(api_key=PINECONE_API_KEY)
        index_name = 'su-rag-pipeline'
        dimension = 384 
        vectors = {
            'id': url,
            'values': Settings.embed_model.get_text_embedding(clean_text(content)),
            'metadata': {
                'url': url,
                'text': content
            }
        }
        # embedded_text = Settings.embed_model.get_text_embedding(upload_dict['text'])

        index.upsert(
            vectors=vectors,
            namespace="poc_rag"
    )
        return True
    except Exception as e:
        logger.error(f"Error adding URL to vector store: {e}")
        return False

def retrieve_relevant_context(
    index: VectorStoreIndex,
    query: str,
    namespace: Optional[str] = None,
    top_k: int = 3
) -> List[Dict[str, Any]]:
    """
    Embed the user query and fetch top_k relevant docs from Pinecone.
    """
    embedding = Settings.embed_model.get_text_embedding(query)
    pinecone_idx = getattr(index, 'pinecone_index')
    res = pinecone_idx.query(
        namespace=namespace,
        vector=embedding,
        top_k=top_k,
        include_metadata=True,
        include_values=False
    )
    return [m.metadata for m in res.matches]


def build_prompt(query: str, context: List[Dict[str, Any]]) -> str:
    """
    Merge user query with retrieved context into a single prompt.
    """
    ctx = "\n".join(str(item) for item in context)
    return f"User Query: {query}\n\nRelevant Context:\n{ctx}\n\nAnswer:"


def answer_query(
    chat_session: Any,
    index: VectorStoreIndex,
    query: str,
    namespace: Optional[str] = None
) -> str:
    """
    Retrieve context, build prompt, and send it to an existing chat session.
    """
    context = retrieve_relevant_context(index, query, namespace)
    prompt = build_prompt(query, context)
    resp = chat_session.send_message(prompt)
    return resp.text


def main():
    """
    CLI loop for the RAG-enabled chatbot using a persistent Gemini chat session.
    """
    init_embedding_settings()
    pinecone_client = init_pinecone_client(PINECONE_API_KEY)
    index = load_index(pinecone_client, INDEX_NAME)
    gemini_client = init_gemini_client(GEMINI_API_KEY)
    # start first session
    chat = init_chat_session(gemini_client)

    print("RAG Chatbot ready! Type your query or 'new chat' to reset.")
    while True:
        user_input = input("\nYou: ")
        if user_input.strip().lower() == "exit":
            print("Goodbye!")
            break
        if user_input.strip().lower() == "new chat":
            chat = init_chat_session(gemini_client)
            print("\n🔄 Started a new chat session. Clear context.")
            continue
        answer = answer_query(chat, index, user_input, namespace="poc_rag")
        print(f"\nBot: {answer}\n")


if __name__ == "__main__":
    main()
