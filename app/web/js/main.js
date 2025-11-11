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

    // Listeners para cambios en grid (actualiza botón)
    document.getElementById("xmin").addEventListener("change", updateChargeInputLimits);
    document.getElementById("xmax").addEventListener("change", updateChargeInputLimits);
    document.getElementById("ymin").addEventListener("change", updateChargeInputLimits);
    document.getElementById("ymax").addEventListener("change", updateChargeInputLimits);
    
    //También al escribir (input event)
    document.getElementById("xmin").addEventListener("input", updateAddChargeButton);
    document.getElementById("xmax").addEventListener("input", updateAddChargeButton);
    document.getElementById("ymin").addEventListener("input", updateAddChargeButton);
    document.getElementById("ymax").addEventListener("input", updateAddChargeButton);

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
    handleModeChange();

    const xmin = parseFloat(document.getElementById("xmin").value);
    const xmax = parseFloat(document.getElementById("xmax").value);
    const ymin = parseFloat(document.getElementById("ymin").value);
    const ymax = parseFloat(document.getElementById("ymax").value);
    
    const centerX = (xmin + xmax) / 2;
    const centerY = (ymin + ymax) / 2;
    
    addCharge(centerX, centerY, 1e-9);

    //Check initial button state
    updateAddChargeButton();

    // Add event listener for measure button
    document.getElementById("measure-btn").addEventListener("click", toggleMeasureTool);

    // Add event listener for equipotential button
    document.getElementById("equipotential-btn").addEventListener("click", toggleEquipotentialTool);
    showStatus("✓ Ready! Add charges and click 'Run Simulation' to start", "success");
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
 * Update charge data in sessionStorage from DOM
 */
function updateChargeData() {
    const chargeElements = document.querySelectorAll(".charge-item");
    const chargesData = Array.from(chargeElements).map((el) => {
        const x = parseFloat(el.querySelector(".charge-x").value);
        const y = parseFloat(el.querySelector(".charge-y").value);
        const q = parseFloat(el.querySelector(".charge-q").value);
        return { x, y, q };
    });
    
    sessionStorage.setItem("chargeData", JSON.stringify(chargesData));
    console.log("📊 Charge data updated:", chargesData);
}

function validateGridForNewCharge() {
    const xmin = parseFloat(document.getElementById("xmin").value);
    const xmax = parseFloat(document.getElementById("xmax").value);
    const ymin = parseFloat(document.getElementById("ymin").value);
    const ymax = parseFloat(document.getElementById("ymax").value);
    
    // Check if grid is valid
    if (isNaN(xmin) || isNaN(xmax) || isNaN(ymin) || isNaN(ymax)) {
        return {
            valid: false,
            message: "⚠️ Grid settings are invalid. Please set valid X and Y ranges."
        };
    }
    
    if (xmin >= xmax) {
        return {
            valid: false,
            message: "⚠️ X min must be less than X max"
        };
    }
    
    if (ymin >= ymax) {
        return {
            valid: false,
            message: "⚠️ Y min must be less than Y max"
        };
    }
    
    // ✅ Solo valida que el grid sea válido, no la posición de la próxima carga
    return { valid: true };
}

function updateAddChargeButton() {
    const addBtn = document.getElementById("add-charge-btn");
    const validation = validateGridForNewCharge();
    
    if (!validation.valid) {
        addBtn.disabled = true;
        addBtn.style.opacity = "0.5";
        addBtn.style.cursor = "not-allowed";
        addBtn.title = validation.message;
        showStatus(validation.message, "error");
    } else {
        addBtn.disabled = false;
        addBtn.style.opacity = "1";
        addBtn.style.cursor = "pointer";
        addBtn.title = "Add a new charge";
    }
}

