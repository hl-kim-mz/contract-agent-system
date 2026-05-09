from enum import Enum
from typing import Optional
from datetime import datetime
from pydantic import BaseModel


# === Enums ===
class RiskLevel(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class RiskType(str, Enum):
    UNLIMITED_LIABILITY = "UNLIMITED_LIABILITY"
    IP_OWNERSHIP = "IP_OWNERSHIP"
    CONFIDENTIALITY_BREACH = "CONFIDENTIALITY_BREACH"
    TERMINATION_RISK = "TERMINATION_RISK"
    PAYMENT_RISK = "PAYMENT_RISK"
    PENALTY_RISK = "PENALTY_RISK"
    OTHER = "OTHER"


class WorkflowStatus(str, Enum):
    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    SKIPPED = "SKIPPED"


# === Models ===
class ClauseRisk(BaseModel):
    clause_id: str
    risk_level: RiskLevel
    risk_type: RiskType
    reason: str
    recommendation: str
    financial_impact: Optional[str] = None


class RiskReport(BaseModel):
    id: str
    contract_id: str
    overall_risk: RiskLevel
    is_standard_contract: bool = False
    risk_summary: str
    clause_risks: list[ClauseRisk] = []
    key_concerns: list[str] = []
    standard_deviation: Optional[str] = None
    escalation_required: bool = False
    created_at: datetime


class LegalReview(BaseModel):
    recommendation: Optional[str] = None
    legal_opinion: Optional[str] = None
    negotiation_points: list[str] = []
    escalation_required: bool = False


class WorkflowStep(BaseModel):
    id: str
    contract_id: str
    step_order: int
    department: str
    role: str
    status: WorkflowStatus = WorkflowStatus.PENDING
    comment: Optional[str] = None
    signed_at: Optional[str] = None
    is_parallel: bool = False
    assignee: Optional[str] = None
    created_at: Optional[datetime] = None


class SearchSource(BaseModel):
    contract_id: Optional[str] = None
    customer_name: Optional[str] = None
    version: Optional[int] = None
    clause_content: Optional[str] = None
    relevance_score: Optional[float] = None


class SearchResult(BaseModel):
    answer: str
    sources: list[SearchSource] = []
