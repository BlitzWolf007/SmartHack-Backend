#!/bin/bash

set -e

python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r server/requirements.txt > /dev/null

python3 -m server.seed

uvicorn server.app:app --host 0.0.0.0 --port 8000 --reload &

cd frontend
npm i --silent
npm run build
npm run dev

