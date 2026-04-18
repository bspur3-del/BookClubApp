import os
from flask import Flask, render_template, request, redirect, url_for, flash, jsonify
from flask_migrate import Migrate
from models import db, Member, Book, Rating, PastBook, PastBookRating, APPROVAL_THRESHOLD
from recommendations import (
    get_group_recommendation, get_member_recommendation,
    get_member_personality, get_group_personality,
)
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

database_url = os.environ.get("DATABASE_URL", "sqlite:///bookclub.db")
if database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql://", 1)
app.config["SQLALCHEMY_DATABASE_URI"] = database_url
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.secret_key = os.environ.get("SECRET_KEY", "dev-secret-key")
app.config["HAS_API_KEY"] = bool(os.environ.get("ANTHROPIC_API_KEY"))
db.init_app(app)
migrate = Migrate(app, db)

with app.app_context():
    db.create_all()

@app.context_processor
def inject_globals():
    logo_path = os.path.join(app.static_folder, "logo.png")
    return {
        "has_api_key": app.config["HAS_API_KEY"],
        "logo_exists": os.path.exists(logo_path),
    }


# ── Members ────────────────────────────────────────────────────────────────────

@app.route("/members/add", methods=["POST"])
def add_member():
    name = request.form.get("name", "").strip()
    if not name:
        flash("Member name cannot be empty.", "danger")
        return redirect(url_for("index"))
    if Member.query.filter_by(name=name).first():
        flash(f'"{name}" is already a member.', "warning")
        return redirect(url_for("index"))
    db.session.add(Member(name=name))
    db.session.commit()
    flash(f'"{name}" added to the book club.', "success")
    return redirect(url_for("index"))


@app.route("/members/<int:member_id>/delete", methods=["POST"])
def delete_member(member_id):
    member = Member.query.get_or_404(member_id)
    db.session.delete(member)
    db.session.commit()
    flash(f'"{member.name}" removed from the book club.', "success")
    return redirect(url_for("index"))


@app.route("/members/<int:member_id>")
def member_profile(member_id):
    member = Member.query.get_or_404(member_id)
    rated_books = (
        db.session.query(Book, Rating)
        .join(Rating, Rating.book_id == Book.id)
        .filter(Rating.member_id == member_id)
        .order_by(Book.year.desc(), Book.month.desc())
        .all()
    )
    return render_template("member.html", member=member, rated_books=rated_books)


def _member_history(member_id):
    rated = (
        db.session.query(Book, Rating)
        .join(Rating, Rating.book_id == Book.id)
        .filter(Rating.member_id == member_id)
        .all()
    )
    history = [{"title": b.title, "author": b.author, "rating": r.rating} for b, r in rated]
    past_rated = (
        db.session.query(PastBook, PastBookRating)
        .join(PastBookRating, PastBookRating.past_book_id == PastBook.id)
        .filter(PastBookRating.member_id == member_id)
        .all()
    )
    history += [{"title": pb.title, "author": pb.author, "rating": pr.rating} for pb, pr in past_rated]
    return history


@app.route("/members/<int:member_id>/recommend")
def member_recommend(member_id):
    member = Member.query.get_or_404(member_id)
    history = _member_history(member_id)
    if not history:
        return jsonify({"error": "No ratings yet — start rating books to get personalised recommendations!"})
    try:
        rec = get_member_recommendation(member.name, history)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    return jsonify(rec)


@app.route("/members/<int:member_id>/personality")
def member_personality(member_id):
    member = Member.query.get_or_404(member_id)
    history = _member_history(member_id)
    if not history:
        return jsonify({"personality": "Rate some books first to discover your reading personality!"})
    personality = get_member_personality(member.name, history)
    return jsonify({"personality": personality})


