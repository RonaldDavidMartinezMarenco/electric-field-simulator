import numpy as np
from math import pi
from app.server.schemas.simulation3d import Simulation3DRequest, Simulation3DResponse, Field3D

# Physical constants
EPS0 = 8.8541878128e-12  # Vacuum permittivity (F/m)
K = 1.0 / (4.0 * pi * EPS0)  # Coulomb constant ≈ 8.99e9

def compute_field_3d(req: Simulation3DRequest) -> Simulation3DResponse:
    """
    Computes electric field on a 3D grid from point charges using Coulomb's law.
    
    E = K*q / r² (magnitude), direction is radial from charge
    
    Args:
        req: Simulation3DRequest with charges and grid
        
    Returns:
        Simulation3DResponse with Ex, Ey, Ez, and optional potential
    """
    g = req.grid
    
    # Create 3D grid points
    x = np.linspace(g.xmin, g.xmax, g.nx)
    y = np.linspace(g.ymin, g.ymax, g.ny)
    z = np.linspace(g.zmin, g.zmax, g.nz)
    
    # 3D meshgrid (indexing='ij' para mantener orden [nz, ny, nx])
    X, Y, Z = np.meshgrid(x, y, z, indexing='ij')
    
    # Initialize 3D field arrays
    Ex = np.zeros_like(X, dtype=float)
    Ey = np.zeros_like(Y, dtype=float)
    Ez = np.zeros_like(Z, dtype=float)
    V = np.zeros_like(X, dtype=float) if req.include_potential else None

    # Softening parameter (prevents division by zero near charges)
    s2 = req.softening ** 2 if req.softening > 0 else 0.0

    # Loop over each charge and accumulate field contribution
    for c in req.charges:
        # Distance vectors from each grid point to this charge (3D)
        rx = X - c.x  # x-distance (nz × ny × nx)
        ry = Y - c.y  # y-distance (nz × ny × nx)
        rz = Z - c.z  # z-distance (nz × ny × nx)
        
        # Distance squared with softening (3D)
        r2 = rx * rx + ry * ry + rz * rz + s2
        r = np.sqrt(r2)
        
        # 1/r³ for field calculation (avoid /0)
        inv_r3 = np.where(r > 0, 1.0 / (r2 * r), 0.0)
        
        # Accumulate 3D field: E = K*q * r_hat / r²
        Ex += K * c.q * rx * inv_r3
        Ey += K * c.q * ry * inv_r3
        Ez += K * c.q * rz * inv_r3  # Nueva componente Z
        
        # Potential: V = K*q / r
        if V is not None:
            inv_r = np.where(r > 0, 1.0 / r, 0.0)
            V += K * c.q * inv_r

    # Convert 3D numpy arrays to Python lists for JSON serialization
    field = Field3D(
        ex=Ex.tolist(),
        ey=Ey.tolist(),
        ez=Ez.tolist(),  # Nueva componente
        potential=(V.tolist() if V is not None else None),
    )
    
    return Simulation3DResponse(grid=g, field=field)