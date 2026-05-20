"""add past_book_ratings table

Revision ID: 002
Revises: 001
Create Date: 2026-04-18
"""
from alembic import op
import sqlalchemy as sa

revision = '002'
down_revision = '001'
branch_labels = None
depends_on = None


def upgrade():
    existing = sa.inspect(op.get_bind()).get_table_names()

    if 'past_book_ratings' not in existing:
        op.create_table(
            'past_book_ratings',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('member_id', sa.Integer(), nullable=False),
            sa.Column('past_book_id', sa.Integer(), nullable=False),
            sa.Column('rating', sa.Integer(), nullable=False),
            sa.ForeignKeyConstraint(['member_id'], ['members.id']),
            sa.ForeignKeyConstraint(['past_book_id'], ['past_books.id']),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('member_id', 'past_book_id', name='unique_member_past_book'),
        )


def downgrade():
    op.drop_table('past_book_ratings')
