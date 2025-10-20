from fastapi import APIRouter
from app.server.schemas.simulation import Simulation2DRequest, Simulation2DResponse
from app.server.simulations.sim2d.solver import compute_field_2d
import json 


# Create a router for simulation endpoints
router = APIRouter(tags=["simulation"])

@router.post("/simulate/2d", response_model=Simulation2DResponse)
def simulate_2d(body: Simulation2DRequest) -> Simulation2DResponse:
    """
    Simulate 2D electric field
    
    Takes charges and grid configuration, returns Ex, Ey, and potential fields
    """
    try:
        print(f"📡 Request received: {json.dumps(body.model_dump(), default=str)}")
        result = compute_field_2d(body)
        print(f"✅ Simulation successful")
        return result
    except Exception as e:
        print(f"❌ Error in simulate_2d: {e}")
        raise