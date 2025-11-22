from __future__ import annotations

import os

import uvicorn

from backend.app import create_app

app = create_app()

if __name__ == "__main__":  # pragma: no cover
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run(app, host="0.0.0.0", port=port)
