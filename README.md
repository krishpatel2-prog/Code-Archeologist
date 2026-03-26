# 🧠 AI Code Archeologist

### Understand any codebase in minutes.

AI Code Archeologist is an **architecture intelligence tool** that analyzes software repositories and automatically uncovers system structure, module dependencies, risk hotspots, and safe refactoring zones.

Instead of manually exploring thousands of files, the system converts raw source code into **structured architectural intelligence**.

It combines **static analysis, dependency graphs, and LLM reasoning** to help developers quickly understand unfamiliar codebases.

⚠️ Currently supports Python repositories only.

<video src="new.mp4" controls width="700"></video>

Live Demo: [https://code-archeologist-frontend.onrender.com](https://code-archeologist-frontend.onrender.com)
---

# ✨ What This Tool Does

AI Code Archeologist helps engineers answer questions like:

* 🔍 *How is this project structured?*
* ⚠️ *Which modules are risky to change?*
* 🔗 *What files depend on this module?*
* 🧱 *What architecture pattern does this project follow?*
* 🛠 *Which parts are safe to refactor?*

---

# 🚀 Core Features

## 📂 Repository Analysis

Analyze both **local repositories** and **GitHub repositories**.

Supported inputs:

```text
D:\projects\my_repo
https://github.com/user/repository
```

If a GitHub URL is provided, the system automatically clones and analyzes it.

---

## 🌳 File Structure Explorer

Navigate the repository using an interactive project tree.

Features include:

* Collapsible folder hierarchy
* File summaries
* Module responsibilities
* Risk indicators per file

This allows developers to quickly explore the structure of large repositories.

---

## 🏗 Architecture Detection

The system automatically detects **high-level architectural patterns**.

Examples:

* Layered Monolith
* Modular Systems
* Service-oriented architectures

Detected architectural layers may include:

* Presentation Layer
* Business Logic Layer
* Domain Model Layer
* Data Access Layer
* Infrastructure Layer

---

## 🔗 Dependency Graph Analysis

Using Python's AST parser, the system builds a **dependency graph** of the codebase.

This graph reveals:

* Module relationships
* Dependency chains
* System coupling patterns
* Architectural bottlenecks

---

## ⚠️ Risk & Hotspot Detection

Identify modules that represent **architectural risk**.

Hotspots are detected using metrics such as:

* Dependency centrality
* Coupling levels
* Impact radius

This helps developers locate areas where changes may cause cascading issues.

---

## 💥 Impact Analysis

Predict the **blast radius of code changes**.

For any file, the system displays:

* Direct dependents
* Indirect dependents
* Total impact radius
* Structural risk signals

This helps developers understand how modifications propagate through the system.

---

## 🛡 Refactor Safe Zones

Highlights modules with **low coupling and minimal dependencies**.

These areas are safer to refactor without affecting other components.

---

## 📘 Architecture Intelligence Wiki

The system generates a structured **architecture wiki** describing the repository.

The wiki includes:

* Architecture overview
* Module responsibilities
* Architectural observations
* Risk hotspots
* Refactor candidates

---

## 🤖 Architecture-Aware Q&A

Ask questions about the project using the generated architecture intelligence.

Example questions:

* Where is the core orchestration implemented?
* Which modules interact with the API layer?
* What files should be refactored first?
* Which components are most critical?

Responses are generated using contextual data extracted from the repository.

---

# 🧩 System Architecture

The project consists of three main components.

## 🔍 Static Analysis Engine

Responsible for parsing code and extracting structural data.

Processes include:

* Repository scanning
* AST parsing
* Dependency graph construction
* Structural metric analysis

---

## 🧠 Architecture Intelligence Layer

Transforms raw analysis data into architectural insights.

Generates:

* Architecture summaries
* Hotspot detection
* Impact predictions
* Refactor recommendations

---

## 🖥 Intelligence Interface

A modern UI dashboard used to explore repository intelligence.

Includes:

* File structure explorer
* Architecture visualization
* Hotspot analysis
* Impact analysis
* Architecture Q&A assistant

---

# 🧰 Technology Stack

## Backend

* 🐍 Python
* ⚡ FastAPI
* 🧠 LangGraph
* 🌳 AST Parsing
* 🔗 Graph-based dependency analysis
* 🤖 Groq LLM API

---

## Frontend

* ⚛️ React
* 📘 TypeScript
* 🎨 Modern dashboard UI
* 🌳 Interactive repository explorer
* 📊 Architecture visualization

---

# ⚙️ Analysis Pipeline

When a repository is analyzed, the system performs the following steps:

```text
Repository Input
      ↓
Repository Scanning
      ↓
Python File Extraction
      ↓
AST Parsing
      ↓
Dependency Graph Construction
      ↓
Graph Analysis (hotspots, cycles, leaf nodes)
      ↓
Architecture Detection
      ↓
Impact Analysis Engine
      ↓
Architecture Wiki Generation
      ↓
Interactive Intelligence Dashboard
```

---

# 📁 Project Structure

```
backend
│
├── analysis
│   ├── ast_parser.py
│   ├── dependency_graph.py
│   ├── file_prioritizer.py
│   ├── impact.py
│   └── risk_engine.py
│
├── core
│   ├── langgraph_flow.py
│   ├── state.py
│   └── wiki_builder.py
│
├── ingestion
│   ├── file_scanner.py
│   ├── repo_loader.py
│   └── github_loader.py
│
├── llm
│   ├── architecture.py
│   ├── summarizer.py
│   └── impact_explainer.py
│
└── api
    └── routes.py


frontend
│
├── components
├── pages
├── services
└── ui
```

---

# ⚙️ Installation

## 1️⃣ Clone the Repository

```bash
git clone https://github.com/yourusername/ai-code-archeologist
cd ai-code-archeologist
```

---

## 2️⃣ Backend Setup

```bash
cd backend
pip install -r requirements.txt
```

Create `.env` file:

```
GROQ_API_KEY=your_key_here
```

Run backend:

```bash
uvicorn main:app --reload
```

---

## 3️⃣ Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

---

# 🧪 Example Usage

Analyze a local repository:

```
D:\projects\my_repo
```

Analyze a GitHub repository:

```
https://github.com/langchain-ai/langgraph
```

The system will:

1. Clone the repository (if GitHub URL)
2. Scan source files
3. Build dependency graph
4. Detect architecture
5. Generate architecture wiki
6. Display analysis dashboard

---

# 📈 Future Improvements

Planned enhancements include:

* 🌐 Multi-language support (Java, Go, TypeScript)
* 📊 Interactive dependency graph visualization
* 🔍 Architectural drift detection
* 🧪 Pull request impact prediction
* 📉 Code complexity metrics
* 📚 Exportable architecture documentation

---

# 🎯 Motivation

Understanding unfamiliar codebases is one of the most difficult tasks engineers face.

AI Code Archeologist was created to transform **raw source code into structured architectural knowledge**, enabling developers to quickly understand:

* System structure
* Dependency relationships
* Architectural risks
* Safe modification zones

---

# 📜 License

MIT License
