import os
import json
import time
import anthropic

_client = None


def _get_client():
    global _client
    if _client is None:
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY environment variable is not set")
        _client = anthropic.Anthropic(api_key=api_key, timeout=120.0)
    return _client


def _call_with_retry(model, max_tokens, messages, retries=2):
    """Call the API with simple retry on timeout/stream errors."""
    last_err = None
    for attempt in range(retries + 1):
        try:
            return _get_client().messages.create(
                model=model, max_tokens=max_tokens, messages=messages
            )
        except Exception as e:
            last_err = e
            if attempt < retries:
                time.sleep(2 ** attempt)  # 1s, 2s backoff
    raise last_err


def _parse_book_json(text: str) -> dict:
    text = text.strip()
    if text.startswith("```"):
        parts = text.split("```")
        text = parts[1]
        if text.startswith("json"):
            text = text[4:]
        text = text.strip()
    return json.loads(text)


def _parse_book_list(text: str) -> list:
    text = text.strip()
    if text.startswith("```"):
        parts = text.split("```")
        text = parts[1]
        if text.startswith("json"):
            text = text[4:]
        text = text.strip()
    return json.loads(text)


def get_group_recommendation(history: list[dict]) -> dict:
    """Returns a single book recommendation as a dict with title, author, reason."""
    if not history:
        raise ValueError("No reading history available yet.")

    sorted_history = sorted(history, key=lambda x: x["average_rating"], reverse=True)
    approved = [h for h in history if h["approved"]]
    not_approved = [h for h in history if not h["approved"]]

    history_text = "\n".join(
        f'- "{h["title"]}" by {h["author"]}: {h["average_rating"]}/5'
        f'{" ✓ APPROVED" if h["approved"] else " ✗ not approved"}'
        for h in sorted_history
    )
    approved_titles = ", ".join(f'"{h["title"]}"' for h in approved) or "none yet"
    rejected_titles = ", ".join(f'"{h["title"]}"' for h in not_approved) or "none"

    message = _call_with_retry(
        model="claude-sonnet-4-6",
        max_tokens=500,
        messages=[{
            "role": "user",
            "content": (
                "You are a literary expert tasked with recommending the perfect next book for a book club.\n\n"
                "The club uses the Gonder Scale (1–5). A book earns APPROVED status at 3.6 or higher.\n\n"
                f"Full reading history (best to worst):\n{history_text}\n\n"
                f"Books the club APPROVED (loved): {approved_titles}\n"
                f"Books the club did NOT approve: {rejected_titles}\n\n"
                "Carefully study what the approved books have in common: themes, narrative style, pacing, "
                "emotional depth, subject matter, prose quality. Then identify what the rejected books "
                "lacked or did wrong for this group.\n\n"
                "Recommend exactly 1 book NOT already in the list above that this club will most likely approve. "
                "Your recommendation must be grounded in specific, observable patterns from their ratings — "
                "not generic taste assumptions.\n\n"
                "Respond ONLY with valid JSON, no other text:\n"
                '{"title": "Book Title", "author": "Full Author Name", "reason": "Two sentences: first cite the specific qualities of their approved books that this shares, then address why it avoids what they rejected."}'
            ),
        }],
    )
    return _parse_book_json(message.content[0].text)


def get_member_recommendation(member_name: str, history: list[dict]) -> dict:
    """Returns a single personalised book recommendation as a dict."""
    if not history:
        raise ValueError("No ratings yet.")

    sorted_history = sorted(history, key=lambda x: x["rating"], reverse=True)
    loved = [h for h in history if h["rating"] >= 4]
    middle = [h for h in history if h["rating"] == 3]
    disliked = [h for h in history if h["rating"] <= 2]
    avg = sum(h["rating"] for h in history) / len(history)

    history_text = "\n".join(
        f'- "{h["title"]}" by {h["author"]}: {h["rating"]}/5'
        for h in sorted_history
    )
    loved_text = ", ".join(f'"{h["title"]}"' for h in loved) or "none yet"
    disliked_text = ", ".join(f'"{h["title"]}"' for h in disliked) or "none"

    message = _call_with_retry(
        model="claude-sonnet-4-6",
        max_tokens=500,
        messages=[{
            "role": "user",
            "content": (
                f"You are a literary expert giving a deeply personalised recommendation for {member_name}.\n\n"
                f"Their ratings on the Gonder Scale (1–5), sorted best to worst:\n{history_text}\n\n"
                f"Books they LOVED (4–5 stars): {loved_text}\n"
                f"Books they DISLIKED (1–2 stars): {disliked_text}\n"
                f"Their average rating: {avg:.1f}/5 "
                f"({'generous rater' if avg >= 3.5 else 'selective rater' if avg <= 2.5 else 'balanced rater'})\n\n"
                f"Study the specific books they loved — what do those books share in terms of themes, "
                f"writing style, pacing, emotional tone, subject matter, or narrative structure? "
                f"What patterns appear in the books they disliked? "
                f"Use this analysis to recommend exactly 1 book {member_name} has NOT read.\n\n"
                "Do NOT recommend any book already listed. Be specific — reference actual elements "
                "from their loved books in the reason, not vague genre labels.\n\n"
                "Respond ONLY with valid JSON, no other text:\n"
                '{"title": "Book Title", "author": "Full Author Name", "reason": "Two sentences: first name the specific qualities from their loved books that this recommendation shares, then why it avoids what they disliked."}'
            ),
        }],
    )
    return _parse_book_json(message.content[0].text)


