"""
客户需求反馈系统 - API 路由
"""
import hashlib
import re
import logging
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from smartbi.database.connection import get_db, is_postgres_enabled
from ..models import ClientRequirementCompany, ClientRequirementFeedback, Base

logger = logging.getLogger(__name__)

router = APIRouter()

TOTAL_SPEC_FIELDS = 243


# ========== Pydantic Models ==========

class LoginRequest(BaseModel):
    companyName: str
    contactName: Optional[str] = None
    contactPhone: Optional[str] = None


class FeedbackItem(BaseModel):
    section: str
    rowIndex: int
    fieldName: Optional[str] = None
    applicability: Optional[str] = None
    priority: Optional[str] = None
    note: Optional[str] = None


class SaveRequest(BaseModel):
    companyId: str
    items: List[FeedbackItem]


# ========== Helper ==========

def generate_slug(name: str) -> str:
    """Generate URL-safe slug from company name"""
    cleaned = re.sub(r'[^\w]+', '-', name, flags=re.UNICODE).strip('-').lower()
    if not cleaned:
        cleaned = "company"
    hash_suffix = int(hashlib.md5(name.encode()).hexdigest()[:8], 16) % 10000
    return f"{cleaned}-{hash_suffix:04d}"


def ensure_tables(db: Session):
    """Create tables if they don't exist"""
    try:
        from smartbi.database.connection import engine
        if engine:
            Base.metadata.create_all(bind=engine)
    except Exception as e:
        logger.warning(f"Table creation skipped: {e}")


# ========== API Endpoints ==========

@router.post("/login")
def login(request: LoginRequest, db: Session = Depends(get_db)):
    """客户登录 - 输入公司名 → 返回companyId + 已有反馈"""
    if not request.companyName or not request.companyName.strip():
        return {"success": False, "message": "公司名称不能为空", "data": None}

    ensure_tables(db)
    slug = generate_slug(request.companyName.strip())

    company = db.query(ClientRequirementCompany).filter(
        ClientRequirementCompany.company_id == slug,
        ClientRequirementCompany.deleted_at.is_(None)
    ).first()

    if not company:
        company = ClientRequirementCompany(
            company_id=slug,
            company_name=request.companyName.strip(),
            contact_name=request.contactName,
            contact_phone=request.contactPhone,
            total_fields=TOTAL_SPEC_FIELDS,
            completed_fields=0,
        )
        db.add(company)
        db.commit()
        db.refresh(company)
    else:
        updated = False
        if request.contactName and request.contactName.strip():
            company.contact_name = request.contactName.strip()
            updated = True
        if request.contactPhone and request.contactPhone.strip():
            company.contact_phone = request.contactPhone.strip()
            updated = True
        if updated:
            company.updated_at = datetime.now()
            db.commit()

    feedbacks = db.query(ClientRequirementFeedback).filter(
        ClientRequirementFeedback.company_id == slug,
        ClientRequirementFeedback.deleted_at.is_(None)
    ).all()

    return {
        "success": True,
        "message": "登录成功",
        "data": {
            "companyId": company.company_id,
            "companyName": company.company_name,
            "feedbacks": [f.to_dict() for f in feedbacks],
        }
    }


@router.post("/save")
def save(request: SaveRequest, db: Session = Depends(get_db)):
    """批量保存反馈项 (upsert)"""
    if not request.companyId or not request.items:
        return {"success": False, "message": "参数不完整", "data": None}

    company = db.query(ClientRequirementCompany).filter(
        ClientRequirementCompany.company_id == request.companyId,
        ClientRequirementCompany.deleted_at.is_(None)
    ).first()

    if not company:
        return {"success": False, "message": "公司不存在", "data": None}

    for item in request.items:
        feedback = db.query(ClientRequirementFeedback).filter(
            ClientRequirementFeedback.company_id == request.companyId,
            ClientRequirementFeedback.section == item.section,
            ClientRequirementFeedback.row_index == item.rowIndex,
            ClientRequirementFeedback.deleted_at.is_(None)
        ).first()

        if not feedback:
            feedback = ClientRequirementFeedback(
                company_id=request.companyId,
                section=item.section,
                row_index=item.rowIndex,
            )
            db.add(feedback)

        feedback.field_name = item.fieldName
        feedback.applicability = item.applicability
        feedback.priority = item.priority
        feedback.note = item.note
        feedback.updated_at = datetime.now()

    # Update completion stats
    completed = db.query(ClientRequirementFeedback).filter(
        ClientRequirementFeedback.company_id == request.companyId,
        ClientRequirementFeedback.deleted_at.is_(None)
    ).count()

    company.completed_fields = completed
    if not company.total_fields or company.total_fields == 0:
        company.total_fields = TOTAL_SPEC_FIELDS
    company.updated_at = datetime.now()

    db.commit()

    return {"success": True, "message": "保存成功", "data": None}


@router.get("/companies")
def list_companies(db: Session = Depends(get_db)):
    """管理端: 所有公司列表 + 完成度"""
    ensure_tables(db)

    companies = db.query(ClientRequirementCompany).filter(
        ClientRequirementCompany.deleted_at.is_(None)
    ).order_by(ClientRequirementCompany.updated_at.desc()).all()

    summaries = []
    for c in companies:
        total = c.total_fields or TOTAL_SPEC_FIELDS
        completed = c.completed_fields or 0
        rate = round(completed / total * 100, 1) if total > 0 else 0

        summary = c.to_dict()
        summary["completionRate"] = rate
        summaries.append(summary)

    return {"success": True, "message": "操作成功", "data": summaries}


@router.get("/{company_id}")
def get_company_feedback(company_id: str, db: Session = Depends(get_db)):
    """管理端: 某公司完整反馈"""
    company = db.query(ClientRequirementCompany).filter(
        ClientRequirementCompany.company_id == company_id,
        ClientRequirementCompany.deleted_at.is_(None)
    ).first()

    if not company:
        return {"success": False, "message": "公司不存在", "data": None}

    feedbacks = db.query(ClientRequirementFeedback).filter(
        ClientRequirementFeedback.company_id == company_id,
        ClientRequirementFeedback.deleted_at.is_(None)
    ).all()

    return {
        "success": True,
        "message": "操作成功",
        "data": {
            "companyId": company.company_id,
            "companyName": company.company_name,
            "feedbacks": [f.to_dict() for f in feedbacks],
        }
    }
