def _safe_line_count(file_path: str) -> int:
    try:
        with open(file_path, "r", encoding="utf-8") as handle:
            return sum(1 for _ in handle)
    except Exception:
        return 0


def build_wiki(state):
    architecture = state["architecture_summary"]
    graph = state["dependency_graph"]

    modules = []

    for file, summary in state["file_summaries"].items():
        parsed = state["parsed_files"].get(file, {})
        function_count = len(parsed.get("functions", []))
        import_count = len(parsed.get("imports", []))
        dependency_count = graph.out_degree(file) if graph is not None and file in graph else 0
        key_dependencies = summary.get("key_dependencies", [])

        modules.append({
            "file": file,
            "role": summary.get("role"),
            "responsibility": summary.get("responsibility"),
            "risk_level": summary.get("risk_level"),
            "key_dependencies": key_dependencies,
            "metrics": {
                "lines_of_code": _safe_line_count(file),
                "function_count": function_count,
                "import_count": import_count,
                "dependency_count": dependency_count,
            }
        })

    hotspots = [
        {"file": f, "score": score}
        for f, score in state["hotspots"]
    ]

    dead_code = state["leaf_nodes"]

    # Simple heuristic:
    # Files with no incoming edges = refactor safer
    refactor_safe = [
        node for node in graph.nodes
        if graph.in_degree(node) == 0
    ]

    graph_metrics = {
        "nodes": len(graph.nodes),
        "edges": len(graph.edges),
    }

    return {
        "architecture": architecture,
        "modules": modules,
        "main_flow": architecture.get("core_flow"),
        "hotspots": hotspots,
        "dead_code_candidates": dead_code,
        "refactor_safe_zones": refactor_safe,
        "graph_metrics": graph_metrics,
    }
