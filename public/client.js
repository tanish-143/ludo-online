const START_INDEX = {
  red: 0,
  green: 13,
  yellow: 26,
  blue: 39,
};

const SAFE_CELLS = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

const COLOR_HEX = {
  red: '#c62828',
  green: '#2f8f4e',
  yellow: '#d99a1b',
  blue: '#1f52c2',
};

const TRACK_CELLS = [
  [6, 1], [6, 2], [6, 3], [6, 4], [6, 5],
  [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6],
  [0, 7],
  [0, 8],
  [1, 8], [2, 8], [3, 8], [4, 8], [5, 8],
  [6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [6, 14],
  [7, 14],
  [8, 14],
  [8, 13], [8, 12], [8, 11], [8, 10], [8, 9],
  [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8],
  [14, 7],
  [14, 6],
  [13, 6], [12, 6], [11, 6], [10, 6], [9, 6],
  [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0],
  [7, 0],
  [6, 0],
];

const YARD_CELLS = {
  red: [[2, 2], [4, 2], [2, 4], [4, 4]],
  blue: [[10, 2], [12, 2], [10, 4], [12, 4]],
  green: [[2, 10], [4, 10], [2, 12], [4, 12]],
  yellow: [[10, 10], [12, 10], [10, 12], [12, 12]],
};

const HOME_LANE_CELLS = {
  red: [[7, 2], [7, 3], [7, 4], [7, 5], [7, 6], [7, 7]],
  green: [[2, 7], [3, 7], [4, 7], [5, 7], [6, 7], [7, 7]],
  yellow: [[7, 12], [7, 11], [7, 10], [7, 9], [7, 8], [7, 7]],
  blue: [[12, 7], [11, 7], [10, 7], [9, 7], [8, 7], [7, 7]],
};

const HOME_BLOCKS = {
  red: [0, 0],
  blue: [9, 0],
  green: [0, 9],
  yellow: [9, 9],
};

const SESSION_KEY = 'ludo_online_session';

const setupPanel = document.getElementById('setup-panel');
const gamePanel = document.getElementById('game-panel');
const nameInput = document.getElementById('player-name');
const passwordInput = document.getElementById('room-password');
const roomCodeLabel = document.getElementById('room-code');
const joinCodeInput = document.getElementById('join-room-code');
const createRoomBtn = document.getElementById('create-room-btn');
const joinRoomBtn = document.getElementById('join-room-btn');
const setupStatus = document.getElementById('setup-status');
const turnStatus = document.getElementById('turn-status');
const boardTip = document.getElementById('board-tip');
const startBtn = document.getElementById('start-btn');
const rollBtn = document.getElementById('roll-btn');
const exitBtn = document.getElementById('exit-btn');
const diceWidget = document.getElementById('dice-widget');
const diceFace = document.getElementById('dice-face');
const diceHelp = document.getElementById('dice-help');
const moveActions = document.getElementById('move-actions');
const playersList = document.getElementById('players-list');
const winnersList = document.getElementById('winners-list');
const logList = document.getElementById('log-list');
const board = document.getElementById('board');
const ctx = board.getContext('2d');

let roomCode = '';
let playerId = '';
let eventSource = null;
let state = null;
let rollingDice = false;
let movingToken = false;
let queuedDiceValue = null;
let renderedTokens = [];
let diceTimer = null;
let audioCtx = null;

const boardGeometry = buildBoardGeometry(board.width, board.height);

createRoomBtn.addEventListener('click', async () => {
  const name = nameInput.value.trim();
  const password = passwordInput.value.trim();

  if (!name) {
    setSetupStatus('Enter your name first.');
    return;
  }
  if (!password) {
    setSetupStatus('Enter room password.');
    return;
  }

  createRoomBtn.disabled = true;
  joinRoomBtn.disabled = true;

  try {
    const response = await postJson('/api/create-room', { name, password });
    roomCode = response.roomCode;
    playerId = response.playerId;
    connectToRoom();
  } catch (error) {
    setSetupStatus(error.message);
  } finally {
    createRoomBtn.disabled = false;
    joinRoomBtn.disabled = false;
  }
});

joinRoomBtn.addEventListener('click', async () => {
  const name = nameInput.value.trim();
  const password = passwordInput.value.trim();
  const code = joinCodeInput.value.trim().toUpperCase();

  if (!name) {
    setSetupStatus('Enter your name first.');
    return;
  }
  if (!password) {
    setSetupStatus('Enter room password.');
    return;
  }
  if (!code) {
    setSetupStatus('Enter a room code.');
    return;
  }

  createRoomBtn.disabled = true;
  joinRoomBtn.disabled = true;

  try {
    const response = await postJson('/api/join-room', { roomCode: code, name, password });
    roomCode = response.roomCode;
    playerId = response.playerId;
    connectToRoom();
  } catch (error) {
    setSetupStatus(error.message);
  } finally {
    createRoomBtn.disabled = false;
    joinRoomBtn.disabled = false;
  }
});

startBtn.addEventListener('click', async () => {
  try {
    await postJson('/api/start-game', { roomCode, playerId });
  } catch (error) {
    setTurnStatus(error.message);
  }
});

rollBtn.addEventListener('click', triggerRoll);
exitBtn.addEventListener('click', exitRoom);
diceWidget.addEventListener('click', triggerRoll);
diceWidget.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  triggerRoll();
});

