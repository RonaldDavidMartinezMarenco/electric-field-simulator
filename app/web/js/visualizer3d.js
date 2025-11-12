class Visualizer3D {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.data = null;
        this.currentOptions = {};
        
        console.log("🎨 Initializing Visualizer3D...");
        this.setupScene();
    }

    setupScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xf0f0f0);

        const container = this.canvas.parentElement;
        const width = container.clientWidth;
        const height = container.clientHeight;
        
        this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
        this.camera.position.set(3, 3, 3);
        this.camera.lookAt(0, 0, 0);

        this.renderer = new THREE.WebGLRenderer({ 
            canvas: this.canvas,
            antialias: true 
        });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(window.devicePixelRatio);

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(5, 10, 7);
        this.scene.add(directionalLight);

        this.setupControls();
        window.addEventListener('resize', () => this.onWindowResize());
        this.animate();
        
        console.log("✅ Visualizer3D initialized");
    }

    setupControls() {
        if (typeof THREE.OrbitControls !== 'undefined') {
            this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
            this.controls.enableDamping = true;
            this.controls.dampingFactor = 0.05;
        } else {
            this.setupBasicControls();
        }
    }

    setupBasicControls() {
        let isDragging = false;
        let previousMousePosition = { x: 0, y: 0 };

        this.canvas.addEventListener('mousedown', (e) => {
            isDragging = true;
            previousMousePosition = { x: e.clientX, y: e.clientY };
        });

        this.canvas.addEventListener('mousemove', (e) => {
            if (isDragging) {
                const deltaX = e.clientX - previousMousePosition.x;
                this.camera.position.applyAxisAngle(
                    new THREE.Vector3(0, 1, 0),
                    deltaX * 0.005
                );
                previousMousePosition = { x: e.clientX, y: e.clientY };
            }
        });

        this.canvas.addEventListener('mouseup', () => { isDragging = false; });
    }

    onWindowResize() {
        const container = this.canvas.parentElement;
        const width = container.clientWidth;
        const height = container.clientHeight;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    animate = () => {
        requestAnimationFrame(this.animate);
        if (this.controls) this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }

    render(simulationData, options = {}) {
        console.log("🎨 Rendering 3D visualization...");
        
        this.data = simulationData;
        this.currentOptions = options;

        this.clearScene();
        this.drawAxes();
        this.drawBoundingBox();
        this.drawCharges();

        if (options.showFieldVectors !== false) {
            this.drawFieldVectors();
        }

        if (options.showPotentialSurface && this.data.field.potential) {
            this.drawPotentialSurface();
        }

        console.log("✅ 3D Render complete");
    }

    clearScene() {
        const objectsToRemove = [];
        this.scene.traverse((object) => {
            if (object.isMesh || object.isLine || object.isArrowHelper || object.isPoints) {
                objectsToRemove.push(object);
            }
        });
        objectsToRemove.forEach((obj) => {
            this.scene.remove(obj);
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) obj.material.dispose();
        });
    }

    drawAxes() {
        const axesHelper = new THREE.AxesHelper(1.5);
        this.scene.add(axesHelper);
    }

    drawBoundingBox() {
        const grid = this.data.grid;
        const geometry = new THREE.BoxGeometry(
            grid.xmax - grid.xmin,
            grid.ymax - grid.ymin,
            grid.zmax - grid.zmin
        );
        const edges = new THREE.EdgesGeometry(geometry);
        const material = new THREE.LineBasicMaterial({ color: 0x999999 });
        const wireframe = new THREE.LineSegments(edges, material);
        wireframe.position.set(
            (grid.xmin + grid.xmax) / 2,
            (grid.ymin + grid.ymax) / 2,
            (grid.zmin + grid.zmax) / 2
        );
        this.scene.add(wireframe);
    }

    drawCharges() {
        const chargeData = JSON.parse(sessionStorage.getItem("chargeData") || "[]");
        
        for (let i = 0; i < chargeData.length; i++) {
            const charge = chargeData[i];
            const geometry = new THREE.SphereGeometry(0.08, 32, 32);
            const color = charge.q > 0 ? 0xff4444 : 0x4444ff;
            const material = new THREE.MeshPhongMaterial({
                color: color,
                emissive: charge.q > 0 ? 0x882222 : 0x222288
            });
            const sphere = new THREE.Mesh(geometry, material);
            sphere.position.set(charge.x, charge.y, charge.z || 0);
            this.scene.add(sphere);
            this.addChargeLabel(charge, i + 1);
        }
        console.log(`✅ Drew ${chargeData.length} charges`);
    }

    addChargeLabel(charge, index) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 128;
        canvas.height = 64;
        context.fillStyle = '#ffffff';
        context.font = 'Bold 32px Arial';
        context.textAlign = 'center';
        context.fillText(`Q${index}`, 64, 40);
        
        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(material);
        sprite.position.set(charge.x, charge.y + 0.15, charge.z || 0);
        sprite.scale.set(0.3, 0.15, 1);
        this.scene.add(sprite);
    }

    drawFieldVectors() {
        const grid = this.data.grid;
        const ex = this.data.field.ex;
        const ey = this.data.field.ey;
        const ez = this.data.field.ez;

        const step = Math.max(1, Math.floor(Math.min(grid.nx, grid.ny, grid.nz) / 8));
        const dx = (grid.xmax - grid.xmin) / (grid.nx - 1);
        const dy = (grid.ymax - grid.ymin) / (grid.ny - 1);
        const dz = (grid.zmax - grid.zmin) / (grid.nz - 1);

        let vectorCount = 0;

        for (let k = 0; k < grid.nz; k += step) {
            for (let j = 0; j < grid.ny; j += step) {
                for (let i = 0; i < grid.nx; i += step) {
                    const exVal = ex[k][j][i];
                    const eyVal = ey[k][j][i];
                    const ezVal = ez[k][j][i];
                    const magnitude = Math.sqrt(exVal*exVal + eyVal*eyVal + ezVal*ezVal);
                    
                    if (magnitude < 1e-10) continue;

                    const x = grid.xmin + i * dx;
                    const y = grid.ymin + j * dy;
                    const z = grid.zmin + k * dz;

                    const direction = new THREE.Vector3(
                        exVal / magnitude,
                        eyVal / magnitude,
                        ezVal / magnitude
                    );

                    const logMag = Math.log10(magnitude + 1);
                    const color = this.magnitudeToColor(logMag);
                    const origin = new THREE.Vector3(x, y, z);
                    const arrowHelper = new THREE.ArrowHelper(direction, origin, 0.15, color);
                    this.scene.add(arrowHelper);
                    vectorCount++;
                }
            }
        }
        console.log(`✅ Drew ${vectorCount} field vectors`);
    }

    magnitudeToColor(logMagnitude) {
        const normalized = Math.min(1, Math.max(0, logMagnitude / 10));
        if (normalized < 0.25) {
            return new THREE.Color(0, 0, 1).lerp(new THREE.Color(0, 1, 1), normalized * 4);
        } else if (normalized < 0.5) {
            return new THREE.Color(0, 1, 1).lerp(new THREE.Color(0, 1, 0), (normalized - 0.25) * 4);
        } else if (normalized < 0.75) {
            return new THREE.Color(0, 1, 0).lerp(new THREE.Color(1, 1, 0), (normalized - 0.5) * 4);
        } else {
            return new THREE.Color(1, 1, 0).lerp(new THREE.Color(1, 0, 0), (normalized - 0.75) * 4);
        }
    }

    drawPotentialSurface() {
        const grid = this.data.grid;
        const potential = this.data.field.potential;

        let minV = Infinity, maxV = -Infinity;
        for (let k = 0; k < grid.nz; k++) {
            for (let j = 0; j < grid.ny; j++) {
                for (let i = 0; i < grid.nx; i++) {
                    const v = potential[k][j][i];
                    minV = Math.min(minV, v);
                    maxV = Math.max(maxV, v);
                }
            }
        }

        const numSurfaces = 5;
        for (let n = 0; n < numSurfaces; n++) {
            const threshold = minV + (maxV - minV) * (n + 1) / (numSurfaces + 1);
            this.drawIsosurface(threshold, n / numSurfaces);
        }
    }

    drawIsosurface(threshold, colorParam) {
        const grid = this.data.grid;
        const potential = this.data.field.potential;
        const vertices = [];
        const colors = [];

        const dx = (grid.xmax - grid.xmin) / (grid.nx - 1);
        const dy = (grid.ymax - grid.ymin) / (grid.ny - 1);
        const dz = (grid.zmax - grid.zmin) / (grid.nz - 1);

        for (let k = 0; k < grid.nz; k++) {
            for (let j = 0; j < grid.ny; j++) {
                for (let i = 0; i < grid.nx; i++) {
                    const v = potential[k][j][i];
                    if (Math.abs(v - threshold) < (Math.abs(threshold) * 0.1 + 1e-6)) {
                        const x = grid.xmin + i * dx;
                        const y = grid.ymin + j * dy;
                        const z = grid.zmin + k * dz;
                        vertices.push(x, y, z);
                        const color = new THREE.Color().setHSL(colorParam, 0.8, 0.5);
                        colors.push(color.r, color.g, color.b);
                    }
                }
            }
        }

        if (vertices.length === 0) return;

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 3));

        const material = new THREE.PointsMaterial({
            size: 0.03,
            vertexColors: true,
            transparent: true,
            opacity: 0.6
        });

        const points = new THREE.Points(geometry, material);
        this.scene.add(points);
    }
}