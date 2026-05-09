import json
import os

import boto3
from strands import tool


@tool
def search_history(query: str) -> dict:
    """Bedrock Knowledge Base에서 계약서 히스토리를 시맨틱 검색한다.

    Args:
        query: 자연어 검색 질의 (예: "과거 CR 조항 이력?")
    Returns:
        검색 결과 + 생성된 답변
    """
    kb_id = os.getenv("BEDROCK_KB_ID")
    region = os.getenv("AWS_REGION", "ap-northeast-2")

    client = boto3.client("bedrock-agent-runtime", region_name=region)
    response = client.retrieve_and_generate(
        input={"text": query},
        retrieveAndGenerateConfiguration={
            "type": "KNOWLEDGE_BASE",
            "knowledgeBaseConfiguration": {
                "knowledgeBaseId": kb_id,
                "modelArn": os.getenv(
                    "KB_MODEL_ARN",
                    f"arn:aws:bedrock:{region}::foundation-model/anthropic.claude-sonnet-4-20250514",
                ),
            },
        },
    )

    output = response.get("output", {}).get("text", "")
    sources = [
        c.get("retrievedReferences", [])
        for c in response.get("citations", [])
    ]

    return json.dumps({
        "answer": output,
        "sources": sources,
    }, ensure_ascii=False)
