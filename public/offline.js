// ======== LUDO OFFLINE - LOCAL MULTIPLAYER ========

const START_INDEX = { red: 0, green: 39, yellow: 13, blue: 26 };
const SAFE_CELLS = new Set([0, 8, 13, 21, 26, 34, 39, 47]);
const COLOR_HEX = { red: '#c62828', green: '#2f8f4e', yellow: '#d99a1b', blue: '#1f52c2' };
const BOARD_COLORS = {
  red:    { bg: '#cc3333', dark: '#a02828', light: '#e06858', nest: '#f2b0a0' },
  green:  { bg: '#2d8a3e', dark: '#1e6e2e', light: '#58b868', nest: '#a8d8b0' },
  yellow: { bg: '#d4a020', dark: '#a87818', light: '#e8c450', nest: '#f0dca0' },
  blue:   { bg: '#2868a8', dark: '#1a5088', light: '#5890c8', nest: '#a0c0e0' },
};
const COLORS = ['red', 'green', 'yellow', 'blue'];
const PLAYER_NAMES = { red: 'Red', green: 'Green', yellow: 'Yellow', blue: 'Blue' };
const TRACK_CELLS = [
  [6,1],[6,2],[6,3],[6,4],[6,5],
  [5,6],[4,6],[3,6],[2,6],[1,6],[0,6],
  [0,7],[0,8],
  [1,8],[2,8],[3,8],[4,8],[5,8],
  [6,9],[6,10],[6,11],[6,12],[6,13],[6,14],
  [7,14],[8,14],
  [8,13],[8,12],[8,11],[8,10],[8,9],
  [9,8],[10,8],[11,8],[12,8],[13,8],[14,8],
  [14,7],[14,6],
  [13,6],[12,6],[11,6],[10,6],[9,6],
  [8,5],[8,4],[8,3],[8,2],[8,1],[8,0],
  [7,0],[6,0],
];
const YARD_CELLS = {
  red: [[2,2],[4,2],[2,4],[4,4]],
  green: [[10,2],[12,2],[10,4],[12,4]],
  yellow: [[2,10],[4,10],[2,12],[4,12]],
  blue: [[10,10],[12,10],[10,12],[12,12]],
};
const HOME_LANE_CELLS = {
  red: [[7,2],[7,3],[7,4],[7,5],[7,6],[7,7]],
  green: [[12,7],[11,7],[10,7],[9,7],[8,7],[7,7]],
  yellow: [[2,7],[3,7],[4,7],[5,7],[6,7],[7,7]],
  blue: [[7,12],[7,11],[7,10],[7,9],[7,8],[7,7]],
};
const HOME_BLOCKS = { red: [0,0], green: [9,0], yellow: [0,9], blue: [9,9] };
const EXIT_STRIPS = {
  red:    [[6,1],[6,2],[6,3],[6,4],[6,5]],
  yellow: [[1,8],[2,8],[3,8],[4,8],[5,8]],
  green:  [[9,6],[10,6],[11,6],[12,6],[13,6]],
  blue:   [[8,9],[8,10],[8,11],[8,12],[8,13]],
};
const CARD_POSITIONS = { red: 'top-left', green: 'top-right', yellow: 'bottom-left', blue: 'bottom-right' };

// DOM
const selectPanel = document.getElementById('select-panel');
const gamePanel = document.getElementById('game-panel');
const turnStatus = document.getElementById('turn-status');
const boardTip = document.getElementById('board-tip');
const playersList = document.getElementById('players-list');
const winnersList = document.getElementById('winners-list');
const logList = document.getElementById('log-list');
const boardCanvas = document.getElementById('board');
const ctx = boardCanvas.getContext('2d');
const soundBtn = document.getElementById('sound-btn');
const exitBtn = document.getElementById('exit-btn');
const restartBtn = document.getElementById('restart-btn');
const settingsBtn = document.getElementById('game-settings-btn');
const rulesOverlay = document.getElementById('ingame-rules-overlay');
const rulesClose = document.getElementById('ingame-rules-close');
const rulesDone = document.getElementById('ingame-rules-done');
const rulesList = document.getElementById('ingame-rules-list');

// State
let game = null;
let rollingDice = false;
let renderedTokens = [];
let diceTimer = null;
let audioCtx = null;
let soundMuted = false;
let pieceAnimations = new Map();
let animFrameId = null;
let autoMoveTimer = null;
const lastDiceByColor = {};

const boardGeometry = buildBoardGeometry(boardCanvas.width, boardCanvas.height);

// ======== PLAYER SELECT ========
document.querySelectorAll('.btn-player-count').forEach(btn => {
  btn.addEventListener('click', () => {
    const count = parseInt(btn.dataset.count, 10);
    startGame(count);
  });
});

