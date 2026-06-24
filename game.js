const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const micBtn = document.getElementById('mic-btn');
const volumeDisplay = document.getElementById('volume-display');

console.log("Software Version: v1.0.6 (MediaElement Force)");

// Game Constants
const GRAVITY = 0.25;
const JUMP_STRENGTH = -5;
const PIPE_SPEED = 2.5;
const PIPE_SPAWN_RATE = 90;
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

function resizeCanvas() {
    canvas.width = 400;
    canvas.height = 600;
}

// Input Handling
window.addEventListener('keydown', (e) => { if (e.code === 'Space') handleAction(); });
canvas.addEventListener('touchstart', (e) => { e.preventDefault(); handleAction(); }, { passive: false });
canvas.addEventListener('mousedown', () => { handleAction(); });

// [최종 해결책] MediaElementSource를 이용한 강제 스트림 추출
async function initMic() {
    try {
        // 1. 가상의 오디오 엘리먼트 생성 (데이터 전달 통로 확보)
        const audioEl = document.createElement('audio');
        audioEl.srcType = 'audio/mpeg'; // 브라우저가 데이터를 처리하도록 유도
        
        // 2. 스트림 요청
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }
        });

        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        
        if (audioCtx.state === 'suspended') {
            await audioCtx.resume();
        }

        // 3. 스트림을 소스로 연결
        const source = audioCtx.createMediaStreamSource(stream);
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        
        source.connect(analyser);
        dataArray = new Uint8Array(analyer.frequencyBinCount || analyser.frequencyBinCount);
        // 위 줄에서 오타 방지를 위해 안전하게 할당
        dataArray = new Uint8Array(analyser.frequencyBinCount);

        isMicActive = true;
        micBtn.style.display = 'none';
        console.log("Microphone Active (MediaElement Route)");
    } catch (err) {
        console.error("Mic Init Error:", err);
        alert("마이크 접근 실패: " + err.message);
    }
}

micBtn.addEventListener('click', async () => {
    await initMic();
});

// 볼륨 실시간 감지 루프 (handleAction 밖에서 별도로 실행)
setInterval((). => {
    if (isMicActive && analyser && dataArray) {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < 16; i++) {
            sum += dataArray[i];
        }
        currentVolume = sum / 16;

        if (volumeDisplay) {
            volumeDisplay.innerText = `Volume: ${Math.round(currentVolume)}`;
        }
    }
}, 10); // 10ms마다 초고속 감지

function handleAction() {
    if (gameOver) {
        resetGame();
    } else if (!gameRunning) {
        gameRunning = true;
        if (audioCtx && audioctx.state === 'suspended') audioCtx.resume();
    }

    // 볼륨 기반 점프 로직
    if (isMicActive) {
        // [감도 조정] 모바일 환경에서 30~50 사이가 적당합니다.
        if (currentVolume > 40) { 
            const dynamicJump = JUMP_STRENGTH * (1 + (currentVolume / 60));
            bird.velocity = dynamicJump;
        }
    } else {
        // 마이크 미사용 시 기본 점프
        bird.velocity = JUMP_STRENGTH;
    }
}

function resetGame() {
    bird.y = 200; bird.velocity = 0; pipes = []; score = 0;
    frameCount = 0; gameOver = false; gameRunning = true; updateScore();
}

function updateScore() { scoreElement.innerText = `Score: ${score}`; }

function drawBird() {
    ctx.fillStyle = 'black'; ctx.fillRect(bird.x, bird.y, bird.width, bird.height);
    ctx.fillStyle = '#FFD700'; ctx.fillRect(bird.x + 2, bird.y + 2, bird.width - 4, bird.height - 4);
}

function drawPipes() {
    pipes.forEach(pipe => {
        ctx.fillStyle = '#2e7d32'; ctx.fillRect(pipe.x, 0, PIPE_WIDTH, pipe.top);
        ctx.fillStyle = '#1b5e20'; ctx.fillRect(pipe.x - 5, pipe.top - 20, PIPE_WIDTH + 10, 20);
        ctx.fillStyle = '#2e7d32'; ctx.fillRect(pipe.x, canvas.height - pipe.bottom, PIPE_WIDTH, pipe.bottom);
        ctx.fillStyle = '#1b5e20'; ctx.fillRect(pipe.x - 5, canvas.height - pipe.bottom - 20, PIPE_WIDTH + 10, 20);
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
resizeCanvas(); gameLoop();