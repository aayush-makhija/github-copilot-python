let gameCompleted = false;
// Client-side rendering and interaction for the Flask-backed Sudoku
let timerInterval = null;
let timerStart = null;
const SIZE = 9;
let puzzle = [];

function createBoardElement() {
  const boardDiv = document.getElementById('sudoku-board');
  boardDiv.innerHTML = '';
  for (let i = 0; i < SIZE; i++) {
    const rowDiv = document.createElement('div');
    rowDiv.className = 'sudoku-row';
    for (let j = 0; j < SIZE; j++) {
      const input = document.createElement('input');
      input.type = 'text';
      input.maxLength = 1;
      input.className = 'sudoku-cell';
      input.dataset.row = i;
      input.dataset.col = j;
      input.addEventListener('input', (event) => {
        if (gameCompleted) {
          return;
        }
        const value = event.target.value.replace(/[^1-9]/g, '');
        event.target.value = value;
        validateCell(event.target);
      });
      rowDiv.appendChild(input);
    }
    boardDiv.appendChild(rowDiv);
  }
}

function stopTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
}

function finishGame() {
  gameCompleted = true;
  stopTimer();

  const inputs = document
    .getElementById('sudoku-board')
    .getElementsByTagName('input');

  for (const input of inputs) {
    input.disabled = true;
  }

  const message = document.getElementById('message');
  message.style.color = '#388e3c';
  message.innerText = 'Congratulations! You solved it!';
}

function renderPuzzle(puz) {
  gameCompleted = false;
  puzzle = puz;
  createBoardElement();
  const boardDiv = document.getElementById('sudoku-board');
  const inputs = boardDiv.getElementsByTagName('input');
  for (let i = 0; i < SIZE; i++) {
    for (let j = 0; j < SIZE; j++) {
      const idx = i * SIZE + j;
      const val = puzzle[i][j];
      const inp = inputs[idx];
      if (val !== 0) {
        inp.value = val;
        inp.disabled = true;
        inp.className += ' prefilled';
      } else {
        inp.value = '';
        inp.disabled = false;
      }
    }
  }
}

function getCurrentBoard() {
  const inputs = document
    .getElementById('sudoku-board')
    .getElementsByTagName('input');

  const board = [];

  for (let row = 0; row < SIZE; row++) {
    board[row] = [];

    for (let col = 0; col < SIZE; col++) {
      const input = inputs[row * SIZE + col];
      board[row][col] = input.value ? parseInt(input.value, 10) : 0;
    }
  }

  return board;
}

async function requestHint() {
  const res = await fetch('/hint', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ board: getCurrentBoard() }),
  });

  const data = await res.json();
  const message = document.getElementById('message');

  if (data.error) {
    message.style.color = '#d32f2f';
    message.innerText = data.error;
    return;
  }

  const input = document.querySelector(
    `.sudoku-cell[data-row="${data.row}"][data-col="${data.col}"]`,
  );

  input.value = data.value;
  input.disabled = true;
  input.className = 'sudoku-cell hinted';

  message.style.color = '#388e3c';
  message.innerText = 'Hint added.';
}

function isValidMove(board, row, col, value) {
  for (let index = 0; index < SIZE; index++) {
    if (index !== col && board[row][index] === value) {
      return false;
    }

    if (index !== row && board[index][col] === value) {
      return false;
    }
  }

  const boxRow = row - (row % 3);
  const boxCol = col - (col % 3);

  for (let boxRowIndex = boxRow; boxRowIndex < boxRow + 3; boxRowIndex++) {
    for (let boxColIndex = boxCol; boxColIndex < boxCol + 3; boxColIndex++) {
      if (
        (boxRowIndex !== row || boxColIndex !== col) &&
        board[boxRowIndex][boxColIndex] === value
      ) {
        return false;
      }
    }
  }

  return true;
}

function validateCell(input) {
  if (gameCompleted) {
    return;
  }
  const value = input.value ? parseInt(input.value, 10) : 0;

  input.classList.remove('invalid');

  if (!value) {
    return;
  }

  const board = getCurrentBoard();
  const row = Number(input.dataset.row);
  const col = Number(input.dataset.col);

  if (!isValidMove(board, row, col, value)) {
    input.classList.add('invalid');
  }
}

function formatElapsedTime(milliseconds) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function startTimer() {
  clearInterval(timerInterval);

  timerStart = Date.now();
  document.getElementById('timer').innerText = '00:00';

  timerInterval = setInterval(() => {
    const elapsed = Date.now() - timerStart;
    document.getElementById('timer').innerText = formatElapsedTime(elapsed);
  }, 1000);
}

async function newGame() {
  const difficulty = document.getElementById('difficulty').value;
  const res = await fetch(`/new?difficulty=${encodeURIComponent(difficulty)}`);
  const data = await res.json();

  if (data.error) {
    document.getElementById('message').innerText = data.error;
    return;
  }

  renderPuzzle(data.puzzle);
  startTimer();
  document.getElementById('message').innerText = '';
}

async function checkSolution() {
  const boardDiv = document.getElementById('sudoku-board');
  const inputs = boardDiv.getElementsByTagName('input');
  const board = [];
  for (let i = 0; i < SIZE; i++) {
    board[i] = [];
    for (let j = 0; j < SIZE; j++) {
      const idx = i * SIZE + j;
      const val = inputs[idx].value;
      board[i][j] = val ? parseInt(val, 10) : 0;
    }
  }
  const res = await fetch('/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ board }),
  });
  const data = await res.json();
  const msg = document.getElementById('message');
  if (data.error) {
    msg.style.color = '#d32f2f';
    msg.innerText = data.error;
    return;
  }
  const incorrect = new Set(data.incorrect.map((x) => x[0] * SIZE + x[1]));
  for (let idx = 0; idx < inputs.length; idx++) {
    const inp = inputs[idx];
    if (inp.disabled) continue;
    inp.className = 'sudoku-cell';
    if (incorrect.has(idx)) {
      inp.className = 'sudoku-cell incorrect';
    }
  }
  if (incorrect.size === 0) {
    finishGame();
  } else {
    msg.style.color = '#d32f2f';
    msg.innerText = 'Some cells are incorrect.';
  }
}

// Wire buttons
window.addEventListener('load', () => {
  document.getElementById('new-game').addEventListener('click', newGame);
  document.getElementById('difficulty').addEventListener('change', newGame);
  document
    .getElementById('check-solution')
    .addEventListener('click', checkSolution);
  document.getElementById('hint').addEventListener('click', requestHint);
  newGame();
});
