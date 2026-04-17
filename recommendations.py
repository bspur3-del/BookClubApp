import os
import anthropic

_client = None


def _get_client():
    global _client
    if _client is None:
        _client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))
    return _client


def get_group_recommendation(history: list[dict]) -> str:
    """Generate a book recommendation for the group based on their rated history."""
    if not history:
        return "No rating history available yet."

    history_text = "\n".join(
        f'- "{h["title"]}" by {h["author"]}: avg {h["average_rating"]}/5'
        f'{" (Book Club Approved)" if h["approved"] else ""}'
        for h in history
    )

    message = _get_client().messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=400,
        messages=[
            {
                "role": "user",
                "content": (
                    "You are a book recommendation assistant for a book club that uses the Gonder Scale "
                    "(1–5, no decimals). A book is 'Book Club Approved' if its average rating is 3.67 or higher.\n\n"
                    "Based on the following rated books:\n"
                    f"{history_text}\n\n"
                    "Recommend 2–3 books the group should read next, explaining briefly why each fits their taste. "
                    "Be specific about titles and authors. Keep the response concise (under 150 words)."
                ),
            }
        ],
    )
    return message.content[0].text


def get_member_recommendation(member_name: str, history: list[dict]) -> str:
    """Generate personalised book recommendations for one member."""
    if not history:
        return "No ratings yet."

    history_text = "\n".join(
        f'- "{h["title"]}" by {h["author"]}: {h["rating"]}/5'
        for h in history
    )

    message = _get_client().messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=400,
        messages=[
            {
                "role": "user",
                "content": (
                    f"You are a book recommendation assistant. {member_name} rates books on the Gonder Scale (1–5, no decimals).\n\n"
                    f"Here are {member_name}'s ratings so far:\n"
                    f"{history_text}\n\n"
                    f"Based on their taste, recommend 2–3 books {member_name} would personally enjoy, "
                    "explaining briefly why each suits their preferences. "
                    "Be specific about titles and authors. Keep the response concise (under 150 words)."
                ),
            }
        ],
    )
    return message.content[0].text
