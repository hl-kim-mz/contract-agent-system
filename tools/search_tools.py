import json
import os
import boto3
from strands import tool


@tool
def search_contract_history(query: str) -> str:
    """Bedrock Knowledge Base에서 과거 계약 이력을 검색한다.

    Args:
        query: 검색 쿼리 (자연어)
    Returns:
        검색 결과 JSON 문자열
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
                "modelArn": f"arn:aws:bedrock:{region}::foundation-model/anthropic.claude-3-5-sonnet-20241022-v2:0",
            },
        },
    )

    output = response.get("output", {}).get("text", "")
    citations = [
        c.get("retrievedReferences", [])
        for c in response.get("citations", [])
    ]

    return json.dumps({
        "answer": output,
        "citations": citations,
    }, ensure_ascii=False)
