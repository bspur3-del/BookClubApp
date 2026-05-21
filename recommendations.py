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
    "Suggest a book from a country or culture not represented in their reading history.",
    "Look at prize-winning literary fiction (Booker, Pulitzer, etc.) that fits their taste.",
    "Suggest a non-fiction or hybrid work that fits the themes they love.",
    "Consider a short story collection that matches the club's preferred tone.",
]

# In-memory record of recently suggested titles per context, to prevent repeats.
# Keys: "group", "member:<name>", "book:<title>".  Persists until server restart.
_recent_recs: dict[str, list[str]] = {}


def _recent_exclusion(key: str) -> str:
    """Return a prompt clause listing recently suggested titles to avoid."""
    recent = _recent_recs.get(key, [])
    if not recent:
        return ""
    titles = ", ".join(f'"{t}"' for t in recent)
    return f"Do NOT suggest any of these recently recommended titles: {titles}\n\n"


def _record_rec(key: str, title: str) -> None:
    """Add a recommended title to the recent-recs cache (keeps last 12 per key)."""
    if not title:
        return
    lst = [t for t in _recent_recs.get(key, []) if t.lower() != title.lower()]
    lst.insert(0, title)
    _recent_recs[key] = lst[:12]


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
    exclusion = _recent_exclusion("group")

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
                f"{exclusion}"
                f"Exploration angle for this recommendation: {angle}\n\n"
                "Respond ONLY with valid JSON, no other text:\n"
                '{"title": "Book Title", "author": "Full Author Name", "reason": "Two sentences: first cite the specific qualities of their approved books that this shares, then address why it avoids what they rejected."}'
            ),
        }],
    )
    result = _parse_book_json(message.content[0].text)
    _record_rec("group", result.get("title", ""))
    return result


_MEMBER_REC_ANGLES = [
    "Suggest a debut novel or a lesser-known author who fits their taste.",
    "Consider a book published in the last five years.",
    "Look at international or translated fiction that fits their preferences.",
    "Explore a classic (pre-1980) that matches what they love.",
    "Suggest something from an author they haven't read, even if the book is well-known.",
    "Think beyond the obvious choice — surface a hidden gem that fits their pattern.",
    "Consider a shorter novel (under 250 pages) that matches their preferences.",
    "Look for a book with an unconventional structure that still fits what they love.",
    "Suggest a book from a country or culture not represented in their reading history.",
    "Look at prize-winning literary fiction (Booker, Pulitzer, etc.) that fits their taste.",
    "Consider non-fiction or narrative journalism that fits their preferred themes.",
    "Suggest a book by a debut author published in the last three years.",
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
    cache_key = f"member:{member_name}"
    exclusion = _recent_exclusion(cache_key)

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
                f"{exclusion}"
                f"Exploration angle for this recommendation: {angle}\n\n"
                "Respond ONLY with valid JSON, no other text:\n"
                '{"title": "Book Title", "author": "Full Author Name", "reason": "Two sentences: first name the specific qualities from their loved books that this recommendation shares, then why it avoids what they disliked."}'
            ),
        }],
    )
    result = _parse_book_json(message.content[0].text)
    _record_rec(cache_key, result.get("title", ""))
    return result


def get_book_recommendation(book_title: str, book_author: str,
                            average_rating: float, is_approved: bool) -> dict:
    """Recommend a book similar to a specific title based on its rating alone."""
    status = "APPROVED" if is_approved else "not approved"
    angle = random.choice(_GROUP_REC_ANGLES)
    cache_key = f"book:{book_title}"
    exclusion = _recent_exclusion(cache_key)

    message = _call_with_retry(
        model="claude-sonnet-4-6",
        max_tokens=500,
        messages=[{
            "role": "user",
            "content": (
                "You are a literary expert recommending the next book for a book club.\n\n"
                f'The club just finished "{book_title}" by {book_author}. '
                f"They rated it {average_rating:.1f}/5 ({status} on the Gonder Scale, "
                f"where 3.6+ earns APPROVED).\n\n"
                f"Recommend exactly 1 book that is similar in themes, writing style, mood, "
                f"or subject matter to \"{book_title}\". Base your recommendation purely on "
                f"this book — do not assume knowledge of any other books the club has read.\n\n"
                f"{exclusion}"
                f"Exploration angle: {angle}\n\n"
                "Respond ONLY with valid JSON, no other text:\n"
                '{"title": "Book Title", "author": "Full Author Name", "reason": "Two sentences: '
                "first explain what this recommendation shares with the book they just read, "
                f'then why it suits a club that rated it {average_rating:.1f}/5."' + "}"
            ),
        }],
    )
    result = _parse_book_json(message.content[0].text)
    _record_rec(cache_key, result.get("title", ""))
    return result


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


