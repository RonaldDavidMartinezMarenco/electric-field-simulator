class Visualizer3D {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.data = null;
        this.currentOptions = {};

        // New: measurement & picking
        this.labelRenderer = null;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.measureLabelObject = null;
        this.isMeasureMode = false;

        // New: containers for dynamic objects so we can clean them
        this._isoObjects = [];
        this._heatmap = null;
        this._vectorGroup = new THREE.Group();

        // New: UI elements
        this.ui = {
            isoSlider: null,
            isoCountInput: null,
            toggleHeatmap: null,
            toggleVectors: null,
            toggleIso: null,
            toggleMeasure: null
        };

        console.log("🎨 Initializing Visualizer3D...");
        this.setupScene();
        this.initLabelRenderer();
        this.initUIControls(); // create slider/toggles
    }

    setupScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xf0f0f0);

        const container = this.canvas.parentElement;
        const width = container.clientWidth;
        const height = container.clientHeight;

        this.camera = new THREE.PerspectiveCamera(60, width / height, 0.01, 1000);
        this.camera.position.set(3, 3, 3);
        this.camera.lookAt(0, 0, 0);

        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true
        });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(window.devicePixelRatio);

        this.updateRendererSize = () => {
            const container = this.canvas.parentElement;
            const width = container.clientWidth || window.innerWidth;
            const height = container.clientHeight || window.innerHeight;

            this.renderer.setSize(width, height);
            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();
        };

        // Actualizar al cambiar tamaño de la ventana
        window.addEventListener("resize", this.updateRendererSize);

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
        if (this.labelRenderer) this.labelRenderer.setSize(width, height);
    }

    animate = () => {
        requestAnimationFrame(this.animate);
        if (this.controls) this.controls.update();
        this.renderer.render(this.scene, this.camera);
        if (this.labelRenderer) this.labelRenderer.render(this.scene, this.camera);
    }

    // ------------------
    // Rendering entrypoint
    // ------------------
    render(simulationData, options = {}) {
        console.log("🎨 Rendering 3D visualization...");

        this.data = simulationData;
        this.currentOptions = options;

        this.clearScene();
        this.drawAxes();
        this.drawBoundingBox();
        this.drawCharges();

        // Vectors: now using a dedicated group so it can be toggled/cleared
        if (options.showFieldVectors !== false) {
            this.drawFieldVectors();
        }

        // Heatmap: colored points representing potential
        if (options.showHeatmap) {
            this.drawHeatmap();
        }

        // Potential surfaces (equipotentials)
        if (options.showPotentialSurface && this.data.field.potential) {
            this.drawPotentialSurface();
        }

        setTimeout(() => {
            this.updateRendererSize();
            this.renderer.render(this.scene, this.camera);
        }, 150);

        console.log("✅ 3D Render complete");
    }

    clearScene() {
        // Remove previously created dynamic objects
        // keep lights and camera and UI label renderer objects
        const toRemove = [];
        this.scene.traverse((object) => {
            // keep ambient/directional lights; remove meshes/points/lines/sprites/Helpers except axes helper (recreate)
            if ((object.isMesh || object.isLine || object.isPoints || object.isSprite || object.isArrowHelper) && !object.isLight) {
                toRemove.push(object);
            }
        });
        toRemove.forEach((obj) => {
            if (obj.parent) obj.parent.remove(obj);
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) {
                if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
                else obj.material.dispose();
            }
        });

        // Clear grouped containers
        if (this._vectorGroup) {
            this._vectorGroup.clear(); // clear children (Three r125+)
        }
        this._isoObjects.forEach(o => { if (o.parent) o.parent.remove(o); });
        this._isoObjects = [];
        if (this._heatmap && this._heatmap.parent) this._heatmap.parent.remove(this._heatmap);
        this._heatmap = null;
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

    // ------------------
    // Field vectors (improved)
    // ------------------
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

        // Option: use group to manage vectors
        const vectorsGroup = new THREE.Group();

        for (let k = 0; k < grid.nz; k += step) {
            for (let j = 0; j < grid.ny; j += step) {
                for (let i = 0; i < grid.nx; i += step) {
                    const exVal = ex[k][j][i];
                    const eyVal = ey[k][j][i];
                    const ezVal = ez[k][j][i];
                    const magnitude = Math.sqrt(exVal * exVal + eyVal * eyVal + ezVal * ezVal);

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
                    const len = 0.15 * Math.min(dx, dy, dz) * 2.0;
                    const arrowHelper = new THREE.ArrowHelper(direction, origin, len, color.getHex());
                    vectorsGroup.add(arrowHelper);
                    vectorCount++;
                }
            }
        }

        this._vectorGroup = vectorsGroup;
        this.scene.add(this._vectorGroup);

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

    // ------------------
    // Heatmap (cloud of colored points)
    // ------------------
    drawHeatmap() {
        if (!this.data || !this.data.field || !this.data.field.potential) return;

        const grid = this.data.grid;
        const potential = this.data.field.potential;

        // find min/max
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

        const dx = (grid.xmax - grid.xmin) / (grid.nx - 1);
        const dy = (grid.ymax - grid.ymin) / (grid.ny - 1);
        const dz = (grid.zmax - grid.zmin) / (grid.nz - 1);

        const vertices = [];
        const colors = [];

        // Subsample if grid is dense
        const subs = Math.max(1, Math.floor(Math.min(grid.nx, grid.ny, grid.nz) / 32));

        for (let k = 0; k < grid.nz; k += subs) {
            for (let j = 0; j < grid.ny; j += subs) {
                for (let i = 0; i < grid.nx; i += subs) {
                    const v = potential[k][j][i];
                    const x = grid.xmin + i * dx;
                    const y = grid.ymin + j * dy;
                    const z = grid.zmin + k * dz;
                    vertices.push(x, y, z);
                    const t = (v - minV) / (maxV - minV);
                    const col = new THREE.Color();
                    col.setHSL(0.7 - 0.7 * t, 1.0, 0.5);
                    colors.push(col.r, col.g, col.b);
                }
            }
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 3));
        const material = new THREE.PointsMaterial({
            size: 0.03,
            vertexColors: true,
            transparent: true,
            opacity: 0.8,
            depthWrite: false
        });

        const points = new THREE.Points(geometry, material);
        this._heatmap = points;
        this.scene.add(points);
        console.log('✅ Heatmap drawn');
    }

    // ------------------
    // Potential surfaces / equipotentials
    // ------------------
    drawPotentialSurface() {
        const grid = this.data.grid;
        const potential = this.data.field.potential;

        // compute global min/max
        let minV = Infinity, maxV = -Infinity;
        for (let k = 0; k < grid.nz; k++) {
            for (let j = 0; j < grid.ny; j++) {
                for (let i = 0; i < grid.nx; i++) {
                    const v = potential[k][j][i];
                    if (Number.isFinite(v)) {
                        minV = Math.min(minV, v);
                        maxV = Math.max(maxV, v);
                    }
                }
            }
        }

        // default parameters
        const numSurfaces = (this.currentOptions.numIsoSurfaces) ? this.currentOptions.numIsoSurfaces : 5;
        const baseIndex = (this.currentOptions.isoBaseIndex !== undefined) ? this.currentOptions.isoBaseIndex : 1;

        // try to use MarchingCubes if available for nice isosurfaces
        if (typeof THREE.MarchingCubes !== 'undefined') {
            // build scalar field in array for marching cubes
            const resX = grid.nx;
            const resY = grid.ny;
            const resZ = grid.nz;
            const field = new Float32Array(resX * resY * resZ);
            let idx = 0;
            for (let k = 0; k < resZ; k++) {
                for (let j = 0; j < resY; j++) {
                    for (let i = 0; i < resX; i++) {
                        const v = potential[k][j][i];
                        field[idx++] = (v - minV) / (maxV - minV); // normalize 0..1
                    }
                }
            }

            // create a MarchingCubes instance
            for (let n = 0; n < numSurfaces; n++) {
                const isoValNormalized = (n + baseIndex) / (numSurfaces + baseIndex + 1);
                const material = new THREE.MeshPhongMaterial({
                    color: new THREE.Color().setHSL(n / Math.max(1, numSurfaces), 0.8, 0.5),
                    transparent: true,
                    opacity: 0.3,
                    side: THREE.DoubleSide
                });

                const resolution = Math.max(8, Math.min(64, Math.max(resX, resY, resZ)));
                const mc = new THREE.MarchingCubes(resolution, material, true, true);
                // MarchingCubes expects 'field' and range; but implementations vary.
                // Try to set them if present, otherwise fallback
                if ('field' in mc) mc.field = field;
                if ('isolation' in mc) mc.isolation = isoValNormalized;
                mc.position.set((grid.xmin + grid.xmax) / 2, (grid.ymin + grid.ymax) / 2, (grid.zmin + grid.zmax) / 2);
                // scale to match bounding box
                mc.scale.set((grid.xmax - grid.xmin), (grid.ymax - grid.ymin), (grid.zmax - grid.zmin));
                this.scene.add(mc);
                this._isoObjects.push(mc);
            }

            console.log(`✅ Drew ${numSurfaces} equipotential surfaces (MarchingCubes)`);
            return;
        }

        // Fallback: point-sampled isosurface (fast to compute, similar to the version you had)
        // FALLBACK: sample points near isovalues and draw as Points
        // If user provided a customIsoValue (slider, normalized 0..1) -> draw single iso at that value
        const custom = (this.currentOptions && this.currentOptions.customIsoValue !== undefined);

        if (custom) {
            // map normalized slider (0..1) to actual potential value
            const isoNormalized = this.currentOptions.customIsoValue; // 0..1
            const threshold = minV + (maxV - minV) * isoNormalized;

            const colorParam = 0.5; // single mid color (you can change)
            const vertices = [];
            const colors = [];
            const dx = (grid.xmax - grid.xmin) / (grid.nx - 1);
            const dy = (grid.ymax - grid.ymin) / (grid.ny - 1);
            const dz = (grid.zmax - grid.zmin) / (grid.nz - 1);

            for (let k = 0; k < grid.nz; k++) {
                for (let j = 0; j < grid.ny; j++) {
                    for (let i = 0; i < grid.nx; i++) {
                        const v = potential[k][j][i];
                        if (!Number.isFinite(v)) continue;
                        if (Math.abs(v - threshold) < (Math.abs(threshold) * 0.08 + 1e-6)) {
                            const x = grid.xmin + i * dx;
                            const y = grid.ymin + j * dy;
                            const z = grid.zmin + k * dz;
                            vertices.push(x, y, z);
                            const c = new THREE.Color().setHSL(colorParam, 0.8, 0.5);
                            colors.push(c.r, c.g, c.b);
                        }
                    }
                }
            }

            if (vertices.length > 0) {
                const geometry = new THREE.BufferGeometry();
                geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3));
                geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 3));
                const material = new THREE.PointsMaterial({
                    size: Math.max(0.02, Math.min(0.06, (grid.xmax - grid.xmin) / 40)),
                    vertexColors: true,
                    transparent: true,
                    opacity: 0.7
                });
                const points = new THREE.Points(geometry, material);
                this._isoObjects.push(points);
                this.scene.add(points);
            }
            // done single iso from slider
            return;
        }
    }

    // ------------------
    // Label Renderer + Measurement tool
    // ------------------
    initLabelRenderer() {
        // inject CSS2DRenderer if available
        if (typeof THREE.CSS2DRenderer !== 'undefined') {
            this.labelRenderer = new THREE.CSS2DRenderer();
            const container = this.canvas.parentElement;
            const width = container.clientWidth;
            const height = container.clientHeight;
            this.labelRenderer.setSize(width, height);
            this.labelRenderer.domElement.style.position = 'absolute';
            this.labelRenderer.domElement.style.top = '0';
            this.labelRenderer.domElement.style.pointerEvents = 'none';
            this.canvas.parentElement.appendChild(this.labelRenderer.domElement);

            // create measure label object but keep hidden initially
            const div = document.createElement('div');
            div.className = 'measure-label';
            div.style.background = 'rgba(50,50,0,0.9)';
            div.style.color = 'white';
            div.style.padding = '6px';
            div.style.borderRadius = '4px';
            div.style.fontSize = '12px';
            div.style.pointerEvents = 'none';
            this.measureLabelObject = new THREE.CSS2DObject(div);
            this.measureLabelObject.visible = false;
            this.scene.add(this.measureLabelObject);

            // click handler for measurement (use pointer events)
            this.canvas.addEventListener('pointerdown', (ev) => this._onPointerDown(ev));
        } else {
            console.warn('CSS2DRenderer not available; measurement labels will not show.');
        }
    }

    _onPointerDown(event) {
        if (!this.isMeasureMode) return;

        const rect = this.canvas.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.scene.children, true);

        // prefer bounding-box hits; if none, project ray into grid and compute closest point
        if (intersects.length > 0) {
            const p = intersects[0].point;
            this.showMeasureAt(p);
        } else {
            // fallback: intersect with bounding box plane (grid center)
            const grid = this.data.grid;
            const boxCenter = new THREE.Vector3((grid.xmin + grid.xmax) / 2, (grid.ymin + grid.ymax) / 2, (grid.zmin + grid.zmax) / 2);
            const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -boxCenter.z);
            const point = new THREE.Vector3();
            this.raycaster.ray.intersectPlane(plane, point);
            if (point) this.showMeasureAt(point);
        }
    }

    showMeasureAt(point) {
        // compute interpolated potential locally (no extra API call) if we have grid data
        let V = null;
        if (this.data && this.data.field && this.data.field.potential) {
            V = this._interpolatedPotential(point.x, point.y, point.z);
        }

        const labelText = `x=${point.x.toFixed(3)} y=${point.y.toFixed(3)} z=${point.z.toFixed(3)}${(V !== null) ? `  V=${V.toFixed(4)} V` : ''}`;
        if (this.measureLabelObject) {
            this.measureLabelObject.element.textContent = labelText;
            this.measureLabelObject.position.copy(point);
            this.measureLabelObject.visible = true;
        } else {
            // fallback: console.log
            console.log(labelText);
        }
    }

    _interpolatedPotential(x, y, z) {
        // trilinear interpolation on the grid
        const grid = this.data.grid;
        const pot = this.data.field.potential;

        const dx = (grid.xmax - grid.xmin) / (grid.nx - 1);
        const dy = (grid.ymax - grid.ymin) / (grid.ny - 1);
        const dz = (grid.zmax - grid.zmin) / (grid.nz - 1);

        // convert coords to indices
        const fx = (x - grid.xmin) / dx;
        const fy = (y - grid.ymin) / dy;
        const fz = (z - grid.zmin) / dz;

        const i0 = Math.floor(fx), j0 = Math.floor(fy), k0 = Math.floor(fz);
        const i1 = i0 + 1, j1 = j0 + 1, k1 = k0 + 1;

        // clamp
        if (i0 < 0 || j0 < 0 || k0 < 0 || i1 >= grid.nx || j1 >= grid.ny || k1 >= grid.nz) {
            return NaN;
        }

        const xd = fx - i0, yd = fy - j0, zd = fz - k0;

        // fetch eight corner values
        const c000 = pot[k0][j0][i0];
        const c100 = pot[k0][j0][i1];
        const c010 = pot[k0][j1][i0];
        const c110 = pot[k0][j1][i1];
        const c001 = pot[k1][j0][i0];
        const c101 = pot[k1][j0][i1];
        const c011 = pot[k1][j1][i0];
        const c111 = pot[k1][j1][i1];

        // handle non finite values gracefully
        const lerp = (a, b, t) => (Number.isFinite(a) && Number.isFinite(b)) ? (a * (1 - t) + b * t) : (Number.isFinite(a) ? a : b);

        const c00 = lerp(c000, c100, xd);
        const c01 = lerp(c001, c101, xd);
        const c10 = lerp(c010, c110, xd);
        const c11 = lerp(c011, c111, xd);
        const c0 = lerp(c00, c10, yd);
        const c1 = lerp(c01, c11, yd);
        const c = lerp(c0, c1, zd);

        return c;
    }

    // ------------------
    // UI: sliders and toggles (simple DOM injection)
    // ------------------
    initUIControls() {
        // Create a small control panel appended to canvas parent
        const parent = this.canvas.parentElement;
        const panel = document.createElement('div');
        panel.style.position = 'absolute';
        panel.style.right = '8px';
        panel.style.bottom = '8px';
        panel.style.padding = '8px';
        panel.style.background = 'rgba(255,255,255,0.9)';
        panel.style.border = '1px solid #ccc';
        panel.style.borderRadius = '6px';
        panel.style.fontSize = '12px';
        panel.style.zIndex = 10;

        // Iso slider
        const isoLabel = document.createElement('div');
        isoLabel.textContent = 'Equipotential slider';
        isoLabel.style.marginBottom = '4px';
        panel.appendChild(isoLabel);

        const isoSlider = document.createElement('input');
        isoSlider.type = 'range';
        isoSlider.min = '0';
        isoSlider.max = '1';
        isoSlider.step = '0.01';
        isoSlider.value = '0.5';
        isoSlider.style.width = '160px';
        isoSlider.addEventListener('input', () => {
            const v = parseFloat(isoSlider.value); // 0..1 normalized slider
            // Guardamos el valor normalizado para usarlo en drawPotentialSurface()
            this.currentOptions.customIsoValue = v;

            // Si MarchingCubes ya produjo iso objects y soporta 'isolation' -> actualizamos
            if (this._isoObjects.length > 0 && typeof THREE.MarchingCubes !== 'undefined') {
                this._isoObjects.forEach((mc) => {
                    if ('isolation' in mc) {
                        mc.isolation = v;
                    }
                });
                return;
            }

            // Fallback: sólo eliminamos los iso-objects previos y dibujamos la nueva iso a partir de slider
            this._isoObjects.forEach(o => { if (o.parent) o.parent.remove(o); });
            this._isoObjects = [];
            if (this.data) {
                // dibujar solo las equipotenciales (no limpiar toda la escena)
                this.drawPotentialSurface();
            }
        });

        panel.appendChild(isoSlider);
        panel.appendChild(document.createElement('br'));

        // Toggles
        const mkToggle = (labelText, initial, onChange) => {
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.alignItems = 'center';
            row.style.marginTop = '6px';
            const label = document.createElement('label');
            label.style.marginRight = '8px';
            label.textContent = labelText;
            const chk = document.createElement('input');
            chk.type = 'checkbox';
            chk.checked = initial;
            chk.addEventListener('change', () => onChange(chk.checked));
            row.appendChild(label);
            row.appendChild(chk);
            panel.appendChild(row);
            return chk;
        };

        this.ui.toggleVectors = mkToggle('Vectors', true, (state) => {
            this.currentOptions.showFieldVectors = state;
            if (state) this.drawFieldVectors(); else { if (this._vectorGroup.parent) this._vectorGroup.parent.remove(this._vectorGroup); }
        });

        this.ui.toggleHeatmap = mkToggle('Heatmap', false, (state) => {
            this.currentOptions.showHeatmap = state;
            if (state) this.drawHeatmap(); else { if (this._heatmap && this._heatmap.parent) this._heatmap.parent.remove(this._heatmap); }
        });

        this.ui.toggleIso = mkToggle('Equipotentials', true, (state) => {
            this.currentOptions.showPotentialSurface = state;
            if (state) this.drawPotentialSurface(); else { this._isoObjects.forEach(o => { if (o.parent) o.parent.remove(o); }); this._isoObjects = []; }
        });

        this.ui.toggleMeasure = mkToggle('Measure', false, (state) => {
            this.isMeasureMode = state;
            this.currentOptions.measureMode = state;
            if (!state && this.measureLabelObject) this.measureLabelObject.visible = false;
        });

        // Append panel to container
        parent.style.position = 'relative';
        parent.appendChild(panel);

        // store reference to slider if needed externally
        this.ui.isoSlider = isoSlider;
    }
    // --- 🟠 HEATMAP 3D ---
    drawHeatmap(plane = "xy", zIndex = 0) {
        if (!this.data?.field?.potential) return;

        const grid = this.data.grid;
        const potential = this.data.field.potential;
        const nx = grid.nx, ny = grid.ny, nz = grid.nz;

        // Calcular rango de potencial
        let minV = Infinity, maxV = -Infinity;
        for (let k = 0; k < nz; k++) {
            for (let j = 0; j < ny; j++) {
                for (let i = 0; i < nx; i++) {
                    const v = potential[k][j][i];
                    minV = Math.min(minV, v);
                    maxV = Math.max(maxV, v);
                }
            }
        }

        // Crear canvas de color (textura)
        const canvas = document.createElement("canvas");
        canvas.width = nx;
        canvas.height = ny;
        const ctx = canvas.getContext("2d");
        const imgData = ctx.createImageData(nx, ny);

        // Convertir potencial en color (azul -> rojo)
        const colorMap = (value) => {
            const t = (value - minV) / (maxV - minV);
            const r = Math.floor(255 * t);
            const g = 0;
            const b = Math.floor(255 * (1 - t));
            return [r, g, b, 255];
        };

        for (let j = 0; j < ny; j++) {
            for (let i = 0; i < nx; i++) {
                const v = potential[zIndex][j][i];
                const [r, g, b, a] = colorMap(v);
                const idx = (j * nx + i) * 4;
                imgData.data[idx] = r;
                imgData.data[idx + 1] = g;
                imgData.data[idx + 2] = b;
                imgData.data[idx + 3] = a;
            }
        }

        ctx.putImageData(imgData, 0, 0);
        const texture = new THREE.CanvasTexture(canvas);

        // Crear plano con la textura
        const geometry = new THREE.PlaneGeometry(
            grid.xmax - grid.xmin,
            grid.ymax - grid.ymin,
        );
        const material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            opacity: 0.7,
            side: THREE.DoubleSide
        });
        const planeMesh = new THREE.Mesh(geometry, material);

        // Posición según plano seleccionado
        if (plane === "xy") {
            planeMesh.rotation.x = Math.PI / 2;
            planeMesh.position.set(0, 0, grid.zmin + (zIndex / (nz - 1)) * (grid.zmax - grid.zmin));
        }
        this.scene.add(planeMesh);
        this.heatmapPlane = planeMesh;
        console.log("✅ Heatmap 3D dibujado");
    }

    clearHeatmap() {
        if (this.heatmapPlane) {
            this.scene.remove(this.heatmapPlane);
            this.heatmapPlane.geometry.dispose();
            this.heatmapPlane.material.dispose();
            this.heatmapPlane = null;
        }
    }

    // --- 📏 MODO DE MEDICIÓN ---
    enableMeasureMode(enable = true) {
        if (enable) {
            this.measurePoints = [];
            this.measureLine = null;
            this.canvas.addEventListener("click", this.onMeasureClick);
            console.log("📏 Measure mode ON");
        } else {
            this.canvas.removeEventListener("click", this.onMeasureClick);
            this.clearMeasurement();
            console.log("📏 Measure mode OFF");
        }
    }

    onMeasureClick = (event) => {
        const mouse = new THREE.Vector2(
            (event.offsetX / this.canvas.clientWidth) * 2 - 1,
            -(event.offsetY / this.canvas.clientHeight) * 2 + 1
        );
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, this.camera);

        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const point = new THREE.Vector3();
        raycaster.ray.intersectPlane(plane, point);

        this.addMeasurePoint(point);
    }

    addMeasurePoint(point) {
        const geometry = new THREE.SphereGeometry(0.03, 16, 16);
        const material = new THREE.MeshBasicMaterial({ color: 0x00ffff });
        const sphere = new THREE.Mesh(geometry, material);
        sphere.position.copy(point);
        this.scene.add(sphere);
        this.measurePoints.push(sphere);

        if (this.measurePoints.length === 2) {
            this.drawMeasurement();
        }
    }

    drawMeasurement() {
        const p1 = this.measurePoints[0].position;
        const p2 = this.measurePoints[1].position;

        const geometry = new THREE.BufferGeometry().setFromPoints([p1, p2]);
        const material = new THREE.LineBasicMaterial({ color: 0xffff00 });
        this.measureLine = new THREE.Line(geometry, material);
        this.scene.add(this.measureLine);

        const distance = p1.distanceTo(p2).toFixed(3);
        let deltaV = null;

        if (this.data?.field?.potential) {
            deltaV = this.estimatePotential(p1) - this.estimatePotential(p2);
            deltaV = deltaV.toFixed(3);
        }

        alert(`📏 Distancia: ${distance} m\nΔV: ${deltaV ?? 'N/A'} V`);
    }

    clearMeasurement() {
        if (this.measurePoints) {
            this.measurePoints.forEach(p => {
                this.scene.remove(p);
                p.geometry.dispose();
                p.material.dispose();
            });
            this.measurePoints = [];
        }
        if (this.measureLine) {
            this.scene.remove(this.measureLine);
            this.measureLine.geometry.dispose();
            this.measureLine.material.dispose();
            this.measureLine = null;
        }
    }

    estimatePotential(pos) {
        const grid = this.data.grid;
        const pot = this.data.field.potential;
        const dx = (grid.xmax - grid.xmin) / (grid.nx - 1);
        const dy = (grid.ymax - grid.ymin) / (grid.ny - 1);
        const dz = (grid.zmax - grid.zmin) / (grid.nz - 1);

        const i = Math.floor((pos.x - grid.xmin) / dx);
        const j = Math.floor((pos.y - grid.ymin) / dy);
        const k = Math.floor((pos.z - grid.zmin) / dz);

        return pot[k]?.[j]?.[i] ?? 0;
    }

}
