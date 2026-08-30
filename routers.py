import json
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import FileResponse, StreamingResponse
from inspect_pdf import inspect_pdf
from pipeline import scan_pdf

router = APIRouter()
ROOT = Path(__file__).resolve().parent
SAMPLES = {
    "clean": ROOT / "sanitx_clean_test.pdf",
    "borderline": ROOT / "sanitx_test.pdf",
    "malicious": ROOT / "sanitx_ultimate_test.pdf",
}

@router.post("/pdf_checker")
async def pdf_checker(file: UploadFile = File(...)):
    return await inspect_pdf(file)


@router.post("/api/scan")
async def api_scan(file: UploadFile = File(...)):
    data = await file.read()

    async def frames():
        async for event in scan_pdf(file.filename or "document.pdf", data):
            yield f"data: {json.dumps(event, separators=(',', ':'))}\n\n"

    return StreamingResponse(
        frames(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/api/samples/{sample_id}")
async def api_sample(sample_id: str):
    path = SAMPLES.get(sample_id)
    if path is None:
        raise HTTPException(status_code=404, detail="Unknown sample")
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"Sample {sample_id} is not available")
    return FileResponse(path, media_type="application/pdf", filename=path.name)