board.addEventListener('pointerdown', handleBoardPointerDown);
window.addEventListener('resize', () => render());

setInterval(() => {
  if (state && state.resetAt) {
    render();
  }
}, 1000);

async function exitRoom() {
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }

  if (roomCode && playerId) {
    try {
      await postJson('/api/leave-room', { roomCode, playerId });
    } catch {
      // Ignore server leave errors; local exit should still complete.
    }
  }

  roomCode = '';
  playerId = '';
  state = null;
  movingToken = false;
  rollingDice = false;
  queuedDiceValue = null;

  localStorage.removeItem(SESSION_KEY);
  setDiceFace(1);

  gamePanel.classList.add('hidden');
  setupPanel.classList.remove('hidden');
  joinCodeInput.value = '';

  setSetupStatus('You exited the room.');
  setTurnStatus('');
}
function connectToRoom() {
  saveSession();
  setupPanel.classList.add('hidden');
  gamePanel.classList.remove('hidden');
  roomCodeLabel.textContent = roomCode;
  setTurnStatus('Connecting...');
  openEventStream();
}

function openEventStream() {
  if (eventSource) {
    eventSource.close();
  }

  const query = new URLSearchParams({ roomCode, playerId }).toString();
  eventSource = new EventSource(`/api/events?${query}`);

  eventSource.addEventListener('state', (event) => {
    const nextState = JSON.parse(event.data);
    handleStateTransitions(state, nextState);
    state = nextState;
    render();
  });

  eventSource.onerror = () => {
    setTurnStatus('Connection interrupted. Reconnecting...');
  };
}

async function triggerRoll() {
  if (!canRollCurrentPlayer() || rollingDice) {
    return;
  }

  rollingDice = true;
  queuedDiceValue = null;
  diceWidget.classList.add('rolling');
  render();

  unlockAudio();
  playRollStartSound();

  const animation = animateDice(900);
  let error = null;

  try {
    await postJson('/api/roll', { roomCode, playerId });
  } catch (rollError) {
    error = rollError;
  }

  await animation;

  rollingDice = false;
  diceWidget.classList.remove('rolling');

  if (queuedDiceValue !== null) {
    setDiceFace(queuedDiceValue);
    queuedDiceValue = null;
  } else if (state && state.pendingRoll !== null) {
    setDiceFace(state.pendingRoll);
  }

  render();

  if (error) {
    setTurnStatus(error.message);
    playFailSound();
  }
}

