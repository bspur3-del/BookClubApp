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
    op.execute("""
        CREATE TABLE IF NOT EXISTS book_nominations (
            book_id INTEGER NOT NULL,
            member_id INTEGER NOT NULL,
            PRIMARY KEY (book_id, member_id),
            FOREIGN KEY(book_id) REFERENCES books (id),
            FOREIGN KEY(member_id) REFERENCES members (id)
        )
    """)
    op.execute("""
        INSERT INTO book_nominations (book_id, member_id)
        SELECT id, nominator_id FROM books
        WHERE nominator_id IS NOT NULL
        ON CONFLICT DO NOTHING
    """)


def downgrade():
    op.drop_table('book_nominations')
