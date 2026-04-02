#!/bin/bash
pip install --no-cache-dir fastapi uvicorn requests pydantic
cd /home/site/wwwroot
uvicorn app:app --host 0.0.0.0 --port 8000
