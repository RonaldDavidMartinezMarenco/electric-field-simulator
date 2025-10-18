from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.server.api.routes.simulate_2d import router as simulate_2d_router

app = FastAPI(title="Electric Field Simulator", version="0.1.0")

# Allow requests from frontend (will run on different port)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/", include_in_schema=False)
def root():
    return {"message": "Electric Field Simulator API", "docs": "/docs"}

# Include simulation routes
app.include_router(simulate_2d_router)