function startGame(playerCount) {
  const activeColors = COLORS.slice(0, playerCount);
  game = {
    players: activeColors.map(color => ({
      color,
      name: PLAYER_NAMES[color],
      finished: false,
    })),
    started: true,
    gameOver: false,
    turnIndex: 0,
    pendingRoll: null,
    validMoves: [],
    consecutiveSixes: 0,
    consecutiveOnes: 0,
    pieces: {
      red: [-1,-1,-1,-1],
      green: [-1,-1,-1,-1],
      yellow: [-1,-1,-1,-1],
      blue: [-1,-1,-1,-1],
    },
    winners: [],
    log: [],
    rules: {
      sixTakeOut: false,
      killExtraTurn: false,
      homeExtraTurn: false,
      tripleOnesPenalty: false,
      continueAfterWin: false,
    },
  };
  // Clear dice history
  for (const c of COLORS) delete lastDiceByColor[c];
  addLog(`Game started with ${playerCount} players!`);
  addLog(`Turn: ${currentPlayer().name}`);

  selectPanel.classList.add('hidden');
  gamePanel.classList.remove('hidden');
  render();
}

// ======== GAME LOGIC (client-side) ========
function currentPlayer() {
  if (!game || !game.started || game.gameOver) return null;
  normalizeTurn();
  return game.players[game.turnIndex] || null;
}

function normalizeTurn() {
  if (!game.started || game.gameOver || game.players.length === 0) return;
  let guard = 0;
  while (guard < game.players.length && isFinished(game.players[game.turnIndex].color)) {
    game.turnIndex = (game.turnIndex + 1) % game.players.length;
    guard += 1;
  }
}

function nextTurn() {
  if (!game.started || game.gameOver) return;
  game.turnIndex = (game.turnIndex + 1) % game.players.length;
  normalizeTurn();
}

function isFinished(color) {
  const pieces = game.pieces[color] || [];
  return pieces.length === 4 && pieces.every(v => v === 57);
}

function progressToTrack(color, progress) {
  return (START_INDEX[color] + progress) % 52;
}

function calculateNextProgress(current, dice) {
  if (current === 57) return null;
  if (current === -1) {
    if (dice === 1) return 0;
    if (dice === 6 && game.rules.sixTakeOut) return 0;
    return null;
  }
  const next = current + dice;
  if (next > 57) return null;
  return next;
}

function countPiecesAtTrackIndex(color, trackIndex) {
  const pieces = game.pieces[color] || [];
  let count = 0;
  for (const p of pieces) {
    if (p < 0 || p > 51) continue;
    if (progressToTrack(color, p) === trackIndex) count++;
  }
  return count;
}

function isOpponentBlockAt(moverColor, trackIndex) {
  for (const pl of game.players) {
    if (pl.color === moverColor) continue;
    if (countPiecesAtTrackIndex(pl.color, trackIndex) >= 2) return true;
  }
  return false;
}

function isMoveBlocked(moverColor, currentProgress, nextProgress, dice) {
  if (nextProgress === null) return true;
  if (currentProgress === -1) {
    return isOpponentBlockAt(moverColor, progressToTrack(moverColor, 0));
  }
  for (let step = 1; step <= dice; step++) {
    const sp = currentProgress + step;
    if (sp > 51) break;
    if (isOpponentBlockAt(moverColor, progressToTrack(moverColor, sp))) return true;
  }
  return false;
}

function isLegalMove(color, currentProgress, dice) {
  const np = calculateNextProgress(currentProgress, dice);
  if (np === null) return false;
  if (currentProgress >= 52) return true;
  return !isMoveBlocked(color, currentProgress, np, dice);
}

function validMovesFor(color, dice) {
  const pieces = game.pieces[color] || [];
  const moves = [];
  for (let i = 0; i < pieces.length; i++) {
    if (isLegalMove(color, pieces[i], dice)) moves.push(i);
  }
  return moves;
}

function maybeCapture(moverColor, landingProgress) {
  if (landingProgress < 0 || landingProgress > 51) return 0;
  const landingTrack = progressToTrack(moverColor, landingProgress);
  if (SAFE_CELLS.has(landingTrack)) return 0;
  let captured = 0;
  for (const pl of game.players) {
    if (pl.color === moverColor) continue;
    if (countPiecesAtTrackIndex(pl.color, landingTrack) >= 2) continue;
    const ep = game.pieces[pl.color];
    for (let i = 0; i < ep.length; i++) {
      if (ep[i] < 0 || ep[i] > 51) continue;
      if (progressToTrack(pl.color, ep[i]) === landingTrack) {
        ep[i] = -1;
        captured++;
      }
    }
  }
  return captured;
}

function maybeFinishPlayer(player) {
  if (!isFinished(player.color)) return false;
  if (game.winners.includes(player.color)) return false;
  game.winners.push(player.color);
  player.finished = true;
  addLog(`${player.name} reached home with all tokens!`);
  return true;
}

function maybeEndGame() {
  if (game.gameOver) return;
  const threshold = game.rules.continueAfterWin ? game.players.length : game.players.length - 1;
  if (game.winners.length >= threshold) {
    for (const pl of game.players) {
      if (!game.winners.includes(pl.color)) game.winners.push(pl.color);
    }
    game.gameOver = true;
    game.started = false;
    game.pendingRoll = null;
    game.validMoves = [];
    addLog('Game over! Final ranking is shown in the winners list.');
    playWinSound();
  }
}

