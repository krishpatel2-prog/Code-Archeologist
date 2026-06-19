from collections import defaultdict
import os

import networkx as nx


def _normalize(path: str) -> str:
    return os.path.normcase(os.path.normpath(os.path.abspath(path)))


def _module_names_for_path(file_path: str, repo_path: str) -> list[str]:
    relative = os.path.relpath(file_path, repo_path)
    without_ext = os.path.splitext(relative)[0]
    parts = [part for part in without_ext.replace(os.sep, "/").split("/") if part]

    if parts and parts[-1] == "__init__":
        parts = parts[:-1]

    names = []
    for start in range(len(parts)):
        dotted = ".".join(parts[start:])
        if dotted:
            names.append(dotted)
    return names


def _build_module_index(project_files: set[str], repo_path: str) -> dict[str, list[str]]:
    index = defaultdict(list)
    for file_path in project_files:
        for module_name in _module_names_for_path(file_path, repo_path):
            index[module_name].append(file_path)
    return dict(index)


def _lookup_module(module_name: str, module_index: dict[str, list[str]]) -> str | None:
    matches = module_index.get(module_name, [])
    return matches[0] if len(matches) == 1 else None


def _containing_package(file_path: str, repo_path: str) -> list[str]:
    relative = os.path.relpath(file_path, repo_path)
    without_ext = os.path.splitext(relative)[0]
    parts = [part for part in without_ext.replace(os.sep, "/").split("/") if part]
    if parts and parts[-1] == "__init__":
        return parts
    return parts[:-1]


def _resolve_import_targets(
    importer: str,
    import_entry,
    repo_path: str,
    module_index: dict[str, list[str]],
) -> set[str]:
    if isinstance(import_entry, str):
        import_entry = {"module": import_entry, "level": 0, "names": []}

    module = (import_entry.get("module") or "").strip(".")
    level = int(import_entry.get("level") or 0)
    names = import_entry.get("names") or []

    if level > 0:
        package = _containing_package(importer, repo_path)
        base_length = max(0, len(package) - level + 1)
        base_parts = package[:base_length]
        if module:
            base_parts.extend(module.split("."))
        candidates = [".".join(base_parts)] if base_parts else []
    else:
        candidates = [module] if module else []

    targets = set()
    if names and all(name != "*" for name in names):
        expanded_candidates = [
            f"{candidate}.{name}" for candidate in candidates for name in names
        ]
        for candidate in expanded_candidates:
            target = _lookup_module(candidate, module_index)
            if target and target != importer:
                targets.add(target)
        if targets:
            return targets

    for candidate in candidates:
        target = _lookup_module(candidate, module_index)
        if target and target != importer:
            targets.add(target)

    return targets


def build_dependency_graph(parsed_data, repo_path):
    graph = nx.DiGraph()
    project_files = {_normalize(path) for path in parsed_data.keys()}
    normalized_data = {
        _normalize(path): data for path, data in parsed_data.items()
    }
    normalized_repo_path = _normalize(repo_path)
    module_index = _build_module_index(project_files, normalized_repo_path)

    for file_path, data in normalized_data.items():
        graph.add_node(file_path)

        import_entries = data.get("import_details") or data.get("imports", [])
        for import_entry in import_entries:
            for target in _resolve_import_targets(
                file_path,
                import_entry,
                normalized_repo_path,
                module_index,
            ):
                graph.add_edge(file_path, target)

    return graph


def analyze_graph(graph):
    hotspots = sorted(graph.in_degree, key=lambda item: (-item[1], item[0]))
    leaf_nodes = sorted(node for node in graph.nodes if graph.out_degree(node) == 0)
    cycles = list(nx.simple_cycles(graph))

    return hotspots, leaf_nodes, cycles
