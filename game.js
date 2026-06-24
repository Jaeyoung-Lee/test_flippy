const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const micBtn = document.getElementById('mic-btn');
const volumeDisplay = document.getElementById('volume-display');

// 소프트웨어 버전 표시 (UI에 추가됨)
console.log("Software Version: v1.0.3 (Mic Fix)");

// Game Constants
const GRAVITY = 0.25;
const JUMP_STRENGTH = -5;
const PIPE_SPEED = 2.5;
const PIPE_SPAWN_RATE = 90;
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

// Audio Variables
let audioCtx = null;
let analyser = null;
let dataArray = null;
let isMicActive = false;

function resizeCanvas() {
    canvas.width = 400;
    canvas.height = 600;
}

// Input Handling
window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') handleAction();
});

canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    handleAction();
}, { passive: false });

canvas.addEventListener('mousedown', () => {
    handleAction();
});

// 핵심 수정 부분: 마이크 초기화 로직 강화
async function initMic() {
    try {
        // 1. 스트림 요청
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: true,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
        });

        // 2. AudioContext 생성 및 강제 Resume
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        
        if (audioCtx.state === 'suspended' || audioCtx.state === 'inactive') {
            await audioCtx.resume();
        }

        // 3. 분석기 연결 (가장 확실한 표준 파이프라인)
        const source = audioCtx.createMediaStreamSource(stream);
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);

        dataArray = new Uint8Array(analyser.frequencyBinCount);
        isMicActive = true;
        micBtn.style.display = 'none';
        
        console.log("Microphone Initialized Successfully");
    } catch (err) {
        console.error("Mic Init Error:", err);
        alert("마이크 접근 실패: " + err.message);
    }
}

micBtn.addEventListener('click', () => {
    initMic();
});

function handleAction() {
    if (gameOver) {
        resetGame();
    } else if (!gameRunning) {
        gameRunning = true;
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
    }

    // 볼륨 및 점프 처리 로직
    if (isMicActive && analyser && dataArray) {
        analyser.getByteFrequencyData(dataArray);
        
        // 저음역대(0~15번 인덱스) 평균 추출 - 모바일 마이크 반응성 최적화
        let sum = 0;
        for (let i = 0; i < 16; i++) {
            sum += dataArray[i];
        }
        let volume = sum / 16;

        if (volumeDisplay) {
            volumeDisplay.innerText = `Volume: ${Math.round(volume)}`;
        }

        // 볼륨이 일정 수준 이상일 때 점프 실행
        // 안드로이드 마이크 감도에 따라 30~60 사이를 조절하세요.
        if (volume > 45) { 
            const dynamicJump = JUMP_STRENGTH * (1 + (volume / 50));
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

    ctx.fillStyle = 'black';
    ctx.fillRect(x, y, size, size);

    ctx.fillStyle = '#FFD700';
    ctx.fillRect(x + 2, y + 2, size - 4, size - 4);

    ctx.fillStyle = 'white';
    ctx.fillRect(x + 18, y + 4, 10, 10);
    ctx.fillStyle = 'black';
    ctx.fillRect(x + 22, y + 6, 4, 4);

    ctx.fillStyle = '#FF8C00';
    ctx.fillRect(x + 22, y + 18, 12, 8);
    ctx.fillStyle = 'black';
    ctx.fillRect(x + 32, y + 20, 2, 4);

    ctx.fillStyle = 'white';
    ctx.fillRect(x + 2, y + 10, 12, 8);
}

function drawPipes() {
    pipes.forEach(pipe => {
        ctx.fillStyle = '#2e7d32';
        ctx.fillRect(pipe.x, 0, PIPE_WIDTH, pipe.top);
        ctx.fillStyle = '#1b5e20';
        ctx.fillRect(pipe.x - 5, pipe.top - 20, PIPE_WIDTH + 10, 20);
        
        ctx.fillStyle = '#2e7d32';
        ctx.fillRect(pipe.x, canvas.height - pipe.bottom, PIPE_WIDTH, pipe.bottom);
        ctx.fillStyle = '#1b5e20';
        ctx.fillRect(pipe.x - 5, canvas.height - pipe.bottom, PIPE_WIDTH + 10, 20);
    });
}

function update() {
    if (!gameRunning || gameOver) return;

    bird.velocity += GRAVITY;
    bird.y += bird.velocity;

    if (bird.y + bird.height > canvas.height || bird.y < 0) {
        gameOver = true;
        gameRunning = false;
    }

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

        if (
            bird.x < pipes[i].x + PIPE_WIDTH &&
            bird.x + bird.width > pipes[i].x &&
            (bird.y < pipes[i].top || bird.y + bird.height > canvas.height - pipes[i].bottom)
        ) {
            gameOver = true;
            gameRunning = false;
        }

        if (!pipes[i].passed && bird.x > pipes[i].x + PIPE_WIDTH) {
            score++;
            pipes[i].passed = true;
            updateScore();
        }

        if (pipes[i].x + PIPE_WIDTH < 0) {
            pipes.splice(i, 1);
        }
    }

    frameCount++;
}

function draw() {
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

resizeCanvas();
gameLoop();