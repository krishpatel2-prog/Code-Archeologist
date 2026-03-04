from langgraph.graph import StateGraph, START, END
from backend.core.state import ArcheologistState
from backend.ingestion.file_scanner import scan_repo
from backend.analysis.ast_parser import parse_file
from backend.analysis.dependency_graph import (
    build_dependency_graph,
    analyze_graph,
)
from backend.llm.summarizer import summarize_file
from backend.llm.architecture import detect_architecture
from backend.analysis.impact import analyze_impact
from backend.core.wiki_builder import build_wiki
from backend.memory.vector_store import store_wiki_chunks

# ----------------------------
# NODE 1: Initialize
# ----------------------------
def initialize(state: ArcheologistState) -> ArcheologistState:
    file_tree, python_files = scan_repo(state["repo_path"])

    state["file_summaries"] = {}
    state["file_tree"] = file_tree
    state["python_files"] = python_files

    # Use ABSOLUTE paths everywhere
    state["priority_queue"] = python_files.copy()
    state["parsed_files"] = {}

    state["dependency_graph"] = None
    state["hotspots"] = []
    state["leaf_nodes"] = []
    state["cycles"] = []

    return state


# ----------------------------
# NODE 2: Parse Next File
# ----------------------------
def parse_next_file(state: ArcheologistState) -> ArcheologistState:
    if not state["priority_queue"]:
        return state

    next_file = state["priority_queue"].pop(0)

    parsed = parse_file(next_file)

    state["parsed_files"][next_file] = parsed

    return state


# ----------------------------
# NODE 3: Update Graph + Metrics
# ----------------------------
def update_graph(state: ArcheologistState) -> ArcheologistState:
    if not state["parsed_files"]:
        return state

    graph = build_dependency_graph(
        state["parsed_files"],
        state["repo_path"],
    )

    state["dependency_graph"] = graph

    hotspots, leaf_nodes, cycles = analyze_graph(graph)

    state["hotspots"] = hotspots
    state["leaf_nodes"] = leaf_nodes
    state["cycles"] = cycles

    # Remaining files = those not yet parsed
    state["priority_queue"] = [
        f for f in state["python_files"]
        if f not in state["parsed_files"]
    ]

    return state


# ----------------------------
# CONDITIONAL ROUTING
# ----------------------------
def should_continue(state: ArcheologistState) -> str:
    return "continue" if state["priority_queue"] else "stop"


def summarize_current_file(state: ArcheologistState) -> ArcheologistState:
    if not state["parsed_files"]:
        return state

    last_file = list(state["parsed_files"].keys())[-1]
    parsed_data = state["parsed_files"][last_file]

    summary = summarize_file(last_file, parsed_data)

    state["file_summaries"][last_file] = summary

    return state

def analyze_architecture(state: ArcheologistState) -> ArcheologistState:
    architecture = detect_architecture(
        state["file_summaries"],
        state["hotspots"],
        state["leaf_nodes"],
        state["cycles"],
        len(state["python_files"])
    )
    state["architecture_summary"] = architecture
    return state

def run_impact_analysis(state: ArcheologistState) -> ArcheologistState:
    target = state.get("impact_target")

    if not target:
        return state

    result = analyze_impact(
        target,
        state["dependency_graph"]
    )

    state["impact_result"] = result

    return state

def generate_wiki(state):
    wiki = build_wiki(state)
    state["wiki"] = wiki

    # Store in vector DB
    store_wiki_chunks(
        job_id="default",   # for now static
        wiki=wiki
    )

    return state

# ----------------------------
# BUILD GRAPH
# ----------------------------
builder = StateGraph(ArcheologistState)

builder.add_node("initialize", initialize)
builder.add_node("parse_next_file", parse_next_file)
builder.add_node("update_graph", update_graph)
builder.add_node("summarize_file", summarize_current_file)
builder.add_node("detect_architecture", analyze_architecture)
builder.add_node("generate_wiki", generate_wiki)

builder.add_edge(START, "initialize")
builder.add_edge("initialize", "parse_next_file")
builder.add_edge("parse_next_file", "summarize_file")
builder.add_edge("summarize_file", "update_graph")
builder.add_edge("detect_architecture", "generate_wiki")
builder.add_edge("generate_wiki", END)
builder.add_conditional_edges(
    "update_graph",
    should_continue,
    {
        "continue": "parse_next_file",
        "stop":"detect_architecture",
    },
)

graph = builder.compile()