class Visualizer3D {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.data = null;
        this.setupScene();
    }

    /**
     * Initialize Three.js scene
     */
    setupScene() {
        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xf9fafb);

        // Camera
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
        this.camera.position.set(2, 2, 2);
        this.camera.lookAt(0, 0, 0);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(width, height);
        this.container.appendChild(this.renderer.domElement);

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(5, 10, 7);
        this.scene.add(directionalLight);

        // Orbit controls (basic rotation with mouse)
        this.setupControls();

        // Animation loop
        this.animate();
    }

    /**
     * Basic mouse controls for rotation
     */
    setupControls() {
        let isDragging = false;
        let previousMousePosition = { x: 0, y: 0 };

        this.renderer.domElement.addEventListener("mousedown", (e) => {
            isDragging = true;
            previousMousePosition = { x: e.clientX, y: e.clientY };
        });

        this.renderer.domElement.addEventListener("mousemove", (e) => {
            if (isDragging) {
                const deltaX = e.clientX - previousMousePosition.x;
                const deltaY = e.clientY - previousMousePosition.y;

                this.scene.rotation.y += deltaX * 0.005;
                this.scene.rotation.x += deltaY * 0.005;

                previousMousePosition = { x: e.clientX, y: e.clientY };
            }
        });

        this.renderer.domElement.addEventListener("mouseup", () => {
            isDragging = false;
        });
    }

    /**
     * Main render function
     */
    render(simulationData, options = {}) {
        this.data = simulationData;

        // Clear old objects
        while (this.scene.children.length > 4) { // Keep lights and camera
            this.scene.remove(this.scene.children[4]);
        }

        if (options.showPotentialSurface !== false && this.data.field.potential) {
            this.drawPotentialSurface();
        }

        if (options.showFieldVectors !== false) {
            this.drawFieldVectors();
        }

        this.drawCharges3D();
    }

    /**
     * Draw potential as a 3D surface
     */
    drawPotentialSurface() {
        const grid = this.data.grid;
        const potential = this.data.field.potential;

        const geometry = new THREE.BufferGeometry();
        const vertices = [];
        const colors = [];

        // Find min/max
        let minV = Infinity, maxV = -Infinity;
        for (let row of potential) {
            for (let v of row) {
                minV = Math.min(minV, v);
                maxV = Math.max(maxV, v);
            }
        }

        const xScale = 2 / (grid.nx - 1);
        const yScale = 2 / (grid.ny - 1);
        const zScale = 0.5;

        for (let i = 0; i < grid.ny; i++) {
            for (let j = 0; j < grid.nx; j++) {
                const x = j * xScale - 1;
                const y = i * yScale - 1;
                const z = ((potential[i][j] - minV) / (maxV - minV + 1e-10) - 0.5) * zScale;

                vertices.push(x, y, z);

                // Color based on height
                const normalized = (potential[i][j] - minV) / (maxV - minV + 1e-10);
                const rgb = this.valueToColorRGB(normalized);
                colors.push(rgb.r, rgb.g, rgb.b);
            }
        }

        geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(vertices), 3));
        geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(colors), 3));

        // Create indices for triangles
        const indices = [];
        for (let i = 0; i < grid.ny - 1; i++) {
            for (let j = 0; j < grid.nx - 1; j++) {
                const a = i * grid.nx + j;
                const b = i * grid.nx + (j + 1);
                const c = (i + 1) * grid.nx + j;
                const d = (i + 1) * grid.nx + (j + 1);

                indices.push(a, c, b);
                indices.push(b, c, d);
            }
        }
        geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(indices), 1));

        const material = new THREE.MeshPhongMaterial({
            vertexColors: true,
            wireframe: false,
        });

        const mesh = new THREE.Mesh(geometry, material);
        this.scene.add(mesh);
    }

    /**
     * Convert value [0,1] to RGB
     */
    valueToColorRGB(value) {
        let r, g, b;
        if (value < 0.5) {
            const t = value * 2;
            r = t;
            g = t;
            b = 1;
        } else {
            const t = (value - 0.5) * 2;
            r = 1;
            g = 1 - t;
            b = 1 - t;
        }
        return { r, g, b };
    }

    /**
     * Draw field vectors as 3D arrows
     */
    drawFieldVectors() {
        const grid = this.data.grid;
        const ex = this.data.field.ex;
        const ey = this.data.field.ey;

        const step = Math.max(1, Math.floor(grid.nx / 10));
        const xScale = 2 / (grid.nx - 1);
        const yScale = 2 / (grid.ny - 1);

        for (let i = 0; i < grid.ny; i += step) {
            for (let j = 0; j < grid.nx; j += step) {
                const exVal = ex[i][j];
                const eyVal = ey[i][j];
                const magnitude = Math.sqrt(exVal * exVal + eyVal * eyVal);

                if (magnitude < 1e-10) continue;

                const x = j * xScale - 1;
                const y = i * yScale - 1;
                const z = 0;

                const direction = new THREE.Vector3(exVal / magnitude, eyVal / magnitude, 0);
                const arrowHelper = new THREE.ArrowHelper(direction, new THREE.Vector3(x, y, z), 0.15, 0x000000);
                this.scene.add(arrowHelper);
            }
        }
    }

    /**
     * Draw charges as 3D spheres
     */
    drawCharges3D() {
        const chargeData = JSON.parse(sessionStorage.getItem("chargeData") || "[]");

        for (let charge of chargeData) {
            const geometry = new THREE.SphereGeometry(0.1, 32, 32);
            const material = new THREE.MeshPhongMaterial({
                color: charge.q > 0 ? 0xff0000 : 0x0000ff,
                emissive: charge.q > 0 ? 0xff6666 : 0x6666ff,
            });
            const sphere = new THREE.Mesh(geometry, material);
            sphere.position.set(charge.x, charge.y, 0);
            this.scene.add(sphere);
        }
    }

    /**
     * Animation loop
     */
    animate = () => {
        requestAnimationFrame(this.animate);
        this.renderer.render(this.scene, this.camera);
    };
}