"""Run the local API server detached from the shell."""

import os

import uvicorn


os.environ["DEBUG"] = "false"

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, log_level="info")
