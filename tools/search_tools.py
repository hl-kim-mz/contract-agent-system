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
    if not kb_id:
        return json.dumps({
            "answer": "Knowledge Base가 설정되지 않았습니다 (BEDROCK_KB_ID 환경변수 필요)",
            "sources": [],
        }, ensure_ascii=False)

    region = os.getenv("AWS_REGION", "ap-northeast-2")

    try:
        client = boto3.client("bedrock-agent-runtime", region_name=region)
        response = client.retrieve_and_generate(
            input={"text": query},
            retrieveAndGenerateConfiguration={
                "type": "KNOWLEDGE_BASE",
                "knowledgeBaseConfiguration": {
                    "knowledgeBaseId": kb_id,
                    "modelArn": os.getenv(
                        "KB_MODEL_ARN",
                        "apac.anthropic.claude-3-5-sonnet-20241022-v2:0",
                    ),
                },
            },
        )
    except Exception as e:
        return json.dumps({
            "answer": f"Knowledge Base 검색 실패: {e}",
            "sources": [],
        }, ensure_ascii=False)

    output = response.get("output", {}).get("text", "")
    sources = [
        c.get("retrievedReferences", [])
        for c in response.get("citations", [])
    ]

    return json.dumps({
        "answer": output,
        "sources": sources,
    }, ensure_ascii=False)