function animateDice(durationMs) {
  return new Promise((resolve) => {
    if (diceTimer) {
      clearTimeout(diceTimer);
      diceTimer = null;
    }

    const startAt = performance.now();

    const tick = () => {
      setDiceFace(1 + Math.floor(Math.random() * 6));
      const elapsed = performance.now() - startAt;
      if (elapsed >= durationMs) {
        resolve();
        return;
      }
      diceTimer = setTimeout(tick, 95);
    };

    tick();
  });
}

async function handleBoardPointerDown(event) {
  if (!state || movingToken) return;

  const isMyTurn = state.turnPlayerId === playerId;
  if (!state.started || state.gameOver || !isMyTurn || state.pendingRoll === null) {
    return;
  }

  const movableTokens = renderedTokens.filter((token) => token.playerId === playerId && token.movable);
  if (movableTokens.length === 0) {
    return;
  }

  const rect = board.getBoundingClientRect();
  const scaleX = board.width / rect.width;
  const scaleY = board.height / rect.height;
  const px = (event.clientX - rect.left) * scaleX;
  const py = (event.clientY - rect.top) * scaleY;

  let nearest = null;
  let nearestDistance = Infinity;

  for (const token of movableTokens) {
    const dx = px - token.x;
    const dy = py - token.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance <= 20 && distance < nearestDistance) {
      nearest = token;
      nearestDistance = distance;
    }
  }

  if (!nearest) {
    return;
  }

  await moveToken(nearest.tokenIndex);
}

async function moveToken(tokenIndex) {
  if (movingToken) return;
  movingToken = true;
  unlockAudio();

  try {
    await postJson('/api/move', {
      roomCode,
      playerId,
      tokenIndex,
    });
  } catch (error) {
    setTurnStatus(error.message);
    playFailSound();
  } finally {
    movingToken = false;
  }
}

async function postJson(path, payload) {
  const response = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Request failed.');
  }
  return data;
}

function setSetupStatus(message) {
  setupStatus.textContent = message;
}

function setTurnStatus(message) {
  turnStatus.textContent = message;
}

function setDiceFace(value) {
  const nextValue = Math.max(1, Math.min(6, Number(value) || 1));
  diceFace.textContent = String(nextValue);
}

function canRollCurrentPlayer() {
  if (!state) return false;
  const isMyTurn = state.turnPlayerId === playerId;
  return Boolean(state.started && !state.gameOver && isMyTurn && state.pendingRoll === null && !movingToken);
}

function render() {
  if (!state) return;

  const byId = new Map(state.players.map((player) => [player.id, player]));
  const currentTurn = byId.get(state.turnPlayerId);
  const isMyTurn = Boolean(state.turnPlayerId && state.turnPlayerId === playerId);
  const canRoll = canRollCurrentPlayer() && !rollingDice;

  startBtn.classList.toggle('hidden', !(state.youAreHost && !state.started));
  startBtn.disabled = state.players.length < 2;
  rollBtn.disabled = !canRoll;
  diceWidget.disabled = !canRoll;

  if (rollingDice) {
    diceHelp.textContent = 'Rolling...';
  } else if (canRoll) {
    diceHelp.textContent = 'Tap to roll';
  } else {
    diceHelp.textContent = 'Wait turn';
  }

  if (state.pendingRoll !== null && !rollingDice) {
    setDiceFace(state.pendingRoll);
  }

  renderMoveButtons(isMyTurn);
  renderPlayers(byId);
  renderWinners(byId);
  renderLog();

  if (state.gameOver) {
    const names = state.winners
      .map((id) => byId.get(id))
      .filter(Boolean)
      .map((player) => player.name);

    const countdown = state.resetAt ? Math.max(0, Math.ceil((state.resetAt - Date.now()) / 1000)) : null;
    const resetText = countdown !== null ? ` Auto-reset in ${countdown}s.` : '';
    setTurnStatus(`Game over. Ranking: ${names.join(' > ')}.${resetText}`);
  } else if (!state.started) {
    const minimum = state.players.length < 2 ? 'Need 2 to 4 players to start.' : 'Host can start the game.';
    setTurnStatus(`Lobby open. ${minimum}`);
  } else if (isMyTurn) {
    if (state.pendingRoll === null) {
      setTurnStatus('Your turn: tap the dice to roll.');
    } else {
      setTurnStatus(`You rolled ${state.pendingRoll}. Tap a highlighted token to move.`);
    }
  } else if (currentTurn) {
    if (state.pendingRoll === null) {
      setTurnStatus(`${currentTurn.name}'s turn.`);
    } else {
      setTurnStatus(`${currentTurn.name} rolled ${state.pendingRoll}.`);
    }
  } else {
    setTurnStatus('Waiting for game state...');
  }

  boardTip.textContent = state.started
    ? 'Tap highlighted tokens to move. Safe cells are marked with gold dots.'
    : 'Classic mode ready. Start game when players have joined.';

  drawBoard(isMyTurn);
}

