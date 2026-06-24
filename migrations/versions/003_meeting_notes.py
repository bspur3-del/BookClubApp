"""add meeting_notes to books

Revision ID: 003
Revises: 002
Create Date: 2026-06-24
"""
from alembic import op
import sqlalchemy as sa

revision = '003'
down_revision = '002'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('books', sa.Column('meeting_notes', sa.Text(), nullable=True))


def downgrade():
    op.drop_column('books', 'meeting_notes')
