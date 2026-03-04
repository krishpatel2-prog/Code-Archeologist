import ast
from typing import Dict, Any


class CodeVisitor(ast.NodeVisitor):

    def __init__(self):
        self.imports = []
        self.classes = []
        self.functions = []
        self.calls = []

    def visit_Import(self, node):
        for alias in node.names:
            self.imports.append(alias.name)

    def visit_ImportFrom(self, node):
        self.imports.append(node.module)

    def visit_ClassDef(self, node):
        self.classes.append(node.name)
        self.generic_visit(node)

    def visit_FunctionDef(self, node):
        self.functions.append(node.name)
        self.generic_visit(node)

    def visit_Call(self, node):
        if isinstance(node.func, ast.Name):
            self.calls.append(node.func.id)
        self.generic_visit(node)


def parse_file(file_path: str) -> Dict[str, Any]:

    with open(file_path, "r", encoding="utf-8") as f:
        tree = ast.parse(f.read())

    visitor = CodeVisitor()
    visitor.visit(tree)

    return {
        "imports": visitor.imports,
        "classes": visitor.classes,
        "functions": visitor.functions,
        "calls": visitor.calls,
    }