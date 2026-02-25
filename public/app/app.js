// MX AirCanvas3D - MVP Implementation
// Hand tracking and 3D drawing application

class AirCanvas3D {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.hands = null;
        this.cameraUtils = null;
        
        this.isDrawing = false;
        this.currentStroke = [];
        this.allStrokes = [];
        this.brushSize = 5;
        this.brushColor = '#00B8FC';
        
        this.lastPosition = null;
        this.handDetected = false;
        
        this.init();
    }

    async init() {
        // Initialize Three.js
        this.initThreeJS();
        
        // Initialize MediaPipe Hands
        await this.initHandTracking();
        
        // Initialize UI
        this.initUI();
        
        // Start camera
        await this.startCamera();
        
        // Start animation loop
        this.animate();
    }

    initThreeJS() {
        const canvas = document.getElementById('canvas3d');
        
        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a1a1a);
        
        // Camera
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        this.camera.position.z = 5;
        
        // Renderer
        this.renderer = new THREE.WebGLRenderer({ 
            canvas,
            antialias: true 
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        
        // Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(5, 5, 5);
        this.scene.add(directionalLight);
        
        // Grid helper
        const gridHelper = new THREE.GridHelper(20, 20, 0x00B8FC, 0x333333);
        this.scene.add(gridHelper);
        
        // Handle window resize
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    async initHandTracking() {
        this.hands = new Hands({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
            }
        });
        
        this.hands.setOptions({
            maxNumHands: 1,
            modelComplexity: 1,
            minDetectionConfidence: 0.7,
            minTrackingConfidence: 0.5
        });
        
        this.hands.onResults((results) => this.onHandResults(results));
    }

    async startCamera() {
        const video = document.getElementById('video');
        const canvasOverlay = document.getElementById('canvasOverlay');
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: 'user'
                }
            });
            
            video.srcObject = stream;
            
            // Wait for video to be ready
            await new Promise((resolve) => {
                video.onloadedmetadata = () => {
                    video.play();
                    resolve();
                };
            });
            
            // Set overlay canvas size
            canvasOverlay.width = video.videoWidth;
            canvasOverlay.height = video.videoHeight;
            
            // Start hand detection
            const camera = new Camera(video, {
                onFrame: async () => {
                    await this.hands.send({ image: video });
                },
                width: 1280,
                height: 720
            });
            camera.start();
            
            // Update UI
            document.getElementById('loading').style.display = 'none';
            document.getElementById('controls').style.display = 'block';
            document.getElementById('status').style.display = 'block';
            document.getElementById('videoContainer').style.display = 'block';
            document.getElementById('gestureHint').style.display = 'block';
            document.getElementById('cameraStatus').classList.add('active');
            
        } catch (error) {
            console.error('Camera error:', error);
            alert('Failed to access camera. Please grant camera permissions.');
        }
    }

    onHandResults(results) {
        const canvasOverlay = document.getElementById('canvasOverlay');
        const ctx = canvasOverlay.getContext('2d');
        
        // Clear overlay
        ctx.clearRect(0, 0, canvasOverlay.width, canvasOverlay.height);
        
        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            const landmarks = results.multiHandLandmarks[0];
            
            // Draw hand landmarks
            this.drawHandLandmarks(ctx, landmarks, canvasOverlay.width, canvasOverlay.height);
            
            // Process gestures
            this.processGestures(landmarks);
            
            // Update status
            this.handDetected = true;
            document.getElementById('handStatus').classList.add('active');
        } else {
            this.handDetected = false;
            this.isDrawing = false;
            document.getElementById('handStatus').classList.remove('active');
            document.getElementById('drawingStatus').classList.remove('active');
        }
    }

    drawHandLandmarks(ctx, landmarks, width, height) {
        // Draw connections
        const connections = [
            [0, 1], [1, 2], [2, 3], [3, 4],  // Thumb
            [0, 5], [5, 6], [6, 7], [7, 8],  // Index
            [0, 9], [9, 10], [10, 11], [11, 12],  // Middle
            [0, 13], [13, 14], [14, 15], [15, 16],  // Ring
            [0, 17], [17, 18], [18, 19], [19, 20],  // Pinky
            [5, 9], [9, 13], [13, 17]  // Palm
        ];
        
        ctx.strokeStyle = '#00B8FC';
        ctx.lineWidth = 2;
        
        connections.forEach(([start, end]) => {
            const startPoint = landmarks[start];
            const endPoint = landmarks[end];
            
            ctx.beginPath();
            ctx.moveTo(startPoint.x * width, startPoint.y * height);
            ctx.lineTo(endPoint.x * width, endPoint.y * height);
            ctx.stroke();
        });
        
        // Draw landmarks
        landmarks.forEach((landmark, index) => {
            const x = landmark.x * width;
            const y = landmark.y * height;
            
            ctx.beginPath();
            ctx.arc(x, y, index === 8 ? 8 : 4, 0, 2 * Math.PI);
            ctx.fillStyle = index === 8 ? '#00B8FC' : '#8B5CF6';
            ctx.fill();
        });
    }

    processGestures(landmarks) {
        // Index finger tip (landmark 8)
        const indexTip = landmarks[8];
        const indexMCP = landmarks[5];
        const middleTip = landmarks[12];
        const thumbTip = landmarks[4];
        
        // Convert to 3D coordinates
        const x = (indexTip.x - 0.5) * 10;
        const y = -(indexTip.y - 0.5) * 10;
        const z = indexTip.z * 5;
        
        // Check if index finger is extended (drawing gesture)
        const indexExtended = indexTip.y < indexMCP.y;
        const middleExtended = middleTip.y < landmarks[9].y;
        
        // Drawing mode: only index finger extended
        if (indexExtended && !middleExtended) {
            if (!this.isDrawing) {
                this.isDrawing = true;
                this.currentStroke = [];
                document.getElementById('drawingStatus').classList.add('active');
                this.showModeIndicator('Drawing');
            }
            
            // Add point to current stroke
            this.currentStroke.push(new THREE.Vector3(x, y, z));
            
            // Draw line if we have at least 2 points
            if (this.currentStroke.length >= 2) {
                this.drawLine(
                    this.currentStroke[this.currentStroke.length - 2],
                    this.currentStroke[this.currentStroke.length - 1]
                );
            }
            
            this.lastPosition = { x, y, z };
        } else {
            // Stop drawing
            if (this.isDrawing && this.currentStroke.length > 0) {
                this.allStrokes.push([...this.currentStroke]);
                this.currentStroke = [];
            }
            this.isDrawing = false;
            document.getElementById('drawingStatus').classList.remove('active');
        }
        
        // Detect pinch gesture for size adjustment
        const pinchDistance = Math.sqrt(
            Math.pow(thumbTip.x - indexTip.x, 2) +
            Math.pow(thumbTip.y - indexTip.y, 2)
        );
        
        if (pinchDistance < 0.05) {
            // Pinch detected - could adjust brush size based on movement
            this.showModeIndicator('Pinch Detected');
        }
    }

    drawLine(start, end) {
        const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
        const material = new THREE.LineBasicMaterial({
            color: new THREE.Color(this.brushColor),
            linewidth: this.brushSize
        });
        
        const line = new THREE.Line(geometry, material);
        this.scene.add(line);
    }

    showModeIndicator(text) {
        const indicator = document.getElementById('modeIndicator');
        indicator.textContent = text;
        indicator.classList.add('show');
        
        setTimeout(() => {
            indicator.classList.remove('show');
        }, 1000);
    }

    initUI() {
        // Brush size control
        const brushSizeInput = document.getElementById('brushSize');
        const sizeValue = document.getElementById('sizeValue');
        
        brushSizeInput.addEventListener('input', (e) => {
            this.brushSize = parseInt(e.target.value);
            sizeValue.textContent = this.brushSize;
        });
        
        // Color picker
        document.querySelectorAll('.color-option').forEach(option => {
            option.addEventListener('click', () => {
                document.querySelectorAll('.color-option').forEach(o => o.classList.remove('active'));
                option.classList.add('active');
                this.brushColor = option.dataset.color;
            });
        });
        
        // Undo button
        document.getElementById('undoBtn').addEventListener('click', () => {
            this.undo();
        });
        
        // Clear button
        document.getElementById('clearBtn').addEventListener('click', () => {
            this.clear();
        });
    }

    undo() {
        if (this.allStrokes.length > 0) {
            this.allStrokes.pop();
            this.redrawAll();
            this.showModeIndicator('Undo');
        }
    }

    clear() {
        this.allStrokes = [];
        this.currentStroke = [];
        this.redrawAll();
        this.showModeIndicator('Cleared');
    }

    redrawAll() {
        // Remove all lines from scene
        const linesToRemove = [];
        this.scene.children.forEach(child => {
            if (child instanceof THREE.Line && child.geometry.type === 'BufferGeometry') {
                linesToRemove.push(child);
            }
        });
        linesToRemove.forEach(line => this.scene.remove(line));
        
        // Redraw all strokes
        this.allStrokes.forEach(stroke => {
            for (let i = 1; i < stroke.length; i++) {
                this.drawLine(stroke[i - 1], stroke[i]);
            }
        });
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        // Rotate camera slightly for better view
        this.camera.position.x = Math.sin(Date.now() * 0.0001) * 0.5;
        
        this.renderer.render(this.scene, this.camera);
    }
}

// Initialize app when page loads
window.addEventListener('load', () => {
    new AirCanvas3D();
});
