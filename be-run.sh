#!/bin/bash

set -e

python3 -m server.seed
uvicorn server.app:app --host 0.0.0.0 --port 8000 --reload &