from typing import List, Optional
from pydantic import BaseModel, Field, field_validator, model_validator


class Charge3D(BaseModel):
    """
    3D point charge
    """
    x: float = Field(..., description="x position (meters)")
    y: float = Field(..., description="y position (meters)")
    z: float = Field(..., description="z position (meters)")
    q: float = Field(..., description="charge in Coulombs")
    
    @field_validator("q")
    @classmethod
    def validate_charge(cls, v):
        if v == 0:
            raise ValueError("Charge cannot be zero")
        return v


class Grid3D(BaseModel):
    """
    3D computational grid
    """
    xmin: float = Field(-1.0, description="Minimum x coordinate")
    xmax: float = Field(1.0, description="Maximum x coordinate")
    ymin: float = Field(-1.0, description="Minimum y coordinate")
    ymax: float = Field(1.0, description="Maximum y coordinate")
    zmin: float = Field(-1.0, description="Minimum z coordinate")
    zmax: float = Field(1.0, description="Maximum z coordinate")
    nx: int = Field(21, ge=2, le=100, description="Grid points in x")
    ny: int = Field(21, ge=2, le=100, description="Grid points in y")
    nz: int = Field(21, ge=2, le=100, description="Grid points in z")

    @model_validator(mode='after')
    def validate_grid(self):
        """Validate that max > min for all axes"""
        if self.xmax <= self.xmin:
            raise ValueError(f"xmax ({self.xmax}) must be > xmin ({self.xmin})")
        if self.ymax <= self.ymin:
            raise ValueError(f"ymax ({self.ymax}) must be > ymin ({self.ymin})")
        if self.zmax <= self.zmin:
            raise ValueError(f"zmax ({self.zmax}) must be > zmin ({self.zmin})")
        return self


class Simulation3DRequest(BaseModel):
    """
    Request to simulate 3D electric field
    """
    charges: List[Charge3D] = Field(..., min_length=1, description="List of charges")
    grid: Grid3D = Field(default_factory=Grid3D, description="Computational grid")
    softening: float = Field(1e-6, ge=0.0, description="Softening parameter to avoid singularities")
    include_potential: bool = Field(True, description="Include electric potential in response")
    
    @field_validator("charges")
    @classmethod
    def validate_charges(cls, v):
        if not v:
            raise ValueError("At least one charge is required")
        return v


class Field3D(BaseModel):
    """
    3D electric field components
    """
    ex: List[List[List[float]]] = Field(..., description="Ex component [nz][ny][nx]")
    ey: List[List[List[float]]] = Field(..., description="Ey component [nz][ny][nx]")
    ez: List[List[List[float]]] = Field(..., description="Ez component [nz][ny][nx]")
    potential: Optional[List[List[List[float]]]] = Field(None, description="Electric potential [nz][ny][nx]")


class Simulation3DResponse(BaseModel):
    """
    Complete 3D simulation response
    """
    grid: Grid3D
    field: Field3D
    
    class Config:
        json_schema_extra = {
            "example": {
                "grid": {
                    "xmin": -1.0, "xmax": 1.0,
                    "ymin": -1.0, "ymax": 1.0,
                    "zmin": -1.0, "zmax": 1.0,
                    "nx": 21, "ny": 21, "nz": 21
                },
                "field": {
                    "ex": [[[0.0]]],
                    "ey": [[[0.0]]],
                    "ez": [[[0.0]]],
                    "potential": [[[0.0]]]
                }
            }
        }