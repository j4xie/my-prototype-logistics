"""
客户需求反馈系统 - API 路由
"""
import hashlib
import json
import os
import re
import logging
from datetime import datetime
from typing import List, Optional, Dict

import httpx
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from smartbi.database.connection import get_db, is_postgres_enabled
from .models import ClientRequirementCompany, ClientRequirementFeedback, Base
from .ai_consultant import AIConsultant, ChatResponse, AssessmentResult

logger = logging.getLogger(__name__)

router = APIRouter()

TOTAL_SPEC_FIELDS = 243

# Java backend URL for cross-service calls
JAVA_API_BASE = os.getenv("JAVA_API_BASE", "http://localhost:10010")


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


class LinkFactoryRequest(BaseModel):
    companyId: str
    factoryId: str


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

    # If company is linked to a factory, trigger visibility recompute
    if company.factory_id:
        try:
            with httpx.Client(timeout=10.0) as client:
                resp = client.post(
                    f"{JAVA_API_BASE}/api/mobile/{company.factory_id}/field-visibility/recompute"
                )
                if resp.status_code == 200:
                    logger.info(f"Triggered visibility recompute for factory {company.factory_id}")
                else:
                    logger.warning(f"Recompute returned {resp.status_code}")
        except Exception as e:
            logger.warning(f"Failed to trigger recompute: {e}")

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


# ========== Phase 6: AI Onboarding Wizard ==========
# NOTE: Must be defined BEFORE /{company_id} catch-all route

ai_consultant = AIConsultant()

INTERNAL_API_KEY = os.getenv("INTERNAL_API_KEY", "cretas-internal-2026")


class WizardStartRequest(BaseModel):
    factoryName: str
    contactName: Optional[str] = None
    contactPhone: Optional[str] = None
    industry: Optional[str] = None
    scale: Optional[str] = None
    products: Optional[str] = None
    description: Optional[str] = None


class WizardChatRequest(BaseModel):
    companyId: str
    moduleId: str
    message: str
    conversationHistory: List[dict] = []


class WizardStartModuleRequest(BaseModel):
    companyId: str
    moduleId: str
    selectedModules: List[str] = []
    priorModulesSummary: dict = {}


class WizardAssessRequest(BaseModel):
    companyId: str
    selectedModules: List[str] = []
    allConversations: dict = {}


class WizardFinalizeRequest(BaseModel):
    companyId: str
    assessmentData: dict = {}


@router.post("/wizard/start")
def wizard_start(request: WizardStartRequest, db: Session = Depends(get_db)):
    """Step 1: Create company + save basic info + return module list."""
    if not request.factoryName or not request.factoryName.strip():
        return {"success": False, "message": "工厂名称不能为空"}

    ensure_tables(db)
    slug = generate_slug(request.factoryName.strip())

    company = db.query(ClientRequirementCompany).filter(
        ClientRequirementCompany.company_id == slug,
        ClientRequirementCompany.deleted_at.is_(None)
    ).first()

    if not company:
        company = ClientRequirementCompany(
            company_id=slug,
            company_name=request.factoryName.strip(),
            contact_name=request.contactName,
            contact_phone=request.contactPhone,
            industry=request.industry,
            scale=request.scale,
            products=request.products,
            description=request.description,
            total_fields=TOTAL_SPEC_FIELDS,
            completed_fields=0,
            wizard_step=1,
        )
        db.add(company)
    else:
        company.company_name = request.factoryName.strip()
        if request.contactName:
            company.contact_name = request.contactName
        if request.contactPhone:
            company.contact_phone = request.contactPhone
        company.industry = request.industry
        company.scale = request.scale
        company.products = request.products
        company.description = request.description
        company.wizard_step = 1
        company.updated_at = datetime.now()

    db.commit()
    db.refresh(company)

    from .ai_consultant import MODULE_TOPICS
    modules = [
        {"id": mid, "name": info["name"], "topics": info["topics"]}
        for mid, info in MODULE_TOPICS.items()
    ]

    return {
        "success": True,
        "data": {
            "companyId": company.company_id,
            "companyName": company.company_name,
            "modules": modules,
        },
    }


