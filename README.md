# ⚡ Energia Monitor

Full-stack energy consumption dashboard — Next.js frontend + FastAPI Python backend.

## Stack

| Layer     | Technology                              |
|-----------|-----------------------------------------|
| Frontend  | Next.js 15, TypeScript, Tailwind CSS    |
| Backend   | FastAPI (Python 3)                      |
| Data      | pandas + openpyxl                       |

## Quick Start

### 1. Install Python dependencies
```bash
pip install fastapi uvicorn pandas openpyxl
```

### 2. Install Node dependencies
```bash
npm install
```

### 3. Run everything
```bash
chmod +x start.sh
./start.sh
```

Or run separately:

**Backend:**
```bash
cd backend
uvicorn main:app --reload --port 8000
```

**Frontend:**
```bash
npm run dev
```

## Endpoints

| URL | Description |
|-----|-------------|
| `http://localhost:3000` | Frontend dashboard |
| `http://localhost:8000/api/leituras` | JSON API |

## Deployment

The app deploys as two pieces: the Next.js frontend (e.g. on Vercel) and the FastAPI backend (any host that can run Python — Render, Railway, Fly.io, a VM, etc.).

### Environment variables

Copy `.env.example` and set both to your deployed backend's public URL:

| Variable | Used by | Purpose |
|----------|---------|---------|
| `BACKEND_URL` | `next.config.ts` rewrites | Server-side proxy target for `/api/*` requests |
| `NEXT_PUBLIC_API_URL` | Frontend (browser) | Public backend URL exposed to the client |

Locally both default to `http://localhost:8000`.

### Frontend (Vercel)

1. Import the repo into Vercel — it auto-detects Next.js.
2. Set `BACKEND_URL` and `NEXT_PUBLIC_API_URL` in the project's environment variables.
3. Deploy. Vercel runs `npm run build` and serves the app.

Requests to `/api/:path*` are rewritten to `${BACKEND_URL}/api/:path*`, so the browser talks to the frontend origin and Next.js proxies to the backend.

### Backend (FastAPI)

1. Install dependencies from `backend/requirements.txt`.
2. Serve with a production command, binding to the host's port:
   ```bash
   uvicorn main:app --host 0.0.0.0 --port $PORT
   ```
3. Update the CORS `allow_origins` in [backend/main.py](backend/main.py) to include your deployed frontend URL (it currently only allows `http://localhost:3000`).

> **Note:** `data.xlsx` ships with the repo and is read from disk, so the backend host needs that file present. Uploaded files are not persisted across restarts on ephemeral hosts.

## Data

The Excel file (data.xlsx) is read by the Python backend, filtered for Energia consumida rows, and returns:

```json
[
  { "data": "01/06/2026", "vazio": 28474, "ponta": 7221, "cheias": 15747, "total": 51442 }
]
```

Values are cumulative meter readings in kWh.
