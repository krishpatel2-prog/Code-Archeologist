import networkx as nx
import os


def build_dependency_graph(parsed_data, repo_path):
    G = nx.DiGraph()

    # All project files (absolute paths)
    project_files = set(parsed_data.keys())

    for file_path, data in parsed_data.items():
        G.add_node(file_path)

        for imp in data["imports"]:
            # convert module → possible file path
            module_path = os.path.join(
                repo_path,
                imp.replace(".", os.sep) + ".py"
            )

            module_path = os.path.normpath(module_path)

            # only connect if that file exists in our parsed set
            if module_path in project_files:
                G.add_edge(file_path, module_path)

    return G


def analyze_graph(G):
    hotspots = sorted(G.in_degree, key=lambda x: x[1], reverse=True)

    leaf_nodes = [n for n in G.nodes if G.out_degree(n) == 0]

    cycles = list(nx.simple_cycles(G))

    return hotspots, leaf_nodes, cycles