@router.post("/wizard/start-module")
async def wizard_start_module(request: WizardStartModuleRequest, db: Session = Depends(get_db)):
    """Start AI conversation for a specific module."""
    company = db.query(ClientRequirementCompany).filter(
        ClientRequirementCompany.company_id == request.companyId,
        ClientRequirementCompany.deleted_at.is_(None)
    ).first()

    if not company:
        return {"success": False, "message": "公司不存在"}

    # Save selected modules
    company.selected_modules = json.dumps(request.selectedModules)
    company.wizard_step = 3
    company.updated_at = datetime.now()
    db.commit()

    basic_info = {
        "factoryName": company.company_name,
        "industry": company.industry or "",
        "scale": company.scale or "",
        "products": company.products or "",
        "description": company.description or "",
    }

    result = await ai_consultant.start_module_chat(
        session_id=request.companyId,
        module_id=request.moduleId,
        basic_info=basic_info,
        selected_modules=request.selectedModules,
        prior_modules_summary=request.priorModulesSummary,
    )

    return {
        "success": True,
        "data": {
            "message": result.message,
            "suggestedReplies": result.suggested_replies,
            "moduleComplete": result.module_complete,
            "moduleSummary": result.module_summary,
            "topicsCovered": result.topics_covered,
            "topicsRemaining": result.topics_remaining,
        },
    }


@router.post("/wizard/chat")
async def wizard_chat(request: WizardChatRequest, db: Session = Depends(get_db)):
    """Multi-turn conversation core."""
    company = db.query(ClientRequirementCompany).filter(
        ClientRequirementCompany.company_id == request.companyId,
        ClientRequirementCompany.deleted_at.is_(None)
    ).first()

    if not company:
        return {"success": False, "message": "公司不存在"}

    basic_info = {
        "factoryName": company.company_name,
        "industry": company.industry or "",
        "scale": company.scale or "",
        "products": company.products or "",
        "description": company.description or "",
    }

    selected_modules = []
    if company.selected_modules:
        try:
            selected_modules = json.loads(company.selected_modules)
        except json.JSONDecodeError:
            pass

    prior_summaries = {}
    if company.module_summaries:
        try:
            prior_summaries = json.loads(company.module_summaries)
        except json.JSONDecodeError:
            pass

    result = await ai_consultant.chat(
        session_id=request.companyId,
        module_id=request.moduleId,
        user_message=request.message,
        conversation_history=request.conversationHistory,
        basic_info=basic_info,
        selected_modules=selected_modules,
        prior_modules_summary=prior_summaries,
    )

    # If module completed, save the summary
    if result.module_complete and result.module_summary:
        prior_summaries[request.moduleId] = result.module_summary
        company.module_summaries = json.dumps(prior_summaries, ensure_ascii=False)

    # Save conversation log
    existing_log = {}
    if company.conversation_log:
        try:
            existing_log = json.loads(company.conversation_log)
        except json.JSONDecodeError:
            pass

    # Append the new messages to the log
    module_history = existing_log.get(request.moduleId, [])
    module_history.append({"role": "user", "content": request.message})
    module_history.append({"role": "assistant", "content": result.message})
    existing_log[request.moduleId] = module_history
    company.conversation_log = json.dumps(existing_log, ensure_ascii=False)

    company.updated_at = datetime.now()
    db.commit()

    return {
        "success": True,
        "data": {
            "message": result.message,
            "suggestedReplies": result.suggested_replies,
            "moduleComplete": result.module_complete,
            "moduleSummary": result.module_summary,
            "topicsCovered": result.topics_covered,
            "topicsRemaining": result.topics_remaining,
        },
    }


