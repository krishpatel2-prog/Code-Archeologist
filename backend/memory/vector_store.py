import chromadb
from chromadb.utils import embedding_functions


# Use simple default embedding
embedding_function = embedding_functions.DefaultEmbeddingFunction()

client = chromadb.Client()

collection = client.get_or_create_collection(
    name="code_wiki",
    embedding_function=embedding_function
)


def store_wiki_chunks(job_id: str, wiki: dict):
    documents = []
    ids = []

    # Flatten wiki into text chunks
    documents.append(f"Architecture: {wiki['architecture']}")
    ids.append(f"{job_id}_architecture")

    documents.append(f"Main Flow: {wiki['main_flow']}")
    ids.append(f"{job_id}_main_flow")

    for module in wiki["modules"]:
        text = f"""
        File: {module['file']}
        Role: {module['role']}
        Responsibility: {module['responsibility']}
        Risk: {module['risk_level']}
        """
        documents.append(text)
        ids.append(f"{job_id}_{module['file']}")

    collection.add(
        documents=documents,
        ids=ids
    )


def query_wiki(question: str, top_k=3):
    results = collection.query(
        query_texts=[question],
        n_results=top_k
    )
    return results["documents"][0]