def get_member_personality(member_name: str, history: list[dict]) -> str:
    """Generate a reading personality label for a member based on their ratings."""
    if not history:
        return "No ratings yet."

    sorted_history = sorted(history, key=lambda x: x["rating"], reverse=True)
    loved = [h for h in history if h["rating"] >= 4]
    disliked = [h for h in history if h["rating"] <= 2]
    avg = sum(h["rating"] for h in history) / len(history)

    history_text = "\n".join(
        f'- "{h["title"]}" by {h["author"]}: {h["rating"]}/5'
        for h in sorted_history
    )

    try:
        message = _call_with_retry(
            model="claude-sonnet-4-6",
            max_tokens=350,
            messages=[{
                "role": "user",
                "content": (
                    f"You are a literary analyst. Reveal {member_name}'s reading personality "
                    f"based on their Gonder Scale ratings.\n\n"
                    f"Ratings (best to worst):\n{history_text}\n\n"
                    f"Loved (4–5★): {', '.join(h['title'] for h in loved) or 'none yet'}\n"
                    f"Disliked (1–2★): {', '.join(h['title'] for h in disliked) or 'none'}\n"
                    f"Average: {avg:.1f}/5\n\n"
                    "Look at the actual books — what do the loved ones share? "
                    "What patterns reveal themselves in the full ratings? "
                    "Be specific and reference actual titles from their history.\n\n"
                    'First line: a creative, punchy personality label in quotes (e.g. "The Brooding Minimalist"). '
                    "Then 2–3 sentences that reference specific books they rated to explain their taste. "
                    "Be insightful and specific — avoid generic statements like 'enjoys good storytelling'."
                ),
            }],
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

    sorted_history = sorted(history, key=lambda x: x["average_rating"], reverse=True)
    approved = [h for h in history if h["approved"]]
    rejected = [h for h in history if not h["approved"]]

    history_text = "\n".join(
        f'- "{h["title"]}" by {h["author"]}: {h["average_rating"]}/5'
        f'{" ✓" if h["approved"] else " ✗"}'
        for h in sorted_history
    )

    try:
        message = _call_with_retry(
            model="claude-sonnet-4-6",
            max_tokens=350,
            messages=[{
                "role": "user",
                "content": (
                    "You are a literary analyst. Reveal this book club's collective reading personality.\n\n"
                    "Gonder Scale ratings (best to worst, ✓ = Approved at 3.6+):\n"
                    f"{history_text}\n\n"
                    f"Approved: {', '.join(h['title'] for h in approved) or 'none yet'}\n"
                    f"Not approved: {', '.join(h['title'] for h in rejected) or 'none'}\n\n"
                    "What do the approved books have in common? What unifies the rejected ones? "
                    "Reference specific titles in your analysis.\n\n"
                    'First line: a creative personality label in quotes (e.g. "The Discerning Escapists"). '
                    "Then 2–3 sentences referencing specific books they rated to describe the club's collective taste. "
                    "Be specific and insightful — avoid vague generalities."
                ),
            }],
        )
        return message.content[0].text
    except ValueError as e:
        return f"Personality unavailable: {e}"
    except anthropic.APIError as e:
        return f"Personality unavailable: API error ({e.status_code})"
    except Exception as e:
        return f"Personality unavailable: {e}"


def get_nomination_suggestions(theme: str, history: list[dict]) -> list[dict]:
    """Return 3 nomination suggestions for a given theme with predicted Gonder Scale ratings."""
    history_section = ""
    if history:
        sorted_history = sorted(history, key=lambda x: x["average_rating"], reverse=True)
        approved = [h for h in history if h["approved"]]
        rejected = [h for h in history if not h["approved"]]
        rows = "\n".join(
            f'- "{h["title"]}" by {h["author"]}: {h["average_rating"]}/5'
            f'{"  APPROVED" if h["approved"] else ""}'
            for h in sorted_history
        )
        approved_titles = ", ".join(f'"{h["title"]}"' for h in approved) or "none yet"
        rejected_titles = ", ".join(f'"{h["title"]}"' for h in rejected) or "none"
        history_section = (
            f"\nThis club's reading history (Gonder Scale, best to worst):\n{rows}\n\n"
            f"Books they APPROVED (3.6+): {approved_titles}\n"
            f"Books they did NOT approve: {rejected_titles}\n"
        )

    message = _call_with_retry(
        model="claude-sonnet-4-6",
        max_tokens=900,
        messages=[{
            "role": "user",
            "content": (
                "You are a literary expert helping a book club choose nominations for next month.\n\n"
                f'Next month\'s theme: "{theme}"\n'
                f"{history_section}\n"
                f'Suggest exactly 3 real, published books that genuinely fit the theme "{theme}". '
                "The theme must be central to each book — not incidental.\n\n"
                + (
                    "For each book, predict a Gonder Scale rating (1.0-5.0) based on specific, "
                    "observable patterns from this club's approved vs rejected books. "
                    "Reference what the approved books share and why this suggestion matches or diverges.\n\n"
                    if history else
                    "For each book, predict a Gonder Scale rating (1.0-5.0) based on general literary merit "
                    "and how well it suits a thoughtful book club.\n\n"
                ) +
                "Vary your suggestions across styles or sub-genres within the theme.\n\n"
                "Respond ONLY with a valid JSON array, no other text:\n"
                '[{"title": "...", "author": "...", "predicted_rating": 4.1, '
                '"reason": "Two sentences: first explain how the theme is central to this book, '
                'then predict the Gonder Scale score with specific reasoning tied to this club\'s taste."}]'
            ),
        }],
    )
    return _parse_book_list(message.content[0].text)
