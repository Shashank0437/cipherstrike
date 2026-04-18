# FastAPI — use when Railway Railpack fails on apps/api ("Error creating build plan with Railpack").
# Set service Root Directory to `apps/api`. Railway will detect this Dockerfile.

FROM python:3.12-slim-bookworm

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

EXPOSE 8000

# Railway injects PORT at runtime
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
