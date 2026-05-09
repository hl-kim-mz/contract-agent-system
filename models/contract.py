from enum import Enum
from typing import Generic, Optional, TypeVar
from datetime import datetime
from pydantic import BaseModel

T = TypeVar("T")


# === Enums ===
class ContractType(str, Enum):
    NDA = "NDA"
    MSA = "MSA"
    SI = "SI"
    SLA = "SLA"
    MAINTENANCE = "Maintenance"
    OUTSOURCING = "Outsourcing"
    OTHER = "Other"


class ContractStatus(str, Enum):
    DRAFT = "DRAFT"
    PARSING = "PARSING"
    RISK_REVIEWED = "RISK_REVIEWED"
    PENDING_APPROVAL = "PENDING_APPROVAL"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class ClauseType(str, Enum):
    LIABILITY = "liability"
    IP = "ip"
    CONFIDENTIALITY = "confidentiality"
    TERMINATION = "termination"
    DISPUTE = "dispute"
    PENALTY = "penalty"
    OTHER = "other"


# === Core Sub-models ===
class Party(BaseModel):
    name: str
    representative: Optional[str] = None


class PartyInfo(BaseModel):
    name: str
    representative: Optional[str] = None


class Parties(BaseModel):
    party_a: Optional[PartyInfo] = None
    party_b: Optional[PartyInfo] = None


class ContractDates(BaseModel):
    contract_date: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    renewal_terms: Optional[str] = None


class Financials(BaseModel):
    total_amount: int = 0
    currency: str = "KRW"
    payment_terms: Optional[str] = None
    penalty_clause: Optional[str] = None
    delay_penalty_rate: Optional[str] = None


class Clause(BaseModel):
    id: str
    type: ClauseType
    title: str
    content: str
    paragraph: int


# === Contract Main Model ===
class Contract(BaseModel):
    id: str
    customer_name: str
    contract_type: Optional[str] = None
    version: int
    status: str
    overall_risk: Optional[str] = None
    is_standard: bool = False
    uploaded_at: str
    uploaded_by: str
    s3_key: str
    file_name: str
    total_amount: Optional[int] = None
    entities: Optional[dict] = None
    parsed_at: Optional[str] = None
    analyzed_at: Optional[str] = None
    clauses_json: Optional[str] = None
    diff_report_json: Optional[str] = None


class ContractParsed(BaseModel):
    contract_type: ContractType
    is_standard: bool
    parties: Parties
    dates: ContractDates
    financials: Financials
    clauses: list[Clause]


class PromptTemplate(BaseModel):
    id: str
    contract_type: ContractType
    prompt_name: str
    system_prompt: str
    updated_at: datetime
    updated_by: str


class ApiResponse(BaseModel, Generic[T]):
    success: bool
    data: Optional[T] = None
    error: Optional[str] = None


class ErrorResponse(BaseModel):
    success: bool = False
    error: str
    detail: Optional[str] = None


# === FE Response Models (unchanged) ===
class ContractDetail(BaseModel):
    id: str
    customer_name: str
    contract_type: Optional[str] = None
    version: int
    status: str
    file_name: str
    uploaded_at: str
    uploaded_by: str
    total_amount: Optional[int] = None
    parties: Optional[Parties] = None
    dates: Optional[ContractDates] = None


class ClauseItem(BaseModel):
    id: str
    type: Optional[str] = None
    title: str
    content: str
    paragraph: Optional[int] = None
    has_risk: bool = False
    risk_level: Optional[str] = None


class ContractEntities(BaseModel):
    party_a: Optional[str] = None
    party_b: Optional[str] = None
    contract_date: Optional[str] = None
    total_amount: Optional[str] = None
    contract_period: Optional[str] = None


class ContractText(BaseModel):
    contract_id: str
    file_name: str
    customer_name: str
    contract_type: Optional[str] = None
    raw_text_preview: str
    clauses: list[ClauseItem] = []
    entities: Optional[ContractEntities] = None


class ProgressStep(BaseModel):
    id: str
    label: str
    status: str
    detail: Optional[str] = None
    completed_at: Optional[str] = None


class AnalysisProgress(BaseModel):
    contract_id: str
    overall_status: str
    progress_percent: int
    steps: list[ProgressStep] = []
    estimated_remaining_sec: Optional[int] = None
