/**
 * 🔧 Dynamic API URL Detection
 * 
 * Rules:
 * - If running on localhost → use localhost:8000
 * - If running on Vercel → use same domain (backend is on Vercel too)
 * - If running elsewhere → try to auto-detect
 */

let API_BASE_URL = "";

function initializeAPI() {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;

    if (hostname === "localhost" || hostname === "127.0.0.1") {
        // ✅ Local development
        API_BASE_URL = "http://localhost:8000";
        console.log("🖥️ Using local backend:", API_BASE_URL);
    } else if (hostname.includes("vercel.app")) {
        // ✅ Deployed on Vercel (same domain)
        API_BASE_URL = `${protocol}//${hostname}`;
        console.log("☁️ Using Vercel backend:", API_BASE_URL);
    } else {
        // ✅ Other domain
        API_BASE_URL = `${protocol}//${hostname}`;
        console.log("🌐 Using domain backend:", API_BASE_URL);
    }
}

// Initialize on load
initializeAPI();

/**
 * ✅ Call the 2D simulator backend
 * 
 * OLD PATH: /api/v1/sim/2d
 * NEW PATH: /simulate/2d
 */
async function simulate2D(requestData) {
    try {
        const url = `${API_BASE_URL}/simulate/2d`;
        console.log("📡 Calling:", url);

        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(requestData),
        });

        if (!response.ok) {
            const error = await response.json();
            console.error("❌ Backend error:", error);
            throw new Error(error.detail || "Simulation failed");
        }

        const result = await response.json();
        console.log("✅ Simulation successful");
        return result;
    } catch (error) {
        console.error("❌ API Error:", error);
        throw error;
    }
}

/**
 * ✅ Call the 3D simulator backend
 * 
 * TODO: Implement proper 3D solver on backend
 */
async function simulate3D(requestData) {
    try {
        const url = `${API_BASE_URL}/simulate/3d`;
        console.log("📡 Calling 3D:", url);

        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(requestData),
        });

        if (!response.ok) {
            // Fallback to 2D if 3D not implemented
            console.warn("⚠️ 3D not available, using 2D");
            return simulate2D(requestData);
        }

        return await response.json();
    } catch (error) {
        console.warn("⚠️ 3D failed, falling back to 2D:", error);
        return simulate2D(requestData);
    }
}

/**
 * ✅ Check if backend is alive
 * 
 * Called at startup to verify connection
 */
async function checkHealth() {
    try {
        const url = `${API_BASE_URL}/health`;
        console.log("🏥 Health check:", url);

        const response = await fetch(url, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
            },
        });

        const result = await response.json();
        console.log("✅ Backend healthy:", result);
        return response.ok;
    } catch (error) {
        console.error("❌ Health check failed:", error);
        return false;
    }
}