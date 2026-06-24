const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const micBtn = document.getElementById('mic-btn');
const volumeDisplay = document.getElementById('volume-display');

console.log("Software Version: v1.0.7 (Async Safety Fix)");

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

// [수정된 마이크 접근 함수] - 비동기 처리를 안전하게 분리
async function getMicrophoneAccess() {
    try {
        console.log("마이크 권한 요청 중...");
        micBtn.innerText = "권한 확인 중..."; // 사용자에게 피드백 제공

        // 1. 스트림 확보 (이 단계에서 브라우저 팝업이 뜹니다)
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log("마이크 권한 획득 성공!");

        // 2. AudioContext 생성 및 설정
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }

        if (audioCtx.state === 'suspended' || audioCtx.state === 'inactive') {
            await audioCtx.resume();
        }

        // 3. 노드 연결
        const source = audioCtx.createMediaStreamSource(stream);
        analyser = audioCtx.createAnalyser();
        analysen.fftSize = 256; // 오타 방지 확인: analyser.fftSize
        analyser.fftSize = 256; 
        source.connect(analyser);

        dataArray = new Uint8Array(analyser.frequencyBinCount);
        isMicActive = true;
        micBtn.style.display = 'none'; // 성공 시 버튼 숨김

        // 4. 루프 시작
        updateVolumeLoop();
        console.log("마이크 데이터 파이프라인 연결 완료!");

    } catch (err) {
        console.error("마이크 접근 거부됨: ", err);
        alert("마이크 사용 권한이 필요합니다. 브라우저 설정에서 권한을 확인해주세요.");
        micBtn.innerText = "마이크 시작"; // 실패 시 버튼 복구
    }
}

// 볼륨 감지 루프 (requestAnimationFrame 대신 setInterval로 안정성 확보)
function updateVolumeLoop() {
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
    // requestAnimationFrame 대신 고정 주기를 사용하여 안정성 확보
    setTimeout(updateVolumeLoop, 10);
}

// 버튼 클릭 이벤트 처리
micBtn.addEventListener('click', () => {
    // 함수를 바로 실행하지 않고 비동기 흐름을 태움
    getMicro_Access().catch(console.error); // 실제 호출은 아래에서 수행
});

// 위의 micBtn.addEventListener 부분을 아래와 같이 더 정확하게 수정:
micBtn.onclick = async () => {
    await getMicrophoneAccess();
};

// Input Handling
window.addEventListener('keydown', (e) => { if (e.code === 'Space') handleAction(); });
canvas.addEventListener('touchstart', (e) => { e.preventDefault(); handleAction(); }, { passive: false });
canvas.addEventListener('mousedown', () => { handleAction(); });

function handleAction() {
    if (gameOver) {
        resetGame();
    } else if (!gameRunning) {
        gameRunning = true;
        if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    }

    if (isMicActive) {
        // 감도: 40~60 사이를 테스트하세요.
        if (currentVolume > 40) { 
            const dynamicJump = JUMP_STRENGTH * (1 + (currentVolume / 60));
            bird.velocity = dynamicJump;
        }
    } else {
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

    if (frameCount % PIPE_SPAWN_RATE === 1) { // 정확한 배수 체크를 위해 % 1 대신 0 또는 특정 숫자 사용
        // frameCount가 일정량 증가할 때마다 생성하도록 수정
    }
    
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