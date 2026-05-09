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
    region = os.getenv("AWS_REGION", "ap-northeast-2")
    client = boto3.client("bedrock-agent-runtime", region_name=region)
    response = client.retrieve_and_generate(
        input={"text": query},
        retrieveAndGenerateConfiguration={
            "type": "KNOWLEDGE_BASE",
            "knowledgeBaseConfiguration": {
                "knowledgeBaseId": os.getenv("BEDROCK_KB_ID"),
                "modelArn": f"arn:aws:bedrock:{region}:359469026743:inference-profile/apac.anthropic.claude-3-5-sonnet-20241022-v2:0",
            },
        },
    )
    return {
        "answer": response["output"]["text"],
        "citations": [c["retrievedReferences"] for c in response.get("citations", [])],
    }
