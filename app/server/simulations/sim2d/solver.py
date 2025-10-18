import numpy as np
from math import pi
from app.server.schemas.simulation import Simulation2DRequest, Simulation2DResponse, Field2D

# Physical constants
EPS0 = 8.8541878128e-12  # Vacuum permittivity (F/m)
K = 1.0 / (4.0 * pi * EPS0)  # Coulomb constant ≈ 8.99e9

def compute_field_2d(req: Simulation2DRequest) -> Simulation2DResponse:
    """
    Computes electric field on a 2D grid from point charges using Coulomb's law.
    
    E = K*q / r² (magnitude), direction is radial from charge
    """
    g = req.grid
    
    # Create grid points: x and y coordinates
    x = np.linspace(g.xmin, g.xmax, g.nx)
    y = np.linspace(g.ymin, g.ymax, g.ny)
    X, Y = np.meshgrid(x, y)  # X and Y are now 2D arrays (ny × nx)

    # Initialize field arrays
    Ex = np.zeros_like(X, dtype=float)
    Ey = np.zeros_like(Y, dtype=float)
    V = np.zeros_like(X, dtype=float) if req.include_potential else None

    # Softening parameter (prevents division by zero near charges)
    s2 = req.softening ** 2 if req.softening > 0 else 0.0

    # Loop over each charge and accumulate field contribution
    for c in req.charges:
        # Distance vectors from each grid point to this charge
        rx = X - c.x  # x-distance (ny × nx)
        ry = Y - c.y  # y-distance (ny × nx)
        
        # Distance squared with softening
        r2 = rx * rx + ry * ry + s2
        r = np.sqrt(r2)
        
        # 1/r³ for field calculation (avoid /0)
        inv_r3 = np.where(r > 0, 1.0 / (r2 * r), 0.0)
        
        # Accumulate field: E = K*q * r_hat / r²
        Ex += K * c.q * rx * inv_r3
        Ey += K * c.q * ry * inv_r3
        
        # Potential: V = K*q / r
        if V is not None:
            inv_r = np.where(r > 0, 1.0 / r, 0.0)
            V += K * c.q * inv_r

    # Convert numpy arrays to Python lists for JSON serialization
    field = Field2D(
        ex=Ex.tolist(),
        ey=Ey.tolist(),
        potential=(V.tolist() if V is not None else None),
    )
    return Simulation2DResponse(grid=g, field=field)