# ── Books ──────────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    books = Book.query.order_by(Book.year.desc(), Book.month.desc()).all()
    members = Member.query.order_by(Member.name).all()
    past_books = PastBook.query.order_by(PastBook.year.desc(), PastBook.month.desc()).all()
    past_book_ratings = {
        pb.id: {r.member_id: r.rating for r in pb.member_ratings}
        for pb in past_books
    }
    return render_template("index.html", books=books, members=members,
                           past_books=past_books, past_book_ratings=past_book_ratings,
                           approval_threshold=APPROVAL_THRESHOLD)


@app.route("/past-books/add", methods=["POST"])
def add_past_book():
    title = request.form.get("title", "").strip()
    author = request.form.get("author", "").strip()
    average_rating = request.form.get("average_rating", type=float)
    month = request.form.get("month", type=int) or None
    year = request.form.get("year", type=int) or None
    if not all([title, author, average_rating is not None]):
        flash("Title, author, and rating are required.", "danger")
        return redirect(url_for("index"))
    if not (0.1 <= average_rating <= 5.0):
        flash("Rating must be between 0.1 and 5.0.", "danger")
        return redirect(url_for("index"))
    if month and not (1 <= month <= 12):
        flash("Month must be between 1 and 12.", "danger")
        return redirect(url_for("index"))
    db.session.add(PastBook(title=title, author=author, average_rating=average_rating,
                            month=month, year=year))
    db.session.commit()
    flash(f'"{title}" added to past books.', "success")
    return redirect(url_for("index"))


@app.route("/past-books/<int:book_id>/delete", methods=["POST"])
def delete_past_book(book_id):
    book = PastBook.query.get_or_404(book_id)
    title = book.title
    db.session.delete(book)
    db.session.commit()
    flash(f'"{title}" removed from past books.', "success")
    return redirect(url_for("index"))


@app.route("/past-books/<int:book_id>/rate", methods=["POST"])
def rate_past_book(book_id):
    book = PastBook.query.get_or_404(book_id)
    for member in Member.query.all():
        raw = request.form.get(f"rating_{member.id}")
        if raw is None or raw == "":
            continue
        try:
            value = int(raw)
        except ValueError:
            flash(f"Invalid rating for {member.name}.", "danger")
            return redirect(url_for("index"))
        if not (1 <= value <= 5):
            flash(f"Rating for {member.name} must be between 1 and 5.", "danger")
            return redirect(url_for("index"))
        existing = PastBookRating.query.filter_by(member_id=member.id, past_book_id=book_id).first()
        if existing:
            existing.rating = value
        else:
            db.session.add(PastBookRating(member_id=member.id, past_book_id=book_id, rating=value))
    db.session.commit()
    flash(f'Ratings saved for "{book.title}".', "success")
    return redirect(url_for("index"))


@app.route("/books/add", methods=["POST"])
def add_book():
    title = request.form.get("title", "").strip()
    author = request.form.get("author", "").strip()
    month = request.form.get("month", type=int)
    year = request.form.get("year", type=int)
    nominator_id = request.form.get("nominator_id", type=int) or None
    if not all([title, author, month, year]):
        flash("All book fields are required.", "danger")
        return redirect(url_for("index"))
    if not (1 <= month <= 12):
        flash("Month must be between 1 and 12.", "danger")
        return redirect(url_for("index"))
    db.session.add(Book(title=title, author=author, month=month, year=year, nominator_id=nominator_id))
    db.session.commit()
    flash(f'"{title}" added.', "success")
    return redirect(url_for("index"))


@app.route("/books/<int:book_id>")
def book_detail(book_id):
    book = Book.query.get_or_404(book_id)
    members = Member.query.order_by(Member.name).all()
    existing = {r.member_id: r.rating for r in book.ratings}
    return render_template("book.html", book=book, members=members,
                           existing=existing, approval_threshold=APPROVAL_THRESHOLD)