def _verify_trivia_questions(candidates: list[dict]) -> list[dict]:
    """
    Re-answer each candidate question independently (without seeing the marked answer)
    and keep only those where the independent answer matches — catching hallucinated
    correct answers before they reach the player.
    """
    if not candidates:
        return candidates

    blind = [
        {"index": i, "book": q["book"], "question": q["question"], "options": q["options"]}
        for i, q in enumerate(candidates)
    ]

    msg = _call_with_retry(
        model="claude-sonnet-4-6",
        max_tokens=1500,
        messages=[{
            "role": "user",
            "content": (
                "Answer each trivia question by selecting the correct option. "
                "Use 0-indexed positions: 0=A, 1=B, 2=C, 3=D.\n\n"
                "Set 'confident': false for any question where you are not fully certain — "
                "it is better to mark uncertain than to guess.\n\n"
                f"Questions:\n{json.dumps(blind, indent=2)}\n\n"
                "Respond ONLY with a JSON array:\n"
                '[{"index": 0, "answer": 2, "confident": true}, ...]'
            ),
        }],
    )

    try:
        verifications = _parse_book_list(msg.content[0].text)
    except (json.JSONDecodeError, KeyError, ValueError):
        return candidates  # if verification fails, pass everything through

    verify_map = {
        v["index"]: v
        for v in verifications
        if isinstance(v.get("index"), int)
    }

    kept = []
    for i, q in enumerate(candidates):
        v = verify_map.get(i)
        if v and v.get("confident") and v.get("answer") == q["correct"]:
            kept.append(q)
    return kept


def get_trivia_questions(books: list[dict]) -> list[dict]:
    """
    Generate trivia questions using a two-pass approach:
    1. Generate 16 candidate questions.
    2. Re-answer each one independently and discard any where the answers
       disagree or confidence is low — eliminating hallucinated facts.
    """
    if not books:
        raise ValueError("No books to generate trivia from.")

    book_list = "\n".join(f'- "{b["title"]}" by {b["author"]}' for b in books[:15])

    # Pass 1 — generate candidates (extra headroom so filtering can still yield 11)
    gen_msg = _call_with_retry(
        model="claude-sonnet-4-6",
        max_tokens=4000,
        messages=[{
            "role": "user",
            "content": (
                "You are creating a multiple-choice book trivia quiz for a book club.\n\n"
                f"Books the club has read:\n{book_list}\n\n"
                "Generate exactly 16 questions. Only ask about facts you know with "
                "complete certainty — main characters, central plot, primary setting, "
                "key themes. Do NOT invent or guess any detail.\n\n"
                "- Each question has exactly 4 answer choices (A, B, C, D).\n"
                "- One choice is correct; three are plausible but wrong.\n"
                "- Spread questions across different books.\n\n"
                'Respond ONLY with a valid JSON array. The "correct" field is the '
                "0-indexed position of the correct answer in the options array:\n"
                '[{"question": "...", "options": ["A. ...", "B. ...", "C. ...", "D. ..."], "correct": 0, "book": "Title"}]'
            ),
        }],
    )
    candidates = _parse_book_list(gen_msg.content[0].text)

    # Pass 2 — verify by independent answering; discard mismatches
    verified = _verify_trivia_questions(candidates)

    # Assign bonus flag: last question is the bonus
    for q in verified:
        q["bonus"] = False
    if verified:
        verified[-1]["bonus"] = True

    return verified[:11]


def get_cocktail_recipe(book_title: str, cabinet: list[str]) -> dict:
    """Generate a themed cocktail recipe inspired by a book."""
    cabinet_section = ""
    if cabinet:
        items = ", ".join(cabinet)
        cabinet_section = (
            f"\nThe person making this has the following in their liquor cabinet: {items}.\n"
            "Incorporate one or more of these as the base spirit or a key component where they "
            "genuinely fit the book's tone. Do not force an ingredient that clashes — a good "
            "thematic fit matters more than using every item listed.\n"
        )

    message = _call_with_retry(
        model="claude-sonnet-4-6",
        max_tokens=1000,
        messages=[{
            "role": "user",
            "content": (
                f'Create a unique cocktail recipe inspired by the book "{book_title}".\n\n'
                "The drink should reflect the book's mood, setting, characters, or central themes — "
                "not just its title. Give it an evocative name a reader of the book would appreciate.\n"
                f"{cabinet_section}\n"
                "Respond ONLY with valid JSON:\n"
                "{\n"
                '  "cocktail_name": "...",\n'
                '  "tagline": "One evocative sentence connecting the drink to the book.",\n'
                '  "glass": "e.g. Rocks glass, Coupe, Highball",\n'
                '  "ingredients": [{"amount": "2 oz", "item": "bourbon whiskey"}, ...],\n'
                '  "instructions": ["Step 1...", "Step 2...", "Step 3...", ...],\n'
                '  "garnish": "...",\n'
                '  "flavor_profile": "2-3 adjectives, e.g. smoky, bittersweet, bold",\n'
                '  "theme_note": "2-3 sentences explaining how this drink captures the spirit of the book."\n'
                "}"
            ),
        }],
    )
    return _parse_book_json(message.content[0].text)
