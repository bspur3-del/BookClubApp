import os
from datetime import datetime
from flask import Flask, render_template, request, redirect, url_for, flash, jsonify
from flask_migrate import Migrate
from models import db, Member, BiscuitVisit, BiscuitRating, DEFAULT_MEMBERS
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
    # If tables exist without alembic migration history, stamp them so
    # `flask db upgrade` won't try to recreate them on next deploy.
    from sqlalchemy import inspect as sa_inspect, text
    with db.engine.connect() as _conn:
        _tables = sa_inspect(_conn).get_table_names()
        if 'members' in _tables:
            if 'alembic_version' not in _tables:
                _conn.execute(text(
                    "CREATE TABLE alembic_version "
                    "(version_num VARCHAR(32) NOT NULL, "
                    "CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num))"
                ))
                _conn.execute(text("INSERT INTO alembic_version (version_num) VALUES ('001')"))
                _conn.commit()
            else:
                _row = _conn.execute(text("SELECT version_num FROM alembic_version")).fetchone()
                if _row is None:
                    _conn.execute(text("INSERT INTO alembic_version (version_num) VALUES ('001')"))
                    _conn.commit()
    if Member.query.count() == 0:
        for name in DEFAULT_MEMBERS:
            db.session.add(Member(name=name))
        db.session.commit()

CATEGORIES = ['taste', 'texture', 'biscuit', 'chicken', 'presentation']
CATEGORY_LABELS = {
    'taste': 'Taste',
    'texture': 'Texture',
    'biscuit': 'Biscuit',
    'chicken': 'Meat',
    'presentation': 'Sides',
}


@app.context_processor
def inject_globals():
    return {"has_api_key": bool(os.environ.get("ANTHROPIC_API_KEY"))}


def get_member_names():
    return [m.name for m in Member.query.order_by(Member.name).all()]


# ── Index ───────────────────────────────────────────────────────────

@app.route("/")
def index():
    visits = BiscuitVisit.query.order_by(BiscuitVisit.visit_date.desc()).all()
    members = get_member_names()
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
    has_rated = any(v.ratings for v in visits)
    return render_template("index.html", visits=visits, leaderboard=leaderboard,
                           members=members, today=today, has_rated=has_rated)


# ── Members ──────────────────────────────────────────────────────────

@app.route("/members/add", methods=["POST"])
def add_member():
    name = request.form.get("name", "").strip()
    if not name:
        flash("Name cannot be empty.", "danger")
        return redirect(url_for("index"))
    if Member.query.filter_by(name=name).first():
        flash(f'"{name}" is already in the crew.', "warning")
        return redirect(url_for("index"))
    db.session.add(Member(name=name))
    db.session.commit()
    flash(f'"{name}" added to the crew!', "success")
    return redirect(url_for("index"))


@app.route("/members/<member_name>/delete", methods=["POST"])
def delete_member(member_name):
    member = Member.query.filter_by(name=member_name).first_or_404()
    db.session.delete(member)
    db.session.commit()
    flash(f'"{member_name}" removed from the crew.', "success")
    return redirect(url_for("index"))


@app.route("/member/<member_name>")
def member_profile(member_name):
    member = Member.query.filter_by(name=member_name).first_or_404()
    ratings = BiscuitRating.query.filter_by(member_name=member_name).all()
    visits_rated = sorted(
        [{"visit": r.visit, "rating": r} for r in ratings],
        key=lambda x: x["visit"].visit_date,
        reverse=True,
    )
    cat_avgs = {}
    if ratings:
        for cat in CATEGORIES:
            cat_avgs[cat] = round(sum(getattr(r, cat) for r in ratings) / len(ratings), 2)
    return render_template("member.html", member=member, visits_rated=visits_rated,
                           cat_avgs=cat_avgs, categories=CATEGORIES,
                           category_labels=CATEGORY_LABELS)