function renderMoveButtons(isMyTurn) {
  moveActions.innerHTML = '';

  if (!state.started || state.gameOver || !isMyTurn || state.pendingRoll === null) {
    return;
  }

  if (!Array.isArray(state.validMoves) || state.validMoves.length === 0) {
    return;
  }

  const hint = document.createElement('span');
  hint.textContent = 'Fallback controls:';
  moveActions.appendChild(hint);

  for (const tokenIndex of state.validMoves) {
    const button = document.createElement('button');
    button.textContent = `Token ${tokenIndex + 1}`;
    button.addEventListener('click', () => moveToken(tokenIndex));
    moveActions.appendChild(button);
  }
}

function renderPlayers(byId) {
  playersList.innerHTML = '';

  for (const player of state.players) {
    const li = document.createElement('li');

    const dot = document.createElement('span');
    dot.className = 'color-dot';
    dot.style.background = COLOR_HEX[player.color];
    li.appendChild(dot);

    const labels = [player.name];
    if (player.id === playerId) labels.push('(you)');
    if (player.id === state.turnPlayerId && state.started && !state.gameOver) labels.push('[turn]');
    if (player.finished) labels.push('[finished]');

    li.appendChild(document.createTextNode(labels.join(' ')));
    playersList.appendChild(li);
  }
}

function renderWinners(byId) {
  winnersList.innerHTML = '';

  if (!state.winners || state.winners.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'No winners yet';
    winnersList.appendChild(li);
    return;
  }

  for (const winnerId of state.winners) {
    const player = byId.get(winnerId);
    const li = document.createElement('li');
    li.textContent = player ? `${player.name} (${player.color})` : winnerId;
    winnersList.appendChild(li);
  }
}

function renderLog() {
  logList.innerHTML = '';

  for (const entry of state.log || []) {
    const li = document.createElement('li');
    li.textContent = entry;
    logList.appendChild(li);
  }

  logList.scrollTop = logList.scrollHeight;
}

function drawBoard(isMyTurn) {
  renderedTokens = [];
  drawClassicBoard(boardGeometry);

  if (!state || !state.pieces) return;

  const rawTokens = [];

  for (const player of state.players) {
    const pieces = state.pieces[player.color] || [];
    for (let tokenIndex = 0; tokenIndex < pieces.length; tokenIndex += 1) {
      const progress = pieces[tokenIndex];
      rawTokens.push({
        playerId: player.id,
        color: player.color,
        tokenIndex,
        progress,
        coord: getTokenCoord(player.color, tokenIndex, progress, boardGeometry),
      });
    }
  }

  const grouped = groupOverlappingTokens(rawTokens);

  for (const group of grouped) {
    const count = group.length;
    group.forEach((token, index) => {
      const angle = (Math.PI * 2 * index) / Math.max(count, 1);
      const spread = count > 1 ? 11 : 0;
      const x = token.coord.x + Math.cos(angle) * spread;
      const y = token.coord.y + Math.sin(angle) * spread;

      const movable = Boolean(
        isMyTurn &&
        state.pendingRoll !== null &&
        Array.isArray(state.validMoves) &&
        state.validMoves.includes(token.tokenIndex) &&
        token.playerId === playerId
      );

      drawToken(x, y, token.color, token.tokenIndex + 1, movable);
      renderedTokens.push({
        x,
        y,
        playerId: token.playerId,
        tokenIndex: token.tokenIndex,
        movable,
      });
    });
  }
}

