from fastapi import APIRouter
from app.server.schemas.simulation import Simulation2DRequest, Simulation2DResponse
from app.server.simulations.sim2d.solver import compute_field_2d
import json 


# Create a router for simulation endpoints
router = APIRouter(prefix="/api/v1/sim", tags=["simulation"])

@router.post("/2d", response_model=Simulation2DResponse)
def simulate_2d(body: Simulation2DRequest) -> Simulation2DResponse:
    try:
        print(f"Request received: {json.dumps(body.model_dump(), default=str)}")
        return compute_field_2d(body)
    except Exception as e:
        print(f"Error in simulate_2d: {e}")
        raise