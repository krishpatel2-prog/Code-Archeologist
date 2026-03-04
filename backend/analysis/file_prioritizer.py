import os


ENTRYPOINT_NAMES = {"main.py", "app.py", "cli.py", "server.py"}


def detect_entrypoints(project_files):

    entrypoints = []

    for file in project_files:
        if os.path.basename(file) in ENTRYPOINT_NAMES:
            entrypoints.append(file)

    return entrypoints


def build_priority_queue(graph):

    # in-degree ranking
    ranked = sorted(graph.in_degree, key=lambda x: x[1], reverse=True)

    ranked_files = [node for node, _ in ranked]

    entrypoints = detect_entrypoints(ranked_files)

    # entrypoints first, then rest
    priority_queue = entrypoints + [
        f for f in ranked_files if f not in entrypoints
    ]

    return priority_queue