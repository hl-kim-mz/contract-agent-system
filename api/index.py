# Vercel serverless entry point for FastAPI backend
# This file is required by Vercel's @vercel/python runtime

from dotenv import load_dotenv
load_dotenv()

from api.app import app  # noqa: F401 - Vercel uses this 'app' object as ASGI handler
