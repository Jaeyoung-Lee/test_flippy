const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const micBtn = document.getElementById('mic-btn');
const volumeDisplay = document.getElementById('volume-display');

console.log("Software Version: v1.0.8 (Final Audio Pipeline Fix)");

// Game Constants
const GRAVITY = 0.2;
const JUMP_STRENGTH = -3;
const PIPE_SPEED = 2.5;
const PIPE_SPAWN_RATE = 120;
const PIPE_GAP = 160;
const PIPE_WIDTH = 50;
const BIRD_SIZE = 30;

// Game State
let bird = { x: 50, y: 200, velocity: 0, width: BIRD_SIZE, height: BIRD_SIZE };
let pipes = [];
let score = 0;
let frameCount = 0;
let gameRunning = false;
let gameOver = false;

// Audio Variables
let audioCtx = null;
let analyser = null;
let dataArray = null;
let isMicActive = false;
let currentVolume = 0;
let prevVolume = 0;
// Bird image support: if a file named bird.png (or assets/bird.png) is present, use it.
let birdImg = new Image();
let birdImgLoaded = false;
// Try root then assets folder
birdImg.src = 'bird.png';
birdImg.onload = () => { birdImgLoaded = true; console.log('Bird image loaded from bird.png'); };
birdImg.onerror = () => {
    // try assets path
    birdImg.src = 'assets/bird.png';
    birdImg.onload = () => { birdImgLoaded = true; console.log('Bird image loaded from assets/bird.png'); };
    birdImg.onerror = () => { console.log('No bird image found; using canvas-drawn sprite.'); };
};

function resizeCanvas() {
    // Responsive canvas sizing with devicePixelRatio handling
    const cssWidth = Math.max(320, Math.min(420, window.innerWidth - 40));
    const cssHeight = Math.max(480, Math.min(720, window.innerHeight - 80));

    const dpr = window.devicePixelRatio || 1;

    // Set the actual drawing buffer size in device pixels
    canvas.width = Math.floor(cssWidth * dpr);
    canvas.height = Math.floor(cssHeight * dpr);

    // Set the CSS size (what the page layout uses)
    canvas.style.width = cssWidth + 'px';
    canvas.style.height = cssHeight + 'px';

    // Reset and scale the drawing context so 1 unit = 1 CSS pixel
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

// [FIXED] Robust Microphone Initialization
async function getMicrophoneAccess() {
    try {
        console.log("Requesting microphone access...");
        micBtn.innerText = "⌛ Loading...";
        micBtn.disabled = true;

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            micBtn.innerText = "🎤 마이크 시작";
            micBtn.disabled = false;
            alert('Error: getUserMedia is not supported in this browser or context.\nServe the page over HTTPS or use localhost.');
            return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }
        });
        
        // Initialize AudioContext ONLY after user interaction (click)
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }

        // Force Resume
        if (audioCtx.state === 'suspended') {
            await audioCtx.resume();
        }

        const source = audioCtx.createMediaStreamSource(stream);
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);

        dataArray = new Uint8Array(analyser.frequencyBinCount);
        isMicActive = true;
        micBtn.style.display = 'none';
        console.log("Microphone pipeline established.");
        
        // Start the volume monitoring loop
        startVolumeMonitoring();

    } catch (err) {
        console.error("Detailed Mic Error:", err);
        micBtn.innerText = "🎤 마이크 시작";
        micBtn.disabled = false;
        alert(`Error: ${err.name}\n${err.message}`);
    }
}

// [FIXED] Dedicated Monitoring Loop (Separated from Game Loop)
function startVolumeMonitoring() {
    if (!isMicActive || !analyser || !dataArray) return;

    analyser.getByteFrequencyData(dataArray);

    let sum = 0;
    const voiceBins = Math.min(20, dataArray.length);
    for (let i = 0; i < voiceBins; i++) {
        sum += dataArray[i];
    }
    currentVolume = sum / voiceBins;

    if (volumeDisplay) {
        volumeDisplay.innerText = `Volume: ${Math.round(currentVolume)}`;
    }

    const jumpThreshold = 80; // same threshold used in handleAction

    // If user speaks loudly before starting, auto-start the game
    if (!gameRunning && !gameOver && currentVolume > jumpThreshold) {
        gameRunning = true;
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
    }

    // Trigger a jump on the rising edge of a loud sound for responsiveness
    if (gameRunning && currentVolume > jumpThreshold && prevVolume <= (currentVolume-20)) {
        const dynamicJump = JUMP_STRENGTH * (1 + (currentVolume / 200));
        bird.velocity = dynamicJump;
    }

    prevVolume = currentVolume;

    // High frequency polling for responsiveness
    requestAnimationFrame(startVolumeMonitoring);
}

// Input Handling
window.addEventListener('keydown', (e) => { if (e.code === 'Space') handleAction(); });
canvas.addEventListener('touchstart', (e) => { e.preventDefault(); handleAction(); }, { passive: false });
canvas.addEventListener('mousedown', () => { handleAction(); });
// Microphone button handler
if (micBtn) micBtn.addEventListener('click', () => { if (!isMicActive) getMicrophoneAccess(); });

