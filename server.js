const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const crypto = require('crypto');
const os = require('os');

const PORT = Number(process.env.PORT || 3000);
const HOST = String(process.env.HOST || '0.0.0.0');
const PUBLIC_DIR = path.join(__dirname, 'public');
const COLORS = ['red', 'green', 'yellow', 'blue'];
const START_INDEX = {
  red: 0,
  green: 13,
  yellow: 26,
  blue: 39,
};
const SAFE_CELLS = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

const rooms = new Map();
const sseClients = new Map();

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

function randomCode(length = 5) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < length; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

function randomId(length = 18) {
  return crypto.randomBytes(length).toString('hex').slice(0, length);
}

function sanitizeName(input) {
  const name = String(input || '').trim().replace(/\s+/g, ' ');
  return name.slice(0, 20);
}

function safeJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('Invalid JSON body.');
  }
}

function getRoom(roomCode) {
  return rooms.get(String(roomCode || '').toUpperCase());
}

function getPlayer(room, playerId) {
  if (!room || !playerId) return null;
  return room.players.find((p) => p.id === playerId) || null;
}

function isFinished(room, color) {
  const pieces = room.pieces[color] || [];
  return pieces.length === 4 && pieces.every((value) => value === 57);
}

function activePlayer(room) {
  if (!room.started || room.gameOver || room.players.length === 0) return null;
  normalizeTurn(room);
  return room.players[room.turnIndex] || null;
}

function normalizeTurn(room) {
  if (!room.started || room.gameOver || room.players.length === 0) return;
  let guard = 0;
  while (guard < room.players.length && isFinished(room, room.players[room.turnIndex].color)) {
    room.turnIndex = (room.turnIndex + 1) % room.players.length;
    guard += 1;
  }
}

function nextTurn(room) {
  if (!room.started || room.gameOver) return;
  room.turnIndex = (room.turnIndex + 1) % room.players.length;
  normalizeTurn(room);
}

function progressToTrack(color, progress) {
  return (START_INDEX[color] + progress) % 52;
}

function calculateNextProgress(current, dice) {
  if (current === 57) return null;
  if (current === -1) {
    return dice === 6 ? 0 : null;
  }
  const next = current + dice;
  if (next > 57) return null;
  return next;
}

function validMovesFor(room, color, dice) {
  const pieces = room.pieces[color] || [];
  const moves = [];
  for (let i = 0; i < pieces.length; i += 1) {
    if (calculateNextProgress(pieces[i], dice) !== null) {
      moves.push(i);
    }
  }
  return moves;
}

function maybeCapture(room, moverColor, landingProgress) {
  if (landingProgress < 0 || landingProgress > 51) return 0;
  const landingTrack = progressToTrack(moverColor, landingProgress);
  if (SAFE_CELLS.has(landingTrack)) return 0;

  let captured = 0;
  for (const player of room.players) {
    if (player.color === moverColor) continue;
    const enemyPieces = room.pieces[player.color];
    for (let i = 0; i < enemyPieces.length; i += 1) {
      if (enemyPieces[i] < 0 || enemyPieces[i] > 51) continue;
      if (progressToTrack(player.color, enemyPieces[i]) === landingTrack) {
        enemyPieces[i] = -1;
        captured += 1;
      }
    }
  }
  return captured;
}

function maybeFinishPlayer(room, player) {
  if (!player) return false;
  if (!isFinished(room, player.color)) return false;
  if (room.winners.includes(player.id)) return false;
  room.winners.push(player.id);
  room.log.push(`${player.name} reached home with all tokens.`);
  return true;
}

function maybeEndGame(room) {
  if (room.gameOver) return;
  if (room.winners.length >= room.players.length - 1) {
    for (const player of room.players) {
      if (!room.winners.includes(player.id)) {
        room.winners.push(player.id);
      }
    }
    room.gameOver = true;
    room.started = false;
    room.pendingRoll = null;
    room.validMoves = [];
    room.consecutiveSixes = 0;
    room.log.push('Game over. Final ranking is available in the winners list.');
  }
}

