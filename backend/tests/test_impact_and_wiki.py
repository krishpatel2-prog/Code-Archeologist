import unittest

import networkx as nx

from backend.analysis.impact import analyze_impact
from backend.core.wiki_builder import build_wiki


class ImpactAndWikiTests(unittest.TestCase):
    def test_impact_reports_direct_and_indirect_dependents(self):
        graph = nx.DiGraph()
        graph.add_edge("api.py", "service.py")
        graph.add_edge("worker.py", "api.py")
        graph.add_edge("cli.py", "service.py")

        result = analyze_impact("service.py", graph)

        self.assertEqual(["api.py", "cli.py"], result["direct_dependents"])
        self.assertEqual(["worker.py"], result["indirect_dependents"])
        self.assertEqual(3, result["total_impact_radius"])

    def test_wiki_dependency_count_comes_from_graph_edges(self):
        graph = nx.DiGraph()
        graph.add_edge("api.py", "service.py")
        state = {
            "architecture_summary": {
                "architecture_style": "Layered Monolith",
                "core_flow": "Requests flow from api.py to service.py.",
            },
            "dependency_graph": graph,
            "file_summaries": {
                "api.py": {
                    "role": "API",
                    "responsibility": "Handles inbound requests.",
                    "risk_level": "medium",
                    "key_dependencies": ["service.py"],
                },
                "service.py": {
                    "role": "Service",
                    "responsibility": "Runs business logic.",
                    "risk_level": "low",
                    "key_dependencies": [],
                },
            },
            "parsed_files": {
                "api.py": {"functions": ["route"], "imports": ["service"]},
                "service.py": {"functions": ["run"], "imports": []},
            },
            "hotspots": [("service.py", 1), ("api.py", 0)],
            "leaf_nodes": ["service.py"],
            "cycles": [],
        }

        wiki = build_wiki(state)
        modules = {module["file"]: module for module in wiki["modules"]}

        self.assertEqual(1, modules["api.py"]["metrics"]["dependency_count"])
        self.assertEqual(0, modules["service.py"]["metrics"]["dependency_count"])
        self.assertEqual("API", modules["api.py"]["role"])
        self.assertEqual("Handles inbound requests.", modules["api.py"]["responsibility"])


if __name__ == "__main__":
    unittest.main()
