const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const micBtn = document.getElementById('mic-btn');
const volumeDisplay = document.getElementById('volume-display');

// Game Constants
const GRAVITY = 0.25;
const JUMP_STRENGTH = -5;
const PIPE_SPEED = 2.5;
const PIPE_SPAWN_RATE = 90; // Slightly faster spawn
const PIPE_GAP = 160;
const PIPE_WIDTH = 50;
const BIRD_SIZE = 30;

// Game State
let bird = {
    x: 50,
    y: 200,
    velocity: 0,
    width: BIRD_SIZE,
    height: BIRD_SIZE
};

let pipes = [];
let score = 0;
let frameCount = 0;
let gameRunning = false;
let gameOver = false;

// Audio Context State
let audioCtx = null;
let analyser = null;
let dataArray = null;
let isMicActive = false;

// Canvas sizing
function resizeCanvas() {
    canvas.width = 400;
    canvas.height = 600;
}

// Input Handling
window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        handleAction();
    }
});

canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    handleAction();
}, { passive: false });

canvas.addEventListener('mousedown', () => {
    handleAction();
});

async function initMic() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        
        // 브라우저 차단 해제 (매우 중요)
        if (audioCtx.state === 'suspended') {
            await audioCtx.resume();
        }

        const source = audioCtx.createMediaStreamSource(stream);
        analyser = audioctx.createAnalyser(); // 오타 수정 포함: analyser
        analyser.fftSize = 256;
        source.connect(analyser);
        dataArray = new Uint8Array(analyser.frequencyBinCount);
        
        isMicActive = true;
        micBtn.style.display = 'none';
        console_log("Microphone initialized"); // 디버깅용
    } catch (err) {
        console.error("Microphone access denied:", err);
        alert("Microphone access is required for this game.");
    }
}

micBtn.addEventListener('click', () => {
    initMic();
});

// handleAction 함수 내부 수정
function handleAction() {
    if (gameOver) {
        resetGame();
    } else if (!gameRunning) {
        gameRunning = true;
        // 게임 시작 시 오디오 컨텍스트 재확인 및 Resume
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
    }

    if (isMicActive && analyser && dataArray) {
        analyser.getByteFrequencyData(dataArray);
        let volume = 0;
        // 저음역대 위주로 샘플링하여 반응성 높임
        for (let i = 0; i < 10; i++) {
            volume += dataArray[i];
        }
        volume /= 10;

        if (volumeDisplay) {
            volumeDisplay.innerText = `Volume: ${Math.round(volume)}`;
        }

        // 소리 크기에 따른 점프 감도 조절
        if (volume > 30) { // 민감도에 따라 20~50 사이 조정 가능
            const dynamicJump = JUMP_STRENGTH * (1 + (volume / 40));
            bird.velocity = dynamicJump;
        }
    } else {
        // 마이크 미사용 시 기본 점프
        bird.velocity = JUMP_STRENGTH;
    }
}

function resetGame() {
    bird.y = 200;
    bird.velocity = 0;
    pipes = [];
    score = 0;
    frameCount = 0;
    gameOver = false;
    gameRunning = true;
    updateScore();
}

function updateScore() {
    scoreElement.innerText = `Score: ${score}`;
}

function drawBird() {
    const x = bird.x;
    const y = bird.y;
    const size = BIRD_SIZE;

    // Outline (Black)
    ctx.fillStyle = 'black';
    ctx.fillRect(x, y, size, size);

    // Body (Yellow)
    ctx.fillStyle = '#FFD700';
    ctx.fillRect(x + 2, y + 2, size - 4, size - 4);

    // Eye (White)
    ctx.fillStyle = 'white';
    ctx.fillRect(x + 18, y + 4, 10, 10);
    // Pupil (Black)
    ctx.fillStyle = 'black';
    ctx.fillRect(x + 22, y + 6, 4, 4);

    // Beak (Orange)
    ctx.fillStyle = '#FF8C00';
    ctx.fillRect(x + 22, y + 18, 12, 8);
    ctx.fillStyle = 'black';
    ctx.fillRect(x + 32, y + 20, 2, 4);

    // Wing (White)
    ctx.fillStyle = 'white';
    ctx.fillRect(x + 2, y + 10, 12, 8);
}

function drawPipes() {
    pipes.forEach(pipe => {
        // Top pipe
        ctx.fillStyle = '#2e7d32'; // Green
        ctx.fillRect(pipe.x, 0, PIPE_WIDTH, pipe.top);
        // Top pipe cap
        ctx.fillStyle = '#1b5e20'; // Dark Green
        ctx.fillRect(pipe.x - 5, pipe.top - 20, PIPE_WIDTH + 10, 20);
        
        // Bottom pipe
        ctx.fillStyle = '#2e7d32'; // Green
        ctx.fillRect(pipe.x, canvas.height - pipe.bottom, PIPE_WIDTH, pipe.bottom);
        // Bottom pipe cap
        ctx.fillStyle = '#1b5e20'; // Dark Green
        ctx.fillRect(pipe.x - 5, canvas.height - pipe.bottom, PIPE_WIDTH + 10, 20);
    });
}

function update() {
    if (!gameRunning || gameOver) return;

    // Bird Physics
    bird.velocity += GRAVITY;
    bird.y += bird.velocity;

    // Collision: Ground or Ceiling
    if (bird.y + bird.height > canvas.height || bird.y < 0) {
        gameOver = true;
        gameRunning = false;
    }

    // Pipes logic
    if (frameCount % PIPE_SPAWN_RATE === 0) {
        const minPipeHeight = 50;
        const maxPipeHeight = canvas.height - PIPE_GAP - minPipeHeight;
        const topHeight = Math.floor(Math.random() * (maxPipeHeight - minPipeHeight + 1)) + minPipeHeight;
        
        pipes.push({
            x: canvas.width,
            top: topHeight,
            bottom: canvas.height - topHeight - PIPE_GAP,
            passed: false
        });
    }

    for (let i = pipes.length - 1; i >= 0; i--) {
        pipes[i].x -= PIPE_SPEED;

        // Collision: Bird and Pipe
        if (
            bird.x < pipes[i].x + PIPE_WIDTH &&
            bird.x + bird.width > pipes[i].x &&
            (bird.y < pipes[i].top || bird.y + bird.height > canvas.height - pipes[i].bottom)
        ) {
            gameOver = true;
            gameRunning = false;
        }

        // Score update
        if (!pipes[i].passed && bird.x > pipes[i].x + PIPE_WIDTH) {
            score++;
            pipes[i].passed = true;
            updateScore();
        }

        // Remove off-screen pipes
        if (pipes[i].x + PIPE_WIDTH < 0) {
            pipes.splice(i, 1);
        }
    }

    frameCount++;
}

function draw() {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawPipes();
    drawBird();

    if (!gameRunning && !gameOver) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'white';
        ctx.font = '24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Press Space or Click to Start', canvas.width / 2, canvas.height / 2);
    }

    if (gameOver) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'white';
        ctx.font = '40px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - 20);
        ctx.font = '24px Arial';
        ctx.fillText(`Score: ${score}`, canvas.width / 2, canvas.height / 2 + 20);
        ctx.fillText('Click to Restart', canvas.width / 2, canvas.height / 2 + 60);
    }
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// Initialize
resizeCanvas();
gameLoop();