function createRoom(hostName) {
  const cleanName = sanitizeName(hostName);
  if (!cleanName) {
    throw new Error('Name is required.');
  }

  let code = randomCode();
  while (rooms.has(code)) {
    code = randomCode();
  }

  const host = {
    id: randomId(),
    name: cleanName,
    color: COLORS[0],
  };

  const room = {
    code,
    hostId: host.id,
    createdAt: Date.now(),
    players: [host],
    started: false,
    gameOver: false,
    turnIndex: 0,
    pendingRoll: null,
    validMoves: [],
    consecutiveSixes: 0,
    pieces: {
      red: [-1, -1, -1, -1],
      green: [-1, -1, -1, -1],
      yellow: [-1, -1, -1, -1],
      blue: [-1, -1, -1, -1],
    },
    winners: [],
    log: [`${host.name} created room ${code}.`],
  };

  rooms.set(code, room);
  return { room, host };
}

function buildState(room, viewerId, reason) {
  const current = activePlayer(room);
  return {
    roomCode: room.code,
    reason: reason || null,
    hostId: room.hostId,
    started: room.started,
    gameOver: room.gameOver,
    turnPlayerId: current ? current.id : null,
    pendingRoll: room.pendingRoll,
    validMoves: room.validMoves,
    players: room.players.map((player) => ({
      id: player.id,
      name: player.name,
      color: player.color,
      finished: isFinished(room, player.color),
    })),
    pieces: room.pieces,
    winners: room.winners,
    log: room.log.slice(-30),
    yourPlayerId: viewerId || null,
    youAreHost: viewerId === room.hostId,
  };
}

function sendSse(client, payload) {
  try {
    client.res.write(`event: state\n`);
    client.res.write(`data: ${JSON.stringify(payload)}\n\n`);
  } catch {
    client.closed = true;
  }
}

function broadcast(room, reason) {
  const clients = sseClients.get(room.code);
  if (!clients || clients.size === 0) return;

  for (const client of clients) {
    if (client.closed) continue;
    const snapshot = buildState(room, client.playerId, reason);
    sendSse(client, snapshot);
  }

  for (const client of Array.from(clients)) {
    if (client.closed) {
      clients.delete(client);
    }
  }

  if (clients.size === 0) {
    sseClients.delete(room.code);
  }
}

function addLog(room, message) {
  room.log.push(message);
  if (room.log.length > 200) {
    room.log = room.log.slice(-200);
  }
}

function handleRoll(room, player) {
  if (!room.started || room.gameOver) {
    throw new Error('Game is not active.');
  }
  const current = activePlayer(room);
  if (!current || current.id !== player.id) {
    throw new Error('It is not your turn.');
  }
  if (room.pendingRoll !== null) {
    throw new Error('You must move a token first.');
  }

  const dice = Math.floor(Math.random() * 6) + 1;
  const moves = validMovesFor(room, player.color, dice);

  room.pendingRoll = dice;
  room.validMoves = moves;

  if (dice === 6) {
    room.consecutiveSixes += 1;
  } else {
    room.consecutiveSixes = 0;
  }

  addLog(room, `${player.name} rolled a ${dice}.`);

  if (room.consecutiveSixes >= 3) {
    addLog(room, `${player.name} rolled three consecutive sixes. Turn skipped.`);
    room.pendingRoll = null;
    room.validMoves = [];
    room.consecutiveSixes = 0;
    nextTurn(room);
    const next = activePlayer(room);
    if (next) {
      addLog(room, `Turn: ${next.name}`);
    }
    return;
  }

  if (moves.length === 0) {
    addLog(room, `${player.name} has no legal move.`);
    room.pendingRoll = null;
    room.validMoves = [];
    room.consecutiveSixes = 0;
    nextTurn(room);
    const next = activePlayer(room);
    if (next) {
      addLog(room, `Turn: ${next.name}`);
    }
  }
}

