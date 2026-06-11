import os
from datetime import datetime
from flask import Flask, render_template, request, redirect, url_for, flash
from flask_migrate import Migrate
from models import db, BiscuitVisit, BiscuitRating, MEMBERS
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

database_url = os.environ.get("DATABASE_URL", "sqlite:///biscuits.db")
if database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql://", 1)
app.config["SQLALCHEMY_DATABASE_URI"] = database_url
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.secret_key = os.environ.get("SECRET_KEY", "dev-secret-key")

db.init_app(app)
migrate = Migrate(app, db)

with app.app_context():
    db.create_all()

CATEGORIES = ['taste', 'texture', 'biscuit', 'chicken', 'presentation']
CATEGORY_LABELS = {
    'taste': 'Taste',
    'texture': 'Texture',
    'biscuit': 'Biscuit',
    'chicken': 'Chicken',
    'presentation': 'Presentation',
}


@app.route("/")
def index():
    visits = BiscuitVisit.query.order_by(BiscuitVisit.visit_date.desc()).all()
    restaurant_scores = {}
    for visit in visits:
        score = visit.group_overall()
        if score is not None:
            name = visit.restaurant_name
            if name not in restaurant_scores:
                restaurant_scores[name] = []
            restaurant_scores[name].append(score)
    leaderboard = sorted(
        [{"name": n, "avg": sum(s) / len(s), "visits": len(s)}
         for n, s in restaurant_scores.items()],
        key=lambda x: x["avg"],
        reverse=True,
    )
    today = datetime.today().strftime("%Y-%m-%d")
    return render_template("index.html", visits=visits, leaderboard=leaderboard,
                           members=MEMBERS, today=today)


@app.route("/visit/add", methods=["POST"])
def add_visit():
    restaurant_name = request.form.get("restaurant_name", "").strip()
    visit_date_str = request.form.get("visit_date", "").strip()
    notes = request.form.get("notes", "").strip()
    if not restaurant_name or not visit_date_str:
        flash("Restaurant name and date are required.", "danger")
        return redirect(url_for("index"))
    try:
        visit_date = datetime.strptime(visit_date_str, "%Y-%m-%d").date()
    except ValueError:
        flash("Invalid date format.", "danger")
        return redirect(url_for("index"))
    db.session.add(BiscuitVisit(
        restaurant_name=restaurant_name,
        visit_date=visit_date,
        notes=notes or None,
    ))
    db.session.commit()
    flash(f'Visit to "{restaurant_name}" logged!', "success")
    return redirect(url_for("index"))


@app.route("/visit/<int:visit_id>")
def visit_detail(visit_id):
    visit = BiscuitVisit.query.get_or_404(visit_id)
    existing = {r.member_name: r for r in visit.ratings}
    return render_template("visit.html", visit=visit, members=MEMBERS,
                           existing=existing, categories=CATEGORIES,
                           category_labels=CATEGORY_LABELS)


@app.route("/visit/<int:visit_id>/rate", methods=["POST"])
def rate_visit(visit_id):
    visit = BiscuitVisit.query.get_or_404(visit_id)
    member_name = request.form.get("member_name", "").strip()
    if member_name not in MEMBERS:
        flash("Select a valid member.", "danger")
        return redirect(url_for("visit_detail", visit_id=visit_id))

    values = {}
    for cat in CATEGORIES:
        raw = request.form.get(cat)
        if not raw:
            flash("Please rate all 5 categories.", "danger")
            return redirect(url_for("visit_detail", visit_id=visit_id))
        try:
            v = int(raw)
        except ValueError:
            flash(f"Invalid value for {cat}.", "danger")
            return redirect(url_for("visit_detail", visit_id=visit_id))
        if not (1 <= v <= 5):
            flash(f"{cat.capitalize()} must be between 1 and 5.", "danger")
            return redirect(url_for("visit_detail", visit_id=visit_id))
        values[cat] = v

    existing = BiscuitRating.query.filter_by(visit_id=visit_id, member_name=member_name).first()
    if existing:
        for cat in CATEGORIES:
            setattr(existing, cat, values[cat])
    else:
        db.session.add(BiscuitRating(visit_id=visit_id, member_name=member_name, **values))
    db.session.commit()
    flash(f"{member_name}'s ratings saved!", "success")
    return redirect(url_for("visit_detail", visit_id=visit_id))


@app.route("/visit/<int:visit_id>/delete", methods=["POST"])
def delete_visit(visit_id):
    visit = BiscuitVisit.query.get_or_404(visit_id)
    name = visit.restaurant_name
    db.session.delete(visit)
    db.session.commit()
    flash(f'Visit to "{name}" deleted.', "success")
    return redirect(url_for("index"))


@app.route("/visit/<int:visit_id>/rating/<member_name>/delete", methods=["POST"])
def delete_rating(visit_id, member_name):
    if member_name not in MEMBERS:
        flash("Invalid member.", "danger")
        return redirect(url_for("visit_detail", visit_id=visit_id))
    rating = BiscuitRating.query.filter_by(
        visit_id=visit_id, member_name=member_name
    ).first_or_404()
    db.session.delete(rating)
    db.session.commit()
    flash(f"{member_name}'s rating removed.", "success")
    return redirect(url_for("visit_detail", visit_id=visit_id))


@app.route("/suggestions")
def suggestions():
    return render_template("suggestions.html")


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
