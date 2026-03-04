import os
from groq import Groq

client = Groq(api_key=os.getenv("GROQ_API_KEY"))


def generate_impact_explanation(
    target,
    impact,
    risk,
    file_summary,
    architecture_summary
):
    prompt = f"""
You are generating a structured engineering impact report.

Target file:
{target}

Structural impact:
- Direct dependents: {impact["direct_dependents"]}
- Indirect dependents: {impact["indirect_dependents"]}
- Impact radius: {impact["total_impact_radius"]}

Structural risk classification:
- Risk level: {risk["risk_level"]}
- Signals: {risk["signals"]}

File role summary:
{file_summary}

System architecture:
{architecture_summary}

Instructions:
1. Do NOT change the risk level.
2. Do NOT invent dependencies.
3. Produce a structured, pointwise impact report.
4. Use clear technical bullet points.
5. Keep it concise but informative.

Format strictly as:

📌 Target:
⚠ Risk Level:
📊 Structural Signals:
🔗 Directly Affected:
🔁 Indirectly Affected:
🧠 Technical Reasoning:
"""

    response = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        temperature=0.2,
        messages=[
            {"role": "user", "content": prompt}
        ],
    )

    return response.choices[0].message.content