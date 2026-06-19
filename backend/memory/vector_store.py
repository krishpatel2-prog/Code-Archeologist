import chromadb
from chromadb.utils import embedding_functions
import logging
from threading import Lock


logger = logging.getLogger(__name__)

# Use simple default embedding
embedding_function = embedding_functions.DefaultEmbeddingFunction()

client = chromadb.Client()
collection_lock = Lock()

collection = client.get_or_create_collection(
    name="code_wiki",
    embedding_function=embedding_function
)


def store_wiki_chunks(job_id: str, wiki: dict):
    documents = []
    ids = []
    metadatas = []

    # Flatten wiki into text chunks
    documents.append(f"Architecture: {wiki['architecture']}")
    ids.append(f"{job_id}_architecture")
    metadatas.append({"job_id": job_id, "kind": "architecture"})

    documents.append(f"Main Flow: {wiki['main_flow']}")
    ids.append(f"{job_id}_main_flow")
    metadatas.append({"job_id": job_id, "kind": "main_flow"})

    for index, module in enumerate(wiki["modules"]):
        text = f"""
        File: {module['file']}
        Role: {module['role']}
        Responsibility: {module['responsibility']}
        Risk: {module['risk_level']}
        """
        documents.append(text)
        ids.append(f"{job_id}_module_{index}")
        metadatas.append({
            "job_id": job_id,
            "kind": "module",
            "file": str(module.get("file", "")),
        })

    with collection_lock:
        try:
            collection.delete(where={"job_id": job_id})
        except Exception as exc:
            logger.warning("Failed to clear existing wiki chunks for job %s: %s", job_id, exc)
        collection.add(
            documents=documents,
            ids=ids,
            metadatas=metadatas,
        )


def query_wiki(job_id: str, question: str, top_k=3):
    with collection_lock:
        results = collection.query(
            query_texts=[question],
            n_results=top_k,
            where={"job_id": job_id},
        )
    return results["documents"][0] if results.get("documents") else []
