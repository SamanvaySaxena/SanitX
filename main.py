import logging
import os

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from routers import router

load_dotenv()

app = FastAPI()

origins = [
    origin.strip()
    for origin in os.getenv("SANITX_CORS_ORIGINS", "http://localhost:3000").split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/healthz")
async def healthz():
    return {"ok": True}


if not os.getenv("GOOGLE_API_KEY"):
    logging.warning(
        "GOOGLE_API_KEY is not set. Live scans will fail closed during phase 4."
    )


if __name__ == "__main__":
    uvicorn.run(
        app,
        host=os.getenv("SANITX_BACKEND_HOST", "127.0.0.1"),
        port=int(os.getenv("SANITX_BACKEND_PORT", "7000")),
    )