@app.route("/club/personality")
def club_personality():
    history = []
    for b in Book.query.all():
        if b.ratings:
            avg = b.average()
            history.append({"title": b.title, "author": b.author,
                            "average_rating": round(avg, 2), "approved": b.is_approved})
    for pb in PastBook.query.all():
        history.append({"title": pb.title, "author": pb.author,
                        "average_rating": round(pb.average_rating, 2), "approved": pb.is_approved})
    if not history:
        return jsonify({"personality": "Rate some books first to discover the club's reading personality!"})
    personality = get_group_personality(history)
    return jsonify({"personality": personality})


@app.route("/books/<int:book_id>/edit", methods=["POST"])
def edit_book(book_id):
    book = Book.query.get_or_404(book_id)
    title = request.form.get("title", "").strip()
    author = request.form.get("author", "").strip()
    month = request.form.get("month", type=int)
    year = request.form.get("year", type=int)
    nominator_id = request.form.get("nominator_id", type=int) or None
    if not all([title, author, month, year]):
        flash("All book fields are required.", "danger")
        return redirect(url_for("book_detail", book_id=book_id))
    if not (1 <= month <= 12):
        flash("Month must be between 1 and 12.", "danger")
        return redirect(url_for("book_detail", book_id=book_id))
    book.title = title
    book.author = author
    book.month = month
    book.year = year
    book.nominator_id = nominator_id
    db.session.commit()
    flash(f'"{title}" updated.', "success")
    return redirect(url_for("book_detail", book_id=book_id))


@app.route("/books/<int:book_id>/delete", methods=["POST"])
def delete_book(book_id):
    book = Book.query.get_or_404(book_id)
    db.session.delete(book)
    db.session.commit()
    flash(f'"{book.title}" deleted.', "success")
    return redirect(url_for("index"))


@app.route("/books/<int:book_id>/recommend")
def book_recommend(book_id):
    book = Book.query.get_or_404(book_id)
    if not book.ratings:
        return jsonify({"error": "No ratings yet for this book."})
    history = []
    for b in Book.query.all():
        if b.ratings:
            avg = b.average()
            history.append({"title": b.title, "author": b.author,
                            "average_rating": round(avg, 2), "approved": b.is_approved})
    for pb in PastBook.query.all():
        history.append({"title": pb.title, "author": pb.author,
                        "average_rating": round(pb.average_rating, 2), "approved": pb.is_approved})
    try:
        rec = get_group_recommendation(history)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    return jsonify(rec)


@app.route("/club/recommend")
def club_recommend():
    history = []
    for b in Book.query.all():
        if b.ratings:
            avg = b.average()
            history.append({"title": b.title, "author": b.author,
                            "average_rating": round(avg, 2), "approved": b.is_approved})
    for pb in PastBook.query.all():
        history.append({"title": pb.title, "author": pb.author,
                        "average_rating": round(pb.average_rating, 2), "approved": pb.is_approved})
    if not history:
        return jsonify({"error": "Rate some books first to get a recommendation."})
    try:
        rec = get_group_recommendation(history)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    return jsonify(rec)


# ── Ratings ────────────────────────────────────────────────────────────────────

@app.route("/books/<int:book_id>/rate", methods=["POST"])
def rate_book(book_id):
    book = Book.query.get_or_404(book_id)
    for member in Member.query.all():
        raw = request.form.get(f"rating_{member.id}")
        if raw is None or raw == "":
            continue
        try:
            value = int(raw)
        except ValueError:
            flash(f"Invalid rating for {member.name}.", "danger")
            return redirect(url_for("book_detail", book_id=book_id))
        if not (1 <= value <= 5):
            flash(f"Rating for {member.name} must be between 1 and 5.", "danger")
            return redirect(url_for("book_detail", book_id=book_id))
        existing = Rating.query.filter_by(member_id=member.id, book_id=book_id).first()
        if existing:
            existing.rating = value
        else:
            db.session.add(Rating(member_id=member.id, book_id=book_id, rating=value))
    db.session.commit()
    flash("Ratings saved.", "success")
    return redirect(url_for("book_detail", book_id=book_id))


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