function addCharge(x = null, y = null, q = null) {
    // ✅ Validate grid is valid
    const validation = validateGridForNewCharge();
    if (!validation.valid) {
        showStatus(validation.message, "error");
        return;
    }
    
    const chargesList = document.getElementById("charges-list");
    const chargeId = charges.length;
    
    // Get current grid limits
    const xmin = parseFloat(document.getElementById("xmin").value);
    const xmax = parseFloat(document.getElementById("xmax").value);
    const ymin = parseFloat(document.getElementById("ymin").value);
    const ymax = parseFloat(document.getElementById("ymax").value);
    
    // Smart defaults based on charge number
    if (x === null || isNaN(x)) {
        const centerX = (xmin + xmax) / 2;
        const rangeX = xmax - xmin;
        
        // ✅ Distribuir cargas más inteligentemente
        if (chargeId === 0) {
            // Primera carga en el centro
            x = centerX;
        } else {
            // Siguiente carga: alternar izquierda/derecha del centro
            const offset = Math.ceil(chargeId / 2) * (rangeX / 8);
            x = chargeId % 2 === 0 ? centerX + offset : centerX - offset;
        }
        
        // Clamp to grid
        x = Math.max(xmin + 0.1 * rangeX, Math.min(xmax - 0.1 * rangeX, x));
    }
    
    if (y === null || isNaN(y)) {
        const centerY = (ymin + ymax) / 2;
        const rangeY = ymax - ymin;
        
        // ✅ Variar Y para que no se superpongan
        y = centerY + (Math.random() - 0.5) * rangeY * 0.2;
        y = Math.max(ymin + 0.1 * rangeY, Math.min(ymax - 0.1 * rangeY, y));
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
                <input 
                    type="number" 
                    class="charge-x" 
                    placeholder="X position" 
                    value="${x.toFixed(2)}" 
                    step="0.1" 
                    min="${xmin}" 
                    max="${xmax}"
                    oninput="validateChargePosition(this, ${chargeId})"
                    required>
            </div>
            <div style="margin-bottom: 8px;">
                <label style="display: inline; margin-right: 5px;">Y (m):</label>
                <input 
                    type="number" 
                    class="charge-y" 
                    placeholder="Y position" 
                    value="${y.toFixed(2)}" 
                    step="0.1" 
                    min="${ymin}" 
                    max="${ymax}"
                    oninput="validateChargePosition(this, ${chargeId})"
                    required>
            </div>
            <div style="margin-bottom: 8px;">
                <label style="display: inline; margin-right: 5px;">Q (C):</label>
                <input 
                    type="number" 
                    class="charge-q" 
                    placeholder="Charge" 
                    value="${q}" 
                    step="1e-9" 
                    required>
            </div>
        </div>
        <button type="button" onclick="removeCharge(${chargeId})" style="align-self: flex-start;">✕ Remove</button>
    `;

    chargesList.appendChild(chargeItem);

    // Update sessionStorage immediately
    updateChargeData();
    
    // Draw charges immediately
    const stored = sessionStorage.getItem("lastResult");
    if (stored && visualizer2D && visualizer2D.data) {
        visualizer2D.render(visualizer2D.data, visualizer2D.currentOptions);
    } 
    
    //Update button state for next charge
    updateAddChargeButton();
    
    showStatus(`✓ Charge ${chargeId + 1} added at (${x.toFixed(2)}, ${y.toFixed(2)})`, "success");
}


function updateChargeInputLimits() {
    const xmin = parseFloat(document.getElementById("xmin").value);
    const xmax = parseFloat(document.getElementById("xmax").value);
    const ymin = parseFloat(document.getElementById("ymin").value);
    const ymax = parseFloat(document.getElementById("ymax").value);
    
    // Update all charge inputs
    const chargeElements = document.querySelectorAll(".charge-item");
    chargeElements.forEach((el) => {
        const xInput = el.querySelector(".charge-x");
        const yInput = el.querySelector(".charge-y");
        
        // Update min/max attributes
        xInput.setAttribute("min", xmin);
        xInput.setAttribute("max", xmax);
        yInput.setAttribute("min", ymin);
        yInput.setAttribute("max", ymax);
        
        // Clamp current values
        const currentX = parseFloat(xInput.value);
        const currentY = parseFloat(yInput.value);
        
        if (currentX < xmin) xInput.value = xmin;
        if (currentX > xmax) xInput.value = xmax;
        if (currentY < ymin) yInput.value = ymin;
        if (currentY > ymax) yInput.value = ymax;
    });
    
    // Update visualization
    updateChargeData();
    if (visualizer2D) {
        const stored = sessionStorage.getItem("lastResult");
        if (stored && visualizer2D.data) {
            visualizer2D.render(visualizer2D.data, visualizer2D.currentOptions);
        } else {
            visualizer2D.drawChargesOnly();
        }
    }
    
    // Check if add charge button should be enabled/disabled
    updateAddChargeButton();
}
/**
 * Add a new charge input with smart defaults
 */


function validateChargePosition(input, chargeId) {
    const xmin = parseFloat(document.getElementById("xmin").value);
    const xmax = parseFloat(document.getElementById("xmax").value);
    const ymin = parseFloat(document.getElementById("ymin").value);
    const ymax = parseFloat(document.getElementById("ymax").value);
    
    const value = parseFloat(input.value);
    const isXInput = input.classList.contains("charge-x");
    const isYInput = input.classList.contains("charge-y");
    
    // Get limits for this input
    const min = isXInput ? xmin : (isYInput ? ymin : -Infinity);
    const max = isXInput ? xmax : (isYInput ? ymax : Infinity);
    
    // Clamp value
    if (value < min) {
        input.value = min;
        showStatus(`⚠️ Charge ${chargeId + 1}: ${isXInput ? 'X' : 'Y'} clamped to grid minimum (${min})`, "error");
    } else if (value > max) {
        input.value = max;
        showStatus(`⚠️ Charge ${chargeId + 1}: ${isXInput ? 'X' : 'Y'} clamped to grid maximum (${max})`, "error");
    }
    
    // Update visualization
    updateChargeData();
    const stored = sessionStorage.getItem("lastResult");
    if (stored && visualizer2D && visualizer2D.data) {
        visualizer2D.render(visualizer2D.data, visualizer2D.currentOptions);
    } else if (visualizer2D) {
        visualizer2D.drawChargesOnly();
    }
}

function updateChargeInputLimits() {
    const xmin = parseFloat(document.getElementById("xmin").value);
    const xmax = parseFloat(document.getElementById("xmax").value);
    const ymin = parseFloat(document.getElementById("ymin").value);
    const ymax = parseFloat(document.getElementById("ymax").value);
    
    // Update all charge inputs
    const chargeElements = document.querySelectorAll(".charge-item");
    chargeElements.forEach((el) => {
        const xInput = el.querySelector(".charge-x");
        const yInput = el.querySelector(".charge-y");
        
        // Update min/max attributes
        xInput.setAttribute("min", xmin);
        xInput.setAttribute("max", xmax);
        yInput.setAttribute("min", ymin);
        yInput.setAttribute("max", ymax);
        
        // Clamp current values
        const currentX = parseFloat(xInput.value);
        const currentY = parseFloat(yInput.value);
        
        if (currentX < xmin) xInput.value = xmin;
        if (currentX > xmax) xInput.value = xmax;
        if (currentY < ymin) yInput.value = ymin;
        if (currentY > ymax) yInput.value = ymax;
    });
    
    // Update visualization
    updateChargeData();
    if (visualizer2D) {
        const stored = sessionStorage.getItem("lastResult");
        if (stored && visualizer2D.data) {
            visualizer2D.render(visualizer2D.data, visualizer2D.currentOptions);
        } else {
            visualizer2D.drawChargesOnly();
        }
    }
}

function removeCharge(chargeId) {
    const chargeItem = document.getElementById(`charge-${chargeId}`);
    if (chargeItem) chargeItem.remove();
    charges = charges.filter(c => c.id !== chargeId);
    
    // Update sessionStorage
    updateChargeData();
    
    // Re-dibujar
    const stored = sessionStorage.getItem("lastResult");
    if (stored && visualizer2D && visualizer2D.data) {
        visualizer2D.render(visualizer2D.data, visualizer2D.currentOptions);
    } else if (visualizer2D) {
        visualizer2D.drawChargesOnly();
    }
    
    // Update button state (may be enabled now)
    updateAddChargeButton();
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
        visualizer2D.measurePoint = null;  // Clear the measurement
        
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