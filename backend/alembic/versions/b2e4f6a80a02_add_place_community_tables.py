"""add place-community scaffolding tables + backfill from entries

Revision ID: b2e4f6a80a02
Revises: a1c3e5f70901
Create Date: 2026-06-10 10:00:00.000000

장소-커뮤니티 예비(스캐폴딩 + 백필):
- places / place_reviews / place_review_photos / place_review_reports 생성
- entries.place_id 컬럼 추가 (FK 는 Postgres 에서만 — SQLite ALTER ADD FK 미지원)
- 백필: 기존 entries 의 비정규화 장소를 canonical Place 로 집계·연결,
  rating/review 있는 entry → PlaceReview(visibility='private', status='visible').
  ⚠️ 레거시 리뷰는 개인 기록 → 전부 private. 커뮤니티 공개는 향후 동의/약관 후.

대용량 대비: 현재 사용자 규모 작아 단일 트랜잭션 처리. 행이 수십만+로 커지면
배치 처리(서버 측 스크립트)로 분리할 것.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b2e4f6a80a02'
down_revision: Union[str, None] = 'a1c3e5f70901'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'places',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('lat', sa.Float(), nullable=True),
        sa.Column('lng', sa.Float(), nullable=True),
        sa.Column('address', sa.String(length=255), nullable=True),
        sa.Column('google_place_id', sa.String(length=128), nullable=True),
        sa.Column('category', sa.String(length=40), nullable=True),
        sa.Column('review_count', sa.Integer(), server_default='0', nullable=False),
        sa.Column('rating_sum', sa.Integer(), server_default='0', nullable=False),
        sa.Column('visit_count', sa.Integer(), server_default='0', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_places_name', 'places', ['name'])
    op.create_index('ix_places_google_place_id', 'places', ['google_place_id'])

    op.create_table(
        'place_reviews',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('place_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('entry_id', sa.Integer(), nullable=True),
        sa.Column('rating', sa.Integer(), nullable=True),
        sa.Column('body', sa.Text(), nullable=True),
        sa.Column('mood', sa.String(length=20), nullable=True),
        sa.Column('visibility', sa.String(length=16), server_default='private', nullable=False),
        sa.Column('status', sa.String(length=16), server_default='visible', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(['place_id'], ['places.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['entry_id'], ['entries.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_place_reviews_place_id', 'place_reviews', ['place_id'])
    op.create_index('ix_place_reviews_user_id', 'place_reviews', ['user_id'])
    op.create_index('ix_place_reviews_entry_id', 'place_reviews', ['entry_id'])
    op.create_index('ix_place_reviews_status', 'place_reviews', ['status'])

    op.create_table(
        'place_review_photos',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('place_review_id', sa.Integer(), nullable=False),
        sa.Column('url', sa.String(length=500), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(['place_review_id'], ['place_reviews.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_place_review_photos_place_review_id', 'place_review_photos', ['place_review_id'])

    op.create_table(
        'place_review_reports',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('place_review_id', sa.Integer(), nullable=False),
        sa.Column('reporter_user_id', sa.Integer(), nullable=True),
        sa.Column('reason', sa.String(length=255), nullable=True),
        sa.Column('status', sa.String(length=16), server_default='open', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column('resolved_by_id', sa.Integer(), nullable=True),
        sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['place_review_id'], ['place_reviews.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['reporter_user_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['resolved_by_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_place_review_reports_place_review_id', 'place_review_reports', ['place_review_id'])
    op.create_index('ix_place_review_reports_status', 'place_review_reports', ['status'])

    # entries.place_id — SQLite 는 ALTER ADD FK 미지원이라 컬럼만 추가하고 FK 는 Postgres 에서만.
    op.add_column('entries', sa.Column('place_id', sa.Integer(), nullable=True))
    op.create_index('ix_entries_place_id', 'entries', ['place_id'])
    conn = op.get_bind()
    if conn.dialect.name == 'postgresql':
        op.create_foreign_key(
            'fk_entries_place_id', 'entries', 'places',
            ['place_id'], ['id'], ondelete='SET NULL',
        )

    _backfill(conn)


def _backfill(conn) -> None:
    """기존 entries 의 장소를 canonical Place 로 집계 + place_id 연결 + 개인 리뷰 백필."""
    rows = conn.execute(sa.text(
        "SELECT id, user_id, place_name, place_lat, place_lng, place_address, "
        "category, rating, review, mood "
        "FROM entries WHERE place_name IS NOT NULL AND TRIM(place_name) <> ''"
    )).mappings().all()
    if not rows:
        return

    def key_of(r):
        if r['place_lat'] is not None and r['place_lng'] is not None:
            return ('geo', round(float(r['place_lat']), 4), round(float(r['place_lng']), 4))
        return ('name', (r['place_name'] or '').strip().lower())

    groups: dict = {}
    for r in rows:
        groups.setdefault(key_of(r), []).append(r)

    for _key, items in groups.items():
        rep = items[0]
        visit_count = len(items)
        rating_sum = sum(int(it['rating']) for it in items if it['rating'] is not None)
        review_items = [
            it for it in items
            if it['rating'] is not None or (it['review'] and str(it['review']).strip())
        ]
        review_count = len(review_items)

        conn.execute(
            sa.text(
                "INSERT INTO places (name, lat, lng, address, category, "
                "review_count, rating_sum, visit_count) "
                "VALUES (:name, :lat, :lng, :address, :category, :rc, :rs, :vc)"
            ),
            {
                "name": (rep['place_name'] or '')[:200],
                "lat": rep['place_lat'],
                "lng": rep['place_lng'],
                "address": rep['place_address'],
                "category": rep['category'],
                "rc": review_count,
                "rs": rating_sum,
                "vc": visit_count,
            },
        )
        # 단일 트랜잭션·단일 스레드라 직후 MAX(id) = 방금 INSERT 한 place id (cross-DB 안전).
        place_id = conn.execute(sa.text("SELECT MAX(id) FROM places")).scalar()

        for it in items:
            conn.execute(
                sa.text("UPDATE entries SET place_id = :pid WHERE id = :eid"),
                {"pid": place_id, "eid": it['id']},
            )

        for it in review_items:
            conn.execute(
                sa.text(
                    "INSERT INTO place_reviews "
                    "(place_id, user_id, entry_id, rating, body, mood, visibility, status) "
                    "VALUES (:pid, :uid, :eid, :rating, :body, :mood, 'private', 'visible')"
                ),
                {
                    "pid": place_id,
                    "uid": it['user_id'],
                    "eid": it['id'],
                    "rating": it['rating'],
                    "body": it['review'],
                    "mood": it['mood'],
                },
            )


def downgrade() -> None:
    conn = op.get_bind()
    if conn.dialect.name == 'postgresql':
        op.drop_constraint('fk_entries_place_id', 'entries', type_='foreignkey')
    op.drop_index('ix_entries_place_id', table_name='entries')
    op.drop_column('entries', 'place_id')
    op.drop_table('place_review_reports')
    op.drop_table('place_review_photos')
    op.drop_table('place_reviews')
    op.drop_table('places')
