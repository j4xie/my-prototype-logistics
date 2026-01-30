"""
客户需求反馈系统 - 数据库模型
"""
from sqlalchemy import Column, BigInteger, String, Integer, DateTime, UniqueConstraint, Index, text
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()


class ClientRequirementCompany(Base):
    __tablename__ = "client_requirement_company"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    company_id = Column(String(100), unique=True, nullable=False)
    company_name = Column(String(200), nullable=False)
    contact_name = Column(String(100))
    contact_phone = Column(String(50))
    total_fields = Column(Integer, default=0)
    completed_fields = Column(Integer, default=0)
    created_at = Column(DateTime, server_default=text("CURRENT_TIMESTAMP"), nullable=False)
    updated_at = Column(DateTime, server_default=text("CURRENT_TIMESTAMP"), nullable=False)
    deleted_at = Column(DateTime)

    def to_dict(self):
        return {
            "companyId": self.company_id,
            "companyName": self.company_name,
            "contactName": self.contact_name,
            "contactPhone": self.contact_phone,
            "totalFields": self.total_fields,
            "completedFields": self.completed_fields,
            "updatedAt": self.updated_at.strftime("%Y-%m-%d %H:%M:%S") if self.updated_at else None,
        }


class ClientRequirementFeedback(Base):
    __tablename__ = "client_requirement_feedback"
    __table_args__ = (
        UniqueConstraint("company_id", "section", "row_index", name="uk_company_section_row"),
        Index("idx_feedback_company_id", "company_id"),
    )

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    company_id = Column(String(100), nullable=False)
    section = Column(String(100), nullable=False)
    row_index = Column(Integer, nullable=False)
    field_name = Column(String(200))
    applicability = Column(String(50))
    priority = Column(String(50))
    note = Column(String(1000))
    created_at = Column(DateTime, server_default=text("CURRENT_TIMESTAMP"), nullable=False)
    updated_at = Column(DateTime, server_default=text("CURRENT_TIMESTAMP"), nullable=False)
    deleted_at = Column(DateTime)

    def to_dict(self):
        return {
            "section": self.section,
            "rowIndex": self.row_index,
            "fieldName": self.field_name,
            "applicability": self.applicability,
            "priority": self.priority,
            "note": self.note,
        }
