const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const micBtn = document.getElementById('mic-btn');
const volumeDisplay = document.getElementById('volume-display');

console.log("Software Version: v1.0.5 (ScriptProcessor Fix)");

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

// Audio Variables (Modified for Stability)
let audioCtx = null;
let volume = 0; // 전역 볼륨 변수
let isMicActive = false;

function resizeCanvas() {
    canvas.width = 400;
    canvas.height = 600;
}

// Input Handling
window.addEventListener('keydown', (e) => { if (e.code === 'Space') handleAction(); });
canvas.addEventListener('touchstart', (e) => { e.preventDefault(); handleAction(); }, { passive: false });
canvas.addEventListener('mousedown', () => { handleAction(); });

// [핵심 수정] ScriptProcessorNode를 이용한 마이크 데이터 강제 추출
async function initMic() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: true,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
        });

        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        
        if (audioCtx.state === 'suspended') {
            await audioCtx.resume();
        }

        const source = audioCtx.createMediaStreamSource(stream);
        
        // ScriptProcessorNode는 구형이지만 모바일/안드로이드에서 스트림 데이터를 
        // 가장 확실하게 가져오는 방법입니다.
        const processor = audioCtx.createScriptProcessor(2048, 1, 1);

        processor.onaudioprocess = (e) => {
            const inputData = e.inputBuffer.getChannelData(0);
            let sum = 0;
            for (let i = 0; i < inputData.length; i++) {
                sum += Math.abs(inputData[i]);
            }
            // 볼륨 값을 0~100 사이로 정규화 (마이크 감도에 따라 조절 가능)
            volume = (sum / inputData.length) * 255; 
        };

        source.connect(processor);
        processor.connect(audioCtx.destination); // 데이터를 소비하기 위해 연결 필요

        isMicActive = true;
        micBtn.style.display = 'none';
        console.log("Microphone Active via ScriptProcessor");
    } catch (err) {
        console.error("Mic Init Error:", err);
        alert("마이크 접근 실패: " + err.message);
    }
}

micBtn.addEventListener('click', async () => {
    await initMic();
});

function handleAction() {
    if (gameOver) {
        resetGame();
    } else if (!gameRunning) {
        gameRunning = true;
        if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    }

    // 볼륨 및 점프 처리
    if (isMicActive) {
        // 실시간으로 계산된 volume 변수 사용
        if (volumeDisplay) {
            volumeDisplay.innerText = `Volume: ${Math.round(volume)}`;
        }

        // [감도 조절] 안드로이드 마이크 성능에 따라 30~70 사이를 테스트하며 조정하세요.
        if (volume > 40) { 
            const dynamicJump = JUMP_STRENGTH * (1 + (volume / 100));
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
        ctx.fillStyle = '#1b5e20'; ctx.fillRect(pe.x - 5, canvas.height - pipe.bottom, PIPE_WIDTH + 10, 20);
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
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.fillStyle = 'white'; ctx.font = '24px Arial'; ctx.textAlign = 'center';
        ctx.fillText('Press Space or Click to Start', canvas.width/2, canvas.height/2);
    }
    if (gameOver) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.fillStyle = 'white'; ctx.font = '40px Arial'; ctx.textAlign = 'center';
        ctx.fillText('GAME OVER', canvas.width/2, canvas.height/2 - 20);
        ctx.font = '24px Arial'; ctx.fillText(`Score: ${score}`, canvas.width/2, canvas.height/2 + 20);
    }
}

function gameLoop() { update(); draw(); requestAnimationFrame(gameLoop); }
resizeCanvas(); gameLoop();