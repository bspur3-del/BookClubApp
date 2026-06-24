"""add is_upcoming and meeting_date to books

Revision ID: 004
Revises: 003
Create Date: 2026-06-24
"""
from alembic import op
import sqlalchemy as sa

revision = '004'
down_revision = '003'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('books', sa.Column('is_upcoming', sa.Boolean(), nullable=True))
    op.add_column('books', sa.Column('meeting_date', sa.Date(), nullable=True))


def downgrade():
    op.drop_column('books', 'meeting_date')
    op.drop_column('books', 'is_upcoming')
