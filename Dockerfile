# ---- Build Stage ----
FROM python:3.11-slim AS builder

WORKDIR /app

# Install system dependencies for document parsing
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
        libpq-dev \
            && rm -rf /var/lib/apt/lists/*

            # Install Python dependencies
            COPY requirements.txt .
            RUN pip install --no-cache-dir --upgrade pip \
                && pip install --no-cache-dir -r requirements.txt

                # ---- Runtime Stage ----
                FROM python:3.11-slim

                WORKDIR /app

                # Install runtime system dependencies
                RUN apt-get update && apt-get install -y --no-install-recommends \
                    libpq5 \
                        && rm -rf /var/lib/apt/lists/*

                        # Copy installed packages from builder
                        COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
                        COPY --from=builder /usr/local/bin /usr/local/bin

                        # Copy application code
                        COPY . .

                        # Expose port
                        EXPOSE 8000

                        # Run the FastAPI server
                        CMD ["uvicorn", "api.app:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
