#!/bin/bash
# EC2 서버 시작 스크립트 (직접 실행 방식 - Docker 없이 사용 시)
# 사용법: bash scripts/start.sh

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# 가상환경 활성화 (없으면 생성)
if [ ! -d ".venv" ]; then
  echo "[INFO] 가상환경 생성 중..."
    python3 -m venv .venv
    fi

    echo "[INFO] 가상환경 활성화..."
    source .venv/bin/activate

    # 의존성 설치
    echo "[INFO] 패키지 설치 중..."
    pip install --upgrade pip
    pip install -r requirements.txt

    # 환경 변수 로드
    if [ -f ".env" ]; then
      echo "[INFO] .env 파일 로드..."
        export $(grep -v '^#' .env | xargs)
        else
          echo "[WARN] .env 파일 없음 - .env.example 참고하여 .env 파일을 생성하세요."
          fi

          # FastAPI 서버 실행
          echo "[INFO] FastAPI 서버 시작 (포트 8000)..."
          exec uvicorn api.app:app \
            --host 0.0.0.0 \
              --port 8000 \
                --workers 2 \
                  --log-level info