function drawClassicBoard(geometry) {
  const { cell, offsetX, offsetY, boardSize } = geometry;

  ctx.clearRect(0, 0, board.width, board.height);

  ctx.fillStyle = '#f8e9c9';
  ctx.fillRect(offsetX, offsetY, boardSize, boardSize);

  drawHomeBlock(geometry, 'red');
  drawHomeBlock(geometry, 'blue');
  drawHomeBlock(geometry, 'green');
  drawHomeBlock(geometry, 'yellow');

  // Central cross base cells.
  for (let y = 0; y < 15; y += 1) {
    for (let x = 6; x <= 8; x += 1) {
      drawCell(geometry, x, y, '#fff8ea');
    }
  }
  for (let x = 0; x < 15; x += 1) {
    for (let y = 6; y <= 8; y += 1) {
      drawCell(geometry, x, y, '#fff8ea');
    }
  }

  // Track cells.
  for (let index = 0; index < TRACK_CELLS.length; index += 1) {
    const [x, y] = TRACK_CELLS[index];
    drawCell(geometry, x, y, '#fffdf8');
  }

  // Home lanes.
  for (const [color, cells] of Object.entries(HOME_LANE_CELLS)) {
    for (const [x, y] of cells) {
      drawCell(geometry, x, y, lightenColor(COLOR_HEX[color], 0.65));
    }
  }

  // Safe markers.
  for (const safeIndex of SAFE_CELLS) {
    const point = geometry.track[safeIndex];
    ctx.beginPath();
    ctx.arc(point.x, point.y, cell * 0.12, 0, Math.PI * 2);
    ctx.fillStyle = '#d9a31a';
    ctx.fill();
    ctx.strokeStyle = '#7c4f10';
    ctx.lineWidth = 1.3;
    ctx.stroke();
  }

  // Start markers.
  for (const [color, startIndex] of Object.entries(START_INDEX)) {
    const point = geometry.track[startIndex];
    ctx.beginPath();
    ctx.arc(point.x, point.y, cell * 0.26, 0, Math.PI * 2);
    ctx.strokeStyle = COLOR_HEX[color];
    ctx.lineWidth = 2.2;
    ctx.stroke();
  }

  drawCenterMotif(geometry);

  // Yard nests.
  for (const [color, points] of Object.entries(geometry.yards)) {
    for (const point of points) {
      ctx.beginPath();
      ctx.arc(point.x, point.y, cell * 0.22, 0, Math.PI * 2);
      ctx.fillStyle = lightenColor(COLOR_HEX[color], 0.72);
      ctx.fill();
      ctx.strokeStyle = COLOR_HEX[color];
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  // Grid lines.
  ctx.strokeStyle = 'rgba(123, 82, 34, 0.45)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 15; i += 1) {
    const p = offsetX + i * cell;
    ctx.beginPath();
    ctx.moveTo(p, offsetY);
    ctx.lineTo(p, offsetY + boardSize);
    ctx.stroke();

    const q = offsetY + i * cell;
    ctx.beginPath();
    ctx.moveTo(offsetX, q);
    ctx.lineTo(offsetX + boardSize, q);
    ctx.stroke();
  }
}

function drawHomeBlock(geometry, color) {
  const [gx, gy] = HOME_BLOCKS[color];
  const baseColor = lightenColor(COLOR_HEX[color], 0.62);

  for (let y = gy; y < gy + 6; y += 1) {
    for (let x = gx; x < gx + 6; x += 1) {
      drawCell(geometry, x, y, baseColor);
    }
  }
}

function drawCenterMotif(geometry) {
  const center = toPixel(geometry, [7, 7]);
  const radius = geometry.cell * 0.42;

  ctx.beginPath();
  ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
  ctx.fillStyle = '#fef4de';
  ctx.fill();
  ctx.strokeStyle = '#a36c2d';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(center.x, center.y - radius);
  ctx.lineTo(center.x + radius, center.y);
  ctx.lineTo(center.x, center.y + radius);
  ctx.lineTo(center.x - radius, center.y);
  ctx.closePath();
  ctx.fillStyle = '#f1d09b';
  ctx.fill();
  ctx.strokeStyle = '#93652b';
  ctx.stroke();
}

function drawCell(geometry, gx, gy, color) {
  const { cell, offsetX, offsetY } = geometry;
  const x = offsetX + gx * cell;
  const y = offsetY + gy * cell;

  ctx.fillStyle = color;
  ctx.fillRect(x, y, cell, cell);
}

function drawToken(x, y, color, label, movable) {
  const pulse = 0.7 + 0.3 * Math.sin(Date.now() / 180);

  if (movable) {
    ctx.beginPath();
    ctx.arc(x, y, 17 + pulse * 2.2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 215, 0, 0.32)';
    ctx.fill();
  }

  ctx.beginPath();
  ctx.arc(x, y, 14, 0, Math.PI * 2);
  ctx.fillStyle = COLOR_HEX[color];
  ctx.fill();
  ctx.strokeStyle = movable ? '#111' : '#fff7e0';
  ctx.lineWidth = movable ? 3 : 2;
  ctx.stroke();

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px Trebuchet MS';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(label), x, y + 0.4);
}

function buildBoardGeometry(width, height) {
  const cell = Math.floor(Math.min(width, height) / 15);
  const boardSize = cell * 15;
  const offsetX = Math.floor((width - boardSize) / 2);
  const offsetY = Math.floor((height - boardSize) / 2);

  const track = TRACK_CELLS.map((cellPos) => toPixel({ cell, offsetX, offsetY }, cellPos));
  const yards = {};
  const homes = {};

  for (const [color, cells] of Object.entries(YARD_CELLS)) {
    yards[color] = cells.map((cellPos) => toPixel({ cell, offsetX, offsetY }, cellPos));
  }

  for (const [color, cells] of Object.entries(HOME_LANE_CELLS)) {
    homes[color] = cells.map((cellPos) => toPixel({ cell, offsetX, offsetY }, cellPos));
  }

  return {
    cell,
    boardSize,
    offsetX,
    offsetY,
    track,
    yards,
    homes,
  };
}

function toPixel(geometry, cellPos) {
  return {
    x: geometry.offsetX + cellPos[0] * geometry.cell + geometry.cell / 2,
    y: geometry.offsetY + cellPos[1] * geometry.cell + geometry.cell / 2,
  };
}

function getTokenCoord(color, tokenIndex, progress, geometry) {
  if (progress === -1) {
    return geometry.yards[color][tokenIndex];
  }

  if (progress >= 0 && progress <= 51) {
    return geometry.track[(START_INDEX[color] + progress) % 52];
  }

  const homeIndex = Math.max(0, Math.min(5, progress - 52));
  return geometry.homes[color][homeIndex];
}

function groupOverlappingTokens(tokens) {
  const map = new Map();
  for (const token of tokens) {
    const key = `${Math.round(token.coord.x)}:${Math.round(token.coord.y)}`;
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key).push(token);
  }
  return Array.from(map.values());
}

