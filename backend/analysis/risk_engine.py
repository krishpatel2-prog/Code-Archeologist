
def compute_structural_risk(target, impact, hotspots):
    score = 0
    reasoning = []

    # Signal 1: Impact radius
    if impact["total_impact_radius"] >= 3:
        score += 2
        reasoning.append("Large impact radius")

    elif impact["total_impact_radius"] >= 1:
        score += 1
        reasoning.append("Moderate impact radius")

    # Signal 2: Hotspot position
    hotspot_files = [f for f, _ in hotspots[:3]]

    if target in hotspot_files:
        score += 2
        reasoning.append("High centrality hotspot")

    # Final classification
    if score >= 3:
        risk = "high"
    elif score == 2:
        risk = "medium"
    else:
        risk = "low"

    return {
        "risk_level": risk,
        "score": score,
        "signals": reasoning
    }