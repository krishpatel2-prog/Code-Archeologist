import os
import tempfile
import unittest
from pathlib import Path

from backend.analysis.ast_parser import parse_file
from backend.analysis.dependency_graph import build_dependency_graph


class DependencyGraphTests(unittest.TestCase):
    def test_parse_file_reports_syntax_errors_without_raising(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            broken = Path(temp_dir) / "broken.py"
            broken.write_text("def broken(:\n", encoding="utf-8")

            parsed = parse_file(os.fspath(broken))

            self.assertEqual([], parsed["imports"])
            self.assertIn("parse_error", parsed)

    def test_resolves_relative_package_and_nested_imports(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            (root / "pkg" / "sub").mkdir(parents=True)
            (root / "pkg" / "__init__.py").write_text("", encoding="utf-8")
            (root / "pkg" / "a.py").write_text(
                "\n".join([
                    "from . import b",
                    "from pkg import c",
                    "from pkg.sub import d",
                    "import os",
                ]),
                encoding="utf-8",
            )
            (root / "pkg" / "b.py").write_text("VALUE = 1\n", encoding="utf-8")
            (root / "pkg" / "c.py").write_text("VALUE = 2\n", encoding="utf-8")
            (root / "pkg" / "sub" / "d.py").write_text("VALUE = 3\n", encoding="utf-8")

            files = [
                os.fspath(root / "pkg" / "__init__.py"),
                os.fspath(root / "pkg" / "a.py"),
                os.fspath(root / "pkg" / "b.py"),
                os.fspath(root / "pkg" / "c.py"),
                os.fspath(root / "pkg" / "sub" / "d.py"),
            ]
            parsed = {file_path: parse_file(file_path) for file_path in files}

            graph = build_dependency_graph(parsed, os.fspath(root))
            importer = os.path.normcase(os.path.abspath(root / "pkg" / "a.py"))
            expected_targets = {
                os.path.normcase(os.path.abspath(root / "pkg" / "b.py")),
                os.path.normcase(os.path.abspath(root / "pkg" / "c.py")),
                os.path.normcase(os.path.abspath(root / "pkg" / "sub" / "d.py")),
            }

            self.assertEqual(expected_targets, set(graph.successors(importer)))

    def test_supports_src_layout_absolute_imports(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            (root / "src" / "app").mkdir(parents=True)
            (root / "src" / "app" / "__init__.py").write_text("", encoding="utf-8")
            (root / "src" / "app" / "main.py").write_text(
                "from app import services\n",
                encoding="utf-8",
            )
            (root / "src" / "app" / "services.py").write_text("def run(): pass\n", encoding="utf-8")

            files = [
                os.fspath(root / "src" / "app" / "__init__.py"),
                os.fspath(root / "src" / "app" / "main.py"),
                os.fspath(root / "src" / "app" / "services.py"),
            ]
            parsed = {file_path: parse_file(file_path) for file_path in files}

            graph = build_dependency_graph(parsed, os.fspath(root))
            importer = os.path.normcase(os.path.abspath(root / "src" / "app" / "main.py"))
            target = os.path.normcase(os.path.abspath(root / "src" / "app" / "services.py"))

            self.assertIn(target, set(graph.successors(importer)))


if __name__ == "__main__":
    unittest.main()
