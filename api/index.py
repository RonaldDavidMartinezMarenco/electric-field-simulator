from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
import sys

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import your router
from app.server.api.routes.simulate_2d import router as simulate_2d_router

app = FastAPI(
    title="⚡ Electric Field Simulator",
    version="0.1.0",
    description="Simulate electric fields from point charges"
)

# ✅ CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ✅ Health check
@app.get("/health")
def health():
    return {
        "status": "ok",
        "message": "⚡ Electric Field Simulator Backend Running"
    }

# ✅ Root
@app.get("/", include_in_schema=False)
def root():
    return {
        "message": "⚡ Electric Field Simulator API",
        "docs": "/api/docs",
        "health": "/api/health"
    }

# ✅ Include routes
app.include_router(simulate_2d_router)