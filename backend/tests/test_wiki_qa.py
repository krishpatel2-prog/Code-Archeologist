import os
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import networkx as nx

from backend.llm.wiki_qa import ask_wiki


class WikiQATests(unittest.TestCase):
    def test_database_question_uses_import_and_config_evidence(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = root / "backend" / "memory" / "vector_store.py"
            source.parent.mkdir(parents=True)
            source.write_text(
                "\n".join([
                    "import chromadb",
                    "client = chromadb.Client()",
                ]),
                encoding="utf-8",
            )
            (root / "requirements.txt").write_text("chromadb==1.5.2\n", encoding="utf-8")
            result = _analysis_result(root, [source])

            with patch("backend.llm.wiki_qa.client", _mock_client(
                "## Answer\n\nThe project uses ChromaDB.\n\n"
                "## Reasoning\n\nThe vector storage layer imports chromadb and creates a client from that package. The dependency file also lists chromadb, so the database conclusion is tied to concrete source and configuration evidence.\n\n"
                "## Evidence\n\n* backend/memory/vector_store.py\n* requirements.txt"
            )) as client:
                with self.assertLogs("backend.llm.wiki_qa", level="INFO") as logs:
                    answer = ask_wiki("job-1", "Which database does the project use?", result)

        self.assertIn("The project uses ChromaDB.", answer)
        self.assertIn("## Answer", answer)
        self.assertIn("## Reasoning", answer)
        self.assertIn("## Evidence", answer)
        self.assertIn("* vector_store.py", answer)
        self.assertIn("* requirements.txt", answer)
        self.assertNotRegex(answer.lower(), r"\b(probably|might|likely)\b")
        self.assertNotIn("[grep_symbol]", answer)
        self.assertNotIn("chromadb==1.5.2", answer)
        client.chat.completions.create.assert_called_once()
        self.assertIn("llm.invoke called", "\n".join(logs.output))
        self.assertIn("llm.invoke completed", "\n".join(logs.output))

    def test_prompt_question_reports_prompt_construction_location(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = root / "backend" / "llm" / "summarizer.py"
            source.parent.mkdir(parents=True)
            source.write_text(
                "\n".join([
                    "from groq import Groq",
                    "def summarize_file(file_path, parsed_data):",
                    "    prompt = f\"\"\"",
                    "File path:",
                    "{file_path}",
                    "Return ONLY valid JSON",
                    "\"\"\"",
                    "    return prompt",
                ]),
                encoding="utf-8",
            )
            result = _analysis_result(root, [source])

            with patch("backend.llm.wiki_qa.client", _mock_client(
                "## Answer\n\nThe LLM prompt is constructed in backend/llm/summarizer.py.\n\n"
                "## Reasoning\n\nThe file builds a prompt string before returning or sending it through the LLM path. The prompt block contains the instructions and file context used for the request.\n\n"
                "## Evidence\n\n* backend/llm/summarizer.py"
            )) as client:
                answer = ask_wiki("job-1", "What prompt is given to the LLM?", result)

        self.assertIn("The LLM prompt is constructed in", answer)
        self.assertIn("summarizer.py", answer)
        self.assertIn("## Reasoning", answer)
        self.assertIn("* summarizer.py", answer)
        self.assertNotIn("prompt = f", answer)
        self.assertNotIn("Return ONLY valid JSON", answer)
        client.chat.completions.create.assert_called_once()

    def test_hotspot_and_risk_questions_pass_distinct_intents_to_llm(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = root / "core.py"
            source.write_text("def run(): pass\n", encoding="utf-8")
            result = _analysis_result(root, [source])

            with patch("backend.llm.wiki_qa.client", _mock_client(
                "## Answer\n\nRefactor core.py first.\n\n"
                "## Reasoning\n\nThe file is ranked as a hotspot and has impact evidence.\n\n"
                "## Evidence\n\n* core.py"
            )) as hotspot_client:
                ask_wiki("job-1", "Which hotspot should be refactored first?", result)

            hotspot_prompt = hotspot_client.chat.completions.create.call_args.kwargs["messages"][1]["content"]
            self.assertIn("Intent:\nhotspot", hotspot_prompt)

            with patch("backend.llm.wiki_qa.client", _mock_client(
                "## Answer\n\ncore.py has the highest risk.\n\n"
                "## Reasoning\n\nThe file has impact and hotspot evidence.\n\n"
                "## Evidence\n\n* core.py"
            )) as risk_client:
                ask_wiki("job-1", "Which file has the highest risk?", result)

            risk_prompt = risk_client.chat.completions.create.call_args.kwargs["messages"][1]["content"]
            self.assertIn("Intent:\nrisk", risk_prompt)

    def test_embedding_question_requires_embedding_source_evidence(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            upload = root / "upload.py"
            upload.write_text("def upload_question(file): return file\n", encoding="utf-8")
            result = _analysis_result(root, [upload])
            result["file_summaries"][os.fspath(upload)] = {
                "role": "Upload API",
                "responsibility": "Uploads user questions.",
                "key_dependencies": [],
                "risk_level": "low",
            }

            with patch("backend.llm.wiki_qa.client", _mock_client("unused")) as client:
                answer = ask_wiki("job-1", "Which file embeds questions?", result)

        self.assertEqual("I could not find evidence for this in the repository.", answer)
        client.chat.completions.create.assert_not_called()

    def test_authentication_question_does_not_use_architecture_summary(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            route = root / "api.py"
            route.write_text("def route(): return 'ok'\n", encoding="utf-8")
            result = _analysis_result(root, [route])
            result["wiki"]["architecture"] = {
                "architecture_style": "API Gateway",
                "layers": [{
                    "name": "API Gateway",
                    "responsibility": "Handles authentication at the boundary.",
                    "evidence": ["api.py"],
                }],
                "core_flow": "Requests enter the API gateway.",
            }

            with patch("backend.llm.wiki_qa.client", _mock_client("unused")) as client:
                answer = ask_wiki("job-1", "Where is authentication handled?", result)

        self.assertEqual("I could not find evidence for this in the repository.", answer)
        client.chat.completions.create.assert_not_called()

    def test_chunk_storage_uses_direct_storage_code(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = root / "backend" / "memory" / "vector_store.py"
            source.parent.mkdir(parents=True)
            source.write_text(
                "\n".join([
                    "def store_wiki_chunks(collection, documents, ids, metadatas):",
                    "    collection.add(documents=documents, ids=ids, metadatas=metadatas)",
                ]),
                encoding="utf-8",
            )
            result = _analysis_result(root, [source])

            with patch("backend.llm.wiki_qa.client", _mock_client(
                "## Answer\n\nChunks are stored through collection.add in backend/memory/vector_store.py.\n\n"
                "## Reasoning\n\nThe storage function builds document, id, and metadata payloads and sends them to the collection. That makes the vector store file the component responsible for chunk persistence.\n\n"
                "## Evidence\n\n* backend/memory/vector_store.py"
            )) as client:
                answer = ask_wiki("job-1", "How are chunks stored?", result)

        self.assertIn("collection.add", client.chat.completions.create.call_args.kwargs["messages"][1]["content"])
        self.assertIn("* vector_store.py", answer)

    def test_safe_modify_question_uses_graph_candidates(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            leaf = root / "leaf.py"
            core = root / "core.py"
            leaf.write_text("def leaf(): pass\n", encoding="utf-8")
            core.write_text("def core(): pass\n", encoding="utf-8")
            result = _analysis_result(root, [leaf, core])
            graph = nx.DiGraph()
            graph.add_edge(os.fspath(core), os.fspath(leaf))
            result["dependency_graph"] = graph

            with patch("backend.llm.wiki_qa.client", _mock_client(
                "## Answer\n\ncore.py is the safest module to modify first.\n\n"
                "## Reasoning\n\nIt has no incoming dependents in the dependency graph, so changes do not fan out to callers. That makes it a lower-risk starting point than imported modules.\n\n"
                "## Evidence\n\n* core.py"
            )) as client:
                answer = ask_wiki("job-1", "Which modules are safest to modify?", result)

        prompt = client.chat.completions.create.call_args.kwargs["messages"][1]["content"]
        self.assertIn("safe_modify_candidate=true", prompt)
        self.assertIn("* core.py", answer)

    def test_duplicate_file_names_are_removed_from_final_evidence(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = root / "backend" / "memory" / "vector_store.py"
            source.parent.mkdir(parents=True)
            source.write_text(
                "\n".join([
                    "import chromadb",
                    "client = chromadb.Client()",
                    "collection = client.get_or_create_collection('code_wiki')",
                ]),
                encoding="utf-8",
            )
            result = _analysis_result(root, [source])

            with patch("backend.llm.wiki_qa.client", _mock_client(
                "## Answer\n\nThe project uses ChromaDB.\n\n"
                "## Reasoning\n\nThe same vector-store file imports chromadb and creates the client and collection.\n\n"
                "## Evidence\n\n* backend/memory/vector_store.py\n* vector_store.py\n* D:\\repo\\backend\\memory\\vector_store.py"
            )):
                answer = ask_wiki("job-1", "Which database does the project use?", result)

        self.assertEqual(answer.count("vector_store.py"), 1)
        self.assertNotIn("backend/memory/vector_store.py", answer)

    def test_highest_risk_and_refactor_first_use_different_evidence(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            app = root / "app.py"
            api = root / "api.py"
            core = root / "core.py"
            leaf = root / "leaf.py"
            for file_path in (app, api, core, leaf):
                file_path.write_text("def run(): pass\n", encoding="utf-8")

            result = _analysis_result(root, [app, api, core, leaf])
            graph = nx.DiGraph()
            graph.add_edge(os.fspath(app), os.fspath(core))
            graph.add_edge(os.fspath(api), os.fspath(core))
            graph.add_node(os.fspath(leaf))
            result["dependency_graph"] = graph
            result["hotspots"] = [(os.fspath(core), 2), (os.fspath(app), 0), (os.fspath(api), 0), (os.fspath(leaf), 0)]

            with patch("backend.llm.wiki_qa.client", _mock_client(
                "## Answer\n\ncore.py is the highest-risk module.\n\n"
                "## Reasoning\n\nIt is imported by multiple files and has the highest hotspot score.\n\n"
                "## Evidence\n\n* core.py"
            )) as risk_client:
                risk_answer = ask_wiki("job-1", "Which file has the highest risk?", result)

            risk_prompt = risk_client.chat.completions.create.call_args.kwargs["messages"][1]["content"]
            self.assertIn("Intent:\nrisk", risk_prompt)
            self.assertIn("core.py", risk_prompt)
            self.assertIn("hotspot_score=2", risk_prompt)
            self.assertIn("* core.py", risk_answer)

            with patch("backend.llm.wiki_qa.client", _mock_client(
                "## Answer\n\nleaf.py is the better first refactor candidate.\n\n"
                "## Reasoning\n\nIt has no incoming dependents and a zero impact radius, so changes are isolated compared with the high-centrality core module.\n\n"
                "## Evidence\n\n* leaf.py"
            )) as refactor_client:
                refactor_answer = ask_wiki("job-1", "Which file should be refactored first?", result)

            refactor_prompt = refactor_client.chat.completions.create.call_args.kwargs["messages"][1]["content"]
            self.assertIn("Intent:\nrefactor", refactor_prompt)
            self.assertIn("refactor_candidate=true", refactor_prompt)
            self.assertIn("leaf.py", refactor_prompt)
            self.assertNotIn("hotspot_score=2", refactor_prompt)
            self.assertIn("* leaf.py", refactor_answer)


def _analysis_result(root: Path, files: list[Path]) -> dict:
    graph = nx.DiGraph()
    for file_path in files:
        graph.add_node(os.fspath(file_path))

    return {
        "repo_path": os.fspath(root),
        "source_repo_path": os.fspath(root),
        "python_files": [os.fspath(file_path) for file_path in files],
        "parsed_files": {
            os.fspath(files[0]): {
                "imports": ["chromadb", "groq"],
                "classes": [],
                "functions": ["summarize_file"],
                "calls": [],
            }
        },
        "file_summaries": {
            os.fspath(files[0]): {
                "role": "LLM or vector-store integration",
                "responsibility": "Contains integration code.",
                "key_dependencies": ["chromadb", "groq"],
                "risk_level": "medium",
            }
        },
        "dependency_graph": graph,
        "hotspots": [(os.fspath(files[0]), 0)],
        "wiki": {
            "architecture": {
                "architecture_style": "Single module",
                "layers": [],
                "core_flow": "The file contains integration code.",
            }
        },
    }


def _mock_client(content: str):
    client = MagicMock()
    client.chat.completions.create.return_value = SimpleNamespace(
        choices=[
            SimpleNamespace(
                message=SimpleNamespace(content=content)
            )
        ]
    )
    return client


if __name__ == "__main__":
    unittest.main()
