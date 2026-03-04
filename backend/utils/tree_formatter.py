import os


def build_tree_structure(python_files, repo_path):
    tree = {}

    for file_path in python_files:
        relative = os.path.relpath(file_path, repo_path)
        parts = relative.split(os.sep)

        current = tree
        for part in parts[:-1]:
            current = current.setdefault(part, {})

        current.setdefault("__files__", []).append(parts[-1])

    return tree


def print_tree(tree, indent=0):
    for key, value in tree.items():
        if key == "__files__":
            for file in value:
                print("  " * indent + f"📄 {file}")
        else:
            print("  " * indent + f"📂 {key}")
            print_tree(value, indent + 1)