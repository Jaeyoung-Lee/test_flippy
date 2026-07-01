# Flippy Bird

## Game Description
Flippy Bird is a fun, interactive game that combines classic Flappy Bird mechanics with voice control. Players control the bird using either mouse/touch input or by speaking into their microphone. The louder the sound, the higher the bird jumps!

## Features
- Classic Flappy Bird gameplay with smooth controls
- Voice-controlled gameplay (microphone input)
- Real-time volume monitoring and display
- Responsive design for both desktop and mobile devices
- Score tracking and game over detection

## How to Play
1. Click the "🎤 마이크 시작" button to enable microphone access
2. Once microphone is active, click or press spacebar to start the game
3. Control the bird by:
   - Clicking/tapping on the screen
   - Pressing the spacebar
   - Speaking into your microphone (louder voice = higher jump)
4. Navigate through pipes without hitting them
5. Each pipe passed earns you 1 point
6. Game ends when the bird hits a pipe or the ground

## Technical Implementation
- Uses HTML5 Canvas for rendering
- Implements Web Audio API for microphone input processing
- Uses `navigator.mediaDevices.getUserMedia` for microphone access
- Uses `AudioContext` with `AnalyserNode` to process volume data
- Responsive design using CSS Flexbox
- Game loop implemented with `requestAnimationFrame`

## Requirements
- Modern web browser with Web Audio API support
- Microphone (optional but recommended for full experience)
- Mouse or touch screen for gameplay

## Files
- `index.html` - Main HTML structure
- `style.css` - Styling and layout
- `game.js` - Game logic and implementation

## Known Issues & Limitations
- Voice sensitivity may vary depending on microphone quality
- Mobile browsers may have different permission handling requirements
- Volume monitoring might not work perfectly in all environments
