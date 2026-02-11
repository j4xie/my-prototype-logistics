"""
Client Requirement Models - SQLAlchemy ORM Models

Tables:
- client_requirement_companies: Company information and completion tracking
- client_requirement_feedbacks: Individual feedback items per field
"""
from datetime import datetime
from typing import Optional

from sqlalchemy import Column, String, Integer, DateTime, Text
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()


class ClientRequirementCompany(Base):
    """Company entity for client requirement feedback"""
    __tablename__ = "client_requirement_companies"

    id = Column(Integer, primary_key=True, autoincrement=True)
    company_id = Column(String(100), unique=True, nullable=False, index=True)
    company_name = Column(String(255), nullable=False)
    contact_name = Column(String(100), nullable=True)
    contact_phone = Column(String(50), nullable=True)
    factory_id = Column(String(50), nullable=True, index=True)
    total_fields = Column(Integer, default=243)
    completed_fields = Column(Integer, default=0)
    wizard_step = Column(Integer, default=0)
    industry = Column(String(50), nullable=True)
    scale = Column(String(50), nullable=True)
    products = Column(Text, nullable=True)
    description = Column(Text, nullable=True)
    selected_modules = Column(Text, nullable=True)       # JSON: ["m1","m2","m4"]
    conversation_log = Column(Text, nullable=True)        # JSON: { "m2": [{role, content},...] }
    module_summaries = Column(Text, nullable=True)        # JSON: { "m2": "summary..." }
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    deleted_at = Column(DateTime, nullable=True)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "companyId": self.company_id,
            "companyName": self.company_name,
            "contactName": self.contact_name,
            "contactPhone": self.contact_phone,
            "factoryId": self.factory_id,
            "totalFields": self.total_fields,
            "completedFields": self.completed_fields,
            "wizardStep": self.wizard_step,
            "industry": self.industry,
            "scale": self.scale,
            "products": self.products,
            "description": self.description,
            "selectedModules": self.selected_modules,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None,
        }


class ClientRequirementFeedback(Base):
    """Individual feedback item for a spec field"""
    __tablename__ = "client_requirement_feedbacks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    company_id = Column(String(100), nullable=False, index=True)
    section = Column(String(100), nullable=False)
    row_index = Column(Integer, nullable=False)
    field_name = Column(String(255), nullable=True)
    applicability = Column(String(50), nullable=True)  # 'applicable', 'not_applicable', 'partial'
    priority = Column(String(50), nullable=True)  # 'high', 'medium', 'low'
    note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    deleted_at = Column(DateTime, nullable=True)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "companyId": self.company_id,
            "section": self.section,
            "rowIndex": self.row_index,
            "fieldName": self.field_name,
            "applicability": self.applicability,
            "priority": self.priority,
            "note": self.note,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None,
        }
