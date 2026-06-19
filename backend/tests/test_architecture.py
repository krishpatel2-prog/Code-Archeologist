import unittest
from unittest.mock import patch

from backend.llm.architecture import detect_architecture


class ArchitectureDetectionTests(unittest.TestCase):
    def test_detect_architecture_preserves_repository_specific_layers(self):
        response_json = """
        {
          "architecture_style": "API and analysis pipeline",
          "layers": [
            {
              "name": "API Routing",
              "responsibility": "Exposes FastAPI endpoints.",
              "evidence": ["backend/api/routes.py"]
            },
            {
              "name": "AST and Graph Analysis",
              "responsibility": "Parses files and builds dependency graph.",
              "evidence": ["backend/analysis/ast_parser.py", "backend/analysis/dependency_graph.py"]
            }
          ],
          "core_flow": "Routes start jobs, LangGraph parses files, analysis builds wiki.",
          "observations": ["Hotspots are in graph analysis modules."]
        }
        """

        with patch("backend.llm.architecture.client") as client:
            client.chat.completions.create.return_value.choices[0].message.content = response_json

            result = detect_architecture(
                file_summaries={
                    "backend/api/routes.py": {
                        "role": "API Routing",
                        "responsibility": "Exposes FastAPI endpoints.",
                        "key_dependencies": ["backend.services.job_manager"],
                        "risk_level": "medium",
                    },
                    "backend/analysis/dependency_graph.py": {
                        "role": "Graph Analysis",
                        "responsibility": "Builds dependency graph.",
                        "key_dependencies": ["networkx"],
                        "risk_level": "high",
                    },
                },
                hotspots=[("backend/analysis/dependency_graph.py", 2)],
                leaf_nodes=[],
                cycles=[],
                total_files=2,
            )

        self.assertEqual("API and analysis pipeline", result["architecture_style"])
        self.assertEqual("API Routing", result["layers"][0]["name"])
        self.assertEqual(["backend/api/routes.py"], result["layers"][0]["evidence"])


if __name__ == "__main__":
    unittest.main()