@router.post("/wizard/assess")
async def wizard_assess(request: WizardAssessRequest, db: Session = Depends(get_db)):
    """Generate 243-field assessment based on all conversations."""
    company = db.query(ClientRequirementCompany).filter(
        ClientRequirementCompany.company_id == request.companyId,
        ClientRequirementCompany.deleted_at.is_(None)
    ).first()

    if not company:
        return {"success": False, "message": "公司不存在"}

    basic_info = {
        "factoryName": company.company_name,
        "industry": company.industry or "",
        "scale": company.scale or "",
        "products": company.products or "",
        "description": company.description or "",
    }

    # Use conversations from request, or fall back to stored log
    conversations = request.allConversations
    if not conversations and company.conversation_log:
        try:
            conversations = json.loads(company.conversation_log)
        except json.JSONDecodeError:
            conversations = {}

    selected_modules = request.selectedModules
    if not selected_modules and company.selected_modules:
        try:
            selected_modules = json.loads(company.selected_modules)
        except json.JSONDecodeError:
            selected_modules = []

    result = await ai_consultant.assess_all_fields(
        basic_info=basic_info,
        selected_modules=selected_modules,
        all_conversations=conversations,
    )

    company.wizard_step = 4
    company.updated_at = datetime.now()
    db.commit()

    return {
        "success": True,
        "data": {
            "summary": result.summary,
            "confidence": result.confidence,
            "items": [item.dict() for item in result.items],
            "moduleInsights": result.moduleInsights,
            "formSchemas": result.formSchemas,
            "moduleConfigs": result.moduleConfigs,
            "stageTemplates": result.stageTemplates,
            "alertThresholds": result.alertThresholds,
            "factoryMetadata": result.factoryMetadata,
        },
    }


@router.post("/wizard/finalize")
async def wizard_finalize(request: WizardFinalizeRequest, db: Session = Depends(get_db)):
    """Save assessment + create factory + users + configs via Java API."""
    company = db.query(ClientRequirementCompany).filter(
        ClientRequirementCompany.company_id == request.companyId,
        ClientRequirementCompany.deleted_at.is_(None)
    ).first()

    if not company:
        return {"success": False, "message": "公司不存在"}

    # Idempotency guard: if factory already created, return existing result
    if company.factory_id and company.wizard_step == 5:
        logger.warning(f"Duplicate finalize attempt for company {request.companyId}, "
                       f"factory {company.factory_id} already exists")
        return {
            "success": True,
            "data": {
                "factoryId": company.factory_id,
                "users": [],
                "formTemplatesCreated": 0,
                "stagesCreated": 0,
                "alertsCreated": 0,
                "companyId": company.company_id,
                "alreadyFinalized": True,
            },
        }

    assessment = request.assessmentData

    # Step 1: Save assessment items as ClientRequirementFeedback rows
    items = assessment.get("items", [])
    for item in items:
        feedback = db.query(ClientRequirementFeedback).filter(
            ClientRequirementFeedback.company_id == request.companyId,
            ClientRequirementFeedback.section == item.get("section", ""),
            ClientRequirementFeedback.row_index == item.get("rowIndex", 0),
            ClientRequirementFeedback.deleted_at.is_(None),
        ).first()

        if not feedback:
            feedback = ClientRequirementFeedback(
                company_id=request.companyId,
                section=item.get("section", ""),
                row_index=item.get("rowIndex", 0),
            )
            db.add(feedback)

        feedback.field_name = item.get("fieldName", "")
        feedback.applicability = "适用" if item.get("applicable") else "不适用"
        feedback.priority = "high" if item.get("confidence", 0) > 0.8 else "medium"
        feedback.note = item.get("reasoning", "")
        feedback.updated_at = datetime.now()

    company.completed_fields = len(items)
    db.commit()

    # Step 2: Call Java internal API to create factory
    factory_metadata = assessment.get("factoryMetadata", {})
    module_configs = assessment.get("moduleConfigs", {})
    form_schemas = assessment.get("formSchemas", {})
    stage_templates = assessment.get("stageTemplates", [])
    alert_thresholds = assessment.get("alertThresholds", [])

    # Build Java request
    java_request = {
        "factoryName": company.company_name,
        "contactName": company.contact_name or "",
        "contactPhone": company.contact_phone or "",
        "industryCode": factory_metadata.get("industryCode", "OTHER"),
        "regionCode": factory_metadata.get("regionCode", "3101"),
        "surveyCompanyId": company.company_id,
        "moduleConfigs": [
            {
                "moduleId": mid,
                "moduleName": config.get("moduleName", mid),
                "enabled": True,
                "config": config,
            }
            for mid, config in module_configs.items()
        ],
        "formSchemas": {
            entity_type: json.dumps(schema, ensure_ascii=False)
            for entity_type, schema in form_schemas.items()
        },
        "stageTemplates": stage_templates,
        "alertThresholds": alert_thresholds,
        "analysisDimensions": [],
        "benchmarks": {},
    }

    # Collect all analysis dimensions from all module configs
    for mid, config in module_configs.items():
        dims = config.get("analysisDimensions", [])
        java_request["analysisDimensions"].extend(dims)
        benchmarks = config.get("benchmarks", {})
        java_request["benchmarks"].update(benchmarks)

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{JAVA_API_BASE}/api/internal/onboarding/create-factory",
                json=java_request,
                headers={"X-Internal-Key": INTERNAL_API_KEY},
            )
            if resp.status_code == 200:
                java_result = resp.json()
                if java_result.get("success"):
                    factory_data = java_result.get("data", {})
                    factory_id = factory_data.get("factoryId", "")

                    # Link company to factory
                    company.factory_id = factory_id
                    company.wizard_step = 5
                    company.updated_at = datetime.now()
                    db.commit()

                    return {
                        "success": True,
                        "data": {
                            "factoryId": factory_id,
                            "users": factory_data.get("users", []),
                            "formTemplatesCreated": factory_data.get("formTemplatesCreated", 0),
                            "stagesCreated": factory_data.get("stagesCreated", 0),
                            "alertsCreated": factory_data.get("alertsCreated", 0),
                            "companyId": company.company_id,
                        },
                    }
                else:
                    return {
                        "success": False,
                        "message": f"Java API error: {java_result.get('message', 'unknown')}",
                    }
            else:
                return {
                    "success": False,
                    "message": f"Java API returned {resp.status_code}: {resp.text[:200]}",
                }
    except Exception as e:
        logger.error(f"Failed to call Java onboarding API: {e}")
        return {
            "success": False,
            "message": f"无法连接到后端服务: {str(e)}",
        }


