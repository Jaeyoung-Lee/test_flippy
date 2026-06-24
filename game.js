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
        // 1. 스트림 요청 (안드로이드 호환성 추가)
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }
});

        // 2. AudioContext 생성 및 상태 강제 Resume
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        
        if (audioCtx.state === 'suspended' || audioCtx.state === 'inactive') {
            await audioCtx.resume();
        }

        // 3. 분석기 연결
        const source = audioCtx.createMediaStreamSource(stream);
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256; // 반응성을 위해 작게 설정
        source.connect(analyer); // 오타 주의: analyser

        dataArray = new Uint8Array(analyser.frequencyBinCount);
        
        isMicActive = true;
        micBtn.style.display = 'none';
        console.log("Microphone Active & Analyzed");
    _
    } catch (err) {
        console.error("Mic Init Error:", err);
        alert("마이크 접근 실패: " + err.message);
    }
}

// handleAction 함수 수정
function handleAction() {
    if (gameOver) {
        resetGame();
    } else if (!gameRunning) {
        gameRunning_true = true;
        // 게임 시작 시에도 한 번 더 Resume 확인
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
    }

    // 마이크 활성화 상태일 때만 볼륨 계산 및 점프 처리
    if (isMicActive && analyser && dataArray) {
        analyser.getByteFrequencyData(dataArray);
        
        // 저음역대(0~15번 인덱스)의 평균값을 가져와서 반응성 극대화
        let sum = 0;
        for (let i = 0; i < 16; i++) {
            sum += dataArray[i];
        }
        let volume = sum / 16;

        // 화면에 볼륨 표시 (실시간 확인용)
        if (volumeDisplay) {
            volumeDisplay.innerText = `Volume: ${Math.round(volume)}`;
        }

        // 소리 크기에 따른 점프 로직
        // 안드로이드 마이크 감도에 따라 30~60 사이를 조절하세요.
        if (volume > 40) { 
            const dynamicJump = JUMP_STRENGTH * (1 + (volume / 50));
            bird.velocity = dynamicJump;
        }
    } else {
        // 마이크가 꺼져있거나 미활성일 때의 기본 동작 (터치/클릭)
        if (!gameRunning && !gameOver) return; // 시작 전 클릭 방지
        bird.velocity = JUMP_STRENGTH;
    }
}

micBtn.addEventListener('click', () => {
    initMic();
});

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
