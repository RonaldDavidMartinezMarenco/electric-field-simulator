from typing import List, Optional
from pydantic import BaseModel, Field, field_validator

# A single point charge in a 2D space
class Charge2D(BaseModel):
    x: float          # x position (meters)
    y: float          # y position (meters)
    q: float          # charge in Coulombs

# The simulation grid (computational domain)
class Grid2D(BaseModel):
    xmin: float = -1.0
    xmax: float = 1.0
    ymin: float = -1.0
    ymax: float = 1.0
    nx: int = Field(41, ge=2, le=200)  # number of points in x direction
    ny: int = Field(41, ge=2, le=200)  # number of points in y direction 41x41 grid :)

    # Validate that xmax > xmin
    @field_validator("xmax")
    @classmethod
    def check_x(cls, v, info):
        xmin = info.data.get("xmin", None)
        if xmin is not None and v <= xmin:
            raise ValueError("xmax must be > xmin")
        return v

    @field_validator("ymax")
    @classmethod
    def check_y(cls, v, info):
        ymin = info.data.get("ymin", None)
        if ymin is not None and v <= ymin:
            raise ValueError("ymax must be > ymin")
        return v

# What the client sends to request a 2D simulation
class Simulation2DRequest(BaseModel):
    charges: List[Charge2D]      # list of charges
    grid: Grid2D                 # the domain and resolution
    softening: float = Field(1e-6, ge=0.0)  # numerical trick to avoid infinity near charges
    include_potential: bool = True  # compute voltage field?

# The electric field values at each grid point
class Field2D(BaseModel):
    ex: List[List[float]]           # Ex component (ny × nx)
    ey: List[List[float]]           # Ey component (ny × nx)
    potential: Optional[List[List[float]]] = None  # V field (optional)

# What the server sends back
class Simulation2DResponse(BaseModel):
    grid: Grid2D
    field: Field2D