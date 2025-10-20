let visualizer2D = null;
let visualizer3D = null;
let charges = [];

/**
 * Initialize app on page load
 */
document.addEventListener("DOMContentLoaded", async () => {
    // Check backend
    const isHealthy = await checkHealth();
    if (!isHealthy) {
        showStatus("❌ Cannot connect to backend. Is it running?", "error");
        return;
    }

    showStatus("✓ Connected to backend", "success");

    // Initialize visualizers
    visualizer2D = new Visualizer2D("canvas-2d");
    visualizer3D = new Visualizer3D("canvas-3d");

    // Event listeners
    document.getElementById("mode").addEventListener("change", handleModeChange);
    document.getElementById("add-charge-btn").addEventListener("click", addCharge);
    document.getElementById("run-simulation-btn").addEventListener("click", runSimulation);

    // Checkbox listeners for visualization options
    document.getElementById("show-field-lines-2d").addEventListener("change", updateVisualization);
    document.getElementById("show-potential-2d").addEventListener("change", updateVisualization);
    document.getElementById("show-field-vectors-3d").addEventListener("change", updateVisualization);
    document.getElementById("show-potential-surface-3d").addEventListener("change", updateVisualization);

    // Add equipotential checkbox listener
    const equipotentialCheckbox = document.getElementById("show-equipotential-2d");
    if (equipotentialCheckbox) {
        equipotentialCheckbox.addEventListener("change", updateVisualization);
    }

    // Initialize with two default charges
    addCharge(-0.5, 0, 1e-9);
    addCharge(0.5, 0, -1e-9);
    handleModeChange();

    // Add event listener for measure button
    document.getElementById("measure-btn").addEventListener("click", toggleMeasureTool);

    // Add event listener for equipotential button
    document.getElementById("equipotential-btn").addEventListener("click", toggleEquipotentialTool);
});

/**
 * Switch between 2D and 3D
 */
function handleModeChange() {
    const mode = document.getElementById("mode").value;
    const container2D = document.getElementById("canvas-2d-container");
    const container3D = document.getElementById("canvas-3d-container");

    if (mode === "2d") {
        container2D.style.display = "block";
        container3D.style.display = "none";
    } else {
        container2D.style.display = "none";
        container3D.style.display = "block";
    }
}

/**
 * Add a new charge input with smart defaults
 */
function addCharge(x = null, y = null, q = null) {
    const chargesList = document.getElementById("charges-list");
    const chargeId = charges.length;
    
    // Smart defaults based on charge number
    if (x === null || isNaN(x)) {
        x = -0.5 + (chargeId * 0.5);  // -0.5, 0, 0.5, 1.0, ...
    }
    if (y === null || isNaN(y)) {
        y = 0;
    }
    if (q === null || isNaN(q)) {
        q = chargeId % 2 === 0 ? 1e-9 : -1e-9;  // Alternate +/- charges
    }
    
    charges.push({ x, y, q, id: chargeId });

    const chargeItem = document.createElement("div");
    chargeItem.className = "charge-item";
    chargeItem.id = `charge-${chargeId}`;
    chargeItem.innerHTML = `
        <div>
            <label><strong>Charge ${chargeId + 1}</strong></label>
            <div style="margin-bottom: 8px;">
                <label style="display: inline; margin-right: 5px;">X (m):</label>
                <input type="number" class="charge-x" placeholder="X position" value="${x}" step="0.1" required>
            </div>
            <div style="margin-bottom: 8px;">
                <label style="display: inline; margin-right: 5px;">Y (m):</label>
                <input type="number" class="charge-y" placeholder="Y position" value="${y}" step="0.1" required>
            </div>
            <div style="margin-bottom: 8px;">
                <label style="display: inline; margin-right: 5px;">Q (C):</label>
                <input type="number" class="charge-q" placeholder="Charge" value="${q}" step="1e-9" required>
            </div>
        </div>
        <button type="button" onclick="removeCharge(${chargeId})" style="align-self: flex-start;">✕ Remove</button>
    `;

    chargesList.appendChild(chargeItem);
}

/**
 * Remove a charge
 */
function removeCharge(chargeId) {
    const chargeItem = document.getElementById(`charge-${chargeId}`);
    if (chargeItem) chargeItem.remove();
    charges = charges.filter(c => c.id !== chargeId);
}

/**
 * Collect form data with validation
 */
