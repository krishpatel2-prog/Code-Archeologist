import os

from backend.ingestion.repo_loader import load_repo
from backend.core.langgraph_flow import graph
from backend.utils.tree_formatter import build_tree_structure, print_tree

from backend.analysis.impact import analyze_impact
from backend.analysis.risk_engine import compute_structural_risk
from backend.llm.impact_explainer import generate_impact_explanation
from backend.core.wiki_builder import build_wiki
from backend.llm.wiki_qa import ask_wiki


# --------------------------------------------------
# CONFIG
# --------------------------------------------------

REPO_INPUT = r"D:\Python-Project\ReviewPilot"
TARGET_RELATIVE_PATH = r"app\github\pr_service.py"


# --------------------------------------------------
# RUN FULL ANALYSIS PIPELINE
# --------------------------------------------------

repo_path = load_repo(REPO_INPUT)

result = graph.invoke({
    "repo_path": repo_path
})


# --------------------------------------------------
# PRINT ARCHITECTURE SUMMARY
# --------------------------------------------------

# print("\n🏗 ARCHITECTURE SUMMARY:\n")
#
# for key, value in result["architecture_summary"].items():
#     print(f"{key}: {value}")


# --------------------------------------------------
# PRINT FILE TREE
# --------------------------------------------------

tree = build_tree_structure(
    result["python_files"],
    repo_path
)

# print("\n🌳 FILE TREE:\n")
# print_tree(tree)


# --------------------------------------------------
# IMPACT ANALYSIS
# --------------------------------------------------

# Resolve exact node from graph
target = next(
    f for f in result["dependency_graph"].nodes
    if f.endswith(TARGET_RELATIVE_PATH)
)

impact = analyze_impact(
    target,
    result["dependency_graph"]
)

risk = compute_structural_risk(
    target,
    impact,
    result["hotspots"]
)

# print("\n💥 IMPACT ANALYSIS:\n")
# print(impact)
#
# print("\n⚠ STRUCTURAL RISK:\n")
# print(risk)


# --------------------------------------------------
# LLM IMPACT EXPLANATION
# --------------------------------------------------
def to_relative(path):
    return os.path.relpath(path, repo_path)
impact["direct_dependents"] = [
    to_relative(f) for f in impact["direct_dependents"]
]

impact["indirect_dependents"] = [
    to_relative(f) for f in impact["indirect_dependents"]
]

target_rel = to_relative(target)
file_summary = result["file_summaries"][target]
architecture_summary = result["architecture_summary"]

explanation = generate_impact_explanation(
    target,
    impact,
    risk,
    file_summary,
    architecture_summary
)

# print("\n🧠 IMPACT EXPLANATION:\n")
# print(explanation)

#------wiki------------

# print("\n📘 GENERATED ARCHITECTURE WIKI:\n")
# print(result["wiki"])

#---------q&a-------------
print("\n🧠 Q&A TEST:\n")

answer = ask_wiki("Where is GitHub pull request logic handled?")
print(answer)