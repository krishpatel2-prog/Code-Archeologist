from backend.ingestion.file_scanner import scan_repo
from backend.analysis.ast_parser import parse_file
from backend.analysis.dependency_graph import build_dependency_graph, analyze_graph
import os
from backend.analysis.file_prioritizer import build_priority_queue



def run_analysis(repo_path: str):

    file_tree, python_files = scan_repo(repo_path)


    parsed_data = {}

    for file in python_files:
        parsed_data[file] = parse_file(file)

    graph = build_dependency_graph(parsed_data, repo_path)

    hotspots, leaf_nodes, cycles = analyze_graph(graph)

    priority_queue = build_priority_queue(graph)

    return file_tree, python_files, parsed_data, hotspots, leaf_nodes, cycles, priority_queue