function doRoll() {
  if (!game || !game.started || game.gameOver) return;
  const player = currentPlayer();
  if (!player) return;
  if (game.pendingRoll !== null) return;

  const prevPieces = deepCopyPieces();
  const dice = Math.floor(Math.random() * 6) + 1;
  const moves = validMovesFor(player.color, dice);

  game.pendingRoll = dice;
  game.validMoves = moves;
  lastDiceByColor[player.color] = dice;

  if (dice === 6) game.consecutiveSixes++;
  else game.consecutiveSixes = 0;
  if (dice === 1) game.consecutiveOnes++;
  else game.consecutiveOnes = 0;

  addLog(`${player.name} rolled a ${dice}.`);

  if (game.consecutiveSixes >= 3) {
    addLog(`${player.name} rolled three consecutive sixes. Turn skipped.`);
    game.pendingRoll = null;
    game.validMoves = [];
    game.consecutiveSixes = 0;
    game.consecutiveOnes = 0;
    nextTurn();
    const np = currentPlayer();
    if (np) addLog(`Turn: ${np.name}`);
    render();
    return;
  }

  if (moves.length === 0) {
    addLog(`${player.name} has no legal move.`);
    game.pendingRoll = null;
    game.validMoves = [];
    game.consecutiveSixes = 0;
    game.consecutiveOnes = 0;
    nextTurn();
    const np = currentPlayer();
    if (np) addLog(`Turn: ${np.name}`);
  }

  render();

  // Auto-move if only 1 valid move
  if (game.pendingRoll !== null && game.validMoves.length === 1) {
    if (autoMoveTimer) clearTimeout(autoMoveTimer);
    const ti = game.validMoves[0];
    autoMoveTimer = setTimeout(() => {
      autoMoveTimer = null;
      if (game && game.pendingRoll !== null && game.validMoves.length === 1) {
        doMove(ti);
      }
    }, 600);
  }
}

function doMove(tokenIndex) {
  if (!game || !game.started || game.gameOver) return;
  const player = currentPlayer();
  if (!player) return;
  if (game.pendingRoll === null) return;
  if (!game.validMoves.includes(tokenIndex)) return;

  const dice = game.pendingRoll;
  const color = player.color;
  const currentProgress = game.pieces[color][tokenIndex];

  if (!isLegalMove(color, currentProgress, dice)) return;

  const prevPieces = deepCopyPieces();
  const nextProgress = calculateNextProgress(currentProgress, dice);
  game.pieces[color][tokenIndex] = nextProgress;

  // Triple ones penalty
  if (game.rules.tripleOnesPenalty && dice === 1 && game.consecutiveOnes >= 3) {
    game.pieces[color][tokenIndex] = -1;
    addLog(`${player.name} rolled 1 for the third consecutive turn. Token returned home.`);
    game.pendingRoll = null;
    game.validMoves = [];
    game.consecutiveSixes = 0;
    game.consecutiveOnes = 0;
    nextTurn();
    const np = currentPlayer();
    if (np) addLog(`Turn: ${np.name}`);
    detectAndAnimatePieces(prevPieces, game.pieces);
    playMoveSound();
    render();
    return;
  }

  const captured = maybeCapture(color, nextProgress);
  if (captured > 0) {
    addLog(`${player.name} captured ${captured} token${captured > 1 ? 's' : ''}.`);
    playCaptureSound();
  } else {
    playMoveSound();
  }

  const reachedHome = nextProgress === 57;
  if (reachedHome) addLog(`${player.name} moved token ${tokenIndex + 1} into home.`);

  maybeFinishPlayer(player);
  maybeEndGame();

  game.pendingRoll = null;
  game.validMoves = [];

  if (!game.gameOver) {
    const getsExtra =
      ((dice === 6 || dice === 1) && !isFinished(player.color)) ||
      (captured > 0 && game.rules.killExtraTurn) ||
      (reachedHome && game.rules.homeExtraTurn);

    if (getsExtra) {
      addLog(`${player.name} gets another turn.`);
    } else {
      game.consecutiveSixes = 0;
      game.consecutiveOnes = 0;
      nextTurn();
      const np = currentPlayer();
      if (np) addLog(`Turn: ${np.name}`);
    }
  }

  detectAndAnimatePieces(prevPieces, game.pieces);
  render();
}

function deepCopyPieces() {
  const copy = {};
  for (const c of COLORS) copy[c] = [...(game.pieces[c] || [])];
  return copy;
}

function addLog(msg) {
  if (!game) return;
  game.log.push(msg);
  if (game.log.length > 200) game.log = game.log.slice(-200);
}

