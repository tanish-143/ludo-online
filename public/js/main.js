'use strict';

(function () {
  const G = window.LudoGame;
  const UI = window.LudoUI;
  const Dice = window.LudoDice;

  let diceEl = null;
  let rollBtn = null;
  let animating = false;

  function init() {
    G.initGame(4);
    UI.buildBoard();
    UI.renderBoard();
    UI.updatePlayerPanels();
    UI.updateTurnIndicator(G.getCurrentPlayer().color);

    diceEl = document.getElementById('dice');
    rollBtn = document.getElementById('roll-btn');

    Dice.renderDie(diceEl, 1);

    rollBtn.addEventListener('click', onRollClick);

    // Token click delegation on board
    document.getElementById('board').addEventListener('click', onTokenClick);

    // New game button
    const newGameBtn = document.getElementById('new-game-btn');
    if (newGameBtn) {
      newGameBtn.addEventListener('click', function () {
        UI.hideWinner();
        G.initGame(4);
        UI.buildBoard();
        UI.renderBoard();
        UI.updatePlayerPanels();
        UI.updateTurnIndicator(G.getCurrentPlayer().color);
        Dice.renderDie(diceEl, 1);
        rollBtn.disabled = false;
        animating = false;
      });
    }
  }

  function onRollClick() {
    if (animating) return;
    const state = G.getState();
    if (state.phase !== 'roll') return;

    animating = true;
    rollBtn.disabled = true;

    const value = G.rollDice();
    Dice.animateRoll(diceEl, value, function () {
      animating = false;
      onDiceResult(value);
    });
  }

  function onDiceResult(value) {
    const state = G.getState();
    const player = G.getCurrentPlayer();

    UI.updateTurnIndicator(player.color);
    UI.showMessage(player.name + ' rolled a ' + value + '!');

    // 3 consecutive sixes — forfeit turn
    if (state.consecutiveSixes >= 3) {
      UI.showMessage('Three sixes! Turn forfeited.');
      state.consecutiveSixes = 0;
      setTimeout(function () {
        G.nextTurn(false);
        startNextTurn();
      }, 1200);
      return;
    }

    const movable = G.getMovableTokens(player.color, value);

    if (movable.length === 0) {
      UI.showMessage('No moves available. Passing...');
      setTimeout(function () {
        G.nextTurn(false);
        startNextTurn();
      }, 1200);
      return;
    }

    if (movable.length === 1) {
      // Auto-move
      setTimeout(function () {
        executeMove(player.color, movable[0], value);
      }, 400);
      return;
    }

    // Let player choose
    UI.highlightMovable(movable, player.color);
    UI.showMessage('Click a highlighted token to move.');
    // store pending move info
    window._pendingMove = { color: player.color, movable, value };
  }

  function onTokenClick(e) {
    const tokenEl = e.target.closest('.token');
    if (!tokenEl) return;
    if (!tokenEl.classList.contains('token-movable')) return;

    const color = tokenEl.dataset.color;
    const id = parseInt(tokenEl.dataset.id);

    const pending = window._pendingMove;
    if (!pending || pending.color !== color || !pending.movable.includes(id)) return;

    window._pendingMove = null;
    UI.clearHighlights();
    executeMove(color, id, pending.value);
  }

  function executeMove(color, tokenId, diceValue) {
    if (animating) return;
    animating = true;

    const state = G.getState();

    // Get from coord BEFORE move and capture its bounding rect immediately
    const player = state.players.find(p => p.color === color);
    const token = player.tokens.find(t => t.id === tokenId);
    const fromCoord = G.getTokenCoord(token);
    // Capture the token's bounding rect BEFORE renderBoard() moves it to the new cell.
    // If captured after renderBoard(), fromRect would equal toCell's rect and no animation occurs.
    const fromCell = fromCoord ? UI.getCell(fromCoord[0], fromCoord[1]) : null;
    const fromRect = fromCell ? fromCell.getBoundingClientRect() : null;

    const result = G.moveToken(color, tokenId, diceValue);

    // Get to coord AFTER move
    const toCoord = G.getTokenCoord(token);

    UI.renderBoard();

    // Animate: token element is now at its new cell; ghost flies from fromRect to toCell
    const tokenEl = document.getElementById('token-' + color + '-' + tokenId);
    const toCell = toCoord ? UI.getCell(toCoord[0], toCoord[1]) : null;

    function afterAnimation() {
      animating = false;

      // Show capture message
      if (result.captured && result.captured.length > 0) {
        const names = result.captured.map(c => c.color).join(', ');
        UI.showMessage(color + ' captured ' + names + '!');
      }

      if (result.finished) {
        UI.showMessage('A ' + color + ' token reached home!');
      }

      UI.updatePlayerPanels();

      // Check win
      const winner = G.checkWin();
      if (winner) {
        const winPlayer = state.players.find(p => p.color === winner);
        UI.showWinner(winner, winPlayer.name);
        return;
      }

      // If rolled 6 and < 3 consecutive sixes, same player goes again
      const rolled6 = diceValue === 6;
      G.nextTurn(rolled6);
      startNextTurn();
    }

    if (tokenEl && toCell && fromRect) {
      UI.animateTokenMove(tokenEl, fromRect, toCell, afterAnimation);
    } else {
      afterAnimation();
    }
  }

  function startNextTurn() {
    const player = G.getCurrentPlayer();
    UI.updateTurnIndicator(player.color);
    UI.updatePlayerPanels();
    rollBtn.disabled = false;
    UI.showMessage(player.name + "'s turn — click Roll Dice!");
  }

  document.addEventListener('DOMContentLoaded', init);
})();