function collectFormData() {
    // Validate grid
    const grid = {
        xmin: parseFloat(document.getElementById("xmin").value),
        xmax: parseFloat(document.getElementById("xmax").value),
        ymin: parseFloat(document.getElementById("ymin").value),
        ymax: parseFloat(document.getElementById("ymax").value),
        nx: parseInt(document.getElementById("nx").value),
        ny: parseInt(document.getElementById("ny").value),
    };

    // Check grid values
    if (isNaN(grid.xmin) || isNaN(grid.xmax) || isNaN(grid.ymin) || isNaN(grid.ymax)) {
        throw new Error("Invalid grid values. Check that all grid fields are numbers.");
    }
    if (isNaN(grid.nx) || isNaN(grid.ny) || grid.nx < 2 || grid.ny < 2) {
        throw new Error("Grid resolution must be at least 2x2");
    }

    // Charges - read from DOM and validate
    const chargeElements = document.querySelectorAll(".charge-item");
    if (chargeElements.length === 0) {
        throw new Error("At least one charge is required");
    }

    const chargesData = Array.from(chargeElements).map((el, idx) => {
        const x = parseFloat(el.querySelector(".charge-x").value);
        const y = parseFloat(el.querySelector(".charge-y").value);
        const q = parseFloat(el.querySelector(".charge-q").value);
        
        // Detailed validation
        if (isNaN(x)) throw new Error(`Charge ${idx + 1}: X position is not a valid number`);
        if (isNaN(y)) throw new Error(`Charge ${idx + 1}: Y position is not a valid number`);
        if (isNaN(q)) throw new Error(`Charge ${idx + 1}: Charge magnitude is not a valid number`);
        if (q === 0) throw new Error(`Charge ${idx + 1}: Charge cannot be zero`);
        
        return { x, y, q };
    });

    // Save charges to session for visualization
    sessionStorage.setItem("chargeData", JSON.stringify(chargesData));

    return {
        charges: chargesData,
        grid: grid,
        softening: parseFloat(document.getElementById("softening").value),
        include_potential: document.getElementById("include-potential").checked,
    };
}

/**
 * Run simulation
 */
async function runSimulation() {
    try {
        showStatus("⏳ Running simulation...", "loading");

        const mode = document.getElementById("mode").value;
        let requestData;
        
        try {
            requestData = collectFormData();
        } catch (validationError) {
            showStatus(`❌ Validation Error: ${validationError.message}`, "error");
            return;
        }
        
        // DEBUG: Log the request
        console.log("📤 Sending request:", JSON.stringify(requestData, null, 2));

        let result;
        if (mode === "2d") {
            result = await simulate2D(requestData);
        } else {
            result = await simulate3D(requestData);
        }

        // Update visualization
        updateVisualization(result);
        showStatus("✓ Simulation complete!", "success");
    } catch (error) {
        showStatus(`❌ Error: ${error.message}`, "error");
        console.error("Full error:", error);
    }
}

/**
 * Update visualization based on options
 */
function updateVisualization(simulationResult = null) {
    if (!simulationResult) {
        const stored = sessionStorage.getItem("lastResult");
        if (!stored) return;
        simulationResult = JSON.parse(stored);
    } else {
        sessionStorage.setItem("lastResult", JSON.stringify(simulationResult));
    }

    const mode = document.getElementById("mode").value;

    if (mode === "2d") {
        visualizer2D.render(simulationResult, {
            showFieldLines: document.getElementById("show-field-lines-2d").checked,
            showPotential: document.getElementById("show-potential-2d").checked,
            showEquipotential: document.getElementById("show-equipotential-2d")?.checked || false,
        });
    } else {
        visualizer3D.render(simulationResult, {
            showFieldVectors: document.getElementById("show-field-vectors-3d").checked,
            showPotentialSurface: document.getElementById("show-potential-surface-3d").checked,
        });
    }
}

/**
 * Show status message
 */
function showStatus(message, type) {
    const el = document.getElementById("status-message");
    el.textContent = message;
    el.className = type;
}

/**
 * Toggle measurement mode
 */
