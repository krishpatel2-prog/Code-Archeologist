from typing import TypedDict, NotRequired, Any

class ArcheologistState(TypedDict):
    repo_path: str

    file_tree: dict
    python_files: list
    priority_queue: list

    parsed_files: dict
    dependency_graph: Any

    file_summaries: dict
    architecture_summary: dict

    hotspots: list
    leaf_nodes: list
    cycles: list

    wiki: NotRequired[dict]
    impact_result: NotRequired[dict]