function handleMove(room, player, tokenIndex) {
  if (!room.started || room.gameOver) {
    throw new Error('Game is not active.');
  }

  const current = activePlayer(room);
  if (!current || current.id !== player.id) {
    throw new Error('It is not your turn.');
  }

  if (room.pendingRoll === null) {
    throw new Error('Roll the dice first.');
  }

  if (!Number.isInteger(tokenIndex) || tokenIndex < 0 || tokenIndex > 3) {
    throw new Error('Invalid token index.');
  }

  if (!room.validMoves.includes(tokenIndex)) {
    throw new Error('That token cannot be moved for this roll.');
  }

  const dice = room.pendingRoll;
  const color = player.color;
  const currentProgress = room.pieces[color][tokenIndex];
  const nextProgress = calculateNextProgress(currentProgress, dice);

  if (nextProgress === null) {
    throw new Error('Illegal move.');
  }

  room.pieces[color][tokenIndex] = nextProgress;
  const captured = maybeCapture(room, color, nextProgress);

  if (captured > 0) {
    addLog(room, `${player.name} captured ${captured} token${captured > 1 ? 's' : ''}.`);
  }

  if (nextProgress === 57) {
    addLog(room, `${player.name} moved token ${tokenIndex + 1} into home.`);
  }

  maybeFinishPlayer(room, player);
  maybeEndGame(room);

  room.pendingRoll = null;
  room.validMoves = [];

  if (room.gameOver) {
    return;
  }

  const getsExtraTurn = dice === 6 && !isFinished(room, player.color);

  if (getsExtraTurn) {
    addLog(room, `${player.name} gets another turn.`);
  } else {
    room.consecutiveSixes = 0;
    nextTurn(room);
    const next = activePlayer(room);
    if (next) {
      addLog(room, `Turn: ${next.name}`);
    }
  }
}

function ensureRoomForAction(roomCode, playerId) {
  const room = getRoom(roomCode);
  if (!room) {
    throw new Error('Room not found.');
  }
  const player = getPlayer(room, playerId);
  if (!player) {
    throw new Error('Player not found in this room.');
  }
  return { room, player };
}

