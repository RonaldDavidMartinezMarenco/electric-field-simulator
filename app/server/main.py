from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
import sys 
from pathlib import Path
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

# Import your router
from app.server.api.routes.simulate_2d import router as simulate_2d_router
from app.server.api.routes.simulate_3d import router as simulate_3d_router


frontend_path = Path(__file__).parent.parent / "web"

app = FastAPI(
    title="⚡ Electric Field Simulator",
    version="0.1.0",
    description="Simulate electric fields from point charges"
)

app.mount("/static", StaticFiles(directory=frontend_path / "static"), name="static")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def serve_frontend():
    return FileResponse(frontend_path / "index.html")

# ✅ Health check endpoint
@app.get("/health")
def health():
    """Check if backend is alive"""
    return {
        "status": "ok",
        "message": "⚡ Electric Field Simulator Backend Running"
    }

# info endpoint
@app.get("/info", include_in_schema=False)
def root():
    return {
        "message": "⚡ Electric Field Simulator API",
        "docs": "/docs",
        "health": "/health"
    }

# Include simulation routes - THIS IS THE IMPORTANT PART
app.include_router(
    simulate_2d_router,
    prefix="",
    tags=["Simulation"]
)

app.include_router(
    simulate_3d_router,
    prefix="",
    tags=["Simulation"]
)

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)