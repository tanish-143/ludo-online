'use strict';

(function () {
  // 52-cell common path: [row, col]
  const PATH = [
    [6,1],[6,2],[6,3],[6,4],[6,5],[5,6],[4,6],[3,6],[2,6],[1,6],[0,6],[0,7],[0,8],
    [1,8],[2,8],[3,8],[4,8],[5,8],[6,9],[6,10],[6,11],[6,12],[6,13],[6,14],[7,14],
    [8,14],[8,13],[8,12],[8,11],[8,10],[8,9],[9,8],[10,8],[11,8],[12,8],[13,8],
    [14,8],[14,7],[14,6],[13,6],[12,6],[11,6],[10,6],[9,6],[8,5],[8,4],[8,3],
    [8,2],[8,1],[8,0],[7,0],[6,0]
  ];

  // Home columns (6 cells leading to center)
  const HOME_COLS = {
    red:    [[7,1],[7,2],[7,3],[7,4],[7,5],[7,6]],
    green:  [[1,7],[2,7],[3,7],[4,7],[5,7],[6,7]],
    yellow: [[7,13],[7,12],[7,11],[7,10],[7,9],[7,8]],
    blue:   [[13,7],[12,7],[11,7],[10,7],[9,7],[8,7]]
  };

  // Index in PATH (0-based) where each color enters the common path
  const ENTRY_INDEX = { red: 0, green: 13, yellow: 26, blue: 39 };

  // Index in PATH (0-based) just BEFORE entering the home column
  // After this index, next step goes into home col step 1
  const HOME_ENTRY_INDEX = { red: 51, green: 12, yellow: 25, blue: 38 };

  // Safe positions (1-based path positions)
  const SAFE_POS = new Set([1, 9, 14, 19, 27, 31, 40, 44]);

  // Home base yard coordinates for display (not on path)
  const HOME_YARD = {
    red:    [[1,1],[1,2],[2,1],[2,2],[3,1],[3,2]],
    green:  [[1,12],[1,13],[2,12],[2,13],[3,12],[3,13]],
    yellow: [[11,12],[11,13],[12,12],[12,13],[13,12],[13,13]],
    blue:   [[11,1],[11,2],[12,1],[12,2],[13,1],[13,2]]
  };

  const COLORS = ['red', 'green', 'yellow', 'blue'];
  const TOKENS_PER_PLAYER = 4;

  let state = null;

  function initGame(playerCount) {
    playerCount = playerCount || 4;
    state = {
      playerCount,
      players: [],
      currentPlayerIndex: 0,
      consecutiveSixes: 0,
      lastDice: null,
      phase: 'roll', // 'roll' | 'move'
      winner: null
    };

    const names = ['Red', 'Green', 'Yellow', 'Blue'];
    for (let i = 0; i < 4; i++) {
      const color = COLORS[i];
      const tokens = [];
      for (let t = 0; t < TOKENS_PER_PLAYER; t++) {
        tokens.push({
          id: t,
          color,
          // pos: -1 = in home yard; 1-52 = on common path (1-based); 101-106 = home col; 107 = finished
          pos: -1
        });
      }
      state.players.push({
        color,
        name: names[i],
        tokens,
        active: i < playerCount,
        finished: false
      });
    }

    return state;
  }

  function getState() { return state; }

  function getCurrentPlayer() {
    return state.players[state.currentPlayerIndex];
  }

  function rollDice() {
    const value = Math.floor(Math.random() * 6) + 1;
    state.lastDice = value;
    if (value === 6) {
      state.consecutiveSixes++;
    } else {
      state.consecutiveSixes = 0;
    }
    state.phase = 'move';
    return value;
  }

  function isSafePosition(absPos) {
    return SAFE_POS.has(absPos);
  }

  // Convert 0-based PATH index to 1-based position
  function idxToPos(idx) { return idx + 1; }
  // Convert 1-based pos to 0-based index
  function posToIdx(pos) { return pos - 1; }

  // Get the absolute path index (0-based) for a token's relative step count from its entry
  // relativePath: how many steps taken on common path (0 = at entry point)
  function relToAbsIdx(color, relSteps) {
    return (ENTRY_INDEX[color] + relSteps) % 52;
  }

  // How many relative steps has this token taken from its color's entry?
  function getRelSteps(color, pos) {
    if (pos <= 0) return -1;
    if (pos >= 101) return 52 + (pos - 100); // in home col
    // pos is 1-based absolute path pos; convert to 0-based index
    const absIdx = posToIdx(pos);
    const entryIdx = ENTRY_INDEX[color];
    return (absIdx - entryIdx + 52) % 52;
  }

  // Steps remaining before entering home column (from current pos)
  // Home column entry = HOME_ENTRY_INDEX + 1 step goes to home col 1
  function stepsToHomeEntry(color, pos) {
    if (pos <= 0 || pos >= 101) return Infinity;
    const relSteps = getRelSteps(color, pos);
    // To reach HOME_ENTRY_INDEX we need:
    const entryIdx = ENTRY_INDEX[color];
    const homeEntryIdx = HOME_ENTRY_INDEX[color];
    const stepsToEntry = (homeEntryIdx - entryIdx + 52) % 52; // total rel steps to home entry index
    return stepsToEntry - relSteps; // remaining steps
  }

  // Can a token from home-yard come out? Requires dice=6
  function canExitHomeYard(color, diceValue) {
    return diceValue === 6;
  }

  // Starting path position (1-based) for a color
  function startPos(color) {
    return idxToPos(ENTRY_INDEX[color]);
  }

  function getMovableTokens(color, diceValue) {
    const player = state.players.find(p => p.color === color);
    if (!player) return [];

    const movable = [];

    for (const token of player.tokens) {
      if (token.pos === 107) continue; // already finished

      if (token.pos === -1) {
        // In home yard — need 6 to exit
        if (diceValue === 6) {
          // Check if start position is not fully blocked by own tokens
          const sp = startPos(color);
          const ownBlockers = player.tokens.filter(t => t.pos === sp).length;
          if (ownBlockers < 4) movable.push(token.id);
        }
        continue;
      }

      // Token is on the board
      if (token.pos >= 1 && token.pos <= 52) {
        const steps = stepsToHomeEntry(color, token.pos);
        if (steps > 0) {
          // Can move on common path
          if (steps >= diceValue) {
            // Moves within or to home entry
            movable.push(token.id);
          } else {
            // Would enter home column
            const homeSteps = diceValue - steps;
            if (homeSteps <= 6) movable.push(token.id); // fits in home col
          }
        } else if (steps === 0) {
          // At home entry index, next step enters home col
          if (diceValue <= 6) movable.push(token.id);
        }
      } else if (token.pos >= 101 && token.pos <= 106) {
        const homeColStep = token.pos - 100; // 1-6
        const remaining = 6 - homeColStep; // steps to finish (pos 107 = step 6 done)
        if (diceValue <= remaining + 1) {
          // +1 because at step 6 with dice 1 → finishes
          if (homeColStep + diceValue <= 7) movable.push(token.id);
        }
      }
    }

    return movable;
  }

  function moveToken(color, tokenId, diceValue) {
    const player = state.players.find(p => p.color === color);
    const token = player.tokens.find(t => t.id === tokenId);
    if (!token) return null;

    const result = {
      tokenId,
      color,
      fromPos: token.pos,
      toPos: null,
      captured: [],
      finished: false,
      enteredHome: false
    };

    if (token.pos === -1) {
      // Exit from yard to start
      token.pos = startPos(color);
      result.toPos = token.pos;
      // Check capture at start position
      result.captured = checkCapture(color, token.pos);
      return result;
    }

    if (token.pos >= 101 && token.pos <= 106) {
      // In home column
      const newStep = (token.pos - 100) + diceValue;
      if (newStep === 7) {
        token.pos = 107;
        result.toPos = 107;
        result.finished = true;
      } else if (newStep < 7) {
        token.pos = 100 + newStep;
        result.toPos = token.pos;
      }
      return result;
    }

    if (token.pos >= 1 && token.pos <= 52) {
      const steps = stepsToHomeEntry(color, token.pos);
      if (diceValue <= steps) {
        // Stays on common path
        const absIdx = posToIdx(token.pos);
        const newAbsIdx = (absIdx + diceValue) % 52;
        token.pos = idxToPos(newAbsIdx);
        result.toPos = token.pos;
        if (diceValue === steps) {
          // Landed exactly on home entry — still on path at HOME_ENTRY_INDEX
          // next move will push into home col
        }
        result.captured = checkCapture(color, token.pos);
      } else {
        // Enters home column
        const homeSteps = diceValue - steps;
        token.pos = 100 + homeSteps;
        result.toPos = token.pos;
        result.enteredHome = true;
        if (homeSteps === 7) {
          token.pos = 107;
          result.toPos = 107;
          result.finished = true;
        }
      }
      return result;
    }

    return result;
  }

  function checkCapture(movingColor, position) {
    // Can't capture on safe positions
    if (position < 1 || position > 52) return [];
    if (isSafePosition(position)) return [];

    // Check if this is a start position for any color — start positions are safe
    for (const c of COLORS) {
      if (position === startPos(c) && c !== movingColor) {
        // It's another color's start — that is safe
        return [];
      }
    }

    const captured = [];
    for (const player of state.players) {
      if (player.color === movingColor) continue;
      for (const token of player.tokens) {
        if (token.pos === position) {
          // Count how many of the same color are here; block of 2+ can't be captured
          const sameColorCount = player.tokens.filter(t => t.pos === position).length;
          if (sameColorCount >= 2) continue; // blockade — can't capture
          token.pos = -1;
          captured.push({ color: player.color, tokenId: token.id });
        }
      }
    }
    return captured;
  }

  function checkWin() {
    for (const player of state.players) {
      if (!player.active) continue;
      if (player.tokens.every(t => t.pos === 107)) {
        state.winner = player.color;
        return player.color;
      }
    }
    return null;
  }

  function nextTurn(rolled6) {
    if (rolled6 && state.consecutiveSixes < 3) {
      // Same player rolls again — don't advance
    } else {
      // Advance to next active player
      state.consecutiveSixes = 0;
      let next = (state.currentPlayerIndex + 1) % 4;
      let tries = 0;
      while (!state.players[next].active && tries < 4) {
        next = (next + 1) % 4;
        tries++;
      }
      state.currentPlayerIndex = next;
    }
    state.phase = 'roll';
    state.lastDice = null;
  }

  function getPathCoord(pos) {
    if (pos === -1) return null;
    if (pos >= 1 && pos <= 52) return PATH[pos - 1];
    if (pos >= 101 && pos <= 106) {
      const color = null; // need color context
      return null;
    }
    if (pos === 107) return [7, 7]; // center
    return null;
  }

  function getTokenCoord(token) {
    if (token.pos === -1) {
      // Return a home yard coord based on token id
      const yards = HOME_YARD[token.color];
      return yards[token.id % yards.length];
    }
    if (token.pos >= 1 && token.pos <= 52) {
      return PATH[token.pos - 1];
    }
    if (token.pos >= 101 && token.pos <= 106) {
      return HOME_COLS[token.color][token.pos - 101];
    }
    if (token.pos === 107) {
      return [7, 7];
    }
    return null;
  }

  function getScore(color) {
    const player = state.players.find(p => p.color === color);
    if (!player) return 0;
    return player.tokens.filter(t => t.pos === 107).length;
  }

  window.LudoGame = {
    PATH,
    HOME_COLS,
    HOME_YARD,
    ENTRY_INDEX,
    HOME_ENTRY_INDEX,
    COLORS,
    initGame,
    getState,
    getCurrentPlayer,
    rollDice,
    getMovableTokens,
    moveToken,
    checkCapture,
    checkWin,
    nextTurn,
    isSafePosition,
    startPos,
    getTokenCoord,
    getScore
  };
})();
