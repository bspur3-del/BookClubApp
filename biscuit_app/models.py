from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

DEFAULT_MEMBERS = ['Andrew', 'Blake', 'Jermaine', 'Jordan', 'Nick', 'Zack']


class Member(db.Model):
    __tablename__ = 'members'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True)


class BiscuitVisit(db.Model):
    __tablename__ = 'biscuit_visits'
    id = db.Column(db.Integer, primary_key=True)
    restaurant_name = db.Column(db.String(200), nullable=False)
    visit_date = db.Column(db.Date, nullable=False)
    notes = db.Column(db.Text, nullable=True)
    ratings = db.relationship('BiscuitRating', backref='visit', lazy=True, cascade='all, delete-orphan')

    def group_overall(self):
        if not self.ratings:
            return None
        return sum(r.overall() for r in self.ratings) / len(self.ratings)

    def category_averages(self):
        if not self.ratings:
            return {}
        n = len(self.ratings)
        return {
            'taste': round(sum(r.taste for r in self.ratings) / n, 2),
            'texture': round(sum(r.texture for r in self.ratings) / n, 2),
            'biscuit': round(sum(r.biscuit for r in self.ratings) / n, 2),
            'chicken': round(sum(r.chicken for r in self.ratings) / n, 2),
            'presentation': round(sum(r.presentation for r in self.ratings) / n, 2),
        }


class BiscuitRating(db.Model):
    __tablename__ = 'biscuit_ratings'
    id = db.Column(db.Integer, primary_key=True)
    visit_id = db.Column(db.Integer, db.ForeignKey('biscuit_visits.id'), nullable=False)
    member_name = db.Column(db.String(50), nullable=False)
    taste = db.Column(db.Integer, nullable=False)
    texture = db.Column(db.Integer, nullable=False)
    biscuit = db.Column(db.Integer, nullable=False)
    chicken = db.Column(db.Integer, nullable=False)
    presentation = db.Column(db.Integer, nullable=False)

    __table_args__ = (
        db.UniqueConstraint('visit_id', 'member_name', name='unique_member_visit'),
    )

    def overall(self):
        return (self.taste + self.texture + self.biscuit + self.chicken + self.presentation) / 5.0
