import os
import anthropic

_client = None


def _get_client():
    global _client
    if _client is None:
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY environment variable is not set")
        _client = anthropic.Anthropic(api_key=api_key)
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

    try:
        message = _get_client().messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=400,
            messages=[
                {
                    "role": "user",
                    "content": (
                        "You are a book recommendation assistant for a book club that uses the Gonder Scale "
                        "(1–5, no decimals). A book is 'Book Club Approved' if its average rating is 3.6 or higher.\n\n"
                        "The following books have ALREADY BEEN READ by the club:\n"
                        f"{history_text}\n\n"
                        "Recommend 2–3 books the group should read next. "
                        "Do NOT recommend any book already in the list above. "
                        "Explain briefly why each fits their taste. "
                        "Be specific about titles and authors. Keep the response concise (under 150 words)."
                    ),
                }
            ],
        )
        return message.content[0].text
    except ValueError as e:
        return f"Recommendations unavailable: {e}"
    except anthropic.APIError as e:
        return f"Recommendations unavailable: API error ({e.status_code})"
    except Exception as e:
        return f"Recommendations unavailable: {e}"


def get_member_recommendation(member_name: str, history: list[dict]) -> str:
    """Generate personalised book recommendations for one member."""
    if not history:
        return "No ratings yet."

    history_text = "\n".join(
        f'- "{h["title"]}" by {h["author"]}: {h["rating"]}/5'
        for h in history
    )

    try:
        message = _get_client().messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=400,
            messages=[
                {
                    "role": "user",
                    "content": (
                        f"You are a book recommendation assistant. {member_name} rates books on the Gonder Scale (1–5, no decimals).\n\n"
                        f"Here are books {member_name} has ALREADY READ and rated:\n"
                        f"{history_text}\n\n"
                        f"Based on their taste, recommend 2–3 books {member_name} would personally enjoy. "
                        "Do NOT recommend any book already in the list above. "
                        "Explain briefly why each suits their preferences. "
                        "Be specific about titles and authors. Keep the response concise (under 150 words)."
                    ),
                }
            ],
        )
        return message.content[0].text
    except ValueError as e:
        return f"Recommendations unavailable: {e}"
    except anthropic.APIError as e:
        return f"Recommendations unavailable: API error ({e.status_code})"
    except Exception as e:
        return f"Recommendations unavailable: {e}"


def get_member_personality(member_name: str, history: list[dict]) -> str:
    """Generate a reading personality label for a member based on their ratings."""
    if not history:
        return "No ratings yet."

    history_text = "\n".join(
        f'- "{h["title"]}" by {h["author"]}: {h["rating"]}/5'
        for h in history
    )

    try:
        message = _get_client().messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=200,
            messages=[
                {
                    "role": "user",
                    "content": (
                        f"{member_name} rates books on the Gonder Scale (1–5, no decimals). "
                        f"Here are their ratings:\n{history_text}\n\n"
                        "Based on their rating patterns, give them a reading personality. "
                        'First line: a short creative personality label in quotes (e.g. "The Reluctant Optimist"). '
                        "Then 2 sentences explaining what their ratings reveal about their taste. "
                        "Be specific and fun, not generic."
                    ),
                }
            ],
        )
        return message.content[0].text
    except ValueError as e:
        return f"Personality unavailable: {e}"
    except anthropic.APIError as e:
        return f"Personality unavailable: API error ({e.status_code})"
    except Exception as e:
        return f"Personality unavailable: {e}"


def get_group_personality(history: list[dict]) -> str:
    """Generate a collective reading personality for the whole book club."""
    if not history:
        return "No rating history available yet."

    history_text = "\n".join(
        f'- "{h["title"]}" by {h["author"]}: avg {h["average_rating"]}/5'
        f'{" (Book Club Approved)" if h["approved"] else ""}'
        for h in history
    )

    try:
        message = _get_client().messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=200,
            messages=[
                {
                    "role": "user",
                    "content": (
                        "This book club rates books on the Gonder Scale (1–5, no decimals). "
                        "A book is 'Book Club Approved' if its average is 3.6 or higher.\n\n"
                        f"Their reading history:\n{history_text}\n\n"
                        "Based on what they love and hate collectively, give the club a reading personality. "
                        'First line: a short creative personality label in quotes (e.g. "The Picky Adventurers"). '
                        "Then 2 sentences describing what their tastes say about them as a group. "
                        "Be specific and fun, not generic."
                    ),
                }
            ],
        )
        return message.content[0].text
    except ValueError as e:
        return f"Personality unavailable: {e}"
    except anthropic.APIError as e:
        return f"Personality unavailable: API error ({e.status_code})"
    except Exception as e:
        return f"Personality unavailable: {e}"
