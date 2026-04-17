import os
from flask import Flask, render_template, request, redirect, url_for, flash, jsonify
from models import db, Member, Book, Rating, APPROVAL_THRESHOLD
from recommendations import get_group_recommendation, get_member_recommendation
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///bookclub.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.secret_key = os.environ.get("SECRET_KEY", "dev-secret-key")
db.init_app(app)


@app.before_request
def create_tables():
    db.create_all()


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


@app.route("/members/<int:member_id>/recommend")
def member_recommend(member_id):
    member = Member.query.get_or_404(member_id)
    rated_books = (
        db.session.query(Book, Rating)
        .join(Rating, Rating.book_id == Book.id)
        .filter(Rating.member_id == member_id)
        .all()
    )
    if not rated_books:
        return jsonify({"recommendation": "No ratings yet — start rating books to get personalised recommendations!"})
    history = [
        {"title": b.title, "author": b.author, "rating": r.rating}
        for b, r in rated_books
    ]
    rec = get_member_recommendation(member.name, history)
    return jsonify({"recommendation": rec})


# ── Books ──────────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    books = Book.query.order_by(Book.year.desc(), Book.month.desc()).all()
    members = Member.query.order_by(Member.name).all()
    return render_template("index.html", books=books, members=members,
                           approval_threshold=APPROVAL_THRESHOLD)


@app.route("/books/add", methods=["POST"])
def add_book():
    title = request.form.get("title", "").strip()
    author = request.form.get("author", "").strip()
    month = request.form.get("month", type=int)
    year = request.form.get("year", type=int)
    if not all([title, author, month, year]):
        flash("All book fields are required.", "danger")
        return redirect(url_for("index"))
    if not (1 <= month <= 12):
        flash("Month must be between 1 and 12.", "danger")
        return redirect(url_for("index"))
    db.session.add(Book(title=title, author=author, month=month, year=year))
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
        return jsonify({"recommendation": "No ratings yet for this book."})
    all_books = Book.query.all()
    history = []
    for b in all_books:
        if b.ratings:
            avg = b.average()
            history.append({
                "title": b.title,
                "author": b.author,
                "average_rating": round(avg, 2),
                "approved": b.is_approved(),
            })
    rec = get_group_recommendation(history)
    return jsonify({"recommendation": rec})


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
    app.run(debug=True)
