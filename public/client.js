const START_INDEX = {
  red: 0,
  green: 39,
  yellow: 13,
  blue: 26,
};

const SAFE_CELLS = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

const COLOR_HEX = {
  red: '#c62828',
  green: '#2f8f4e',
  yellow: '#d99a1b',
  blue: '#1f52c2',
};

const BOARD_COLORS = {
  red:    { bg: '#cc3333', dark: '#a02828', light: '#e06858', nest: '#f2b0a0' },
  green:  { bg: '#2d8a3e', dark: '#1e6e2e', light: '#58b868', nest: '#a8d8b0' },
  yellow: { bg: '#d4a020', dark: '#a87818', light: '#e8c450', nest: '#f0dca0' },
  blue:   { bg: '#2868a8', dark: '#1a5088', light: '#5890c8', nest: '#a0c0e0' },
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
  green: [[10, 2], [12, 2], [10, 4], [12, 4]],
  yellow: [[2, 10], [4, 10], [2, 12], [4, 12]],
  blue: [[10, 10], [12, 10], [10, 12], [12, 12]],
};

const HOME_LANE_CELLS = {
  red: [[7, 2], [7, 3], [7, 4], [7, 5], [7, 6], [7, 7]],
  green: [[12, 7], [11, 7], [10, 7], [9, 7], [8, 7], [7, 7]],
  yellow: [[2, 7], [3, 7], [4, 7], [5, 7], [6, 7], [7, 7]],
  blue: [[7, 12], [7, 11], [7, 10], [7, 9], [7, 8], [7, 7]],
};

const HOME_BLOCKS = {
  red: [0, 0],
  green: [9, 0],
  yellow: [0, 9],
  blue: [9, 9],
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
const emojiBtn = document.getElementById('emoji-btn');
const emojiPicker = document.getElementById('emoji-picker');
const emojiFloatContainer = document.getElementById('emoji-float-container');
const copyCodeBtn = document.getElementById('copy-code-btn');
const soundBtn = document.getElementById('sound-btn');
const startHint = document.getElementById('start-hint');

// Room lobby elements
const roomLobby = document.getElementById('room-lobby');
const lobbyConnecting = document.getElementById('lobby-connecting');
const lobbyContent = document.getElementById('lobby-content');
const connectingRoomCode = document.getElementById('connecting-room-code');
const lobbyRoomCode = document.getElementById('lobby-room-code');
const lobbyCopyBtn = document.getElementById('lobby-copy-btn');
const lobbyPlayersList = document.getElementById('lobby-players-list');
const lobbyPlayerCount = document.getElementById('lobby-player-count');
const lobbyHumanCount = document.getElementById('lobby-human-count');
const lobbyStartBtn = document.getElementById('lobby-start-btn');
const lobbyLeaveBtn = document.getElementById('lobby-leave-btn');
const lobbyStatus = document.getElementById('lobby-status');
const gameRulesToggle = document.getElementById('game-rules-toggle');
const gameRulesPanel = document.getElementById('game-rules-panel');
const rulesBackBtn = document.getElementById('rules-back-btn');
const rulesDoneBtn = document.getElementById('rules-done-btn');
const shareWhatsapp = document.getElementById('share-whatsapp');
const shareTwitter = document.getElementById('share-twitter');

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
let soundMuted = false;
let pieceAnimations = new Map();
let animFrameId = null;
let autoMoveTimer = null;

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

// Emoji picker toggle
emojiBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  emojiPicker.classList.toggle('hidden');
});

// Close emoji picker on outside click
document.addEventListener('click', (e) => {
  if (!emojiPicker.contains(e.target) && e.target !== emojiBtn) {
    emojiPicker.classList.add('hidden');
  }
});

// Send emoji on click
emojiPicker.addEventListener('click', async (e) => {
  const opt = e.target.closest('.emoji-opt');
  if (!opt) return;
  const emoji = opt.dataset.emoji;
  emojiPicker.classList.add('hidden');
  if (!roomCode || !playerId) return;
  try {
    await postJson('/api/send-emoji', { roomCode, playerId, emoji });
  } catch {
    // Ignore send errors
  }
});

// Copy room code to clipboard
copyCodeBtn.addEventListener('click', async () => {
  if (!roomCode) return;
  try {
    const url = `${location.origin}?room=${roomCode}`;
    await navigator.clipboard.writeText(url);
    copyCodeBtn.classList.add('copied');
    const origText = copyCodeBtn.textContent;
    copyCodeBtn.innerHTML = copyCodeBtn.innerHTML.replace('Copy Link', 'Copied!');
    setTimeout(() => {
      copyCodeBtn.classList.remove('copied');
      copyCodeBtn.innerHTML = copyCodeBtn.innerHTML.replace('Copied!', 'Copy Link');
    }, 2000);
  } catch {
    // Clipboard API not available
  }
});

