from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

MONTH_NAMES = [
    "", "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
]

APPROVAL_THRESHOLD = 3.67


class Member(db.Model):
    __tablename__ = "members"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True)
    ratings = db.relationship("Rating", backref="member", lazy=True, cascade="all, delete-orphan")

    def average_rating(self):
        if not self.ratings:
            return None
        return sum(r.rating for r in self.ratings) / len(self.ratings)


class Book(db.Model):
    __tablename__ = "books"
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    author = db.Column(db.String(200), nullable=False)
    month = db.Column(db.Integer, nullable=False)
    year = db.Column(db.Integer, nullable=False)
    ratings = db.relationship("Rating", backref="book", lazy=True, cascade="all, delete-orphan")

    def month_name(self):
        return MONTH_NAMES[self.month]

    def average(self):
        if not self.ratings:
            return None
        return sum(r.rating for r in self.ratings) / len(self.ratings)

    def is_approved(self):
        avg = self.average()
        return avg is not None and avg >= APPROVAL_THRESHOLD

    def display_period(self):
        return f"{self.month_name()} {self.year}"


class Rating(db.Model):
    __tablename__ = "ratings"
    id = db.Column(db.Integer, primary_key=True)
    member_id = db.Column(db.Integer, db.ForeignKey("members.id"), nullable=False)
    book_id = db.Column(db.Integer, db.ForeignKey("books.id"), nullable=False)
    rating = db.Column(db.Integer, nullable=False)

    __table_args__ = (
        db.UniqueConstraint("member_id", "book_id", name="unique_member_book"),
    )
