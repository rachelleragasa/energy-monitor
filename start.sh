#!/bin/bash

echo ""
echo "⚡ Energia Monitor — Starting servers..."
echo ""



# If backend/venv already exists than just activate the venv
# otherwise create it and install the needed dependecies
cd "$(dirname "$0")"
if [ -d "backend/venv" ]; then
  echo "Activating existing virtual env"
  source backend/venv/bin/activate
else
  echo "Creating virtual env and installing dependencies"
  python3 -m venv backend/venv
  source backend/venv/bin/activate
  pip install --upgrade pip
  if [ -f "backend/requirements.txt" ]; then
    pip install -r backend/requirements.txt
  else
    pip install fastapi uvicorn pandas openpyxl
  fi
fi

# Start Python backend
echo "→ Starting Python backend on http://localhost:8000"
cd "$(dirname "$0")/backend"
uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

# Wait a moment then start Next.js
sleep 2

echo "→ Starting Next.js frontend on http://localhost:3000"
cd "$(dirname "$0")"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "✓ Backend:  http://localhost:8000"
echo "✓ Frontend: http://localhost:3000"
echo "✓ API:      http://localhost:8000/api/leituras"
echo ""
echo "Press Ctrl+C to stop both servers."

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