// Sound toggle
soundBtn.addEventListener('click', () => {
  soundMuted = !soundMuted;
  soundBtn.innerHTML = soundMuted
    ? `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg> Unmute Sound`
    : `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg> Mute Sound`;
});

// In-game settings overlay
const gameSettingsBtn = document.getElementById('game-settings-btn');
const ingameRulesOverlay = document.getElementById('ingame-rules-overlay');
const ingameRulesClose = document.getElementById('ingame-rules-close');
const ingameRulesDone = document.getElementById('ingame-rules-done');
const ingameRulesList = document.getElementById('ingame-rules-list');

const RULES_CONFIG = [
  { key: 'sixTakeOut', name: 'Allow 6 to take piece out', desc: 'Rolling 6 can also bring a piece out (in addition to 1)', iconClass: 'rule-icon-green', icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M12 8v8"/><path d="M8 12h8"/></svg>' },
  { key: 'killExtraTurn', name: 'Kill grants extra turn', desc: 'Get another turn when you capture an opponent\'s piece', iconClass: 'rule-icon-red', icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>' },
  { key: 'homeExtraTurn', name: 'Reaching home grants extra turn', desc: 'Get another turn when a piece reaches home', iconClass: 'rule-icon-green', icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>' },
  { key: 'tripleOnesPenalty', name: 'Triple 1\'s penalty', desc: 'Rolling three 1\'s in a row sends your most advanced piece back', iconClass: 'rule-icon-yellow', icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>' },
  { key: 'continueAfterWin', name: 'Continue after winner', desc: 'Game continues for remaining players after someone wins', iconClass: 'rule-icon-purple', icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>' },
];

function openIngameRules() {
  if (!state) return;
  ingameRulesList.innerHTML = '';
  const isHost = state.youAreHost;
  const isLocked = state.started && !state.gameOver;
  const rules = state.rules || {};

  for (const rc of RULES_CONFIG) {
    const label = document.createElement('label');
    label.className = 'rule-item';

    const iconDiv = document.createElement('div');
    iconDiv.className = `rule-icon ${rc.iconClass}`;
    iconDiv.innerHTML = rc.icon;
    label.appendChild(iconDiv);

    const info = document.createElement('div');
    info.className = 'rule-info';
    const nameSpan = document.createElement('span');
    nameSpan.className = 'rule-name';
    nameSpan.textContent = rc.name;
    info.appendChild(nameSpan);
    const descSpan = document.createElement('span');
    descSpan.className = 'rule-desc';
    descSpan.textContent = rc.desc;
    info.appendChild(descSpan);
    label.appendChild(info);

    const toggle = document.createElement('input');
    toggle.type = 'checkbox';
    toggle.className = 'rule-toggle';
    toggle.dataset.rule = rc.key;
    toggle.checked = !!rules[rc.key];
    toggle.disabled = !isHost || isLocked;
    toggle.addEventListener('change', () => {
      saveIngameRulesToServer();
    });
    label.appendChild(toggle);

    const slider = document.createElement('span');
    slider.className = 'toggle-slider';
    label.appendChild(slider);

    ingameRulesList.appendChild(label);
  }

  ingameRulesOverlay.classList.remove('hidden');
}

async function saveIngameRulesToServer() {
  const rules = {};
  ingameRulesList.querySelectorAll('.rule-toggle').forEach(t => {
    rules[t.dataset.rule] = t.checked;
  });
  try {
    await postJson('/api/update-rules', { roomCode, playerId, rules });
  } catch { /* non-host or locked */ }
}

function closeIngameRules() {
  ingameRulesOverlay.classList.add('hidden');
}

gameSettingsBtn.addEventListener('click', openIngameRules);
ingameRulesClose.addEventListener('click', closeIngameRules);
ingameRulesDone.addEventListener('click', closeIngameRules);
ingameRulesOverlay.addEventListener('click', (e) => {
  if (e.target === ingameRulesOverlay) closeIngameRules();
});

// ======== ROOM LOBBY EVENTS ========

// Lobby copy link
lobbyCopyBtn.addEventListener('click', async () => {
  if (!roomCode) return;
  try {
    const url = `${location.origin}?room=${roomCode}`;
    await navigator.clipboard.writeText(url);
    lobbyCopyBtn.classList.add('copied');
    lobbyCopyBtn.innerHTML = lobbyCopyBtn.innerHTML.replace('Copy Link', 'Copied!');
    setTimeout(() => {
      lobbyCopyBtn.classList.remove('copied');
      lobbyCopyBtn.innerHTML = lobbyCopyBtn.innerHTML.replace('Copied!', 'Copy Link');
    }, 2000);
  } catch { /* ignore */ }
});

// Lobby start game
lobbyStartBtn.addEventListener('click', async () => {
  lobbyStartBtn.disabled = true;
  try {
    // Save rules before starting
    await saveRulesToServer();
    await postJson('/api/start-game', { roomCode, playerId });
  } catch (error) {
    lobbyStatus.textContent = error.message;
  } finally {
    lobbyStartBtn.disabled = false;
  }
});

// Lobby leave room
lobbyLeaveBtn.addEventListener('click', exitRoom);

// Share via WhatsApp
shareWhatsapp.addEventListener('click', () => {
  if (!roomCode) return;
  const url = `${location.origin}?room=${roomCode}`;
  const text = `Join my Ludo game! Room code: ${roomCode}\n${url}`;
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
});

// Share via Twitter
shareTwitter.addEventListener('click', () => {
  if (!roomCode) return;
  const url = `${location.origin}?room=${roomCode}`;
  const text = `Join my Ludo game! Room code: ${roomCode}`;
  window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank');
});

// Game rules toggle
gameRulesToggle.addEventListener('click', () => {
  gameRulesPanel.classList.remove('hidden');
  setLobbyMainVisible(false);
});

rulesBackBtn.addEventListener('click', closeRulesPanel);
rulesDoneBtn.addEventListener('click', closeRulesPanel);

function closeRulesPanel() {
  gameRulesPanel.classList.add('hidden');
  setLobbyMainVisible(true);
}

function setLobbyMainVisible(visible) {
  // Toggle visibility of all lobby-content children except rules panel
  if (!lobbyContent) return;
  for (const child of lobbyContent.children) {
    if (child === gameRulesPanel) continue;
    if (child.id === 'game-rules-panel') continue;
    child.style.display = visible ? '' : 'none';
  }
}

// Rule toggles - only host can change
document.querySelectorAll('.rule-toggle').forEach(toggle => {
  toggle.addEventListener('change', () => {
    // Rules will be saved when starting the game
  });
});

async function saveRulesToServer() {
  const rules = {};
  document.querySelectorAll('.rule-toggle').forEach(toggle => {
    rules[toggle.dataset.rule] = toggle.checked;
  });
  try {
    await postJson('/api/update-rules', { roomCode, playerId, rules });
  } catch {
    // Non-host can't update rules; ignore
  }
}

function renderLobby() {
  if (!state) return;

  // Update player count
  lobbyPlayerCount.textContent = state.players.length;
  lobbyHumanCount.textContent = state.players.length;

  // Show/hide start button
  const isHost = state.youAreHost;
  lobbyStartBtn.classList.toggle('hidden', !isHost);
  lobbyStartBtn.disabled = state.players.length < 2;

  // Disable rule toggles for non-host
  document.querySelectorAll('.rule-toggle').forEach(toggle => {
    toggle.disabled = !isHost;
  });

  // Sync rule toggles from state
  if (state.rules) {
    for (const [key, val] of Object.entries(state.rules)) {
      const el = document.querySelector(`.rule-toggle[data-rule="${key}"]`);
      if (el) el.checked = val;
    }
  }

  // Render players
  lobbyPlayersList.innerHTML = '';
  for (const player of state.players) {
    const li = document.createElement('li');
    li.className = 'player-item';

    if (player.id === playerId) {
      li.style.borderColor = 'var(--accent)';
      li.style.background = 'rgba(255,193,7,0.06)';
    }

    const dot = document.createElement('span');
    dot.className = 'color-dot';
    dot.style.background = COLOR_HEX[player.color];
    li.appendChild(dot);

    const info = document.createElement('div');
    info.className = 'player-info';

    const nameRow = document.createElement('div');
    const nameSpan = document.createElement('span');
    nameSpan.className = 'player-name';
    nameSpan.textContent = player.name;
    nameRow.appendChild(nameSpan);

    if (player.id === playerId) {
      const tag = document.createElement('span');
      tag.className = 'player-tag player-tag-you';
      tag.textContent = ' (You)';
      nameRow.appendChild(tag);
    }
    if (player.id === state.hostId) {
      const tag = document.createElement('span');
      tag.className = 'player-tag player-tag-admin';
      tag.textContent = ' (Host)';
      nameRow.appendChild(tag);
    }
    info.appendChild(nameRow);

    const typeSpan = document.createElement('span');
    typeSpan.className = 'player-type';
    typeSpan.textContent = 'Human';
    info.appendChild(typeSpan);

    li.appendChild(info);
    lobbyPlayersList.appendChild(li);
  }
}

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
  roomLobby.classList.add('hidden');
  setupPanel.classList.remove('hidden');
  joinCodeInput.value = '';

  setSetupStatus('You exited the room.');
  setTurnStatus('');
}
function connectToRoom() {
  saveSession();
  setupPanel.classList.add('hidden');
  gamePanel.classList.add('hidden');
  roomLobby.classList.remove('hidden');

  // Show connecting state, hide full lobby
  lobbyConnecting.classList.remove('hidden');
  lobbyContent.classList.add('hidden');
  connectingRoomCode.textContent = roomCode;

  lobbyRoomCode.textContent = roomCode;
  roomCodeLabel.textContent = roomCode;
  // Hide rules panel, show main lobby content
  gameRulesPanel.classList.add('hidden');
  setLobbyMainVisible(true);
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
    const wasStarted = state && state.started;
    handleStateTransitions(state, nextState);
    state = nextState;

    // Transition from connecting state to full lobby
    if (!lobbyConnecting.classList.contains('hidden')) {
      lobbyConnecting.classList.add('hidden');
      lobbyContent.classList.remove('hidden');
    }

    // Switch from lobby to game board when game starts
    if (state.started && !wasStarted) {
      roomLobby.classList.add('hidden');
      gamePanel.classList.remove('hidden');
    }

    // Switch from game board back to lobby when game resets to lobby
    if (!state.started && !state.gameOver && wasStarted) {
      gamePanel.classList.add('hidden');
      roomLobby.classList.remove('hidden');
      lobbyConnecting.classList.add('hidden');
      lobbyContent.classList.remove('hidden');
      setLobbyMainVisible(true);
      gameRulesPanel.classList.add('hidden');
    }

    if (state.started || state.gameOver) {
      render();
    } else {
      renderLobby();
    }
  });

  eventSource.addEventListener('emoji', (event) => {
    const data = JSON.parse(event.data);
    showFloatingEmoji(data.emoji, data.playerName, data.playerColor);
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
  const valEl = diceFace.querySelector('.dice-val');
  if (valEl) {
    valEl.textContent = String(nextValue);
  } else {
    diceFace.textContent = String(nextValue);
  }
  // Also update active card dice on board
  const cardDice = document.querySelector('.pcard-dice-active .pcard-dice-val');
  if (cardDice) {
    cardDice.textContent = String(nextValue);
  }
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
  if (startHint) {
    startHint.classList.toggle('hidden', !(state.youAreHost && !state.started && state.players.length < 2));
  }
  rollBtn.disabled = !canRoll;
  diceWidget.disabled = !canRoll;

  // Dice is now shown in player cards, hide the old floating overlay
  const diceOverlay = document.querySelector('.dice-overlay');
  if (diceOverlay) {
    diceOverlay.style.display = 'none';
  }

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

  renderPlayerBar(byId);
  renderPlayerCards(byId);
  drawBoard(isMyTurn);

  // Auto-move: if it's my turn, exactly 1 valid move, auto-move after a short delay
  if (autoMoveTimer) { clearTimeout(autoMoveTimer); autoMoveTimer = null; }
  if (isMyTurn && state.pendingRoll !== null && Array.isArray(state.validMoves) && state.validMoves.length === 1 && !movingToken && !rollingDice) {
    const tokenIdx = state.validMoves[0];
    autoMoveTimer = setTimeout(() => {
      autoMoveTimer = null;
      if (state && state.turnPlayerId === playerId && state.pendingRoll !== null && Array.isArray(state.validMoves) && state.validMoves.length === 1 && !movingToken) {
        moveToken(tokenIdx);
      }
    }, 600);
  }
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
    li.className = 'player-item';

    const isCurrentTurn = player.id === state.turnPlayerId && state.started && !state.gameOver;
    if (isCurrentTurn) li.classList.add('active-turn');

    const dot = document.createElement('span');
    dot.className = 'color-dot';
    dot.style.background = COLOR_HEX[player.color];
    li.appendChild(dot);

    const info = document.createElement('div');
    info.className = 'player-info';

    const nameRow = document.createElement('div');
    const nameSpan = document.createElement('span');
    nameSpan.className = 'player-name';
    nameSpan.textContent = player.name;
    nameRow.appendChild(nameSpan);

    if (player.id === playerId) {
      const tag = document.createElement('span');
      tag.className = 'player-tag player-tag-you';
      tag.textContent = ' (You)';
      nameRow.appendChild(tag);
    }
    if (player.id === state.hostId) {
      const tag = document.createElement('span');
      tag.className = 'player-tag player-tag-admin';
      tag.textContent = ' (Admin)';
      nameRow.appendChild(tag);
    }

    info.appendChild(nameRow);

    const meta = document.createElement('div');
    meta.className = 'player-meta';
    const pieces = state.pieces && state.pieces[player.color] ? state.pieces[player.color] : [];
    const homeCount = pieces.filter(p => p === 57).length;
    meta.textContent = `${homeCount}/4 home`;
    if (player.finished) meta.textContent += ' \u2714';
    info.appendChild(meta);

    li.appendChild(info);

    // Progress percentage
    const progress = document.createElement('span');
    progress.className = 'player-progress';
    const totalProgress = pieces.reduce((sum, p) => sum + Math.max(0, p + 1), 0);
    const pct = Math.round((totalProgress / (58 * 4)) * 100);
    progress.textContent = pct + '%';
    li.appendChild(progress);

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

function renderPlayerBar(byId) {
  const playerBarInfo = document.getElementById('player-bar-info');
  const barDiceFace = document.getElementById('bar-dice-face');
  if (!playerBarInfo) return;

  const me = byId.get(playerId);
  if (!me) {
    playerBarInfo.innerHTML = '';
    return;
  }

  const pieces = state.pieces && state.pieces[me.color] ? state.pieces[me.color] : [];
  const homeCount = pieces.filter(p => p === 57).length;

  playerBarInfo.innerHTML = '';
  playerBarInfo.style.borderColor = COLOR_HEX[me.color];

  const dot = document.createElement('span');
  dot.className = 'bar-color-dot';
  dot.style.background = COLOR_HEX[me.color];
  playerBarInfo.appendChild(dot);

  const nameEl = document.createElement('span');
  nameEl.className = 'bar-name';
  nameEl.textContent = me.name;
  playerBarInfo.appendChild(nameEl);

  const stats = document.createElement('span');
  stats.className = 'bar-stats';
  stats.textContent = `${homeCount}/4 home`;
  playerBarInfo.appendChild(stats);

  if (barDiceFace && state.pendingRoll !== null) {
    barDiceFace.querySelector('.bar-dice-dot').textContent = state.pendingRoll;
  }
}

// Position mapping: each color's card position on the board
const CARD_POSITIONS = {
  red: 'top-left',
  green: 'top-right',
  yellow: 'bottom-left',
  blue: 'bottom-right',
};

// Track last dice value per player for display
const lastDiceByColor = {};

// Event delegation: clicking on an active card dice triggers roll
document.getElementById('board-player-cards').addEventListener('click', (e) => {
  const diceEl = e.target.closest('.pcard-dice-active');
  if (diceEl) {
    triggerRoll();
  }
});

function renderPlayerCards(byId) {
  const container = document.getElementById('board-player-cards');
  if (!container || !state) return;

  container.innerHTML = '';

  // Track dice rolls per player
  if (state.pendingRoll !== null && state.turnPlayerId) {
    const turnPlayer = byId.get(state.turnPlayerId);
    if (turnPlayer) {
      lastDiceByColor[turnPlayer.color] = state.pendingRoll;
    }
  }

  for (const player of state.players) {
    const pos = CARD_POSITIONS[player.color] || 'top-left';
    const pieces = state.pieces && state.pieces[player.color] ? state.pieces[player.color] : [];
    const homeCount = pieces.filter(p => p === 57).length;
    const totalProgress = pieces.reduce((sum, p) => sum + Math.max(0, p + 1), 0);
    const pct = Math.round((totalProgress / (58 * 4)) * 100);
    const isTurn = player.id === state.turnPlayerId && state.started && !state.gameOver;
    const isMe = player.id === playerId;
    const isMyActiveTurn = isTurn && isMe;

    const card = document.createElement('div');
    card.className = `board-pcard board-pcard--${pos}`;
    if (isTurn) card.classList.add('active-turn-card');

    // Color pawn circle
    const pawn = document.createElement('div');
    pawn.className = 'pcard-pawn';
    pawn.style.background = COLOR_HEX[player.color];
    card.appendChild(pawn);

    // Info column
    const info = document.createElement('div');
    info.className = 'pcard-info';

    const nameEl = document.createElement('span');
    nameEl.className = 'pcard-name';
    nameEl.textContent = player.name;
    info.appendChild(nameEl);

    const statsEl = document.createElement('span');
    statsEl.className = 'pcard-stats';
    statsEl.textContent = `${homeCount}/4 | ${pct}%`;
    info.appendChild(statsEl);

    card.appendChild(info);

    // Dice face
    const dice = document.createElement('div');
    dice.className = 'pcard-dice';
    dice.style.background = COLOR_HEX[player.color];

    // Active dice: when it's my turn, make interactive
    if (isMyActiveTurn) {
      dice.classList.add('pcard-dice-active');
      if (rollingDice) {
        dice.classList.add('pcard-dice-rolling');
      }
    }

    const diceVal = document.createElement('span');
    diceVal.className = 'pcard-dice-val';
    if (isMyActiveTurn && rollingDice) {
      diceVal.textContent = '?';
    } else {
      diceVal.textContent = lastDiceByColor[player.color] || '-';
    }
    dice.appendChild(diceVal);

    card.appendChild(dice);
    container.appendChild(card);
  }
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
      const animCoord = getAnimatedPosition(player.color, tokenIndex);
      const coord = animCoord || getTokenCoord(player.color, tokenIndex, progress, boardGeometry);
      rawTokens.push({
        playerId: player.id,
        color: player.color,
        tokenIndex,
        progress,
        coord,
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

  // Board background - parchment
  ctx.fillStyle = '#e8d5a8';
  ctx.fillRect(offsetX, offsetY, boardSize, boardSize);

  // Subtle grain texture
  ctx.save();
  ctx.globalAlpha = 0.03;
  ctx.fillStyle = '#6b4510';
  for (let i = 0; i < 120; i++) {
    ctx.fillRect(
      offsetX + Math.random() * boardSize,
      offsetY + Math.random() * boardSize,
      1 + Math.random() * 2,
      1 + Math.random() * 2
    );
  }
  ctx.restore();

  // Four colored quadrants (6x6 blocks)
  for (const [color, [gx, gy]] of Object.entries(HOME_BLOCKS)) {
    const x = offsetX + gx * cell;
    const y = offsetY + gy * cell;
    ctx.fillStyle = BOARD_COLORS[color].bg;
    ctx.fillRect(x, y, cell * 6, cell * 6);
  }

  // Cross pathway (cream fill over colored quadrants)
  ctx.fillStyle = '#ede0c0';
  ctx.fillRect(offsetX + 6 * cell, offsetY, cell * 3, boardSize);
  ctx.fillRect(offsetX, offsetY + 6 * cell, boardSize, cell * 3);

  // Individual track cells
  for (let i = 0; i < TRACK_CELLS.length; i++) {
    const [x, y] = TRACK_CELLS[i];
    drawCell(geometry, x, y, '#f2e6cc');
  }

  // Home lane cells (colored strips leading to center)
  for (const [color, cells] of Object.entries(HOME_LANE_CELLS)) {
    for (let i = 0; i < cells.length - 1; i++) {
      const [x, y] = cells[i];
      // Last cell before center (index cells.length-2) is white
      const fillColor = (i === cells.length - 2) ? '#f2e6cc' : BOARD_COLORS[color].bg;
      drawCell(geometry, x, y, fillColor);
    }
  }

  // Center colored triangles
  drawCenterMotif(geometry);

  // Rounded home bases inside each quadrant
  for (const color of ['red', 'green', 'yellow', 'blue']) {
    drawHomeBase(geometry, color);
  }

  // Grid lines
  ctx.strokeStyle = 'rgba(80, 55, 20, 0.25)';
  ctx.lineWidth = 0.8;
  for (let i = 0; i <= 15; i++) {
    const px = offsetX + i * cell;
    ctx.beginPath();
    ctx.moveTo(px, offsetY);
    ctx.lineTo(px, offsetY + boardSize);
    ctx.stroke();
    const py = offsetY + i * cell;
    ctx.beginPath();
    ctx.moveTo(offsetX, py);
    ctx.lineTo(offsetX + boardSize, py);
    ctx.stroke();
  }

  // Thicker quadrant borders
  ctx.strokeStyle = 'rgba(60, 40, 10, 0.45)';
  ctx.lineWidth = 1.5;
  for (const [, [gx, gy]] of Object.entries(HOME_BLOCKS)) {
    ctx.strokeRect(offsetX + gx * cell, offsetY + gy * cell, cell * 6, cell * 6);
  }

  // Safe cell stars
  for (const safeIndex of SAFE_CELLS) {
    const pt = geometry.track[safeIndex];
    let starColor = '#c0a040';
    for (const [clr, si] of Object.entries(START_INDEX)) {
      if (safeIndex === si) { starColor = BOARD_COLORS[clr].dark; break; }
    }
    drawStar(pt.x, pt.y, cell * 0.22, starColor);
  }

  // Start position rings
  for (const [color, startIndex] of Object.entries(START_INDEX)) {
    const pt = geometry.track[startIndex];
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, cell * 0.3, 0, Math.PI * 2);
    ctx.strokeStyle = BOARD_COLORS[color].dark;
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }

  // Yard nests
  for (const [color, pts] of Object.entries(geometry.yards)) {
    for (const pt of pts) {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, cell * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = BOARD_COLORS[color].nest;
      ctx.fill();
      ctx.strokeStyle = BOARD_COLORS[color].dark;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, cell * 0.16, 0, Math.PI * 2);
      ctx.fillStyle = BOARD_COLORS[color].light;
      ctx.fill();
    }
  }

  // Board outer border
  ctx.strokeStyle = '#4a3220';
  ctx.lineWidth = 3;
  ctx.strokeRect(offsetX, offsetY, boardSize, boardSize);
}

function drawHomeBase(geometry, color) {
  const { cell, offsetX, offsetY } = geometry;
  const [gx, gy] = HOME_BLOCKS[color];

  const x = offsetX + (gx + 0.6) * cell;
  const y = offsetY + (gy + 0.6) * cell;
  const w = cell * 4.8;
  const h = cell * 4.8;
  const r = cell * 0.55;

  // Dark base
  roundedRect(x, y, w, h, r);
  ctx.fillStyle = BOARD_COLORS[color].dark;
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Inner lighter area
  const pad = cell * 0.2;
  roundedRect(x + pad, y + pad, w - pad * 2, h - pad * 2, r * 0.5);
  ctx.fillStyle = BOARD_COLORS[color].bg;
  ctx.fill();
}

function drawCenterMotif(geometry) {
  const { cell, offsetX, offsetY } = geometry;
  const cx = offsetX + 7.5 * cell;
  const cy = offsetY + 7.5 * cell;
  const left = offsetX + 6 * cell;
  const top = offsetY + 6 * cell;
  const right = offsetX + 9 * cell;
  const bottom = offsetY + 9 * cell;

  // Red triangle - top (red home lane enters from top)
  ctx.beginPath();
  ctx.moveTo(left, top);
  ctx.lineTo(right, top);
  ctx.lineTo(cx, cy);
  ctx.closePath();
  ctx.fillStyle = BOARD_COLORS.red.bg;
  ctx.fill();

  // Green triangle - right (green home lane enters from right)
  ctx.beginPath();
  ctx.moveTo(right, top);
  ctx.lineTo(right, bottom);
  ctx.lineTo(cx, cy);
  ctx.closePath();
  ctx.fillStyle = BOARD_COLORS.green.bg;
  ctx.fill();

  // Blue triangle - bottom (blue home lane enters from bottom)
  ctx.beginPath();
  ctx.moveTo(right, bottom);
  ctx.lineTo(left, bottom);
  ctx.lineTo(cx, cy);
  ctx.closePath();
  ctx.fillStyle = BOARD_COLORS.blue.bg;
  ctx.fill();

  // Yellow triangle - left (yellow home lane enters from left)
  ctx.beginPath();
  ctx.moveTo(left, bottom);
  ctx.lineTo(left, top);
  ctx.lineTo(cx, cy);
  ctx.closePath();
  ctx.fillStyle = BOARD_COLORS.yellow.bg;
  ctx.fill();

  // Triangle divider lines
  ctx.strokeStyle = 'rgba(60, 40, 10, 0.4)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(left, top); ctx.lineTo(cx, cy);
  ctx.moveTo(right, top); ctx.lineTo(cx, cy);
  ctx.moveTo(right, bottom); ctx.lineTo(cx, cy);
  ctx.moveTo(left, bottom); ctx.lineTo(cx, cy);
  ctx.stroke();

  // Center border
  ctx.strokeStyle = 'rgba(60, 40, 10, 0.5)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(left, top, right - left, bottom - top);
}

function roundedRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawStar(cx, cy, r, color) {
  const innerR = r * 0.4;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const angle = -Math.PI / 2 + (i * Math.PI / 5);
    const rad = i % 2 === 0 ? r : innerR;
    const px = cx + Math.cos(angle) * rad;
    const py = cy + Math.sin(angle) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.15)';
  ctx.lineWidth = 0.7;
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
  const r = 15;

  // Movable pulse glow
  if (movable) {
    const pulse = 0.7 + 0.3 * Math.sin(Date.now() / 180);
    ctx.beginPath();
    ctx.arc(x, y, r + 4 + pulse * 3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 215, 0, 0.35)';
    ctx.fill();
  }

  // Shadow
  ctx.beginPath();
  ctx.arc(x + 1.5, y + 2.5, r, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.fill();

  // Outer ring
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = BOARD_COLORS[color].dark;
  ctx.fill();

  // Main body
  ctx.beginPath();
  ctx.arc(x, y, r - 2.5, 0, Math.PI * 2);
  ctx.fillStyle = BOARD_COLORS[color].bg;
  ctx.fill();

  // Inner highlight ring
  ctx.beginPath();
  ctx.arc(x, y, r - 6, 0, Math.PI * 2);
  ctx.fillStyle = BOARD_COLORS[color].light;
  ctx.fill();

  // Center dot
  ctx.beginPath();
  ctx.arc(x, y, r - 9, 0, Math.PI * 2);
  ctx.fillStyle = BOARD_COLORS[color].dark;
  ctx.fill();

  // 3D highlight spec
  ctx.beginPath();
  ctx.arc(x - 3.5, y - 4, 3, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.fill();

  // Movable white border
  if (movable) {
    ctx.beginPath();
    ctx.arc(x, y, r + 1.5, 0, Math.PI * 2);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }
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

// ======== PIECE MOVEMENT ANIMATION ========

function detectAndAnimatePieces(prevState, nextState) {
  if (!prevState || !prevState.pieces || !nextState || !nextState.pieces) return;

  let hasNew = false;
  for (const color of ['red', 'green', 'yellow', 'blue']) {
    const prev = prevState.pieces[color] || [];
    const next = nextState.pieces[color] || [];
    for (let i = 0; i < 4; i++) {
      if (prev[i] === undefined || next[i] === undefined || prev[i] === next[i]) continue;
      const key = `${color}_${i}`;
      const path = buildMovePath(color, i, prev[i], next[i]);
      if (path.length > 1) {
        pieceAnimations.set(key, {
          path,
          startTime: performance.now(),
          stepMs: 110,
        });
        hasNew = true;
      }
    }
  }

  if (hasNew && !animFrameId) {
    animFrameId = requestAnimationFrame(animLoop);
  }
}

function buildMovePath(color, tokenIndex, fromP, toP) {
  const path = [];

  if (fromP === -1) {
    // Out of yard onto track
    path.push(boardGeometry.yards[color][tokenIndex]);
    for (let p = 0; p <= toP; p++) {
      path.push(getTokenCoord(color, tokenIndex, p, boardGeometry));
    }
    return path;
  }

  if (toP === -1) {
    // Captured - sent back to yard
    path.push(getTokenCoord(color, tokenIndex, fromP, boardGeometry));
    path.push(boardGeometry.yards[color][tokenIndex]);
    return path;
  }

  if (toP >= fromP) {
    // Forward movement along track / home lane
    for (let p = fromP; p <= toP; p++) {
      path.push(getTokenCoord(color, tokenIndex, p, boardGeometry));
    }
  } else {
    // Backward (penalty) - direct move
    path.push(getTokenCoord(color, tokenIndex, fromP, boardGeometry));
    path.push(getTokenCoord(color, tokenIndex, toP, boardGeometry));
  }

  return path;
}

function getAnimatedPosition(color, tokenIndex) {
  const key = `${color}_${tokenIndex}`;
  const anim = pieceAnimations.get(key);
  if (!anim) return null;

  const elapsed = performance.now() - anim.startTime;
  const totalSteps = anim.path.length - 1;
  const stepFloat = elapsed / anim.stepMs;

  if (stepFloat >= totalSteps) {
    pieceAnimations.delete(key);
    return null;
  }

  const step = Math.floor(stepFloat);
  const t = stepFloat - step;
  const easedT = 1 - Math.pow(1 - t, 2.5);

  const from = anim.path[step];
  const to = anim.path[Math.min(step + 1, anim.path.length - 1)];

  return {
    x: from.x + (to.x - from.x) * easedT,
    y: from.y + (to.y - from.y) * easedT,
  };
}

function animLoop() {
  animFrameId = null;
  if (pieceAnimations.size === 0) return;

  if (state) {
    const isMyTurn = state.turnPlayerId === playerId;
    drawBoard(isMyTurn);
  }

  if (pieceAnimations.size > 0) {
    animFrameId = requestAnimationFrame(animLoop);
  }
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
    detectAndAnimatePieces(previous, next);
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
  if (!audioCtx || soundMuted) return;

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

function showFloatingEmoji(emoji, playerName, playerColor) {
  if (!emojiFloatContainer) return;

  const el = document.createElement('div');
  el.className = 'emoji-float';

  const emojiSpan = document.createElement('span');
  emojiSpan.className = 'emoji-float-icon';
  emojiSpan.textContent = emoji;

  const nameSpan = document.createElement('span');
  nameSpan.className = 'emoji-float-name';
  nameSpan.textContent = playerName;
  nameSpan.style.color = COLOR_HEX[playerColor] || '#fff';

  el.appendChild(emojiSpan);
  el.appendChild(nameSpan);

  // Random horizontal position
  el.style.left = (15 + Math.random() * 70) + '%';

  emojiFloatContainer.appendChild(el);

  // Remove after animation
  setTimeout(() => {
    if (el.parentNode) el.parentNode.removeChild(el);
  }, 2500);
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

    // If game already started, switch directly to game panel
    if (state.started || state.gameOver) {
      lobbyConnecting.classList.add('hidden');
      lobbyContent.classList.remove('hidden');
      roomLobby.classList.add('hidden');
      gamePanel.classList.remove('hidden');
      render();
    } else {
      // Skip connecting state since we already have data
      lobbyConnecting.classList.add('hidden');
      lobbyContent.classList.remove('hidden');
      renderLobby();
    }
  } catch {
    localStorage.removeItem(SESSION_KEY);
  }
}

restoreSession();

// Auto-fill room code from URL param
(function() {
  const params = new URLSearchParams(window.location.search);
  const room = params.get('room');
  if (room && !roomCode) {
    joinCodeInput.value = room.toUpperCase();
  }
})();

