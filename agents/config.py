import os
from strands.models import BedrockModel
from strands.models.litellm import LiteLLMModel


def get_model():
    """MODEL_PROVIDER 환경변수에 따라 모델 전환"""
    provider = os.getenv("MODEL_PROVIDER", "groq")

    if provider == "bedrock":
        return BedrockModel(
            model_id="anthropic.claude-3-5-sonnet-20241022-v2:0",
            region_name="ap-northeast-2",
            temperature=0.3,
            streaming=True,
        )

    return LiteLLMModel(
        client_args={"api_key": os.getenv("GROQ_API_KEY")},
        model_id="groq/llama-3.3-70b-versatile",
        params={"max_tokens": 4096, "temperature": 0.3},
    )