function handleAction() {
    if (gameOver) {
        resetGame();
        return;
    } 
    
    if (!gameRunning) {
        gameRunning = true;
        // Ensure audio context is running when game starts
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        return;
    }

    // Jump logic based on volume OR click/space fallback
    const jumpThreshold = 80; // Adjust this for sensitivity
    if (isMicActive && currentVolume > jumpThreshold) {
        const dynamicJump = JUMP_STRENGTH * (1 + (currentVolume / 200));
        bird.velocity = dynamicJump;
    } else if (!isMicActive || currentVolume <= jumpThreshold) {
        // If user is clicking/pressing space, we still want a standard jump
        // but only if the game is already running.
        if (gameRunning && !isMicActive) {
            bird.velocity = JUMP_STRENGTH;
        } else if (isMicActive && currentVolume <= 5) {
            // If mic is active but too quiet, fallback to standard jump on click/space
             bird.velocity = JUMP_STRENGTH;
        }
    }
}

function resetGame() {
    bird.y = 200; bird.velocity = 0; pipes = []; score = 0;
    frameCount = 0; gameOver = false; gameRunning = true; updateScore();
}

function updateScore() { scoreElement.innerText = `Score: ${score}`; }

function drawBird() {
    const x = Math.round(bird.x);
    const y = Math.round(bird.y);
    const w = Math.max(12, Math.round(bird.width));
    const h = Math.max(12, Math.round(bird.height));
    if (birdImgLoaded) {
        // Draw image; context is already scaled so coordinates are in CSS pixels
        try {
            ctx.drawImage(birdImg, x, y, w, h);
        } catch (e) {
            // fallback to canvas sprite on any draw error
            console.warn('Error drawing bird image, falling back to canvas sprite', e);
            drawCanvasBird(x, y, w, h);
        }
    } else {
        drawCanvasBird(x, y, w, h);
    }
}

function drawCanvasBird(x, y, w, h) {
    const px = Math.max(2, Math.floor(Math.min(w, h) / 6));
    ctx.fillStyle = '#FFD12A';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#3a2b00';
    ctx.lineWidth = Math.max(1, Math.floor(px / 2));
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = '#E6B800';
    ctx.fillRect(x + px, y + Math.floor(h * 0.35), px * 2, px * 2);
    const eyeX = x + Math.floor(w * 0.62);
    const eyeY = y + Math.floor(h * 0.22);
    const eyeR = Math.max(2, Math.floor(px * 1.1));
    ctx.fillStyle = 'white';
    ctx.beginPath(); ctx.arc(eyeX, eyeY, eyeR, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'black';
    ctx.beginPath(); ctx.arc(eyeX + Math.max(1, Math.floor(px * 0.3)), eyeY, Math.max(1, Math.floor(px * 0.6)), 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#FF6D00';
    const beakW = Math.max(px * 2, Math.floor(w * 0.22));
    const beakH = Math.max(2, px);
    const beakX = x + w - Math.floor(px * 0.1);
    ctx.fillRect(beakX, y + Math.floor(h * 0.45), beakW, beakH);
    ctx.fillRect(beakX, y + Math.floor(h * 0.55), beakW, beakH);
    ctx.fillStyle = '#E6B800'; ctx.fillRect(x - px, y + Math.floor(h * 0.35), px, px);
}

function drawPipes() {
    pipes.forEach(pipe => {
        ctx.fillStyle = '#2e7d32'; ctx.fillRect(pipe.x, 0, PIPE_WIDTH, pipe.top);
        ctx.fillStyle = '#1b5e20'; ctx.fillRect(pipe.x - 5, pipe.top - 10, PIPE_WIDTH + 10, 20);
        ctx.fillStyle = '#2e7d32'; ctx.fillRect(pipe.x, canvas.height - pipe.bottom, PIPE_WIDTH, pipe.bottom);
        ctx.fillStyle = '#1b5e20'; ctx.fillRect(pipe.x - 5, canvas.height - pipe.bottom - 10, PIPE_WIDTH + 10, 20);
    });
}

function update() {
    if (!gameRunning || gameOver) return;
    bird.velocity += GRAVITY; bird.y += bird.velocity;
    if (bird.y + bird.height > canvas.height || bird.y < 0) { gameOver = true; gameRunning = false; }

    if (frameCount % PIPE_SPAWN_RATE === 0) {
        const minH = 50, maxH = canvas.height - PIPE_GAP - minH;
        const topH = Math.floor(Math.random() * (maxH - minH + 1)) + minH;
        pipes.push({ x: canvas.width, top: topH, bottom: canvas.height - topH - PIPE_GAP, passed: false });
    }

    for (let i = pipes.length - 1; i >= 0; i--) {
        pipes[i].x -= PIPE_SPEED;
        if (bird.x < pipes[i].x + PIPE_WIDTH && bird.x + bird.width > pipes[i].x &&
            (bird.y < pipes[i].top || bird.y + bird.height > canvas.height - pipes[i].bottom)) {
            gameOver = true; gameRunning = false;
        }
        if (!pipes[i].passed && bird.x > pipes[i].x + PIPE_WIDTH) { score++; pipes[i].passed = true; updateScore(); }
        if (pipes[i].x + PIPE_WIDTH < 0) pipes.splice(i, 1);
    }
    frameCount++;
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawPipes(); drawBird();
    if (!gameRunning && !gameOver) {
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'white'; ctx.font = '24px Arial'; ctx.textAlign = 'center';
        ctx.fillText('Press Space or Click to Start', canvas.width/2, canvas.height/2);
    }
    if (gameOver) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'white'; ctx.font = '40px Arial'; ctx.textAlign = 'center';
        ctx.fillText('GAME OVER', canvas.width/2, canvas.height/2 - 20);
        ctx.font = '24px Arial'; ctx.fillText(`Score: ${score}`, canvas.width/2, canvas.height/2 + 20);
    }
}

function gameLoop() { update(); draw(); requestAnimationFrame(gameLoop); }
resizeCanvas();
window.addEventListener('resize', resizeCanvas);
gameLoop();