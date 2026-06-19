import unittest

from backend.memory import vector_store


class FakeCollection:
    def __init__(self):
        self.rows = []

    def delete(self, where):
        self.rows = [
            row for row in self.rows
            if row["metadata"].get("job_id") != where["job_id"]
        ]

    def add(self, documents, ids, metadatas):
        for document, row_id, metadata in zip(documents, ids, metadatas):
            self.rows.append({
                "document": document,
                "id": row_id,
                "metadata": metadata,
            })

    def query(self, query_texts, n_results, where):
        del query_texts
        matches = [
            row["document"] for row in self.rows
            if row["metadata"].get("job_id") == where["job_id"]
        ][:n_results]
        return {"documents": [matches]}


class VectorStoreTests(unittest.TestCase):
    def setUp(self):
        self.original_collection = vector_store.collection
        vector_store.collection = FakeCollection()

    def tearDown(self):
        vector_store.collection = self.original_collection

    def test_queries_are_isolated_by_job_id(self):
        wiki_a = {
            "architecture": {"architecture_style": "Repo A"},
            "main_flow": "Repo A flow",
            "modules": [{
                "file": "repo_a.py",
                "role": "A",
                "responsibility": "Only repo A",
                "risk_level": "low",
            }],
        }
        wiki_b = {
            "architecture": {"architecture_style": "Repo B"},
            "main_flow": "Repo B flow",
            "modules": [{
                "file": "repo_b.py",
                "role": "B",
                "responsibility": "Only repo B",
                "risk_level": "high",
            }],
        }

        vector_store.store_wiki_chunks("job-a", wiki_a)
        vector_store.store_wiki_chunks("job-b", wiki_b)

        docs = vector_store.query_wiki("job-a", "Where is the core flow?", top_k=10)
        joined = "\n".join(docs)

        self.assertIn("Repo A", joined)
        self.assertNotIn("Repo B", joined)


if __name__ == "__main__":
    unittest.main()
