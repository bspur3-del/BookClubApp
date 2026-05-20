import os
import json
import time
import random
import httpx
import anthropic

_client = None


def _get_client():
    global _client
    if _client is None:
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY environment variable is not set")
        _client = anthropic.Anthropic(
            api_key=api_key,
            timeout=httpx.Timeout(connect=10.0, read=300.0, write=30.0, pool=10.0),
        )
    return _client


def _call_with_retry(model, max_tokens, messages, retries=3):
    """Call the API with retry on timeout and transient server errors."""
    last_err = None
    for attempt in range(retries + 1):
        try:
            return _get_client().messages.create(
                model=model, max_tokens=max_tokens, messages=messages
            )
        except (anthropic.APITimeoutError, anthropic.APIConnectionError) as e:
            last_err = e
        except anthropic.RateLimitError as e:
            last_err = e
        except anthropic.InternalServerError as e:
            last_err = e
        except anthropic.APIStatusError as e:
            if e.status_code in (502, 503, 529):
                last_err = e
            else:
                raise
        if attempt < retries:
            time.sleep(2 ** attempt)
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


_GROUP_REC_ANGLES = [
    "Prioritise a debut novel or a lesser-known author who fits the pattern.",
    "Consider a book published in the last five years that matches the club's taste.",
    "Look at international or translated fiction that fits the pattern.",
    "Explore a classic (pre-1980) that matches what the club loves.",
    "Suggest something from an author the club hasn't read yet, even if the book is well-known.",
    "Think beyond the most obvious choice — surface a hidden gem that fits the pattern.",
    "Consider a short novel (under 250 pages) that matches the club's preferences.",
    "Look for a book with an unusual narrative structure that still fits what the club approves.",
]


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
    angle = random.choice(_GROUP_REC_ANGLES)

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
                f"Exploration angle for this recommendation: {angle}\n\n"
                "Respond ONLY with valid JSON, no other text:\n"
                '{"title": "Book Title", "author": "Full Author Name", "reason": "Two sentences: first cite the specific qualities of their approved books that this shares, then address why it avoids what they rejected."}'
            ),
        }],
    )
    return _parse_book_json(message.content[0].text)


_MEMBER_REC_ANGLES = [
    "Suggest a debut novel or a lesser-known author who fits their taste.",
    "Consider a book published in the last five years.",
    "Look at international or translated fiction that fits their preferences.",
    "Explore a classic (pre-1980) that matches what they love.",
    "Suggest something from an author they haven't read, even if the book is well-known.",
    "Think beyond the obvious choice — surface a hidden gem that fits their pattern.",
    "Consider a shorter novel (under 250 pages) that matches their preferences.",
    "Look for a book with an unconventional structure that still fits what they love.",
]


def get_member_recommendation(member_name: str, history: list[dict]) -> dict:
    """Returns a single personalised book recommendation as a dict."""
    if not history:
        raise ValueError("No ratings yet.")

    sorted_history = sorted(history, key=lambda x: x["rating"], reverse=True)
    loved = [h for h in history if h["rating"] >= 4]
    disliked = [h for h in history if h["rating"] <= 2]
    avg = sum(h["rating"] for h in history) / len(history)

    history_text = "\n".join(
        f'- "{h["title"]}" by {h["author"]}: {h["rating"]}/5'
        for h in sorted_history
    )
    loved_text = ", ".join(f'"{h["title"]}"' for h in loved) or "none yet"
    disliked_text = ", ".join(f'"{h["title"]}"' for h in disliked) or "none"
    angle = random.choice(_MEMBER_REC_ANGLES)

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
                f"Exploration angle for this recommendation: {angle}\n\n"
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


def get_boss_character(books: list[dict]) -> dict:
    """Return a boss character from one of the club's books for the dungeon game."""
    if not books:
        return {}
    titles = "\n".join(f'- "{b["title"]}" by {b["author"]}' for b in books[:8])
    message = _call_with_retry(
        model="claude-haiku-4-5-20251001",
        max_tokens=200,
        messages=[{
            "role": "user",
            "content": (
                f"Book club reading list:\n{titles}\n\n"
                "Pick one book and name a villain, antagonist, or imposing character from it "
                "who would make a memorable video game boss. Respond ONLY with valid JSON:\n"
                '{"book": "Title", "character": "Character Name", "emoji": "🦹", '
                '"flavor": "One atmospheric sentence.", "hp": 110, "atk_min": 16, "atk_max": 26}'
            ),
        }],
    )
    return _parse_book_json(message.content[0].text)


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


def get_trivia_questions(books: list[dict]) -> list[dict]:
    """Generate 10 multiple-choice trivia questions + 1 harder bonus from the club's reading list."""
    if not books:
        raise ValueError("No books to generate trivia from.")

    book_list = "\n".join(f'- "{b["title"]}" by {b["author"]}' for b in books[:15])

    message = _call_with_retry(
        model="claude-sonnet-4-6",
        max_tokens=3000,
        messages=[{
            "role": "user",
            "content": (
                "You are creating a multiple-choice book trivia quiz for a book club.\n\n"
                f"Books the club has read:\n{book_list}\n\n"
                "Generate EXACTLY 11 questions:\n"
                "- Questions 1–10: regular difficulty mix (easy → hard). Each worth 1 point.\n"
                "- Question 11: one BONUS question — a specific detail only a careful reader would know. Worth 3 points.\n\n"
                "Rules:\n"
                "- Every question must be about one of the listed books above — plot, characters, settings, specific events, names, dialogue\n"
                "- Each question has exactly 4 answer choices (A, B, C, D) — one correct, three plausible wrong answers\n"
                "- Spread questions across different books when multiple books are listed\n"
                "- Do NOT ask vague or generic questions — be specific to the actual text\n"
                "- Wrong answers must be plausible (not obviously silly)\n\n"
                "ACCURACY IS CRITICAL:\n"
                "- Only generate questions about facts you are certain are correct.\n"
                "- Do NOT invent, guess at, or speculate about plot details, character names, specific dialogue, or events.\n"
                "- If you are uncertain about a specific detail in a book, skip it and choose a different aspect you ARE certain about.\n"
                "- Prefer questions about major plot events, protagonist names, central themes, and well-established facts.\n"
                "- Every answer marked as correct MUST actually be correct — double-check before including it.\n\n"
                'Respond ONLY with a valid JSON array. The "correct" field is the 0-indexed position of the correct answer in the options array:\n'
                '[{"question": "...", "options": ["A. ...", "B. ...", "C. ...", "D. ..."], "correct": 0, "book": "Title", "bonus": false}]'
            ),
        }],
    )
    questions = _parse_book_list(message.content[0].text)
    for i, q in enumerate(questions):
        q["bonus"] = (i == 10)
    return questions[:11]
