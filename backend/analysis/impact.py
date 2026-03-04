import networkx as nx


def analyze_impact(target_file: str, graph: nx.DiGraph):
    if target_file not in graph:
        return {
            "error": "File not found in dependency graph"
        }

    # Direct dependents (who imports this file)
    direct_dependents = list(graph.predecessors(target_file))

    # Indirect dependents (transitive closure)
    indirect_dependents = list(nx.ancestors(graph, target_file))

    # Remove direct ones from indirect list
    indirect_only = [
        f for f in indirect_dependents
        if f not in direct_dependents
    ]

    return {
        "direct_dependents": direct_dependents,
        "indirect_dependents": indirect_only,
        "total_impact_radius": len(indirect_dependents)
    }