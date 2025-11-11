from fastapi import APIRouter, HTTPException
from app.server.schemas.simulation3d import Simulation3DRequest, Simulation3DResponse
from app.server.simulations.sim3d.solver3d import compute_field_3d
import json

router = APIRouter()

@router.post("/simulate/3d", response_model=Simulation3DResponse)
def simulate_3d(request: Simulation3DRequest) -> Simulation3DResponse:
    """
    Simulate 3D electric field from point charges
    
    Takes charges and 3D grid configuration, returns Ex, Ey, Ez, and potential fields
    """
    try:
        print(f"📡 3D Request received: {json.dumps(request.model_dump(), default=str)}")
        result = compute_field_3d(request)
        print(f"✅ 3D Simulation successful")
        return result
    except Exception as e:
        print(f"❌ Error in simulate_3d: {e}")
        raise HTTPException(status_code=500, detail=str(e))