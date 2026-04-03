'use strict';

(function () {
  // Dot positions for each die face (9-slot grid: [0]=top-left, [1]=top-center, [2]=top-right,
  // [3]=mid-left, [4]=center, [5]=mid-right, [6]=bottom-left, [7]=bottom-center, [8]=bottom-right)
  const DOT_PATTERNS = {
    1: [false, false, false, false, true,  false, false, false, false],
    2: [true,  false, false, false, false, false, false, false, true ],
    3: [true,  false, false, false, true,  false, false, false, true ],
    4: [true,  false, true,  false, false, false, true,  false, true ],
    5: [true,  false, true,  false, true,  false, true,  false, true ],
    6: [true,  false, true,  true,  false, true,  true,  false, true ]
  };

  function roll() {
    return Math.floor(Math.random() * 6) + 1;
  }

  function renderDie(element, value) {
    if (!element) return;
    element.innerHTML = '';
    element.dataset.value = value;
    const pattern = DOT_PATTERNS[value] || DOT_PATTERNS[1];
    pattern.forEach(function (hasDot) {
      const slot = document.createElement('div');
      slot.className = 'die-slot';
      if (hasDot) {
        const dot = document.createElement('div');
        dot.className = 'die-dot';
        slot.appendChild(dot);
      }
      element.appendChild(slot);
    });
  }

  function animateRoll(element, finalValue, callback) {
    if (!element) {
      if (callback) callback();
      return;
    }

    element.classList.add('rolling');
    const frames = 10;
    let count = 0;
    const interval = setInterval(function () {
      const temp = Math.floor(Math.random() * 6) + 1;
      renderDie(element, temp);
      count++;
      if (count >= frames) {
        clearInterval(interval);
        renderDie(element, finalValue);
        element.classList.remove('rolling');
        if (callback) callback();
      }
    }, 60);
  }

  window.LudoDice = {
    roll,
    renderDie,
    animateRoll
  };
})();