// ======== ROLLING ANIMATION ========
function triggerRoll() {
  if (!game || !game.started || game.gameOver || rollingDice) return;
  if (game.pendingRoll !== null) return;

  rollingDice = true;
  unlockAudio();
  playRollStartSound();
  render();

  let elapsed = 0;
  const tick = () => {
    const fakeVal = 1 + Math.floor(Math.random() * 6);
    updateCardDiceVal(fakeVal);
    elapsed += 95;
    if (elapsed >= 900) {
      rollingDice = false;
      doRoll();
      return;
    }
    diceTimer = setTimeout(tick, 95);
  };
  tick();
}

function updateCardDiceVal(val) {
  const el = document.querySelector('.pcard-dice-active .pcard-dice-val');
  if (el) el.textContent = String(val);
}

// ======== BOARD CLICK → MOVE TOKEN ========
boardCanvas.addEventListener('pointerdown', (event) => {
  if (!game || !game.started || game.gameOver) return;
  if (game.pendingRoll === null) return;
  if (game.validMoves.length === 0) return;

  const rect = boardCanvas.getBoundingClientRect();
  const scaleX = boardCanvas.width / rect.width;
  const scaleY = boardCanvas.height / rect.height;
  const px = (event.clientX - rect.left) * scaleX;
  const py = (event.clientY - rect.top) * scaleY;

  const cp = currentPlayer();
  if (!cp) return;

  const movable = renderedTokens.filter(t => t.color === cp.color && t.movable);
  let nearest = null, nearDist = Infinity;
  for (const t of movable) {
    const d = Math.sqrt((px - t.x) ** 2 + (py - t.y) ** 2);
    if (d <= 22 && d < nearDist) { nearest = t; nearDist = d; }
  }
  if (nearest) doMove(nearest.tokenIndex);
});

// ======== CARD DICE CLICK ========
document.getElementById('board-player-cards').addEventListener('click', (e) => {
  if (e.target.closest('.pcard-dice-active')) triggerRoll();
});

// ======== RENDER ========
function render() {
  if (!game) return;

  const cp = currentPlayer();

  // Turn status
  if (game.gameOver) {
    const names = game.winners.map(c => PLAYER_NAMES[c]);
    turnStatus.textContent = `Game over! Ranking: ${names.join(' > ')}`;
  } else if (cp) {
    if (game.pendingRoll === null) {
      turnStatus.textContent = `${cp.name}'s turn — tap dice to roll`;
    } else {
      turnStatus.textContent = `${cp.name} rolled ${game.pendingRoll}. Tap a highlighted token.`;
    }
  }

  boardTip.textContent = game.started ? 'Tap highlighted tokens to move.' : '';

  renderPlayers();
  renderWinners();
  renderLog();
  renderPlayerCards();
  drawBoard();
}

function renderPlayers() {
  playersList.innerHTML = '';
  for (const pl of game.players) {
    const li = document.createElement('li');
    li.className = 'player-item';
    const isTurn = currentPlayer() && currentPlayer().color === pl.color && game.started && !game.gameOver;
    if (isTurn) li.classList.add('active-turn');

    const dot = document.createElement('span');
    dot.className = 'color-dot';
    dot.style.background = COLOR_HEX[pl.color];
    li.appendChild(dot);

    const info = document.createElement('div');
    info.className = 'player-info';

    const nameRow = document.createElement('div');
    const nameSpan = document.createElement('span');
    nameSpan.className = 'player-name';
    nameSpan.textContent = pl.name;
    nameRow.appendChild(nameSpan);
    info.appendChild(nameRow);

    const meta = document.createElement('div');
    meta.className = 'player-meta';
    const pieces = game.pieces[pl.color] || [];
    const homeCount = pieces.filter(p => p === 57).length;
    meta.textContent = `${homeCount}/4 home`;
    if (pl.finished) meta.textContent += ' ✔';
    info.appendChild(meta);

    li.appendChild(info);

    const progress = document.createElement('span');
    progress.className = 'player-progress';
    const total = pieces.reduce((s, p) => s + Math.max(0, p + 1), 0);
    progress.textContent = Math.round((total / (58 * 4)) * 100) + '%';
    li.appendChild(progress);

    playersList.appendChild(li);
  }
}

function renderWinners() {
  winnersList.innerHTML = '';
  if (!game.winners || game.winners.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'No winners yet';
    winnersList.appendChild(li);
    return;
  }
  for (const color of game.winners) {
    const li = document.createElement('li');
    li.textContent = `${PLAYER_NAMES[color]} (${color})`;
    winnersList.appendChild(li);
  }
}

function renderLog() {
  logList.innerHTML = '';
  for (const entry of (game.log || []).slice(-30)) {
    const li = document.createElement('li');
    li.textContent = entry;
    logList.appendChild(li);
  }
  logList.scrollTop = logList.scrollHeight;
}