# ========== Phase 3: Not-Applicable Fields for Visibility Sync ==========
# NOTE: Must be defined BEFORE /{company_id} catch-all route

@router.get("/{company_id}/not-applicable-fields")
def get_not_applicable_fields(company_id: str, db: Session = Depends(get_db)):
    """Return all fields marked '不适用' in the survey, for Java visibility sync."""
    company = db.query(ClientRequirementCompany).filter(
        ClientRequirementCompany.company_id == company_id,
        ClientRequirementCompany.deleted_at.is_(None)
    ).first()

    if not company:
        return {"success": False, "message": "公司不存在", "data": []}

    feedbacks = db.query(ClientRequirementFeedback).filter(
        ClientRequirementFeedback.company_id == company_id,
        ClientRequirementFeedback.applicability == '不适用',
        ClientRequirementFeedback.deleted_at.is_(None)
    ).all()

    items = [{
        "section": f.section,
        "rowIndex": f.row_index,
        "fieldName": f.field_name,
    } for f in feedbacks]

    return {"success": True, "data": items}


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

    # Build responses dict keyed by section → field_name → status
    responses = {}
    for f in feedbacks:
        if f.section not in responses:
            responses[f.section] = {}
        responses[f.section][f.field_name or f"row_{f.row_index}"] = {
            "status": f.applicability or "",
            "importance": f.priority or "",
            "note": f.note or "",
        }

    return {
        "success": True,
        "message": "操作成功",
        "data": {
            "companyId": company.company_id,
            "companyName": company.company_name,
            "contactName": company.contact_name,
            "contactPhone": company.contact_phone,
            "factoryId": company.factory_id,
            "feedbacks": [f.to_dict() for f in feedbacks],
            "responses": responses,
        }
    }


# ========== Phase 2: Company-Factory Linking ==========

