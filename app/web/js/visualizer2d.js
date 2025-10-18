class Visualizer2D {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext("2d");
        this.data = null;
        this.currentOptions = {};
        
        // Interaction state
        this.isDragging = false;
        this.draggedChargeId = null;
        this.measurePoint = null;
        this.measureMode = false;
        this.equipotentialMode = false;
        this.equipotentialValue = null;  // The V value at the clicked point
        this.equipotentialPoint = null;  // The clicked point
        
        this.setupEventListeners();
        this.resizeCanvas();
        window.addEventListener("resize", () => this.resizeCanvas());
    }

    setupEventListeners() {
        this.canvas.addEventListener("mousedown", (e) => this.onMouseDown(e));
        this.canvas.addEventListener("mousemove", (e) => this.onMouseMove(e));
        this.canvas.addEventListener("mouseup", (e) => this.onMouseUp(e));
        this.canvas.addEventListener("mouseleave", (e) => this.onMouseUp(e));
    }

    onMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const pixelX = e.clientX - rect.left;
        const pixelY = e.clientY - rect.top;
        
        const worldCoords = this.pixelToWorld(pixelX, pixelY);
        const chargeData = JSON.parse(sessionStorage.getItem("chargeData") || "[]");
        const clickRadius = 0.08;
        
        for (let i = 0; i < chargeData.length; i++) {
            const charge = chargeData[i];
            const dx = worldCoords.x - charge.x;
            const dy = worldCoords.y - charge.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < clickRadius) {
                this.isDragging = true;
                this.draggedChargeId = i;
                console.log(`🎯 Dragging charge ${i}`);
                return;
            }
        }
    }

    onMouseMove(e) {
        if (!this.isDragging || this.draggedChargeId === null) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const pixelX = e.clientX - rect.left;
        const pixelY = e.clientY - rect.top;
        
        const worldCoords = this.pixelToWorld(pixelX, pixelY);
        const chargeData = JSON.parse(sessionStorage.getItem("chargeData") || "[]");
        
        chargeData[this.draggedChargeId].x = worldCoords.x;
        chargeData[this.draggedChargeId].y = worldCoords.y;
        sessionStorage.setItem("chargeData", JSON.stringify(chargeData));
        
        const chargeElements = document.querySelectorAll(".charge-item");
        if (chargeElements[this.draggedChargeId]) {
            chargeElements[this.draggedChargeId].querySelector(".charge-x").value = worldCoords.x.toFixed(2);
            chargeElements[this.draggedChargeId].querySelector(".charge-y").value = worldCoords.y.toFixed(2);
        }
        
        this.triggerSimulation();
        this.canvas.style.cursor = "grabbing";
    }

    onMouseUp(e) {
        this.isDragging = false;
        this.draggedChargeId = null;
        this.canvas.style.cursor = "grab";
    }

    pixelToWorld(pixelX, pixelY) {
        const grid = this.data.grid;
        const normX = pixelX / this.canvas.width;
        const normY = pixelY / this.canvas.height;
        
        const x = grid.xmin + normX * (grid.xmax - grid.xmin);
        const y = grid.ymin + normY * (grid.ymax - grid.ymin);
        
        return { x, y };
    }

    worldToPixel(x, y) {
        const grid = this.data.grid;
        const normX = (x - grid.xmin) / (grid.xmax - grid.xmin);
        const normY = (y - grid.ymin) / (grid.ymax - grid.ymin);
        
        const pixelX = normX * this.canvas.width;
        const pixelY = normY * this.canvas.height;
        
        return { x: pixelX, y: pixelY };
    }

    resizeCanvas() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width - 20;
        this.canvas.height = Math.min(rect.width - 20, 600);
    }

    /**
     * Main render function
     */
    render(simulationData, options = {}) {
        this.data = simulationData;
        this.currentOptions = options;
        this.resizeCanvas();

        const showFieldLines = options.showFieldLines !== false;
        const showPotential = options.showPotential !== false;
        const showEquipotential = options.showEquipotential !== false;

        // Clear canvas
        this.ctx.fillStyle = "#ffffff";
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw heatmap (background)
        if (showPotential && this.data.field.potential) {
            this.drawPotentialHeatmap();
        }

        // Draw equipotential contour lines with labels
        if (showEquipotential && this.data.field.potential) {
            this.drawEquipotentialLines();
        }

        // Draw the selected equipotential line (highlighted)
        if (this.equipotentialMode && this.equipotentialValue !== null && this.data.field.potential) {
            this.drawHighlightedEquipotentialLine();
        }

        // Draw field lines (vectors)
        if (showFieldLines) {
            this.drawFieldLines();
        }

        // Draw charges (on top)
        this.drawCharges();
        
        // Draw grid boundary
        this.drawGridBox();
        
        // Draw measurement point ONLY if measure mode is active
        if (this.measureMode && this.measurePoint) {
            this.drawMeasurementInfo();
        }

        // Draw equipotential point crosshair
        if (this.equipotentialMode && this.equipotentialPoint) {
            this.drawEquipotentialCrosshair();
        }
    }

    /**
     * Draw potential as a heatmap
     */
    drawPotentialHeatmap() {
        const grid = this.data.grid;
        const potential = this.data.field.potential;
        
        let minV = Infinity, maxV = -Infinity;
        for (let row of potential) {
            for (let v of row) {
                minV = Math.min(minV, v);
                maxV = Math.max(maxV, v);
            }
        }

        const pixelWidth = this.canvas.width / grid.nx;
        const pixelHeight = this.canvas.height / grid.ny;

        for (let i = 0; i < grid.ny; i++) {
            for (let j = 0; j < grid.nx; j++) {
                const v = potential[i][j];
                const normalized = (v - minV) / (maxV - minV + 1e-10);
                
                const color = this.valueToColor(normalized);
                this.ctx.fillStyle = color;
                this.ctx.fillRect(j * pixelWidth, i * pixelHeight, pixelWidth, pixelHeight);
            }
        }
    }

    /**
     * Draw all equipotential contour lines
     */
    drawEquipotentialLines() {
        const grid = this.data.grid;
        const potential = this.data.field.potential;
        
        let minV = Infinity, maxV = -Infinity;
        for (let row of potential) {
            for (let v of row) {
                minV = Math.min(minV, v);
                maxV = Math.max(maxV, v);
            }
        }

        const range = maxV - minV;
        const numContours = 8;
        
        this.ctx.lineWidth = 1.5;
        this.ctx.globalAlpha = 0.5;

        const contours = [];

        for (let contourIdx = 1; contourIdx < numContours; contourIdx++) {
            const targetV = minV + (range * contourIdx) / numContours;
            const hue = (targetV - minV) / range * 360;
            const color = `hsl(${hue}, 100%, 40%)`;
            
            this.ctx.strokeStyle = color;
            this.drawContourLine(potential, grid, targetV);
            
            contours.push({ value: targetV, hue, color });
        }
        
        this.ctx.globalAlpha = 1.0;
        this.drawContourLabels(potential, grid, contours, minV, maxV);
    }

    /**
     * Draw a single equipotential line
     */
    drawContourLine(potential, grid, targetV) {
        const pixelWidth = this.canvas.width / grid.nx;
        const pixelHeight = this.canvas.height / grid.ny;

        for (let i = 0; i < grid.ny - 1; i++) {
            for (let j = 0; j < grid.nx - 1; j++) {
                const v00 = potential[i][j];
                const v10 = potential[i][j + 1];
                const v01 = potential[i + 1][j];
                const v11 = potential[i + 1][j + 1];
                
                const hasLower = (v00 < targetV) || (v10 < targetV) || (v01 < targetV) || (v11 < targetV);
                const hasHigher = (v00 > targetV) || (v10 > targetV) || (v01 > targetV) || (v11 > targetV);
                
                if (hasLower && hasHigher) {
                    const x = j * pixelWidth;
                    const y = i * pixelHeight;
                    
                    this.ctx.beginPath();
                    this.ctx.rect(x, y, pixelWidth, pixelHeight);
                    this.ctx.stroke();
                }
            }
        }
    }

    /**
     * Draw the highlighted equipotential line (thick and bright)
     */
    drawHighlightedEquipotentialLine() {
        const grid = this.data.grid;
        const potential = this.data.field.potential;
        const targetV = this.equipotentialValue;

        const pixelWidth = this.canvas.width / grid.nx;
        const pixelHeight = this.canvas.height / grid.ny;

        // Draw with bright yellow, thick line
        this.ctx.strokeStyle = "#FFD700";
        this.ctx.lineWidth = 4;
        this.ctx.shadowColor = "rgba(255, 215, 0, 0.8)";
        this.ctx.shadowBlur = 10;
        this.ctx.globalAlpha = 0.9;

        for (let i = 0; i < grid.ny - 1; i++) {
            for (let j = 0; j < grid.nx - 1; j++) {
                const v00 = potential[i][j];
                const v10 = potential[i][j + 1];
                const v01 = potential[i + 1][j];
                const v11 = potential[i + 1][j + 1];
                
                // More precise threshold for the line
                const tolerance = Math.abs(this.equipotentialValue) * 0.01 + 1e-6;
                const hasLower = (v00 < targetV) || (v10 < targetV) || (v01 < targetV) || (v11 < targetV);
                const hasHigher = (v00 > targetV) || (v10 > targetV) || (v01 > targetV) || (v11 > targetV);
                
                if (hasLower && hasHigher) {
                    const x = j * pixelWidth;
                    const y = i * pixelHeight;
                    
                    this.ctx.beginPath();
                    this.ctx.rect(x, y, pixelWidth, pixelHeight);
                    this.ctx.stroke();
                }
            }
        }

        this.ctx.shadowColor = "transparent";
        this.ctx.globalAlpha = 1.0;
    }

    /**
     * Draw labels on equipotential lines
     */
    drawContourLabels(potential, grid, contours, minV, maxV) {
        const pixelWidth = this.canvas.width / grid.nx;
        const pixelHeight = this.canvas.height / grid.ny;

        for (let contour of contours) {
            const targetV = contour.value;
            let labelPlaced = false;

            for (let i = Math.floor(grid.ny / 2) - 5; i < Math.floor(grid.ny / 2) + 5 && !labelPlaced; i++) {
                for (let j = Math.floor(grid.nx / 3); j < Math.floor((2 * grid.nx) / 3) && !labelPlaced; j++) {
                    if (i < 0 || i >= grid.ny - 1 || j < 0 || j >= grid.nx - 1) continue;

                    const v00 = potential[i][j];
                    const v10 = potential[i][j + 1];
                    const v01 = potential[i + 1][j];
                    const v11 = potential[i + 1][j + 1];
                    
                    const hasLower = (v00 < targetV) || (v10 < targetV) || (v01 < targetV) || (v11 < targetV);
                    const hasHigher = (v00 > targetV) || (v10 > targetV) || (v01 > targetV) || (v11 > targetV);
                    
                    if (hasLower && hasHigher) {
                        const x = j * pixelWidth + pixelWidth / 2;
                        const y = i * pixelHeight + pixelHeight / 2;
                        
                        const labelText = `${targetV.toFixed(1)}V`;
                        this.ctx.font = "bold 11px Arial";
                        this.ctx.textAlign = "center";
                        this.ctx.textBaseline = "middle";
                        
                        const metrics = this.ctx.measureText(labelText);
                        const padding = 4;
                        
                        this.ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
                        this.ctx.fillRect(
                            x - metrics.width / 2 - padding,
                            y - 8 - padding,
                            metrics.width + padding * 2,
                            16 + padding * 2
                        );
                        
                        this.ctx.strokeStyle = contour.color;
                        this.ctx.lineWidth = 1.5;
                        this.ctx.strokeRect(
                            x - metrics.width / 2 - padding,
                            y - 8 - padding,
                            metrics.width + padding * 2,
                            16 + padding * 2
                        );
                        
                        this.ctx.fillStyle = contour.color;
                        this.ctx.fillText(labelText, x, y);
                        
                        labelPlaced = true;
                    }
                }
            }
        }
    }

    /**
     * Convert normalized value [0,1] to color (blue → white → red)
     */
    valueToColor(value) {
        let r, g, b;
        if (value < 0.5) {
            const t = value * 2;
            r = 255 * t;
            g = 255 * t;
            b = 255;
        } else {
            const t = (value - 0.5) * 2;
            r = 255;
            g = 255 * (1 - t);
            b = 255 * (1 - t);
        }
        return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
    }

    /**
     * Draw field lines (vector arrows)
     */
    drawFieldLines() {
        const grid = this.data.grid;
        const ex = this.data.field.ex;
        const ey = this.data.field.ey;

        const step = Math.max(1, Math.floor(grid.nx / 12));
        const pixelWidth = this.canvas.width / grid.nx;
        const pixelHeight = this.canvas.height / grid.ny;

        this.ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";
        this.ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
        this.ctx.lineWidth = 1.5;

        for (let i = 0; i < grid.ny; i += step) {
            for (let j = 0; j < grid.nx; j += step) {
                const exVal = ex[i][j];
                const eyVal = ey[i][j];
                
                const magnitude = Math.sqrt(exVal * exVal + eyVal * eyVal);
                if (magnitude < 1e-10) continue;

                const scale = 15;
                const dx = (exVal / magnitude) * scale;
                const dy = (eyVal / magnitude) * scale;

                const px = j * pixelWidth + pixelWidth / 2;
                const py = i * pixelHeight + pixelHeight / 2;

                this.ctx.beginPath();
                this.ctx.moveTo(px, py);
                this.ctx.lineTo(px + dx, py + dy);
                this.ctx.stroke();

                this.drawArrow(px + dx, py + dy, dx, dy);
            }
        }
    }

    /**
     * Draw arrowhead
     */
    drawArrow(x, y, dx, dy) {
        const angle = Math.atan2(dy, dx);
        const size = 8;

        this.ctx.beginPath();
        this.ctx.moveTo(x, y);
        this.ctx.lineTo(x - size * Math.cos(angle - Math.PI / 6), y - size * Math.sin(angle - Math.PI / 6));
        this.ctx.lineTo(x - size * Math.cos(angle + Math.PI / 6), y - size * Math.sin(angle + Math.PI / 6));
        this.ctx.closePath();
        this.ctx.fill();
    }

    /**
     * Draw charges as big circles with +/- signs
     */
    drawCharges() {
        const chargeData = JSON.parse(sessionStorage.getItem("chargeData") || "[]");

        for (let i = 0; i < chargeData.length; i++) {
            const charge = chargeData[i];
            const screenCoords = this.worldToPixel(charge.x, charge.y);
            
            const radius = 22;
            
            this.ctx.fillStyle = charge.q > 0 ? "#ff4444" : "#4444ff";
            this.ctx.beginPath();
            this.ctx.arc(screenCoords.x, screenCoords.y, radius, 0, 2 * Math.PI);
            this.ctx.fill();

            this.ctx.strokeStyle = "#000000";
            this.ctx.lineWidth = 3;
            this.ctx.stroke();

            this.ctx.fillStyle = "white";
            this.ctx.font = "bold 32px Arial";
            this.ctx.textAlign = "center";
            this.ctx.textBaseline = "middle";
            const sign = charge.q > 0 ? "+" : "−";
            this.ctx.fillText(sign, screenCoords.x, screenCoords.y);
        }
    }

    /**
     * Draw grid boundary
     */
    drawGridBox() {
        this.ctx.strokeStyle = "#999999";
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(0, 0, this.canvas.width, this.canvas.height);
    }

    /**
     * Draw beautiful equipotential crosshair
     */
    drawEquipotentialCrosshair() {
        if (!this.equipotentialPoint) return;
        
        const screenCoords = this.worldToPixel(this.equipotentialPoint.x, this.equipotentialPoint.y);
        
        // Outer circle
        this.ctx.strokeStyle = "#FFD700";
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.arc(screenCoords.x, screenCoords.y, 25, 0, 2 * Math.PI);
        this.ctx.stroke();
        
        // Inner circle
        this.ctx.strokeStyle = "#FFF";
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.arc(screenCoords.x, screenCoords.y, 20, 0, 2 * Math.PI);
        this.ctx.stroke();
        
        // Crosshair lines
        this.ctx.strokeStyle = "#FFD700";
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([5, 5]);
        
        // Horizontal
        this.ctx.beginPath();
        this.ctx.moveTo(screenCoords.x - 40, screenCoords.y);
        this.ctx.lineTo(screenCoords.x + 40, screenCoords.y);
        this.ctx.stroke();
        
        // Vertical
        this.ctx.beginPath();
        this.ctx.moveTo(screenCoords.x, screenCoords.y - 40);
        this.ctx.lineTo(screenCoords.x, screenCoords.y + 40);
        this.ctx.stroke();
        
        this.ctx.setLineDash([]);
        
        // Center dot
        this.ctx.fillStyle = "#FFD700";
        this.ctx.beginPath();
        this.ctx.arc(screenCoords.x, screenCoords.y, 5, 0, 2 * Math.PI);
        this.ctx.fill();
        
        // Info box
        this.ctx.fillStyle = "rgba(255, 215, 0, 0.95)";
        this.ctx.fillRect(screenCoords.x + 45, screenCoords.y - 35, 180, 70);
        
        this.ctx.fillStyle = "#000000";
        this.ctx.font = "bold 13px Arial";
        this.ctx.textAlign = "left";
        this.ctx.lineWidth = 1;
        this.ctx.strokeStyle = "#000";
        this.ctx.strokeRect(screenCoords.x + 45, screenCoords.y - 35, 180, 70);
        
        this.ctx.fillText(`⚡ Equipotential Line`, screenCoords.x + 53, screenCoords.y - 18);
        this.ctx.font = "bold 12px Arial";
        this.ctx.fillText(`V = ${this.equipotentialValue.toFixed(2)} V`, screenCoords.x + 53, screenCoords.y + 0);
        this.ctx.font = "11px Arial";
        this.ctx.fillText(`X: ${this.equipotentialPoint.x.toFixed(3)} m`, screenCoords.x + 53, screenCoords.y + 18);
        this.ctx.fillText(`Y: ${this.equipotentialPoint.y.toFixed(3)} m`, screenCoords.x + 53, screenCoords.y + 35);
    }

    /**
     * Draw measurement info
     */
    drawMeasurementInfo() {
        if (!this.measurePoint) return;
        
        const screenCoords = this.worldToPixel(this.measurePoint.x, this.measurePoint.y);
        
        // Draw crosshair
        this.ctx.strokeStyle = "#ff0000";
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(screenCoords.x - 20, screenCoords.y);
        this.ctx.lineTo(screenCoords.x + 20, screenCoords.y);
        this.ctx.stroke();
        this.ctx.beginPath();
        this.ctx.moveTo(screenCoords.x, screenCoords.y - 20);
        this.ctx.lineTo(screenCoords.x, screenCoords.y + 20);
        this.ctx.stroke();
        
        // Draw info box
        this.ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
        this.ctx.fillRect(screenCoords.x + 25, screenCoords.y - 50, 220, 100);
        
        this.ctx.fillStyle = "#000000";
        this.ctx.font = "bold 12px Arial";
        this.ctx.textAlign = "left";
        this.ctx.lineWidth = 1;
        this.ctx.strokeStyle = "#cccccc";
        this.ctx.strokeRect(screenCoords.x + 25, screenCoords.y - 50, 220, 100);
        
        this.ctx.fillText(`📍 Position`, screenCoords.x + 35, screenCoords.y - 35);
        this.ctx.font = "11px Arial";
        this.ctx.fillText(`X: ${this.measurePoint.x.toFixed(3)} m`, screenCoords.x + 35, screenCoords.y - 18);
        this.ctx.fillText(`Y: ${this.measurePoint.y.toFixed(3)} m`, screenCoords.x + 35, screenCoords.y - 3);
        
        this.ctx.font = "bold 12px Arial";
        this.ctx.fillText(`⚡ Field Values`, screenCoords.x + 35, screenCoords.y + 18);
        this.ctx.font = "11px Arial";
        this.ctx.fillText(`E: ${this.measurePoint.magnitude.toFixed(2)} V/m`, screenCoords.x + 35, screenCoords.y + 35);
        this.ctx.fillText(`V: ${this.measurePoint.potential.toFixed(2)} V`, screenCoords.x + 35, screenCoords.y + 50);
    }

    /**
     * Trigger simulation update
     */
    triggerSimulation() {
        const btn = document.getElementById("run-simulation-btn");
        btn.click();
    }
}