function serveStatic(reqPath, res) {
  let filePath = reqPath === '/' ? '/index.html' : reqPath;
  filePath = decodeURIComponent(filePath);

  const resolved = path.normalize(filePath).replace(/^([.][.][/\\])+/, '');
  const absolute = path.join(PUBLIC_DIR, resolved);

  if (!absolute.startsWith(PUBLIC_DIR)) {
    safeJson(res, 403, { error: 'Forbidden.' });
    return;
  }

  fs.readFile(absolute, (error, data) => {
    if (error) {
      safeJson(res, 404, { error: 'Not found.' });
      return;
    }

    const ext = path.extname(absolute).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

async function handleApi(req, res, urlObj) {
  const pathname = urlObj.pathname;

  if (req.method === 'GET' && pathname === '/api/state') {
    const roomCode = String(urlObj.searchParams.get('roomCode') || '').toUpperCase();
    const playerId = String(urlObj.searchParams.get('playerId') || '');
    const room = getRoom(roomCode);
    if (!room) {
      safeJson(res, 404, { error: 'Room not found.' });
      return;
    }
    safeJson(res, 200, buildState(room, playerId));
    return;
  }

  if (req.method === 'GET' && pathname === '/api/events') {
    const roomCode = String(urlObj.searchParams.get('roomCode') || '').toUpperCase();
    const playerId = String(urlObj.searchParams.get('playerId') || '');
    const room = getRoom(roomCode);

    if (!room) {
      safeJson(res, 404, { error: 'Room not found.' });
      return;
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    res.write('retry: 2000\n\n');

    const client = {
      id: randomId(10),
      playerId,
      res,
      closed: false,
    };

    if (!sseClients.has(roomCode)) {
      sseClients.set(roomCode, new Set());
    }
    sseClients.get(roomCode).add(client);

    sendSse(client, buildState(room, playerId, 'connected'));

    req.on('close', () => {
      client.closed = true;
      const set = sseClients.get(roomCode);
      if (!set) return;
      set.delete(client);
      if (set.size === 0) {
        sseClients.delete(roomCode);
      }
    });

    return;
  }

  if (req.method !== 'POST') {
    safeJson(res, 404, { error: 'Unknown API endpoint.' });
    return;
  }

  const body = await readJsonBody(req);

  if (pathname === '/api/create-room') {
    const { room, host } = createRoom(body.name);
    safeJson(res, 201, {
      roomCode: room.code,
      playerId: host.id,
      color: host.color,
    });
    broadcast(room, 'room-created');
    return;
  }

  if (pathname === '/api/join-room') {
    const roomCode = String(body.roomCode || '').toUpperCase().trim();
    const name = sanitizeName(body.name);

    if (!roomCode) {
      throw new Error('Room code is required.');
    }
    if (!name) {
      throw new Error('Name is required.');
    }

    const room = getRoom(roomCode);
    if (!room) {
      throw new Error('Room not found.');
    }
    if (room.started) {
      throw new Error('Game already started in this room.');
    }
    if (room.players.length >= 4) {
      throw new Error('Room is full.');
    }

    const usedColors = new Set(room.players.map((p) => p.color));
    const color = COLORS.find((candidate) => !usedColors.has(candidate));
    const player = {
      id: randomId(),
      name,
      color,
    };

    room.players.push(player);
    addLog(room, `${player.name} joined as ${color}.`);

    safeJson(res, 200, {
      roomCode: room.code,
      playerId: player.id,
      color: player.color,
    });
    broadcast(room, 'player-joined');
    return;
  }

  if (pathname === '/api/start-game') {
    const { room, player } = ensureRoomForAction(body.roomCode, body.playerId);
    if (room.started) {
      throw new Error('Game already started.');
    }
    if (player.id !== room.hostId) {
      throw new Error('Only the host can start the game.');
    }
    if (room.players.length < 2) {
      throw new Error('At least 2 players are required.');
    }

    room.started = true;
    room.gameOver = false;
    room.turnIndex = 0;
    room.pendingRoll = null;
    room.validMoves = [];
    room.consecutiveSixes = 0;
    room.winners = [];

    for (const color of COLORS) {
      room.pieces[color] = [-1, -1, -1, -1];
    }

    const starter = activePlayer(room);
    addLog(room, 'Game started.');
    if (starter) {
      addLog(room, `Turn: ${starter.name}`);
    }

    safeJson(res, 200, { ok: true });
    broadcast(room, 'game-started');
    return;
  }

  if (pathname === '/api/roll') {
    const { room, player } = ensureRoomForAction(body.roomCode, body.playerId);
    handleRoll(room, player);
    safeJson(res, 200, { ok: true });
    broadcast(room, 'rolled');
    return;
  }

  if (pathname === '/api/move') {
    const { room, player } = ensureRoomForAction(body.roomCode, body.playerId);
    const tokenIndex = Number(body.tokenIndex);
    handleMove(room, player, tokenIndex);
    safeJson(res, 200, { ok: true });
    broadcast(room, 'moved');
    return;
  }

  safeJson(res, 404, { error: 'Unknown API endpoint.' });
}


function getLanIpv4Addresses() {
  const output = [];
  const interfaces = os.networkInterfaces();
  for (const entries of Object.values(interfaces)) {
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      if (entry && entry.family === 'IPv4' && !entry.internal) {
        output.push(entry.address);
      }
    }
  }
  return output;
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const host = req.headers.host || `localhost:${PORT}`;
  const urlObj = new URL(req.url || '/', `http://${host}`);

  try {
    if (urlObj.pathname.startsWith('/api/')) {
      await handleApi(req, res, urlObj);
      return;
    }

    if (req.method !== 'GET') {
      safeJson(res, 405, { error: 'Method not allowed.' });
      return;
    }

    serveStatic(urlObj.pathname, res);
  } catch (error) {
    safeJson(res, 400, { error: error.message || 'Request failed.' });
  }
});

setInterval(() => {
  for (const clients of sseClients.values()) {
    for (const client of clients) {
      if (client.closed) continue;
      try {
        client.res.write(': ping\n\n');
      } catch {
        client.closed = true;
      }
    }
  }
}, 15000);

server.listen(PORT, HOST, () => {
  console.log('Ludo server running.');
  console.log(`Local: http://localhost:${PORT}`);

  if (HOST === '0.0.0.0' || HOST === '::') {
    const lanIps = getLanIpv4Addresses();
    if (lanIps.length === 0) {
      console.log('LAN: no IPv4 interface found.');
      return;
    }
    for (const ip of lanIps) {
      console.log(`LAN: http://${ip}:${PORT}`);
    }
    return;
  }

  console.log(`Host: http://${HOST}:${PORT}`);
});
