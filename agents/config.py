import os
from strands.models import BedrockModel
from strands.models.litellm import LiteLLMModel


def _guardrail_kwargs() -> dict:
    guardrail_id = os.getenv("BEDROCK_GUARDRAIL_ID")
    guardrail_ver = os.getenv("BEDROCK_GUARDRAIL_VERSION")
    if guardrail_id and guardrail_ver:
        return {
            "guardrail_id": guardrail_id,
            "guardrail_version": guardrail_ver,
        }
    return {}


def get_sonnet():
    """Orchestrator/RiskAgent용 Sonnet 모델 반환."""
    provider = os.getenv("MODEL_PROVIDER", "groq")
    if provider == "bedrock":
        return BedrockModel(
            model_id=os.getenv(
                "SONNET_MODEL_ID", "apac.anthropic.claude-sonnet-4-20250514-v1:0"
            ),
            region_name=os.getenv("AWS_REGION", "ap-northeast-2"),
            temperature=0.3,
            streaming=True,
            **_guardrail_kwargs(),
        )
    return LiteLLMModel(
        client_args={"api_key": os.getenv("GROQ_API_KEY")},
        model_id="groq/llama-3.3-70b-versatile",
        params={"max_tokens": 4096, "temperature": 0.3},
    )


def get_haiku():
    """ParsingAgent/SearchAgent/LegalReviewAgent용 Haiku 모델 반환."""
    provider = os.getenv("MODEL_PROVIDER", "groq")
    if provider == "bedrock":
        return BedrockModel(
            model_id=os.getenv(
                "HAIKU_MODEL_ID", "ap.anthropic.claude-haiku-4-5-20251001-v1:0"
            ),
            region_name=os.getenv("AWS_REGION", "ap-northeast-2"),
            temperature=0.2,
            streaming=True,
        )
    return LiteLLMModel(
        client_args={"api_key": os.getenv("GROQ_API_KEY")},
        model_id="groq/llama-3.3-70b-versatile",
        params={"max_tokens": 4096, "temperature": 0.2},
    )


# Backward compatibility aliases
get_sonnet_model = get_sonnet
get_haiku_model = get_haiku
get_model = get_sonnet
