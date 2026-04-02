const START_INDEX = {
  red: 0,
  green: 13,
  yellow: 26,
  blue: 39,
};

const SAFE_CELLS = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

const COLOR_HEX = {
  red: '#d62828',
  green: '#2b9348',
  yellow: '#e09f2d',
  blue: '#1d4ed8',
};

const SESSION_KEY = 'ludo_online_session';

const setupPanel = document.getElementById('setup-panel');
const gamePanel = document.getElementById('game-panel');
const nameInput = document.getElementById('player-name');
const roomCodeLabel = document.getElementById('room-code');
const joinCodeInput = document.getElementById('join-room-code');
const createRoomBtn = document.getElementById('create-room-btn');
const joinRoomBtn = document.getElementById('join-room-btn');
const setupStatus = document.getElementById('setup-status');
const turnStatus = document.getElementById('turn-status');
const startBtn = document.getElementById('start-btn');
const rollBtn = document.getElementById('roll-btn');
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

const boardGeometry = buildBoardGeometry(board.width, board.height);

createRoomBtn.addEventListener('click', async () => {
  const name = nameInput.value.trim();
  if (!name) {
    setSetupStatus('Enter your name first.');
    return;
  }

  createRoomBtn.disabled = true;
  joinRoomBtn.disabled = true;

  try {
    const response = await postJson('/api/create-room', { name });
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
  const code = joinCodeInput.value.trim().toUpperCase();
  if (!name) {
    setSetupStatus('Enter your name first.');
    return;
  }
  if (!code) {
    setSetupStatus('Enter a room code.');
    return;
  }

  createRoomBtn.disabled = true;
  joinRoomBtn.disabled = true;

  try {
    const response = await postJson('/api/join-room', { roomCode: code, name });
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

rollBtn.addEventListener('click', async () => {
  try {
    await postJson('/api/roll', { roomCode, playerId });
  } catch (error) {
    setTurnStatus(error.message);
  }
});

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
    state = JSON.parse(event.data);
    render();
  });

  eventSource.onerror = () => {
    setTurnStatus('Connection interrupted. Reconnecting...');
  };
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

function render() {
  if (!state) return;

  const byId = new Map(state.players.map((player) => [player.id, player]));
  const currentTurn = byId.get(state.turnPlayerId);
  const isMyTurn = Boolean(state.turnPlayerId && state.turnPlayerId === playerId);

  startBtn.classList.toggle('hidden', !(state.youAreHost && !state.started && !state.gameOver));
  rollBtn.disabled = !(state.started && !state.gameOver && isMyTurn && state.pendingRoll === null);

  renderMoveButtons(isMyTurn);
  renderPlayers(byId);
  renderWinners(byId);
  renderLog();

  if (state.gameOver) {
    const names = state.winners
      .map((id) => byId.get(id))
      .filter(Boolean)
      .map((player) => player.name);
    setTurnStatus(`Game over. Ranking: ${names.join(' > ')}`);
  } else if (!state.started) {
    const minimum = state.players.length < 2 ? 'Need at least 2 players.' : 'Host can start the game.';
    setTurnStatus(`Lobby open. ${minimum}`);
  } else if (isMyTurn) {
    if (state.pendingRoll === null) {
      setTurnStatus('Your turn: roll the dice.');
    } else {
      setTurnStatus(`You rolled ${state.pendingRoll}. Choose a token.`);
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

  for (const tokenIndex of state.validMoves) {
    const button = document.createElement('button');
    button.textContent = `Move Token ${tokenIndex + 1}`;
    button.addEventListener('click', async () => {
      try {
        await postJson('/api/move', {
          roomCode,
          playerId,
          tokenIndex,
        });
      } catch (error) {
        setTurnStatus(error.message);
      }
    });
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
  ctx.clearRect(0, 0, board.width, board.height);

  const { centerX, centerY, track, yards, homes } = boardGeometry;

  drawBoardBackground(centerX, centerY);
  drawTrack(track);
  drawHomes(homes);
  drawYards(yards);

  if (!state || !state.pieces) return;

  const tokens = [];

  for (const player of state.players) {
    const color = player.color;
    const pieces = state.pieces[color] || [];
    for (let tokenIndex = 0; tokenIndex < pieces.length; tokenIndex += 1) {
      const progress = pieces[tokenIndex];
      tokens.push({
        playerId: player.id,
        color,
        tokenIndex,
        progress,
        coord: getTokenCoord(color, tokenIndex, progress, boardGeometry),
      });
    }
  }

  const grouped = groupOverlappingTokens(tokens);

  for (const group of grouped) {
    const count = group.length;
    group.forEach((token, index) => {
      const angle = (Math.PI * 2 * index) / Math.max(count, 1);
      const spread = count > 1 ? 10 : 0;
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
    });
  }
}

function drawBoardBackground(centerX, centerY) {
  ctx.fillStyle = '#fffaf0';
  ctx.fillRect(0, 0, board.width, board.height);

  const zones = [
    { x: 70, y: 70, color: '#ffe2e2' },
    { x: board.width - 250, y: 70, color: '#def5e3' },
    { x: board.width - 250, y: board.height - 250, color: '#fff0cd' },
    { x: 70, y: board.height - 250, color: '#dfe9ff' },
  ];

  for (const zone of zones) {
    ctx.fillStyle = zone.color;
    ctx.fillRect(zone.x, zone.y, 180, 180);
  }

  ctx.beginPath();
  ctx.arc(centerX, centerY, 40, 0, Math.PI * 2);
  ctx.fillStyle = '#f4efe2';
  ctx.fill();
  ctx.strokeStyle = '#c6b9a2';
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawTrack(track) {
  for (let index = 0; index < track.length; index += 1) {
    const point = track[index];
    const safe = SAFE_CELLS.has(index);

    ctx.beginPath();
    ctx.arc(point.x, point.y, safe ? 9 : 7, 0, Math.PI * 2);
    ctx.fillStyle = safe ? '#f5d98b' : '#ece2cf';
    ctx.fill();
    ctx.strokeStyle = '#bba98d';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

function drawHomes(homes) {
  for (const [color, points] of Object.entries(homes)) {
    for (const point of points) {
      ctx.beginPath();
      ctx.arc(point.x, point.y, 8, 0, Math.PI * 2);
      ctx.fillStyle = lightenColor(COLOR_HEX[color], 0.6);
      ctx.fill();
      ctx.strokeStyle = COLOR_HEX[color];
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }
}

function drawYards(yards) {
  for (const [color, points] of Object.entries(yards)) {
    for (const point of points) {
      ctx.beginPath();
      ctx.arc(point.x, point.y, 10, 0, Math.PI * 2);
      ctx.fillStyle = lightenColor(COLOR_HEX[color], 0.7);
      ctx.fill();
      ctx.strokeStyle = COLOR_HEX[color];
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
}

function drawToken(x, y, color, label, highlight) {
  ctx.beginPath();
  ctx.arc(x, y, 13, 0, Math.PI * 2);
  ctx.fillStyle = COLOR_HEX[color];
  ctx.fill();
  ctx.strokeStyle = highlight ? '#111' : '#fff';
  ctx.lineWidth = highlight ? 3 : 2;
  ctx.stroke();

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px Segoe UI';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(label), x, y + 0.5);
}

function buildBoardGeometry(width, height) {
  const centerX = width / 2;
  const centerY = height / 2;
  const trackRadius = Math.min(width, height) * 0.39;

  const track = [];
  for (let index = 0; index < 52; index += 1) {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / 52;
    track.push({
      x: centerX + Math.cos(angle) * trackRadius,
      y: centerY + Math.sin(angle) * trackRadius,
    });
  }

  const yards = makeYards(width, height);
  const homes = {
    red: linePoints({ x: centerX, y: centerY - 178 }, { x: centerX, y: centerY - 38 }, 6),
    green: linePoints({ x: centerX + 178, y: centerY }, { x: centerX + 38, y: centerY }, 6),
    yellow: linePoints({ x: centerX, y: centerY + 178 }, { x: centerX, y: centerY + 38 }, 6),
    blue: linePoints({ x: centerX - 178, y: centerY }, { x: centerX - 38, y: centerY }, 6),
  };

  return { centerX, centerY, track, yards, homes };
}

function makeYards(width, height) {
  const margin = 155;
  const spread = 34;

  return {
    red: yardPoints(margin, margin, spread),
    green: yardPoints(width - margin, margin, spread),
    yellow: yardPoints(width - margin, height - margin, spread),
    blue: yardPoints(margin, height - margin, spread),
  };
}

function yardPoints(baseX, baseY, spread) {
  return [
    { x: baseX - spread, y: baseY - spread },
    { x: baseX + spread, y: baseY - spread },
    { x: baseX - spread, y: baseY + spread },
    { x: baseX + spread, y: baseY + spread },
  ];
}

function linePoints(start, end, count) {
  const points = [];
  for (let i = 0; i < count; i += 1) {
    const t = count === 1 ? 1 : i / (count - 1);
    points.push({
      x: start.x + (end.x - start.x) * t,
      y: start.y + (end.y - start.y) * t,
    });
  }
  return points;
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

function saveSession() {
  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      roomCode,
      playerId,
      name: nameInput.value.trim(),
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
