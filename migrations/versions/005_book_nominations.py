"""add book_nominations many-to-many table

Revision ID: 005
Revises: 004
Create Date: 2026-06-24
"""
from alembic import op
import sqlalchemy as sa

revision = '005'
down_revision = '004'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'book_nominations',
        sa.Column('book_id', sa.Integer(), nullable=False),
        sa.Column('member_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['book_id'], ['books.id']),
        sa.ForeignKeyConstraint(['member_id'], ['members.id']),
        sa.PrimaryKeyConstraint('book_id', 'member_id'),
    )
    # Migrate existing single-nominator data into the new table
    op.execute("""
        INSERT INTO book_nominations (book_id, member_id)
        SELECT id, nominator_id FROM books WHERE nominator_id IS NOT NULL
    """)


def downgrade():
    op.drop_table('book_nominations')