function toggleMeasureTool() {
    visualizer2D.measureMode = !visualizer2D.measureMode;
    const btn = document.getElementById("measure-btn");
    
    if (visualizer2D.measureMode) {
        // Enable measure mode
        btn.style.background = "#f56565";
        visualizer2D.canvas.addEventListener("click", handleMeasureClick);
        showStatus("📍 Click on canvas to measure field", "loading");
    } else {
        // Disable measure mode - CLEAR the measurement point
        btn.style.background = "#667eea";
        visualizer2D.canvas.removeEventListener("click", handleMeasureClick);
        visualizer2D.measurePoint = null;  // ✅ Clear the measurement
        
        // Re-render to remove crosshair
        if (visualizer2D.data) {
            visualizer2D.render(visualizer2D.data, visualizer2D.currentOptions);
        }
        
        showStatus("Measure tool disabled", "success");
    }
}

/**
 * Handle measurement click
 */
function handleMeasureClick(e) {
    const rect = visualizer2D.canvas.getBoundingClientRect();
    const pixelX = e.clientX - rect.left;
    const pixelY = e.clientY - rect.top;
    
    const worldCoords = visualizer2D.pixelToWorld(pixelX, pixelY);
    
    const grid = visualizer2D.data.grid;
    const ex = visualizer2D.data.field.ex;
    const ey = visualizer2D.data.field.ey;
    const potential = visualizer2D.data.field.potential;
    
    const normX = (worldCoords.x - grid.xmin) / (grid.xmax - grid.xmin);
    const normY = (worldCoords.y - grid.ymin) / (grid.ymax - grid.ymin);
    
    const j = Math.round(normX * (grid.nx - 1));
    const i = Math.round(normY * (grid.ny - 1));
    
    if (i >= 0 && i < grid.ny && j >= 0 && j < grid.nx) {
        const exVal = ex[i][j];
        const eyVal = ey[i][j];
        const magnitude = Math.sqrt(exVal * exVal + eyVal * eyVal);
        
        visualizer2D.measurePoint = {
            x: worldCoords.x,
            y: worldCoords.y,
            magnitude: magnitude,
            potential: potential ? potential[i][j] : 0
        };
        
        // Show measurement in status
        showStatus(
            `📍 E: ${magnitude.toFixed(2)} V/m | V: ${visualizer2D.measurePoint.potential.toFixed(2)} V`,
            "success"
        );
        
        visualizer2D.render(visualizer2D.data, visualizer2D.currentOptions);
    }
}

/**
 * Toggle equipotential tool
 */
function toggleEquipotentialTool() {
    visualizer2D.equipotentialMode = !visualizer2D.equipotentialMode;
    const btn = document.getElementById("equipotential-btn");
    
    if (visualizer2D.equipotentialMode) {
        // Enable equipotential mode
        btn.style.background = "#48bb78";
        visualizer2D.canvas.addEventListener("click", handleEquipotentialClick);
        showStatus("🟡 Click on canvas to select equipotential line", "loading");
    } else {
        // Disable equipotential mode
        btn.style.background = "#667eea";
        visualizer2D.canvas.removeEventListener("click", handleEquipotentialClick);
        visualizer2D.equipotentialValue = null;
        visualizer2D.equipotentialPoint = null;
        
        // Re-render to remove crosshair
        if (visualizer2D.data) {
            visualizer2D.render(visualizer2D.data, visualizer2D.currentOptions);
        }
        
        showStatus("Equipotential tool disabled", "success");
    }
}

/**
 * Handle equipotential click
 */
function handleEquipotentialClick(e) {
    const rect = visualizer2D.canvas.getBoundingClientRect();
    const pixelX = e.clientX - rect.left;
    const pixelY = e.clientY - rect.top;
    
    const worldCoords = visualizer2D.pixelToWorld(pixelX, pixelY);
    
    const grid = visualizer2D.data.grid;
    const potential = visualizer2D.data.field.potential;
    
    const normX = (worldCoords.x - grid.xmin) / (grid.xmax - grid.xmin);
    const normY = (worldCoords.y - grid.ymin) / (grid.ymax - grid.ymin);
    
    const j = Math.round(normX * (grid.nx - 1));
    const i = Math.round(normY * (grid.ny - 1));
    
    if (i >= 0 && i < grid.ny && j >= 0 && j < grid.nx) {
        const potentialValue = potential[i][j];
        
        visualizer2D.equipotentialValue = potentialValue;
        visualizer2D.equipotentialPoint = {
            x: worldCoords.x,
            y: worldCoords.y
        };
        
        showStatus(`🟡 Equipotential Line: V = ${potentialValue.toFixed(2)} V`, "success");
        visualizer2D.render(visualizer2D.data, visualizer2D.currentOptions);
    }
}