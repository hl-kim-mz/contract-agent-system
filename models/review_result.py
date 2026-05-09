from enum import Enum
from typing import Optional
from datetime import datetime
from pydantic import BaseModel


# === Enums ===
class RiskLevel(str, Enum):
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class RiskType(str, Enum):
    UNLIMITED_LIABILITY = "무제한_배상책임"
    IP_FULL_TRANSFER = "IP_완전이전"
    UNILATERAL_TERMINATION = "일방적_해지권"
    EXCESSIVE_PENALTY = "과도한_지체상금"
    CR_UNDEFINED = "CR_절차_미정의"
    OTHER = "기타"


class WorkflowStatus(str, Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


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
