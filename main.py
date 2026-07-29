"""Root deployment entry point for the Quantoryx FastAPI service.

Railway builds this repository from its root, while the application package
and its legacy top-level modules live under ``backend/``. Keeping this thin
wrapper at the repository root lets Uvicorn start the existing application
without moving or rewriting the backend package.
"""

from pathlib import Path
import sys


BACKEND_ROOT = Path(__file__).resolve().parent / "backend"
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from backend.main import app  # noqa: E402

__all__ = ["app"]