@router.post("/link-factory")
def link_factory(request: LinkFactoryRequest, db: Session = Depends(get_db)):
    """Link a survey company to a Cretas factory, then trigger visibility recompute."""
    company = db.query(ClientRequirementCompany).filter(
        ClientRequirementCompany.company_id == request.companyId,
        ClientRequirementCompany.deleted_at.is_(None)
    ).first()

    if not company:
        return {"success": False, "message": "公司不存在"}

    company.factory_id = request.factoryId
    company.updated_at = datetime.now()
    db.commit()

    # Call Java API to set factory.surveyCompanyId and trigger recompute
    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.post(
                f"{JAVA_API_BASE}/api/mobile/{request.factoryId}/link-survey-company",
                json={"companyId": request.companyId}
            )
            if resp.status_code == 200:
                logger.info(f"Linked company {request.companyId} to factory {request.factoryId}")
            else:
                logger.warning(f"Java link-survey-company returned {resp.status_code}: {resp.text}")
    except Exception as e:
        logger.warning(f"Failed to notify Java about factory link: {e}")

    return {"success": True, "message": f"已关联到工厂 {request.factoryId}"}


# ========== Phase 4: Gap Analysis ==========

@router.get("/gap-analysis/{factory_id}")
async def gap_analysis(factory_id: str, db: Session = Depends(get_db)):
    """Compare survey declarations vs actual data completeness."""
    # Find company linked to this factory
    company = db.query(ClientRequirementCompany).filter(
        ClientRequirementCompany.factory_id == factory_id,
        ClientRequirementCompany.deleted_at.is_(None)
    ).first()

    if not company:
        return {"success": False, "message": f"工厂 {factory_id} 未关联调研公司"}

    # Get all feedbacks for this company
    feedbacks = db.query(ClientRequirementFeedback).filter(
        ClientRequirementFeedback.company_id == company.company_id,
        ClientRequirementFeedback.deleted_at.is_(None)
    ).all()

    feedback_map: Dict[str, str] = {}
    for f in feedbacks:
        key = f"{f.section}:{f.row_index}"
        feedback_map[key] = f.applicability or ""

    # Get field null rates from Java API
    null_rates: Dict[str, Dict[str, float]] = {}
    entity_types = ["PROCESSING_BATCH", "WORK_SESSION", "MATERIAL_BATCH", "QUALITY_INSPECTION", "EQUIPMENT"]
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            for et in entity_types:
                resp = await client.get(
                    f"{JAVA_API_BASE}/api/mobile/{factory_id}/field-null-counts/{et}"
                )
                if resp.status_code == 200:
                    body = resp.json()
                    if body.get("success"):
                        null_rates[et] = body["data"]
    except Exception as e:
        logger.warning(f"Failed to fetch null rates from Java: {e}")

    # Get field_capability_mapping from cretas_db
    import asyncpg
    db_url = os.getenv("COMPLETENESS_DB_URL", "postgresql://cretas_user:cretas_pass@localhost:5432/cretas_db")
    mappings = []
    try:
        conn = await asyncpg.connect(db_url)
        rows = await conn.fetch(
            "SELECT entity_type, entity_field, survey_section_html, survey_row_index_html, survey_field_name "
            "FROM field_capability_mapping WHERE survey_section_html IS NOT NULL"
        )
        mappings = [dict(r) for r in rows]
        await conn.close()
    except Exception as e:
        logger.warning(f"Failed to fetch field_capability_mapping: {e}")

    # Build gap report
    gaps = []
    for m in mappings:
        et = m["entity_type"]
        ef = m["entity_field"]
        section_html = m["survey_section_html"]
        row_html = m["survey_row_index_html"]
        field_name = m["survey_field_name"]

        # Survey declaration
        key = f"{section_html}:{row_html}"
        declaration = feedback_map.get(key, "")

        # Actual completeness (100 - null_rate)
        field_null_rates = null_rates.get(et, {})
        null_rate = field_null_rates.get(ef, 100.0)
        completeness = round(100.0 - null_rate, 1)

        declared_applicable = declaration in ("适用", "必须有", "需调整", "")
        declared_not_applicable = declaration == "不适用"

        if declared_not_applicable and completeness <= 50:
            status = "HIDDEN_OK"
        elif declared_not_applicable and completeness > 50:
            status = "OVER_DELIVER"
        elif declared_applicable and completeness >= 50:
            status = "OK"
        elif declared_applicable and completeness < 50:
            status = "PROMISE_BROKEN"
        else:
            status = "OK"

        gaps.append({
            "entityType": et,
            "entityField": ef,
            "surveyFieldName": field_name,
            "declaration": declaration or "未填写",
            "completeness": completeness,
            "status": status,
        })

    # Group by entity_type
    grouped: Dict[str, list] = {}
    for g in gaps:
        et = g["entityType"]
        if et not in grouped:
            grouped[et] = []
        grouped[et].append(g)

    summary = {
        "ok": sum(1 for g in gaps if g["status"] == "OK"),
        "promiseBroken": sum(1 for g in gaps if g["status"] == "PROMISE_BROKEN"),
        "hiddenOk": sum(1 for g in gaps if g["status"] == "HIDDEN_OK"),
        "overDeliver": sum(1 for g in gaps if g["status"] == "OVER_DELIVER"),
        "total": len(gaps),
    }

    return {
        "success": True,
        "data": {
            "factoryId": factory_id,
            "companyName": company.company_name,
            "summary": summary,
            "gaps": grouped,
        }
    }