function lightenColor(hex, amount) {
  const normalized = hex.replace('#', '');
  const num = parseInt(normalized, 16);

  const red = (num >> 16) & 255;
  const green = (num >> 8) & 255;
  const blue = num & 255;

  const mix = (channel) => Math.round(channel + (255 - channel) * amount);
  const out = (mix(red) << 16) | (mix(green) << 8) | mix(blue);

  return `#${out.toString(16).padStart(6, '0')}`;
}

function handleStateTransitions(previous, next) {
  if (!previous) {
    if (next.pendingRoll !== null) {
      setDiceFace(next.pendingRoll);
    }
    return;
  }

  if (previous.pendingRoll === null && next.pendingRoll !== null) {
    if (rollingDice) {
      queuedDiceValue = next.pendingRoll;
    } else {
      setDiceFace(next.pendingRoll);
      playRollStopSound();
    }
  }

  if (piecesSignature(previous.pieces) !== piecesSignature(next.pieces)) {
    if (detectCapture(previous.pieces, next.pieces)) {
      playCaptureSound();
    } else {
      playMoveSound();
    }
  }

  if (!previous.gameOver && next.gameOver) {
    playWinSound();
  }

  if (previous.gameOver && !next.gameOver && !next.started) {
    setDiceFace(1);
    playResetSound();
  }
}