function renderPlayerCards() {
  const container = document.getElementById('board-player-cards');
  if (!container || !game) return;
  container.innerHTML = '';

  const cp = currentPlayer();

  for (const pl of game.players) {
    const pos = CARD_POSITIONS[pl.color] || 'top-left';
    const pieces = game.pieces[pl.color] || [];
    const homeCount = pieces.filter(p => p === 57).length;
    const total = pieces.reduce((s, p) => s + Math.max(0, p + 1), 0);
    const pct = Math.round((total / (58 * 4)) * 100);
    const isTurn = cp && cp.color === pl.color && game.started && !game.gameOver;

    const card = document.createElement('div');
    card.className = `board-pcard board-pcard--${pos}`;
    if (isTurn) card.classList.add('active-turn-card');

    const pawn = document.createElement('div');
    pawn.className = 'pcard-pawn';
    pawn.style.background = COLOR_HEX[pl.color];
    card.appendChild(pawn);

    const info = document.createElement('div');
    info.className = 'pcard-info';
    const nameEl = document.createElement('span');
    nameEl.className = 'pcard-name';
    nameEl.textContent = pl.name;
    info.appendChild(nameEl);
    const statsEl = document.createElement('span');
    statsEl.className = 'pcard-stats';
    statsEl.textContent = `${homeCount}/4 | ${pct}%`;
    info.appendChild(statsEl);
    card.appendChild(info);

    const dice = document.createElement('div');
    dice.className = 'pcard-dice';
    dice.style.background = COLOR_HEX[pl.color];

    if (isTurn) {
      dice.classList.add('pcard-dice-active');
      if (rollingDice) dice.classList.add('pcard-dice-rolling');
    }

    const diceVal = document.createElement('span');
    diceVal.className = 'pcard-dice-val';
    if (isTurn && rollingDice) diceVal.textContent = '?';
    else diceVal.textContent = lastDiceByColor[pl.color] || '-';
    dice.appendChild(diceVal);

    card.appendChild(dice);
    container.appendChild(card);
  }
}

// ======== BOARD DRAWING (identical to online version) ========
function drawBoard() {
  renderedTokens = [];
  drawClassicBoard(boardGeometry);
  if (!game || !game.pieces) return;

  const cp = currentPlayer();
  const rawTokens = [];
  for (const pl of game.players) {
    const pieces = game.pieces[pl.color] || [];
    for (let ti = 0; ti < pieces.length; ti++) {
      const p = pieces[ti];
      const animCoord = getAnimatedPosition(pl.color, ti);
      const coord = animCoord || getTokenCoord(pl.color, ti, p, boardGeometry);
      rawTokens.push({ color: pl.color, tokenIndex: ti, progress: p, coord });
    }
  }

  const grouped = groupOverlappingTokens(rawTokens);
  for (const group of grouped) {
    const count = group.length;
    group.forEach((token, idx) => {
      const angle = (Math.PI * 2 * idx) / Math.max(count, 1);
      const spread = count > 1 ? 11 : 0;
      const x = token.coord.x + Math.cos(angle) * spread;
      const y = token.coord.y + Math.sin(angle) * spread;
      const movable = Boolean(
        cp && cp.color === token.color &&
        game.pendingRoll !== null &&
        game.validMoves.includes(token.tokenIndex)
      );
      drawToken(x, y, token.color, token.tokenIndex + 1, movable);
      renderedTokens.push({ x, y, color: token.color, tokenIndex: token.tokenIndex, movable });
    });
  }
}

