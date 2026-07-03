from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone

from core.database import get_db
from core.security import get_current_user
from models.comment import Comment
from models.review import Review
from models.report import Report, StatusEnum
from models.user import User

router = APIRouter(tags=["comments"])


# ── Helpers ───────────────────────────────────────────────────────────────────

def _time_ago(dt: datetime) -> str:
    """Return a human-readable relative time string."""
    if dt is None:
        return ""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    diff = datetime.now(timezone.utc) - dt
    s = int(diff.total_seconds())
    if s < 60:
        return "just now"
    if s < 3600:
        m = s // 60
        return f"{m} minute{'s' if m != 1 else ''} ago"
    if s < 86400:
        h = s // 3600
        return f"{h} hour{'s' if h != 1 else ''} ago"
    d = s // 86400
    return f"{d} day{'s' if d != 1 else ''} ago"


def _initials(name: str) -> str:
    parts = name.strip().split()
    if len(parts) >= 2:
        return (parts[0][0] + parts[-1][0]).upper()
    return name[:2].upper()


# ── Schemas ───────────────────────────────────────────────────────────────────

class UserMinOut(BaseModel):
    name: str
    avatar_initials: str

    class Config:
        from_attributes = True


class CommentIn(BaseModel):
    content: str = Field(..., min_length=1, max_length=500)


class CommentOut(BaseModel):
    id: int
    content: str
    user: UserMinOut
    created_at: datetime
    time_ago: str
    is_mine: bool

    class Config:
        from_attributes = True


class ReviewIn(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    content: Optional[str] = Field(None, max_length=1000)


class ReviewOut(BaseModel):
    id: int
    rating: int
    content: Optional[str]
    user: UserMinOut
    created_at: datetime
    time_ago: str

    class Config:
        from_attributes = True


class ReviewsResponse(BaseModel):
    average_rating: Optional[float]
    total_reviews: int
    reviews: List[ReviewOut]


# ── Comment endpoints ─────────────────────────────────────────────────────────

@router.get("/reports/{report_id}/comments", response_model=List[CommentOut])
def list_comments(
    report_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(
        # Optional auth — guests can read comments
        lambda: None
    ),
):
    """Return all comments for a report, newest first."""
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    comments = (
        db.query(Comment)
        .filter(Comment.report_id == report_id)
        .order_by(Comment.created_at.asc())
        .all()
    )
    return [
        CommentOut(
            id=c.id,
            content=c.content,
            user=UserMinOut(
                name=c.user.name,
                avatar_initials=_initials(c.user.name),
            ),
            created_at=c.created_at,
            time_ago=_time_ago(c.created_at),
            is_mine=False,   # guest view — always False
        )
        for c in comments
    ]


@router.get("/reports/{report_id}/comments/me", response_model=List[CommentOut])
def list_comments_authed(
    report_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Same as above but marks comments belonging to the current user."""
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    comments = (
        db.query(Comment)
        .filter(Comment.report_id == report_id)
        .order_by(Comment.created_at.asc())
        .all()
    )
    return [
        CommentOut(
            id=c.id,
            content=c.content,
            user=UserMinOut(
                name=c.user.name,
                avatar_initials=_initials(c.user.name),
            ),
            created_at=c.created_at,
            time_ago=_time_ago(c.created_at),
            is_mine=(c.user_id == current_user.id),
        )
        for c in comments
    ]


@router.post(
    "/reports/{report_id}/comments",
    response_model=CommentOut,
    status_code=status.HTTP_201_CREATED,
)
def add_comment(
    report_id: int,
    body: CommentIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add a comment to a report (login required)."""
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    comment = Comment(
        content=body.content.strip(),
        report_id=report_id,
        user_id=current_user.id,
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)

    return CommentOut(
        id=comment.id,
        content=comment.content,
        user=UserMinOut(
            name=current_user.name,
            avatar_initials=_initials(current_user.name),
        ),
        created_at=comment.created_at,
        time_ago=_time_ago(comment.created_at),
        is_mine=True,
    )


@router.delete("/comments/{comment_id}")
def delete_comment(
    comment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a comment. Only the owner or an admin can do this."""
    comment = db.query(Comment).filter(Comment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    if comment.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to delete this comment",
        )

    db.delete(comment)
    db.commit()
    return {"message": "Comment deleted"}


# ── Review endpoints ──────────────────────────────────────────────────────────

@router.get("/reports/{report_id}/reviews", response_model=ReviewsResponse)
def list_reviews(
    report_id: int,
    db: Session = Depends(get_db),
):
    """Return all reviews and average rating for a report."""
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    reviews = (
        db.query(Review)
        .filter(Review.report_id == report_id)
        .order_by(Review.created_at.desc())
        .all()
    )

    avg = (
        round(sum(r.rating for r in reviews) / len(reviews), 1)
        if reviews
        else None
    )

    return ReviewsResponse(
        average_rating=avg,
        total_reviews=len(reviews),
        reviews=[
            ReviewOut(
                id=r.id,
                rating=r.rating,
                content=r.content,
                user=UserMinOut(
                    name=r.user.name,
                    avatar_initials=_initials(r.user.name),
                ),
                created_at=r.created_at,
                time_ago=_time_ago(r.created_at),
            )
            for r in reviews
        ],
    )


@router.post(
    "/reports/{report_id}/reviews",
    response_model=ReviewOut,
    status_code=status.HTTP_201_CREATED,
)
def add_review(
    report_id: int,
    body: ReviewIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Add a review to a report (login required).
    - Only fixed reports can be reviewed.
    - One review per user per report.
    """
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    if report.status != StatusEnum.fixed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You can only review reports that have been marked as fixed",
        )

    existing = (
        db.query(Review)
        .filter(Review.user_id == current_user.id, Review.report_id == report_id)
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You have already reviewed this report",
        )

    review = Review(
        rating=body.rating,
        content=body.content.strip() if body.content else None,
        report_id=report_id,
        user_id=current_user.id,
    )
    db.add(review)
    db.commit()
    db.refresh(review)

    return ReviewOut(
        id=review.id,
        rating=review.rating,
        content=review.content,
        user=UserMinOut(
            name=current_user.name,
            avatar_initials=_initials(current_user.name),
        ),
        created_at=review.created_at,
        time_ago=_time_ago(review.created_at),
    )


@router.delete("/reviews/{review_id}")
def delete_review(
    review_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a review. Only the owner or an admin can do this."""
    review = db.query(Review).filter(Review.id == review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")

    if review.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to delete this review",
        )

    db.delete(review)
    db.commit()
    return {"message": "Review deleted"}
