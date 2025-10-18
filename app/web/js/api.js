const API_BASE = "http://localhost:8000/api/v1";

/**
 * Call the 2D simulator backend
 */
async function simulate2D(requestData) {
    try {
        const response = await fetch(`${API_BASE}/sim/2d`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(requestData),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || "Simulation failed");
        }

        return await response.json();
    } catch (error) {
        console.error("API Error:", error);
        throw error;
    }
}

/**
 * Call the 3D simulator backend (stub - will implement later)
 */
async function simulate3D(requestData) {
    // For now, use 2D data (we'll add 3D solver to backend later)
    return simulate2D(requestData);
}

/**
 * Check if backend is alive
 */
async function checkHealth() {
    try {
        const response = await fetch("http://localhost:8000/health");
        return response.ok;
    } catch {
        return false;
    }
}