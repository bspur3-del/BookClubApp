"""initial schema

Revision ID: 001
Revises:
Create Date: 2025-01-01 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = '001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    existing = inspect(conn).get_table_names()

    if 'members' not in existing:
        op.create_table('members',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('name', sa.String(length=100), nullable=False),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('name')
        )

    if 'biscuit_visits' not in existing:
        op.create_table('biscuit_visits',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('restaurant_name', sa.String(length=200), nullable=False),
            sa.Column('visit_date', sa.Date(), nullable=False),
            sa.Column('notes', sa.Text(), nullable=True),
            sa.PrimaryKeyConstraint('id')
        )

    if 'biscuit_ratings' not in existing:
        op.create_table('biscuit_ratings',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('visit_id', sa.Integer(), nullable=False),
            sa.Column('member_name', sa.String(length=100), nullable=False),
            sa.Column('taste', sa.Integer(), nullable=False),
            sa.Column('texture', sa.Integer(), nullable=False),
            sa.Column('biscuit', sa.Integer(), nullable=False),
            sa.Column('chicken', sa.Integer(), nullable=False),
            sa.Column('presentation', sa.Integer(), nullable=False),
            sa.ForeignKeyConstraint(['visit_id'], ['biscuit_visits.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id')
        )


def downgrade():
    op.drop_table('biscuit_ratings')
    op.drop_table('biscuit_visits')
    op.drop_table('members')
