'use strict';

(function () {
  const GRID_SIZE = 15;

  // Cell type classification helpers
  const G = window.LudoGame;

  // Colors and their lighter shades
  const COLOR_MAP = {
    red:    { main: '#e53935', light: '#ef9a9a', dark: '#b71c1c' },
    green:  { main: '#43a047', light: '#a5d6a7', dark: '#1b5e20' },
    yellow: { main: '#fdd835', light: '#fff59d', dark: '#f57f17' },
    blue:   { main: '#1e88e5', light: '#90caf9', dark: '#0d47a1' }
  };

  // Determine cell type for initial coloring
  function classifyCell(row, col) {
    // Center
    if (row === 7 && col === 7) return { type: 'center' };

    // Check home yard token spots BEFORE generic yard check
    for (const color of G.COLORS) {
      const hy = G.HOME_YARD[color];
      for (let i = 0; i < 4; i++) {
        if (hy[i][0] === row && hy[i][1] === col) {
          return { type: 'yardspot', color };
        }
      }
    }

    // Home yards (colored 6x6 quadrants)
    if (row >= 0 && row <= 5 && col >= 0 && col <= 5) return { type: 'yard', color: 'red' };
    if (row >= 0 && row <= 5 && col >= 9 && col <= 14) return { type: 'yard', color: 'green' };
    if (row >= 9 && row <= 14 && col >= 9 && col <= 14) return { type: 'yard', color: 'yellow' };
    if (row >= 9 && row <= 14 && col >= 0 && col <= 5) return { type: 'yard', color: 'blue' };

    // Check home columns
    for (const color of G.COLORS) {
      const hc = G.HOME_COLS[color];
      for (let i = 0; i < hc.length; i++) {
        if (hc[i][0] === row && hc[i][1] === col) {
          return { type: 'homecol', color, step: i + 1 };
        }
      }
    }

    // Check common path
    for (let i = 0; i < G.PATH.length; i++) {
      if (G.PATH[i][0] === row && G.PATH[i][1] === col) {
        const pos = i + 1; // 1-based
        // Check if safe
        const isSafe = G.isSafePosition(pos);
        // Check if start position for a color
        let startColor = null;
        for (const c of G.COLORS) {
          if (G.startPos(c) === pos) { startColor = c; break; }
        }
        return { type: 'path', pos, safe: isSafe, startColor };
      }
    }

    return { type: 'blank' };
  }

  let cellMap = {}; // "row,col" -> DOM element
  let boardEl = null;

  function buildBoard() {
    boardEl = document.getElementById('board');
    if (!boardEl) return;
    boardEl.innerHTML = '';

    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.row = r;
        cell.dataset.col = c;

        const info = classifyCell(r, c);
        cell.dataset.type = info.type;

        if (info.type === 'center') {
          cell.classList.add('cell-center');
          // Center triangles built with inner divs (absolute-positioned, each covers full cell)
          const tri = document.createElement('div');
          tri.className = 'center-triangles';
          ['red','green','yellow','blue'].forEach(function(clr) {
            const t = document.createElement('div');
            t.className = 'tri tri-' + clr;
            tri.appendChild(t);
          });
          cell.appendChild(tri);
        } else if (info.type === 'yardspot') {
          // Token starting positions inside the yard — inherit yard color, show as a spot
          cell.classList.add('cell-yard', 'yard-' + info.color, 'yard-token-spot');
        } else if (info.type === 'yard') {
          cell.classList.add('cell-yard', 'yard-' + info.color);
        } else if (info.type === 'homecol') {
          cell.classList.add('cell-homecol', 'homecol-' + info.color);
          if (info.step === 6) cell.classList.add('homecol-last');
        } else if (info.type === 'path') {
          cell.classList.add('cell-path');
          if (info.safe) {
            cell.classList.add('cell-safe');
            if (info.startColor) {
              cell.classList.add('cell-start', 'start-' + info.startColor);
            } else {
              cell.classList.add('cell-star');
            }
          }
          if (info.startColor && !info.safe) {
            cell.classList.add('cell-start', 'start-' + info.startColor);
          }
        } else {
          cell.classList.add('cell-blank');
        }

        const key = r + ',' + c;
        cellMap[key] = cell;
        boardEl.appendChild(cell);
      }
    }
  }

  function getCell(row, col) {
    return cellMap[row + ',' + col];
  }

  function clearTokensFromBoard() {
    document.querySelectorAll('.token').forEach(function (t) {
      t.parentElement && t.parentElement.removeChild(t);
    });
  }

  function makeTokenEl(token) {
    const el = document.createElement('div');
    el.className = 'token token-' + token.color;
    el.id = 'token-' + token.color + '-' + token.id;
    el.dataset.color = token.color;
    el.dataset.id = token.id;
    return el;
  }

  function renderBoard() {
    const state = G.getState();
    if (!state) return;

    clearTokensFromBoard();

    // Group tokens by cell coordinate to handle stacking
    const cellTokens = {};

    for (const player of state.players) {
      for (const token of player.tokens) {
        const coord = G.getTokenCoord(token);
        if (!coord) continue;
        const key = coord[0] + ',' + coord[1];
        if (!cellTokens[key]) cellTokens[key] = [];
        cellTokens[key].push(token);
      }
    }

    Object.keys(cellTokens).forEach(function (key) {
      const tokens = cellTokens[key];
      const parts = key.split(',');
      const cell = getCell(parseInt(parts[0]), parseInt(parts[1]));
      if (!cell) return;

      tokens.forEach(function (token, i) {
        const el = makeTokenEl(token);
        if (tokens.length > 1) {
          el.classList.add('token-stacked');
          el.style.setProperty('--stack-i', i);
        }
        cell.appendChild(el);
      });
    });
  }

  function highlightMovable(tokenIds, color) {
    clearHighlights();
    tokenIds.forEach(function (id) {
      const el = document.getElementById('token-' + color + '-' + id);
      if (el) el.classList.add('token-movable');
    });
  }

  function clearHighlights() {
    document.querySelectorAll('.token-movable').forEach(function (el) {
      el.classList.remove('token-movable');
    });
  }

  function animateTokenMove(tokenEl, fromRect, toCell, callback) {
    if (!tokenEl || !toCell || !fromRect) {
      if (callback) callback();
      return;
    }

    const toRect = toCell.getBoundingClientRect();

    // Clone the token for animation
    const ghost = tokenEl.cloneNode(true);
    ghost.id = '';
    ghost.style.position = 'fixed';
    ghost.style.left = fromRect.left + 'px';
    ghost.style.top = fromRect.top + 'px';
    ghost.style.width = fromRect.width + 'px';
    ghost.style.height = fromRect.height + 'px';
    ghost.style.margin = '0';
    ghost.style.zIndex = '1000';
    ghost.style.transition = 'left 0.3s ease, top 0.3s ease';
    ghost.style.pointerEvents = 'none';
    document.body.appendChild(ghost);

    // Hide original briefly
    tokenEl.style.opacity = '0';

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        ghost.style.left = (toRect.left + toRect.width / 2 - fromRect.width / 2) + 'px';
        ghost.style.top = (toRect.top + toRect.height / 2 - fromRect.height / 2) + 'px';
      });
    });

    setTimeout(function () {
      document.body.removeChild(ghost);
      tokenEl.style.opacity = '';
      if (callback) callback();
    }, 350);
  }

  function updatePlayerPanels() {
    const state = G.getState();
    if (!state) return;

    state.players.forEach(function (player) {
      const panel = document.getElementById('panel-' + player.color);
      if (!panel) return;

      panel.classList.toggle('active-turn', state.players[state.currentPlayerIndex].color === player.color);

      const scoreEl = panel.querySelector('.player-score');
      const score = G.getScore(player.color);
      if (scoreEl) scoreEl.textContent = score + '/4 home';

      const barEl = panel.querySelector('.progress-bar-fill');
      if (barEl) barEl.style.width = (score / 4 * 100) + '%';

      // Token indicators inside panel
      const tokensEl = panel.querySelector('.panel-tokens');
      if (tokensEl) {
        tokensEl.innerHTML = '';
        player.tokens.forEach(function (token) {
          const dot = document.createElement('div');
          dot.className = 'panel-token';
          if (token.pos === 107) dot.classList.add('panel-token-home');
          else if (token.pos === -1) dot.classList.add('panel-token-yard');
          else dot.classList.add('panel-token-active');
          tokensEl.appendChild(dot);
        });
      }
    });
  }

  function updateTurnIndicator(color) {
    const el = document.getElementById('turn-indicator');
    if (!el) return;
    el.textContent = color.charAt(0).toUpperCase() + color.slice(1) + "'s Turn";
    el.style.color = COLOR_MAP[color] ? COLOR_MAP[color].main : '#333';
    el.style.borderColor = COLOR_MAP[color] ? COLOR_MAP[color].main : '#333';
  }

  function showMessage(msg) {
    const el = document.getElementById('game-message');
    if (!el) return;
    el.textContent = msg;
    el.style.opacity = '1';
    clearTimeout(el._fadeTimer);
    el._fadeTimer = setTimeout(function () {
      el.style.opacity = '0';
    }, 2500);
  }

  function showWinner(color, name) {
    const overlay = document.getElementById('winner-overlay');
    if (!overlay) return;
    const msg = overlay.querySelector('#winner-message');
    if (msg) msg.textContent = name + ' Wins! 🎉';
    overlay.style.display = 'flex';
    overlay.style.background = 'rgba(0,0,0,0.7)';
  }

  function hideWinner() {
    const overlay = document.getElementById('winner-overlay');
    if (overlay) overlay.style.display = 'none';
  }

  window.LudoUI = {
    buildBoard,
    renderBoard,
    highlightMovable,
    clearHighlights,
    animateTokenMove,
    updatePlayerPanels,
    updateTurnIndicator,
    showMessage,
    showWinner,
    hideWinner,
    getCell,
    COLOR_MAP
  };
})();
