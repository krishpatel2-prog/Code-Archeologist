import os
from groq import Groq
from backend.memory.vector_store import query_wiki

client = Groq(api_key=os.getenv("GROQ_API_KEY"))


def ask_wiki(question: str):
    retrieved_chunks = query_wiki(question)

    context = "\n\n".join(retrieved_chunks)

    prompt = f"""
You are answering questions about a Python backend system.

Use ONLY the provided context.
Do NOT invent modules or architecture details.

Context:
{context}

Question:
{question}

Provide a precise and grounded answer.
Include:
- The file name
- Its architectural role
- A short explanation of why it handles this responsibility.
Keep it concise.
"""

    response = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        temperature=0.2,
        messages=[
            {"role": "user", "content": prompt}
        ],
    )

    return response.choices[0].message.content