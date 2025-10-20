from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

# Import your router
from app.server.api.routes.simulate_2d import router as simulate_2d_router

app = FastAPI(
    title="⚡ Electric Field Simulator",
    version="0.1.0",
    description="Simulate electric fields from point charges"
)

# ✅ CORS: Allow requests from anywhere (frontend will be on Vercel domain)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",           # Local development
        "http://localhost:8000",           # Local frontend
        "http://localhost:5173",           # Vite dev server
        "https://*.vercel.app",            # All Vercel deployments
        "https://*.netlify.app",           # Alternative: Netlify
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ✅ Health check endpoint
@app.get("/health")
def health():
    """Check if backend is alive"""
    return {
        "status": "ok",
        "message": "⚡ Electric Field Simulator Backend Running"
    }

# ✅ Root endpoint
@app.get("/", include_in_schema=False)
def root():
    return {
        "message": "⚡ Electric Field Simulator API",
        "docs": "/docs",
        "health": "/health"
    }

# ✅ Include simulation routes
# ✅ Router should have /simulate/2d endpoint
app.include_router(
    simulate_2d_router,
    prefix="",  # No prefix, routes are at root level
    tags=["Simulation"]
)

# ✅ Vercel serverless handler
# This is what Vercel calls to handle requests
if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)