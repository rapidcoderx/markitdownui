"""
Vercel serverless entry point.

Vercel's Python builder looks for an `app` object in this module.
We simply re-export the FastAPI app from backend/main.py.
"""
import sys
from pathlib import Path

# Make backend/ importable without any package install trickery
sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from main import app  # noqa: F401, E402  – re-exported for Vercel
