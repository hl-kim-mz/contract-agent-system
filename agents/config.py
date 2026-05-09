import os
from strands.models import BedrockModel
from strands.models.litellm import LiteLLMModel


def _guardrail_kwargs() -> dict:
    gid = os.getenv("BEDROCK_GUARDRAIL_ID")
    gver = os.getenv("BEDROCK_GUARDRAIL_VERSION", "DRAFT")
    return {"guardrail_id": gid, "guardrail_version": gver} if gid else {}


def get_sonnet():
    """Orchestrator, RiskAgent용 (Sonnet)"""
    provider = os.getenv("MODEL_PROVIDER", "groq")
    if provider == "bedrock":
        return BedrockModel(
            model_id="anthropic.claude-3-5-sonnet-20241022-v2:0",
            region_name="ap-northeast-2",
            streaming=True,
            **_guardrail_kwargs(),
        )
    return LiteLLMModel(
        client_args={"api_key": os.getenv("GROQ_API_KEY")},
        model_id="groq/llama-3.3-70b-versatile",
        params={"max_tokens": 4096, "temperature": 0.3},
    )


def get_haiku():
    """ParsingAgent, SearchAgent용 (Haiku — 비용 효율)"""
    provider = os.getenv("MODEL_PROVIDER", "groq")
    if provider == "bedrock":
        return BedrockModel(
            model_id="anthropic.claude-3-5-haiku-20241022-v1:0",
            region_name="ap-northeast-2",
            streaming=True,
            **_guardrail_kwargs(),
        )
    return LiteLLMModel(
        client_args={"api_key": os.getenv("GROQ_API_KEY")},
        model_id="groq/llama-3.3-70b-versatile",
        params={"max_tokens": 2048, "temperature": 0.1},
    )


# 하위 호환
def get_model():
    return get_sonnet()