@app.route("/member/<member_name>/ai")
def member_ai(member_name):
    if not os.environ.get("ANTHROPIC_API_KEY"):
        return jsonify({"error": "No API key configured."}), 503
    member = Member.query.filter_by(name=member_name).first_or_404()
    ratings = BiscuitRating.query.filter_by(member_name=member_name).all()
    if not ratings:
        return jsonify({"error": "Rate some biscuits first to get a taste profile!"})
    ratings_data = [{
        "restaurant": r.visit.restaurant_name,
        "date": r.visit.visit_date.strftime("%B %d, %Y"),
        "taste": r.taste, "texture": r.texture, "biscuit": r.biscuit,
        "meat": r.chicken, "sides": r.presentation, "overall": r.overall(),
    } for r in ratings]
    try:
        from ai import get_member_taste_profile
        return jsonify(get_member_taste_profile(member_name, ratings_data))
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/group/ai")
def group_ai():
    if not os.environ.get("ANTHROPIC_API_KEY"):
        return jsonify({"error": "No API key configured."}), 503
    member_data = []
    for m in Member.query.all():
        ratings = BiscuitRating.query.filter_by(member_name=m.name).all()
        if not ratings:
            continue
        member_data.append({
            "name": m.name,
            "ratings": [{
                "restaurant": r.visit.restaurant_name,
                "taste": r.taste, "texture": r.texture, "biscuit": r.biscuit,
                "meat": r.chicken, "sides": r.presentation, "overall": r.overall(),
            } for r in ratings]
        })
    if not member_data:
        return jsonify({"error": "Rate some biscuits first!"})
    try:
        from ai import get_group_taste_profile
        return jsonify({"profile": get_group_taste_profile(member_data)})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── Visits ──────────────────────────────────────────────────────────────

@app.route("/visit/add", methods=["POST"])
def add_visit():
    restaurant_name = request.form.get("restaurant_name", "").strip()
    visit_date_str = request.form.get("visit_date", "").strip()
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
    ))
    db.session.commit()
    flash(f'Visit to "{restaurant_name}" logged!', "success")
    return redirect(url_for("index"))


@app.route("/visit/<int:visit_id>")
def visit_detail(visit_id):
    visit = BiscuitVisit.query.get_or_404(visit_id)
    existing = {r.member_name: r for r in visit.ratings}
    members = get_member_names()
    return render_template("visit.html", visit=visit, members=members,
                           existing=existing, categories=CATEGORIES,
                           category_labels=CATEGORY_LABELS)


@app.route("/visit/<int:visit_id>/rate", methods=["POST"])
def rate_visit(visit_id):
    visit = BiscuitVisit.query.get_or_404(visit_id)
    member_name = request.form.get("member_name", "").strip()
    if not Member.query.filter_by(name=member_name).first():
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
    rating = BiscuitRating.query.filter_by(
        visit_id=visit_id, member_name=member_name
    ).first_or_404()
    db.session.delete(rating)
    db.session.commit()
    flash(f"{member_name}'s rating removed.", "success")
    return redirect(url_for("visit_detail", visit_id=visit_id))


@app.route("/restaurant/<path:restaurant_name>")
def restaurant_detail(restaurant_name):
    visits = BiscuitVisit.query.filter_by(restaurant_name=restaurant_name)\
        .order_by(BiscuitVisit.visit_date.desc()).all()
    if not visits:
        flash(f'No visits found for "{restaurant_name}".', "warning")
        return redirect(url_for("index"))
    all_ratings = [r for v in visits for r in v.ratings]
    cat_avgs = {}
    if all_ratings:
        for cat in CATEGORIES:
            cat_avgs[cat] = round(sum(getattr(r, cat) for r in all_ratings) / len(all_ratings), 2)
    overall_avg = round(sum(r.overall() for r in all_ratings) / len(all_ratings), 2) if all_ratings else None
    return render_template("restaurant.html", restaurant_name=restaurant_name,
                           visits=visits, cat_avgs=cat_avgs, overall_avg=overall_avg,
                           categories=CATEGORIES, category_labels=CATEGORY_LABELS)


@app.route("/suggestions")
def suggestions():
    return render_template("suggestions.html")


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
