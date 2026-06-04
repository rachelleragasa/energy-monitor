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

## Data

The Excel file (data.xlsx) is read by the Python backend, filtered for Energia consumida rows, and returns:

```json
[
  { "data": "01/06/2026", "vazio": 28474, "ponta": 7221, "cheias": 15747, "total": 51442 }
]
```

Values are cumulative meter readings in kWh.
