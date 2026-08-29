from fastapi import APIRouter, UploadFile, File
from inspect_pdf import inspect_pdf

router = APIRouter()

@router.post("/pdf_checker")
async def pdf_checker(file: UploadFile = File(...)):
    return await inspect_pdf(file)

