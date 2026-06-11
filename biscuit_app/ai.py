import os
import anthropic

MODEL = "claude-haiku-4-5-20251001"


def _client():
    return anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])


def get_member_taste_profile(member_name: str, ratings: list) -> dict:
    cats = ['taste', 'texture', 'biscuit', 'meat', 'sides']

    # Find best restaurant per category
    best = {}
    for cat in cats:
        top = max(ratings, key=lambda r: r[cat])
        best[cat] = (top['restaurant'], top[cat])

    best_lines = "\n".join(
        [f"- {cat.capitalize()}: {best[cat][0]} ({best[cat][1]}/5)" for cat in cats]
    )

    lines = [
        f"- {r['restaurant']} ({r['date']}): "
        f"Taste {r['taste']}/5, Texture {r['texture']}/5, Biscuit {r['biscuit']}/5, "
        f"Meat {r['meat']}/5, Sides {r['sides']}/5 → Overall {r['overall']:.1f}/5"
        for r in ratings
    ]

    prompt = (
        f"You're analyzing chicken biscuit ratings from a Memphis men's small group.\n\n"
        f"{member_name}'s ratings across {len(ratings)} visit(s):\n" + "\n".join(lines) + "\n\n"
        f"Best restaurant by category:\n{best_lines}\n\n"
        f"Write exactly two things for {member_name}:\n"
        f"1. TASTE PROFILE (2-3 sentences): What do they value in a chicken biscuit? "
        f"What does their rating pattern reveal about their palate? Be specific and fun.\n"
        f"2. PERFECT BISCUIT (2-3 sentences): Build their dream Memphis chicken biscuit "
        f"by naming the specific restaurant that nailed each element. For example: "
        f"'The meat from Chick-fil-A with the biscuit from Sunrise Memphis...' "
        f"Use the best-by-category data above. Make it sound delicious and specific. "
        f"Only reference restaurants that appear in their actual ratings.\n\n"
        f"Format your response EXACTLY as:\n"
        f"PROFILE: [2-3 sentences]\n"
        f"PERFECT: [2-3 sentences]"
    )
    response = _client().messages.create(
        model=MODEL,
        max_tokens=600,
        messages=[{"role": "user", "content": prompt}],
    )
    text = response.content[0].text.strip()
    profile, perfect = "", ""
    for line in text.split("\n"):
        s = line.strip()
        if s.startswith("PROFILE:"):
            profile = s[8:].strip()
        elif s.startswith("PERFECT:"):
            perfect = s[8:].strip()
    return {"profile": profile or text, "perfect_biscuit": perfect}


def get_group_taste_profile(member_data: list) -> str:
    summaries = []
    for m in member_data:
        r = m["ratings"]
        n = len(r)
        summaries.append(
            f"- {m['name']} ({n} rating{'s' if n != 1 else ''}): "
            f"avg overall {sum(x['overall'] for x in r)/n:.1f}, "
            f"Taste {sum(x['taste'] for x in r)/n:.1f}, "
            f"Texture {sum(x['texture'] for x in r)/n:.1f}, "
            f"Biscuit {sum(x['biscuit'] for x in r)/n:.1f}, "
            f"Meat {sum(x['meat'] for x in r)/n:.1f}, "
            f"Sides {sum(x['sides'] for x in r)/n:.1f}"
        )
    prompt = (
        "You're analyzing a Memphis men's small group's chicken biscuit rating data.\n\n"
        "Member averages:\n" + "\n".join(summaries) + "\n\n"
        "Write a 3-4 sentence group taste profile. What does this crew value as a whole? "
        "Where do they agree? Where do tastes diverge? Who are the tough critics vs the generous raters? "
        "Keep it fun, specific, and conversational — like you know these guys."
    )
    response = _client().messages.create(
        model=MODEL,
        max_tokens=400,
        messages=[{"role": "user", "content": prompt}],
    )
    return response.content[0].text.strip()