function piecesSignature(pieces) {
  if (!pieces) return '';
  const output = [];
  for (const color of ['red', 'green', 'yellow', 'blue']) {
    output.push((pieces[color] || []).join(','));
  }
  return output.join('|');
}

function detectCapture(prevPieces, nextPieces) {
  if (!prevPieces || !nextPieces) return false;

  const countYard = (pieces) => ['red', 'green', 'yellow', 'blue']
    .flatMap((color) => pieces[color] || [])
    .filter((value) => value === -1).length;

  return countYard(nextPieces) > countYard(prevPieces);
}

function unlockAudio() {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  } catch {
    // Audio not available in current browser; UI still works.
  }
}

function tone(freq, duration, options = {}) {
  if (!audioCtx) return;

  const now = audioCtx.currentTime + (options.delay || 0);
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = options.wave || 'sine';
  osc.frequency.setValueAtTime(freq, now);

  const volume = options.volume || 0.05;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(volume, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + duration + 0.01);
}

function playRollStartSound() {
  unlockAudio();
  tone(300, 0.06, { wave: 'square', volume: 0.04, delay: 0.00 });
  tone(360, 0.06, { wave: 'square', volume: 0.04, delay: 0.07 });
  tone(420, 0.06, { wave: 'square', volume: 0.04, delay: 0.14 });
}

function playRollStopSound() {
  unlockAudio();
  tone(540, 0.08, { wave: 'triangle', volume: 0.06, delay: 0.00 });
  tone(420, 0.10, { wave: 'triangle', volume: 0.045, delay: 0.08 });
}

function playMoveSound() {
  unlockAudio();
  tone(470, 0.08, { wave: 'triangle', volume: 0.05, delay: 0.00 });
}

function playCaptureSound() {
  unlockAudio();
  tone(260, 0.08, { wave: 'sawtooth', volume: 0.06, delay: 0.00 });
  tone(620, 0.10, { wave: 'triangle', volume: 0.055, delay: 0.10 });
}

function playWinSound() {
  unlockAudio();
  tone(392, 0.12, { wave: 'triangle', volume: 0.055, delay: 0.00 });
  tone(523, 0.12, { wave: 'triangle', volume: 0.055, delay: 0.14 });
  tone(659, 0.18, { wave: 'triangle', volume: 0.06, delay: 0.28 });
}

function playResetSound() {
  unlockAudio();
  tone(500, 0.07, { wave: 'sine', volume: 0.04, delay: 0.00 });
  tone(350, 0.07, { wave: 'sine', volume: 0.04, delay: 0.08 });
}

function playFailSound() {
  unlockAudio();
  tone(220, 0.08, { wave: 'square', volume: 0.04, delay: 0.00 });
}

function saveSession() {
  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      roomCode,
      playerId,
      name: nameInput.value.trim(),
      password: passwordInput.value.trim(),
    })
  );
}

async function restoreSession() {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return;

  try {
    const session = JSON.parse(raw);
    if (!session.roomCode || !session.playerId) return;

    nameInput.value = session.name || '';
    passwordInput.value = session.password || '';

    const query = new URLSearchParams({
      roomCode: session.roomCode,
      playerId: session.playerId,
    }).toString();

    const response = await fetch(`/api/state?${query}`);
    const data = await response.json();

    if (!response.ok) {
      localStorage.removeItem(SESSION_KEY);
      return;
    }

    roomCode = session.roomCode;
    playerId = session.playerId;
    state = data;
    connectToRoom();
    render();
  } catch {
    localStorage.removeItem(SESSION_KEY);
  }
}

restoreSession();