function drawClassicBoard(geometry) {
  const { cell, offsetX, offsetY, boardSize } = geometry;
  ctx.clearRect(0, 0, boardCanvas.width, boardCanvas.height);

  ctx.fillStyle = '#e8d5a8';
  ctx.fillRect(offsetX, offsetY, boardSize, boardSize);

  // Grain
  ctx.save();
  ctx.globalAlpha = 0.03;
  ctx.fillStyle = '#6b4510';
  for (let i = 0; i < 120; i++) {
    ctx.fillRect(offsetX + Math.random() * boardSize, offsetY + Math.random() * boardSize, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
  ctx.restore();

  // Quadrants
  for (const [color, [gx, gy]] of Object.entries(HOME_BLOCKS)) {
    ctx.fillStyle = BOARD_COLORS[color].bg;
    ctx.fillRect(offsetX + gx * cell, offsetY + gy * cell, cell * 6, cell * 6);
  }

  // Cross pathway
  ctx.fillStyle = '#ede0c0';
  ctx.fillRect(offsetX + 6 * cell, offsetY, cell * 3, boardSize);
  ctx.fillRect(offsetX, offsetY + 6 * cell, boardSize, cell * 3);

  // Track cells
  for (const [x, y] of TRACK_CELLS) drawCell(geometry, x, y, '#f2e6cc');

  // Colored exit strips
  for (const [color, cells] of Object.entries(EXIT_STRIPS)) {
    for (const [x, y] of cells) drawCell(geometry, x, y, BOARD_COLORS[color].bg);
  }

  // Home lane cells
  for (const [color, cells] of Object.entries(HOME_LANE_CELLS)) {
    for (let i = 0; i < cells.length - 1; i++) {
      const [x, y] = cells[i];
      drawCell(geometry, x, y, (i === cells.length - 2) ? '#f2e6cc' : BOARD_COLORS[color].bg);
    }
  }

  drawCenterMotif(geometry);

  // Home bases
  for (const color of COLORS) drawHomeBase(geometry, color);

  // Grid lines
  ctx.strokeStyle = 'rgba(80, 55, 20, 0.25)';
  ctx.lineWidth = 0.8;
  for (let i = 0; i <= 15; i++) {
    ctx.beginPath(); ctx.moveTo(offsetX + i * cell, offsetY); ctx.lineTo(offsetX + i * cell, offsetY + boardSize); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(offsetX, offsetY + i * cell); ctx.lineTo(offsetX + boardSize, offsetY + i * cell); ctx.stroke();
  }

  // Quadrant borders
  ctx.strokeStyle = 'rgba(60, 40, 10, 0.45)';
  ctx.lineWidth = 1.5;
  for (const [, [gx, gy]] of Object.entries(HOME_BLOCKS)) {
    ctx.strokeRect(offsetX + gx * cell, offsetY + gy * cell, cell * 6, cell * 6);
  }

  // Safe stars
  for (const si of SAFE_CELLS) {
    const pt = geometry.track[si];
    let sc = '#c0a040';
    for (const [clr, idx] of Object.entries(START_INDEX)) { if (si === idx) { sc = BOARD_COLORS[clr].dark; break; } }
    drawStar(pt.x, pt.y, cell * 0.22, sc);
  }

  // Start rings
  for (const [color, si] of Object.entries(START_INDEX)) {
    const pt = geometry.track[si];
    ctx.beginPath(); ctx.arc(pt.x, pt.y, cell * 0.3, 0, Math.PI * 2);
    ctx.strokeStyle = BOARD_COLORS[color].dark; ctx.lineWidth = 2.5; ctx.stroke();
  }

  // Yard nests
  for (const [color, pts] of Object.entries(geometry.yards)) {
    for (const pt of pts) {
      ctx.beginPath(); ctx.arc(pt.x, pt.y, cell * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = BOARD_COLORS[color].nest; ctx.fill();
      ctx.strokeStyle = BOARD_COLORS[color].dark; ctx.lineWidth = 2; ctx.stroke();
      ctx.beginPath(); ctx.arc(pt.x, pt.y, cell * 0.16, 0, Math.PI * 2);
      ctx.fillStyle = BOARD_COLORS[color].light; ctx.fill();
    }
  }

  ctx.strokeStyle = '#4a3220'; ctx.lineWidth = 3;
  ctx.strokeRect(offsetX, offsetY, boardSize, boardSize);
}

function drawHomeBase(geometry, color) {
  const { cell, offsetX, offsetY } = geometry;
  const [gx, gy] = HOME_BLOCKS[color];
  const x = offsetX + (gx + 0.6) * cell, y = offsetY + (gy + 0.6) * cell;
  const w = cell * 4.8, h = cell * 4.8, r = cell * 0.55;
  roundedRect(x, y, w, h, r); ctx.fillStyle = BOARD_COLORS[color].dark; ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 2; ctx.stroke();
  const pad = cell * 0.2;
  roundedRect(x + pad, y + pad, w - pad * 2, h - pad * 2, r * 0.5);
  ctx.fillStyle = BOARD_COLORS[color].bg; ctx.fill();
}

function drawCenterMotif(geometry) {
  const { cell, offsetX, offsetY } = geometry;
  const cx = offsetX + 7.5 * cell, cy = offsetY + 7.5 * cell;
  const l = offsetX + 6 * cell, t = offsetY + 6 * cell, ri = offsetX + 9 * cell, b = offsetY + 9 * cell;

  const tri = (p1, p2, color) => { ctx.beginPath(); ctx.moveTo(...p1); ctx.lineTo(...p2); ctx.lineTo(cx, cy); ctx.closePath(); ctx.fillStyle = BOARD_COLORS[color].bg; ctx.fill(); };
  tri([l, t], [ri, t], 'red');
  tri([ri, t], [ri, b], 'green');
  tri([ri, b], [l, b], 'blue');
  tri([l, b], [l, t], 'yellow');

  ctx.strokeStyle = 'rgba(60, 40, 10, 0.4)'; ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(l, t); ctx.lineTo(cx, cy); ctx.moveTo(ri, t); ctx.lineTo(cx, cy);
  ctx.moveTo(ri, b); ctx.lineTo(cx, cy); ctx.moveTo(l, b); ctx.lineTo(cx, cy);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(60, 40, 10, 0.5)'; ctx.lineWidth = 1.5;
  ctx.strokeRect(l, t, ri - l, b - t);
}

function roundedRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawStar(cx, cy, r, color) {
  const ir = r * 0.4;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI / 5);
    const rad = i % 2 === 0 ? r : ir;
    const px = cx + Math.cos(a) * rad, py = cy + Math.sin(a) * rad;
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  }
  ctx.closePath(); ctx.fillStyle = color; ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 0.7; ctx.stroke();
}

function drawCell(geometry, gx, gy, color) {
  const { cell, offsetX, offsetY } = geometry;
  ctx.fillStyle = color;
  ctx.fillRect(offsetX + gx * cell, offsetY + gy * cell, cell, cell);
}

function drawToken(x, y, color, label, movable) {
  const r = 15;
  if (movable) {
    const pulse = 0.7 + 0.3 * Math.sin(Date.now() / 180);
    ctx.beginPath(); ctx.arc(x, y, r + 4 + pulse * 3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 215, 0, 0.35)'; ctx.fill();
  }
  ctx.beginPath(); ctx.arc(x + 1.5, y + 2.5, r, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fill();
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = BOARD_COLORS[color].dark; ctx.fill();
  ctx.beginPath(); ctx.arc(x, y, r - 2.5, 0, Math.PI * 2);
  ctx.fillStyle = BOARD_COLORS[color].bg; ctx.fill();
  ctx.beginPath(); ctx.arc(x, y, r - 6, 0, Math.PI * 2);
  ctx.fillStyle = BOARD_COLORS[color].light; ctx.fill();
  ctx.beginPath(); ctx.arc(x, y, r - 9, 0, Math.PI * 2);
  ctx.fillStyle = BOARD_COLORS[color].dark; ctx.fill();
  ctx.beginPath(); ctx.arc(x - 3.5, y - 4, 3, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fill();
  if (movable) {
    ctx.beginPath(); ctx.arc(x, y, r + 1.5, 0, Math.PI * 2);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.stroke();
  }
}

// ======== GEOMETRY ========
function buildBoardGeometry(w, h) {
  const cell = Math.floor(Math.min(w, h) / 15);
  const boardSize = cell * 15;
  const offsetX = Math.floor((w - boardSize) / 2);
  const offsetY = Math.floor((h - boardSize) / 2);
  const geo = { cell, boardSize, offsetX, offsetY };
  const track = TRACK_CELLS.map(c => toPixel(geo, c));
  const yards = {}, homes = {};
  for (const [color, cells] of Object.entries(YARD_CELLS)) yards[color] = cells.map(c => toPixel(geo, c));
  for (const [color, cells] of Object.entries(HOME_LANE_CELLS)) homes[color] = cells.map(c => toPixel(geo, c));
  return { ...geo, track, yards, homes };
}

function toPixel(g, cp) { return { x: g.offsetX + cp[0] * g.cell + g.cell / 2, y: g.offsetY + cp[1] * g.cell + g.cell / 2 }; }

function getTokenCoord(color, ti, progress, geo) {
  if (progress === -1) return geo.yards[color][ti];
  if (progress >= 0 && progress <= 51) return geo.track[(START_INDEX[color] + progress) % 52];
  return geo.homes[color][Math.max(0, Math.min(5, progress - 52))];
}

function groupOverlappingTokens(tokens) {
  const m = new Map();
  for (const t of tokens) {
    const k = `${Math.round(t.coord.x)}:${Math.round(t.coord.y)}`;
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(t);
  }
  return Array.from(m.values());
}

// ======== ANIMATION ========
function detectAndAnimatePieces(prevPieces, nextPieces) {
  let hasNew = false;
  for (const color of COLORS) {
    const prev = prevPieces[color] || [];
    const next = nextPieces[color] || [];
    for (let i = 0; i < 4; i++) {
      if (prev[i] === undefined || next[i] === undefined || prev[i] === next[i]) continue;
      const path = buildMovePath(color, i, prev[i], next[i]);
      if (path.length > 1) {
        pieceAnimations.set(`${color}_${i}`, { path, startTime: performance.now(), stepMs: 110 });
        hasNew = true;
      }
    }
  }
  if (hasNew && !animFrameId) animFrameId = requestAnimationFrame(animLoop);
}

function buildMovePath(color, ti, fromP, toP) {
  const path = [];
  if (fromP === -1) {
    path.push(boardGeometry.yards[color][ti]);
    for (let p = 0; p <= toP; p++) path.push(getTokenCoord(color, ti, p, boardGeometry));
    return path;
  }
  if (toP === -1) {
    path.push(getTokenCoord(color, ti, fromP, boardGeometry));
    path.push(boardGeometry.yards[color][ti]);
    return path;
  }
  if (toP >= fromP) {
    for (let p = fromP; p <= toP; p++) path.push(getTokenCoord(color, ti, p, boardGeometry));
  } else {
    path.push(getTokenCoord(color, ti, fromP, boardGeometry));
    path.push(getTokenCoord(color, ti, toP, boardGeometry));
  }
  return path;
}

function getAnimatedPosition(color, ti) {
  const anim = pieceAnimations.get(`${color}_${ti}`);
  if (!anim) return null;
  const elapsed = performance.now() - anim.startTime;
  const steps = anim.path.length - 1;
  const sf = elapsed / anim.stepMs;
  if (sf >= steps) { pieceAnimations.delete(`${color}_${ti}`); return null; }
  const s = Math.floor(sf), t = 1 - Math.pow(1 - (sf - s), 2.5);
  const from = anim.path[s], to = anim.path[Math.min(s + 1, anim.path.length - 1)];
  return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
}

function animLoop() {
  animFrameId = null;
  if (pieceAnimations.size === 0) return;
  if (game) drawBoard();
  if (pieceAnimations.size > 0) animFrameId = requestAnimationFrame(animLoop);
}

// ======== SOUND ========
function unlockAudio() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch {}
}

function tone(freq, dur, opts = {}) {
  if (!audioCtx || soundMuted) return;
  const now = audioCtx.currentTime + (opts.delay || 0);
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = opts.wave || 'sine';
  osc.frequency.setValueAtTime(freq, now);
  const vol = opts.volume || 0.05;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(vol, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  osc.connect(gain); gain.connect(audioCtx.destination);
  osc.start(now); osc.stop(now + dur + 0.01);
}

function playRollStartSound() { unlockAudio(); tone(300,0.06,{wave:'square',volume:0.04}); tone(360,0.06,{wave:'square',volume:0.04,delay:0.07}); tone(420,0.06,{wave:'square',volume:0.04,delay:0.14}); }
function playMoveSound() { unlockAudio(); tone(470,0.08,{wave:'triangle',volume:0.05}); }
function playCaptureSound() { unlockAudio(); tone(260,0.08,{wave:'sawtooth',volume:0.06}); tone(620,0.10,{wave:'triangle',volume:0.055,delay:0.10}); }
function playWinSound() { unlockAudio(); tone(392,0.12,{wave:'triangle',volume:0.055}); tone(523,0.12,{wave:'triangle',volume:0.055,delay:0.14}); tone(659,0.18,{wave:'triangle',volume:0.06,delay:0.28}); }

// ======== CONTROLS ========
soundBtn.addEventListener('click', () => {
  soundMuted = !soundMuted;
  soundBtn.innerHTML = soundMuted
    ? '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg> Unmute Sound'
    : '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg> Mute Sound';
});

exitBtn.addEventListener('click', () => {
  game = null;
  gamePanel.classList.add('hidden');
  selectPanel.classList.remove('hidden');
});

restartBtn.addEventListener('click', () => {
  if (!game) return;
  const count = game.players.length;
  startGame(count);
});

// ======== IN-GAME RULES ========
const RULES_CONFIG = [
  { key: 'sixTakeOut', name: 'Allow 6 to take piece out', desc: 'Rolling 6 can also bring a piece out (in addition to 1)', iconClass: 'rule-icon-green', icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M12 8v8"/><path d="M8 12h8"/></svg>' },
  { key: 'killExtraTurn', name: 'Kill grants extra turn', desc: 'Get another turn when you capture an opponent\'s piece', iconClass: 'rule-icon-red', icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>' },
  { key: 'homeExtraTurn', name: 'Reaching home grants extra turn', desc: 'Get another turn when a piece reaches home', iconClass: 'rule-icon-green', icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>' },
  { key: 'tripleOnesPenalty', name: 'Triple 1\'s penalty', desc: 'Rolling three 1\'s in a row sends your most advanced piece back', iconClass: 'rule-icon-yellow', icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>' },
  { key: 'continueAfterWin', name: 'Continue after winner', desc: 'Game continues for remaining players after someone wins', iconClass: 'rule-icon-purple', icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>' },
];

settingsBtn.addEventListener('click', () => {
  if (!game) return;
  rulesList.innerHTML = '';
  for (const rc of RULES_CONFIG) {
    const label = document.createElement('label');
    label.className = 'rule-item';
    const iconDiv = document.createElement('div');
    iconDiv.className = `rule-icon ${rc.iconClass}`;
    iconDiv.innerHTML = rc.icon;
    label.appendChild(iconDiv);
    const info = document.createElement('div');
    info.className = 'rule-info';
    info.innerHTML = `<span class="rule-name">${rc.name}</span><span class="rule-desc">${rc.desc}</span>`;
    label.appendChild(info);
    const toggle = document.createElement('input');
    toggle.type = 'checkbox';
    toggle.className = 'rule-toggle';
    toggle.checked = !!game.rules[rc.key];
    toggle.addEventListener('change', () => { game.rules[rc.key] = toggle.checked; });
    label.appendChild(toggle);
    const slider = document.createElement('span');
    slider.className = 'toggle-slider';
    label.appendChild(slider);
    rulesList.appendChild(label);
  }
  rulesOverlay.classList.remove('hidden');
});

rulesClose.addEventListener('click', () => rulesOverlay.classList.add('hidden'));
rulesDone.addEventListener('click', () => rulesOverlay.classList.add('hidden'));
rulesOverlay.addEventListener('click', (e) => { if (e.target === rulesOverlay) rulesOverlay.classList.add('hidden'); });

window.addEventListener('resize', () => { if (game) render(); });
