let API_BASE_URL = "";

function initializeAPI() {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;

    if (hostname === "localhost" || hostname === "127.0.0.1") {
        // 🖥️ Local
        API_BASE_URL = "http://localhost:8000";
        console.log("Using local backend:", API_BASE_URL);
    } else {
        API_BASE_URL = "https://electric-field-simulator.onrender.com";
        console.log("Using render backend:", API_BASE_URL);
    }
}

initializeAPI();

async function checkHealth() {
    try {
        const url = `${API_BASE_URL}/health`;
        console.log("🏥 Health check:", url);
        const response = await fetch(url);
        const result = await response.json();
        console.log("✅ Backend healthy:", result);
        return response.ok;
    } catch (error) {
        console.error("❌ Health check failed:", error);
        return false;
    }
}

async function simulate2D(requestData) {
    try {
        const url = `${API_BASE_URL}/simulate/2d`;
        console.log("📡 Calling:", url);
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
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

async function simulate3D(requestData) {
    try {
        const url = `${API_BASE_URL}/simulate/3d`;
        console.log("📡 Calling 3D:", url); 
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestData),
        });
        
        // ❌ BUG: Este if está mal ubicado
        if (!response.ok) {
            const error = await response.json();
            console.error("❌ Backend error:", error);
            throw new Error(error.detail || "3D Simulation failed");
        }
        
        const result = await response.json();
        console.log("✅ 3D Simulation successful");
        return result;
        
    } catch (error) {
        console.error("❌ API Error:", error);
        throw error;
    }
}