# ========== Phase 5: Guide Config for Dynamic Guide Page ==========

@router.get("/guide-config/{factory_id}")
async def guide_config(factory_id: str, db: Session = Depends(get_db)):
    """Return guide configuration for a factory: visible fields + completeness."""
    company = db.query(ClientRequirementCompany).filter(
        ClientRequirementCompany.factory_id == factory_id,
        ClientRequirementCompany.deleted_at.is_(None)
    ).first()

    factory_name = factory_id
    if company:
        factory_name = company.company_name

    # Get hidden fields from Java
    hidden_fields: Dict[str, List[str]] = {}
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(f"{JAVA_API_BASE}/api/mobile/{factory_id}/field-visibility")
            if resp.status_code == 200:
                body = resp.json()
                if body.get("success"):
                    hidden_fields = body.get("data", {})
    except Exception as e:
        logger.warning(f"Failed to fetch hidden fields: {e}")

    # Get null rates per entity
    entity_types = ["PROCESSING_BATCH", "WORK_SESSION", "MATERIAL_BATCH", "QUALITY_INSPECTION", "EQUIPMENT"]
    completeness_data: Dict[str, Dict[str, float]] = {}
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            for et in entity_types:
                resp = await client.get(f"{JAVA_API_BASE}/api/mobile/{factory_id}/field-null-counts/{et}")
                if resp.status_code == 200:
                    body = resp.json()
                    if body.get("success"):
                        completeness_data[et] = {k: round(100.0 - v, 1) for k, v in body["data"].items()}
    except Exception as e:
        logger.warning(f"Failed to fetch completeness: {e}")

    # Get mappings
    import asyncpg
    db_url = os.getenv("COMPLETENESS_DB_URL", "postgresql://cretas_user:cretas_pass@localhost:5432/cretas_db")
    sections = []
    try:
        conn = await asyncpg.connect(db_url)
        rows = await conn.fetch(
            "SELECT entity_type, entity_field, survey_field_name, form_schema_key, is_required_for_entity "
            "FROM field_capability_mapping ORDER BY entity_type, survey_row_index"
        )
        await conn.close()

        # Group by entity_type
        section_map: Dict[str, list] = {}
        for r in rows:
            et = r["entity_type"]
            ef = r["entity_field"]
            hidden_list = hidden_fields.get(et, [])
            visible = ef not in hidden_list
            comp = completeness_data.get(et, {}).get(ef, 0)

            if et not in section_map:
                section_map[et] = []
            section_map[et].append({
                "name": r["survey_field_name"],
                "apiField": ef,
                "visible": visible,
                "required": bool(r["is_required_for_entity"]),
                "completeness": comp,
            })

        for et, fields in section_map.items():
            sections.append({"id": et, "fields": fields})
    except Exception as e:
        logger.warning(f"Failed to build guide config: {e}")

    # Overall completeness
    all_comp = []
    for s in sections:
        for f in s["fields"]:
            if f["visible"]:
                all_comp.append(f["completeness"])
    overall = round(sum(all_comp) / len(all_comp), 1) if all_comp else 0

    return {
        "success": True,
        "data": {
            "factoryId": factory_id,
            "factoryName": factory_name,
            "sections": sections,
            "overallCompleteness": overall,
        }
    }
