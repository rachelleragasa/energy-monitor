from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

EXCEL_PATH = os.path.join(os.path.dirname(__file__), "..", "data.xlsx")

def _to_int(x):
    try:
        return int(float(x)) if pd.notna(x) else 0
    except (ValueError, TypeError):
        return 0


def parse_leituras(path):
    """Parse the spreadsheet at `path` into a list of daily readings.

    Each date spans two rows: "Energia consumida" and "Energia injetada"
    (injected = produced by the solar panel). Both are cumulative meter
    readings split across the tariff periods Vazio/Ponta/Cheias.
    """
    df = pd.read_excel(path, sheet_name="Leituras", header=None)
    by_date = {}
    order = []
    current_date = None

    for i, row in df.iterrows():
        if i < 5:
            continue
        date_val = row[0]
        tipo_energia = row[4]

        if pd.notna(date_val) and str(date_val).strip():
            current_date = str(date_val).strip()

        if not current_date:
            continue

        tipo = str(tipo_energia).strip() if pd.notna(tipo_energia) else ""
        vazio = _to_int(row[5])
        ponta = _to_int(row[7])
        cheias = _to_int(row[9])

        if current_date not in by_date:
            by_date[current_date] = {
                "data": current_date,
                "vazio": 0, "ponta": 0, "cheias": 0, "total": 0,
                "injVazio": 0, "injPonta": 0, "injCheias": 0, "injTotal": 0,
            }
            order.append(current_date)

        if tipo == "Energia consumida":
            by_date[current_date].update({
                "vazio": vazio,
                "ponta": ponta,
                "cheias": cheias,
                "total": vazio + ponta + cheias,
            })
        elif tipo == "Energia injetada":
            by_date[current_date].update({
                "injVazio": vazio,
                "injPonta": ponta,
                "injCheias": cheias,
                "injTotal": vazio + ponta + cheias,
            })

    return [by_date[d] for d in order]


@app.get("/api/leituras")
def get_leituras():
    return parse_leituras(EXCEL_PATH)


@app.post("/api/upload")
async def upload_leituras(file: UploadFile = File(...)):
    """Replace the dataset with an uploaded spreadsheet.

    The upload is written to a temporary path and parsed first; only a file
    that parses into at least one reading replaces the live data.xlsx, so a
    malformed upload can never wipe out the existing dataset.
    """
    name = file.filename or ""
    if not name.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(
            status_code=400,
            detail="Formato inválido. Carregue um ficheiro .xlsx ou .xls.",
        )

    contents = await file.read()
    tmp_path = EXCEL_PATH + ".upload"
    with open(tmp_path, "wb") as f:
        f.write(contents)

    try:
        leituras = parse_leituras(tmp_path)
    except ValueError:
        os.remove(tmp_path)
        raise HTTPException(
            status_code=400,
            detail="Não foi possível ler a folha 'Leituras' do ficheiro.",
        )
    except Exception:
        os.remove(tmp_path)
        raise HTTPException(
            status_code=400,
            detail="O ficheiro não pôde ser processado.",
        )

    if not leituras:
        os.remove(tmp_path)
        raise HTTPException(
            status_code=400,
            detail="Nenhuma leitura encontrada no ficheiro.",
        )

    os.replace(tmp_path, EXCEL_PATH)
    return {"registos": len(leituras)}
