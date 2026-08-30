import json
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import FileResponse, StreamingResponse
from inspect_pdf import inspect_pdf
from pipeline import scan_document

router = APIRouter()
ROOT = Path(__file__).resolve().parent
SAMPLES = {
    "clean": ROOT / "sanitx_clean_test.pdf",
    "borderline": ROOT / "sanitx_test.pdf",
    "malicious": ROOT / "sanitx_ultimate_test.pdf",
}
# The scanner accepts both kinds, so a sample must be served as what it is —
# handing a .md back as application/pdf would make the browser's own File
# object lie to the preview pane about which surface to render.
SAMPLE_MEDIA_TYPES = {
    ".pdf": "application/pdf",
    ".md": "text/markdown",
    ".markdown": "text/markdown",
    ".mdown": "text/markdown",
    ".mkd": "text/markdown",
}

@router.post("/pdf_checker")
async def pdf_checker(file: UploadFile = File(...)):
    return await inspect_pdf(file)


@router.post("/api/scan")
async def api_scan(file: UploadFile = File(...)):
    data = await file.read()

    async def frames():
        # content_type only breaks ties: scan_document trusts the bytes first,
        # so a mislabelled upload is still routed to the right pipeline.
        async for event in scan_document(
            file.filename or "document.pdf", data, file.content_type or ""
        ):
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
    media_type = SAMPLE_MEDIA_TYPES.get(path.suffix.lower(), "application/octet-stream")
    return FileResponse(path, media_type=media_type, filename=path.name)
