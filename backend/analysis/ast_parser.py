import ast
from typing import Dict, Any


class CodeVisitor(ast.NodeVisitor):

    def __init__(self):
        self.imports = []
        self.import_details = []
        self.classes = []
        self.functions = []
        self.calls = []

    def visit_Import(self, node):
        for alias in node.names:
            self.imports.append(alias.name)
            self.import_details.append({
                "module": alias.name,
                "level": 0,
                "names": [],
            })

    def visit_ImportFrom(self, node):
        module = node.module or ""
        names = [alias.name for alias in node.names]
        display = "." * node.level + module
        if names:
            display = f"{display} import {', '.join(names)}"
        self.imports.append(display)
        self.import_details.append({
            "module": module,
            "level": node.level,
            "names": names,
        })

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

    try:
        with open(file_path, "r", encoding="utf-8") as f:
            source = f.read()
        tree = ast.parse(source)
    except (OSError, SyntaxError, UnicodeDecodeError) as exc:
        return {
            "imports": [],
            "import_details": [],
            "classes": [],
            "functions": [],
            "calls": [],
            "parse_error": str(exc),
        }

    visitor = CodeVisitor()
    visitor.visit(tree)

    return {
        "imports": visitor.imports,
        "import_details": visitor.import_details,
        "classes": visitor.classes,
        "functions": visitor.functions,
        "calls": visitor.calls,
    }
