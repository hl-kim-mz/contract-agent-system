"""
AWS 인프라 프로비저닝 스크립트
- S3 버킷: cas-contracts (또는 S3_BUCKET_NAME 환경변수)
- DynamoDB 테이블 3개: cas-contracts, cas-risk-reports, cas-workflow-steps

실행: python scripts/setup_aws.py
멱등성 보장: 이미 존재하는 리소스는 건너뜀
"""
import os
import sys
from pathlib import Path

import boto3
from botocore.exceptions import ClientError
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

REGION = os.getenv("AWS_REGION", "ap-northeast-2")
BUCKET = os.getenv("S3_BUCKET_NAME", "cas-contracts")

s3  = boto3.client("s3", region_name=REGION)
ddb = boto3.client("dynamodb", region_name=REGION)


# ─── S3 ──────────────────────────────────────────────────────────────────────

def create_s3_bucket():
    try:
        if REGION == "us-east-1":
            s3.create_bucket(Bucket=BUCKET)
        else:
            s3.create_bucket(
                Bucket=BUCKET,
                CreateBucketConfiguration={"LocationConstraint": REGION},
            )
        print(f"[S3] ✅ 버킷 생성: {BUCKET}")
    except ClientError as e:
        code = e.response["Error"]["Code"]
        if code in ("BucketAlreadyOwnedByYou", "BucketAlreadyExists"):
            print(f"[S3] ℹ️  버킷 이미 존재: {BUCKET}")
        else:
            print(f"[S3] ❌ 오류: {e}")
            sys.exit(1)


# ─── DynamoDB ─────────────────────────────────────────────────────────────────

def _table_exists(table_name: str) -> bool:
    try:
        ddb.describe_table(TableName=table_name)
        return True
    except ClientError as e:
        if e.response["Error"]["Code"] == "ResourceNotFoundException":
            return False
        raise


def create_table(table_name: str, key_schema: list, attribute_definitions: list,
                 gsi_list: list | None = None):
    if _table_exists(table_name):
        print(f"[DDB] ℹ️  테이블 이미 존재: {table_name}")
        return

    kwargs = {
        "TableName": table_name,
        "KeySchema": key_schema,
        "AttributeDefinitions": attribute_definitions,
        "BillingMode": "PAY_PER_REQUEST",
    }
    if gsi_list:
        kwargs["GlobalSecondaryIndexes"] = gsi_list

    try:
        ddb.create_table(**kwargs)
        waiter = ddb.get_waiter("table_exists")
        waiter.wait(TableName=table_name)
        print(f"[DDB] ✅ 테이블 생성: {table_name}")
    except ClientError as e:
        print(f"[DDB] ❌ 테이블 생성 실패 ({table_name}): {e}")
        sys.exit(1)


def provision_dynamodb():
    # cas-contracts
    create_table(
        table_name="cas-contracts",
        key_schema=[{"AttributeName": "id", "KeyType": "HASH"}],
        attribute_definitions=[{"AttributeName": "id", "AttributeType": "S"}],
    )

    # cas-risk-reports (GSI: contract_id)
    create_table(
        table_name="cas-risk-reports",
        key_schema=[{"AttributeName": "id", "KeyType": "HASH"}],
        attribute_definitions=[
            {"AttributeName": "id", "AttributeType": "S"},
            {"AttributeName": "contract_id", "AttributeType": "S"},
        ],
        gsi_list=[{
            "IndexName": "contract_id-index",
            "KeySchema": [{"AttributeName": "contract_id", "KeyType": "HASH"}],
            "Projection": {"ProjectionType": "ALL"},
        }],
    )

    # cas-workflow-steps (GSI: contract_id)
    create_table(
        table_name="cas-workflow-steps",
        key_schema=[{"AttributeName": "id", "KeyType": "HASH"}],
        attribute_definitions=[
            {"AttributeName": "id", "AttributeType": "S"},
            {"AttributeName": "contract_id", "AttributeType": "S"},
        ],
        gsi_list=[{
            "IndexName": "contract_id-index",
            "KeySchema": [{"AttributeName": "contract_id", "KeyType": "HASH"}],
            "Projection": {"ProjectionType": "ALL"},
        }],
    )


# ─── Main ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print(f"리전: {REGION} / 버킷: {BUCKET}\n")
    create_s3_bucket()
    provision_dynamodb()
    print("\n🎉 AWS 인프라 프로비저닝 완료")
