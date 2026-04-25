/**
 * @module minigames
 * @description The 8 in-game minigames plus pure helpers used by tests.
 *
 * Games:
 *   snake, guess, matrix, pong, wordle, qte, logicPuzzle, morse
 *
 * Each game returns a Promise that resolves to:
 *   { completed: bool, win?: bool, score?: number, attempts?: number }
 *
 * Pure (testable, side-effect-free) helpers exported alongside:
 *   scoreGuess(target, guess)         — Wordle-style green/yellow/grey marks
 *   evaluateCircuit(circuit, env)     — runs a chain of logic gates
 *   solveCircuit(circuit, vars, t, v) — brute-force SAT for the puzzle
 *   morseEncode(text) / morseDecode(code) — round-trip safe, multi-word
 *   MORSE_MAP, LOGIC_GATES            — lookup tables
 */

const readline = require('readline');
const { colors, sleep } = require('./ui');

// Raw-mode key listener. Remembers previous state, restores on cleanup.
function setupKeyListener(callback) {
  const stdin = process.stdin;
  const wasRaw = !!stdin.isRaw;
  const wasPaused = stdin.isPaused();
  const prevEncoding = stdin._readableState && stdin._readableState.encoding;

  if (stdin.setRawMode) stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding('utf8');

  const handler = (key) => {
    if (key === '\u0003') { // Ctrl+C -> graceful quit from minigame
      cleanup();
      process.exit(0);
      return;
    }
    try { callback(key); } catch (_) { /* ignore */ }
  };

  stdin.on('data', handler);

  const cleanup = () => {
    stdin.removeListener('data', handler);
    if (stdin.setRawMode) stdin.setRawMode(wasRaw);
    if (prevEncoding) stdin.setEncoding(prevEncoding);
    if (wasPaused) stdin.pause();
  };

  return cleanup;
}

// --- Snake ---
async function snake(game) {
  console.clear();
  console.log(colors.bold('Snake'));
  console.log(colors.dim('WASD / arrows | P pause | Q quit'));
  console.log();

  const width = 20;
  const height = 15;
  let snakeBody = [{ x: 10, y: 7 }];
  let food = randomPos(width, height, snakeBody);
  let direction = { x: 0, y: -1 };
  let pendingDirection = direction;
  let score = 0;
  let gameOver = false;
  let paused = false;
  let speed = 150;
  let stopped = false;

  function randomPos(w, h, body) {
    let pos;
    do {
      pos = { x: Math.floor(Math.random() * w), y: Math.floor(Math.random() * h) };
    } while (body.some((s) => s.x === pos.x && s.y === pos.y));
    return pos;
  }

  function draw() {
    if (!process.stdout.isTTY) return;
    process.stdout.write('\x1b[3;1H');
    let out = '+' + '-'.repeat(width * 2) + '+\n';
    for (let y = 0; y < height; y++) {
      out += '|';
      for (let x = 0; x < width; x++) {
        const isHead = snakeBody[0].x === x && snakeBody[0].y === y;
        const isBody = !isHead && snakeBody.some((s) => s.x === x && s.y === y);
        const isFood = food.x === x && food.y === y;
        if (isHead) out += colors.bold('@ ');
        else if (isBody) out += colors.primary('o ');
        else if (isFood) out += colors.error('* ');
        else out += '  ';
      }
      out += '|\n';
    }
    out += '+' + '-'.repeat(width * 2) + '+\n';
    out += colors.bold(`score: ${score}`);
    if (paused) out += colors.warning('  [paused]');
    console.log(out);
  }

  return new Promise((resolve) => {
    const cleanupKeys = setupKeyListener((key) => {
      if (key === 'p' || key === 'P') { paused = !paused; return; }
      if (key === 'q' || key === 'Q') { gameOver = true; return; }
      if (paused) return;
      switch (key) {
        case 'w': case 'W': case '[A':
          if (direction.y === 0) pendingDirection = { x: 0, y: -1 }; break;
        case 's': case 'S': case '[B':
          if (direction.y === 0) pendingDirection = { x: 0, y: 1 }; break;
        case 'a': case 'A': case '[D':
          if (direction.x === 0) pendingDirection = { x: -1, y: 0 }; break;
        case 'd': case 'D': case '[C':
          if (direction.x === 0) pendingDirection = { x: 1, y: 0 }; break;
      }
    });

    function finish(reason) {
      if (stopped) return;
      stopped = true;
      cleanupKeys();
      console.log();
      if (reason === 'quit') {
        console.log(colors.dim('snake: quit'));
        resolve({ completed: false, win: false, score });
        return;
      }
      console.log(colors.error('game over'));
      console.log(colors.bold(`final score: ${score}`));
      const exp = Math.floor(score / 2);
      if (exp > 0) {
        console.log(colors.gold(`+${exp} EXP`));
        game.addExp(exp, 'snake').catch(() => {});
      }
      resolve({ completed: true, win: false, score });
    }

    function tick() {
      if (stopped) return;
      if (gameOver) { finish(score > 0 ? 'over' : 'quit'); return; }
      if (paused) { schedule(); return; }

      direction = pendingDirection;
      const head = { x: snakeBody[0].x + direction.x, y: snakeBody[0].y + direction.y };
      if (head.x < 0) head.x = width - 1;
      if (head.x >= width) head.x = 0;
      if (head.y < 0) head.y = height - 1;
      if (head.y >= height) head.y = 0;

      if (snakeBody.some((s) => s.x === head.x && s.y === head.y)) { gameOver = true; finish('over'); return; }

      snakeBody.unshift(head);
      if (head.x === food.x && head.y === food.y) {
        score += 10;
        food = randomPos(width, height, snakeBody);
        speed = Math.max(70, speed - 4);
      } else {
        snakeBody.pop();
      }
      draw();
      schedule();
    }

    function schedule() {
      // re-arm timer with current speed (fixes "speed never changes" bug)
      setTimeout(tick, speed);
    }

    draw();
    schedule();
  });
}

// --- Guess ---
async function guess(game) {
  console.clear();
  console.log(colors.bold('Guess the number'));
  console.log(colors.dim('I picked a number 1-100. (type q to quit)'));
  console.log();

  const target = Math.floor(Math.random() * 100) + 1;
  let attempts = 0;
  const history = [];
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  return new Promise((resolve) => {
    let done = false;
    const finish = (result) => {
      if (done) return;
      done = true;
      rl.close();
      resolve(result);
    };
    const ask = () => {
      if (done) return;
      rl.question(colors.bold('guess (1-100): '), (input) => {
        if (done) return;
        const trimmed = (input || '').trim().toLowerCase();
        if (trimmed === 'q' || trimmed === 'quit') {
          finish({ completed: false, win: false, attempts });
          return;
        }
        const n = parseInt(trimmed, 10);
        if (!Number.isFinite(n) || n < 1 || n > 100) {
          console.log(colors.error('please enter a number 1-100'));
          ask();
          return;
        }
        attempts++;
        history.push(n);
        if (n === target) {
          console.log(colors.success(`correct! answer: ${target}`));
          console.log(colors.dim(`attempts: ${attempts}`));
          let exp = 20;
          if (attempts === 1) exp = 100;
          else if (attempts <= 3) exp = 50;
          else if (attempts <= 5) exp = 30;
          console.log(colors.gold(`+${exp} EXP`));
          game.addExp(exp, 'guess').catch(() => {});
          finish({ completed: true, win: true, attempts });
          return;
        }
        console.log(colors.warning(n < target ? 'too low' : 'too high'));
        const diff = Math.abs(n - target);
        if (diff <= 5) console.log(colors.error('very close!'));
        else if (diff <= 15) console.log(colors.warning('getting warm'));
        else if (diff <= 30) console.log(colors.info('cold'));
        console.log(colors.dim(`history: ${history.join(', ')}`));
        ask();
      });
    };
    rl.on('close', () => finish({ completed: false, win: false, attempts }));
    ask();
  });
}

// --- Matrix ---
async function matrix(game) {
  console.clear();
  console.log(colors.dim('press any key to stop'));
  await sleep(300);

  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*';
  const width = Math.max(20, process.stdout.columns || 80);
  const height = Math.max(10, process.stdout.rows || 24);
  const cols = Math.floor(width / 2);
  const drops = new Array(cols).fill(0).map(() => Math.random() * -height);
  const trailLen = 5;
  let stopped = false;

  return new Promise((resolve) => {
    const cleanup = setupKeyListener(() => {
      if (stopped) return;
      stopped = true;
      clearInterval(interval);
      cleanup();
      console.clear();
      resolve({ completed: true });
    });

    const interval = setInterval(() => {
      if (stopped) return;
      let output = '';
      for (let i = 0; i < Math.floor(height / 2); i++) {
        for (let j = 0; j < cols; j++) {
          const d = Math.floor(drops[j]);
          const isHead = d === i;
          const isTrail = d > i && d - trailLen <= i;
          if (isHead) output += colors.white(chars[Math.floor(Math.random() * chars.length)]) + ' ';
          else if (isTrail) {
            const intensity = (d - i) / trailLen;
            const c = chars[Math.floor(Math.random() * chars.length)];
            if (intensity > 0.7) output += colors.primary(c) + ' ';
            else if (intensity > 0.4) output += colors.secondary(c) + ' ';
            else output += colors.dim(c) + ' ';
          } else {
            output += '  ';
          }
        }
        output += '\n';
      }
      for (let j = 0; j < drops.length; j++) {
        drops[j] += 0.5;
        if (drops[j] * 2 > height && Math.random() > 0.975) drops[j] = -Math.random() * 5;
      }
      console.clear();
      console.log(output);
    }, 80);
  });
}

// --- Pong ---
async function pong(game) {
  console.clear();
  console.log(colors.bold('Pong'));
  console.log(colors.dim('W/S move paddle | Q quit | first to 5 wins'));
  console.log();

  const width = 40;
  const height = 12;
  let ball = { x: width / 2, y: height / 2, dx: 1, dy: 0.5 };
  let playerY = Math.floor(height / 2) - 2;
  let aiY = Math.floor(height / 2) - 2;
  const paddleHeight = 4;
  let playerScore = 0;
  let aiScore = 0;
  let gameOver = false;
  let stopped = false;

  function draw() {
    if (!process.stdout.isTTY) return;
    process.stdout.write('\x1b[3;1H');
    let out = '+' + '-'.repeat(width) + '+\n';
    for (let y = 0; y < height; y++) {
      out += '|';
      for (let x = 0; x < width; x++) {
        const isBall = Math.floor(ball.x) === x && Math.floor(ball.y) === y;
        const isPlayer = x === 1 && y >= playerY && y < playerY + paddleHeight;
        const isAI = x === width - 2 && y >= aiY && y < aiY + paddleHeight;
        const isNet = x === Math.floor(width / 2) && y % 2 === 0;
        if (isBall) out += colors.error('o');
        else if (isPlayer) out += colors.primary('#');
        else if (isAI) out += colors.secondary('#');
        else if (isNet) out += colors.dim('|');
        else out += ' ';
      }
      out += '|\n';
    }
    out += '+' + '-'.repeat(width) + '+\n';
    out += colors.bold(`  you: ${playerScore}  ai: ${aiScore}`);
    console.log(out);
  }

  return new Promise((resolve) => {
    const cleanup = setupKeyListener((key) => {
      if (key === 'q' || key === 'Q') { gameOver = true; return; }
      switch (key) {
        case 'w': case 'W': case '[A':
          if (playerY > 0) playerY--; break;
        case 's': case 'S': case '[B':
          if (playerY < height - paddleHeight) playerY++; break;
      }
    });

    function finish(quit) {
      if (stopped) return;
      stopped = true;
      clearInterval(loop);
      cleanup();
      console.log();
      if (quit) {
        resolve({ completed: false, win: false, score: playerScore });
        return;
      }
      if (playerScore >= 5) {
        console.log(colors.success('you win!'));
        console.log(colors.gold('+50 EXP'));
        game.addExp(50, 'pong-win').catch(() => {});
        resolve({ completed: true, win: true, score: playerScore });
      } else {
        console.log(colors.error('game over'));
        const exp = playerScore * 10;
        if (exp > 0) {
          console.log(colors.gold(`+${exp} EXP`));
          game.addExp(exp, 'pong').catch(() => {});
        }
        resolve({ completed: true, win: false, score: playerScore });
      }
    }

    const loop = setInterval(() => {
      if (stopped) return;
      if (gameOver) { finish(true); return; }

      ball.x += ball.dx;
      ball.y += ball.dy;
      if (ball.y <= 0 || ball.y >= height - 1) ball.dy = -ball.dy;

      // robust paddle collisions (use ball.x range, not integer equality)
      if (ball.dx < 0 && ball.x <= 2 && ball.x >= 1 && ball.y >= playerY && ball.y < playerY + paddleHeight) {
        ball.dx = Math.abs(ball.dx) * 1.05;
        ball.dy += (ball.y - playerY - paddleHeight / 2) * 0.1;
      }
      if (ball.dx > 0 && ball.x >= width - 3 && ball.x <= width - 2 && ball.y >= aiY && ball.y < aiY + paddleHeight) {
        ball.dx = -Math.abs(ball.dx) * 1.05;
      }

      if (ball.x < 0) {
        aiScore++;
        ball = { x: width / 2, y: height / 2, dx: -1, dy: (Math.random() - 0.5) };
      }
      if (ball.x > width) {
        playerScore++;
        ball = { x: width / 2, y: height / 2, dx: 1, dy: (Math.random() - 0.5) };
      }

      const aiCenter = aiY + paddleHeight / 2;
      if (aiCenter < ball.y - 1) aiY = Math.min(height - paddleHeight, aiY + 0.8);
      if (aiCenter > ball.y + 1) aiY = Math.max(0, aiY - 0.8);

      if (playerScore >= 5 || aiScore >= 5) { finish(false); return; }
      draw();
    }, 100);

    draw();
  });
}

// --- Wordle ---
function scoreGuess(target, guess) {
  const n = target.length;
  const result = new Array(n).fill('-');
  const used = new Array(n).fill(false);
  // greens
  for (let i = 0; i < n; i++) {
    if (guess[i] === target[i]) { result[i] = 'G'; used[i] = true; }
  }
  // yellows
  for (let i = 0; i < n; i++) {
    if (result[i] === 'G') continue;
    for (let j = 0; j < n; j++) {
      if (!used[j] && guess[i] === target[j]) {
        result[i] = 'Y';
        used[j] = true;
        break;
      }
    }
  }
  return result;
}

async function wordle(game) {
  // keep all words the same length for a fair game
  const words = ['KIMI', 'CODE', 'HACK', 'DATA', 'BYTE', 'NODE', 'BASH', 'DISK'];
  const target = words[Math.floor(Math.random() * words.length)];
  const maxAttempts = 6;

  console.clear();
  console.log(colors.bold('Wordle'));
  console.log(colors.dim(`guess a ${target.length}-letter word`));
  console.log(colors.dim('G = correct  Y = wrong position  - = not in word'));
  console.log();

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  let attempts = 0;

  return new Promise((resolve) => {
    let done = false;
    const finish = (r) => {
      if (done) return;
      done = true;
      rl.close();
      resolve(r);
    };

    const ask = () => {
      if (done) return;
      if (attempts >= maxAttempts) {
        console.log(colors.error(`out of tries - answer: ${target}`));
        finish({ completed: true, win: false, attempts });
        return;
      }
      rl.question(colors.bold(`guess ${attempts + 1}/${maxAttempts}: `), (input) => {
        if (done) return;
        const guess = (input || '').toUpperCase().trim();
        if (guess === 'Q' || guess === 'QUIT') {
          finish({ completed: false, win: false, attempts });
          return;
        }
        if (guess.length !== target.length) {
          console.log(colors.error(`enter ${target.length} letters`));
          ask();
          return;
        }
        if (!/^[A-Z]+$/.test(guess)) {
          console.log(colors.error('letters only'));
          ask();
          return;
        }
        attempts++;
        const scored = scoreGuess(target, guess);
        const render = scored.map((tag, i) => {
          if (tag === 'G') return colors.success('[' + guess[i] + ']');
          if (tag === 'Y') return colors.warning('{' + guess[i] + '}');
          return colors.dim(' ' + guess[i] + ' ');
        }).join('');
        console.log('  ' + render);
        if (guess === target) {
          console.log(colors.success('correct!'));
          let exp = 30;
          if (attempts === 1) exp = 100;
          else if (attempts <= 2) exp = 70;
          else if (attempts <= 3) exp = 50;
          console.log(colors.gold(`+${exp} EXP`));
          game.addExp(exp, 'wordle').catch(() => {});
          finish({ completed: true, win: true, attempts });
          return;
        }
        ask();
      });
    };
    rl.on('close', () => finish({ completed: false, win: false, attempts }));
    ask();
  });
}

// --- Reaction QTE ---
// Press the shown key within `window` ms. Three rounds, count hits.
async function qte(game, opts = {}) {
  const window = opts.window || 1200;
  const rounds = opts.rounds || 3;
  const keys = 'ASDFJKL;'.split('');

  console.clear();
  console.log(colors.bold('Reaction QTE'));
  console.log(colors.dim(`Press the shown key within ${window}ms. ${rounds} rounds.`));
  console.log();

  let hits = 0;
  for (let r = 1; r <= rounds; r++) {
    const target = keys[Math.floor(Math.random() * keys.length)];
    console.log(colors.warning(`Round ${r}/${rounds} -> press ${colors.bold(target)} now!`));
    const start = Date.now();
    const result = await new Promise((resolve) => {
      let resolved = false;
      const cleanup = setupKeyListener((key) => {
        if (resolved) return;
        resolved = true;
        cleanup();
        resolve({ key, elapsed: Date.now() - start });
      });
      setTimeout(() => {
        if (resolved) return;
        resolved = true;
        cleanup();
        resolve({ key: null, elapsed: window + 1 });
      }, window);
    });
    if (result.key && result.key.toUpperCase() === target.toUpperCase() && result.elapsed <= window) {
      hits++;
      console.log(colors.success(`  hit (${result.elapsed}ms)`));
    } else {
      console.log(colors.error(`  miss (pressed: ${result.key || 'nothing'})`));
    }
  }

  const win = hits === rounds;
  if (win) {
    console.log(colors.success(`clean sweep ${hits}/${rounds}`));
    console.log(colors.gold('+60 EXP'));
    if (game && game.addExp) game.addExp(60, 'qte').catch(() => {});
    if (game && game.gameState) game.gameState.qteWon = true;
  } else {
    const exp = hits * 10;
    console.log(colors.warning(`score: ${hits}/${rounds}`));
    if (exp > 0) {
      console.log(colors.gold(`+${exp} EXP`));
      if (game && game.addExp) game.addExp(exp, 'qte').catch(() => {});
    }
  }
  return { completed: true, win, score: hits };
}

// --- Logic circuit puzzle ---
// A tiny boolean-circuit solver: given gate list + truth expectation, ask player
// which inputs (A..) satisfy. Pure evaluator is exported for tests.
const LOGIC_GATES = {
  AND: (a, b) => !!(a && b),
  OR:  (a, b) => !!(a || b),
  XOR: (a, b) => !!(a) !== !!(b),
  NAND: (a, b) => !(a && b),
  NOR: (a, b) => !(a || b)
};

function evaluateCircuit(circuit, inputs) {
  // circuit: array of { op, in: [name|bool, name|bool], out: name }
  // inputs: { A: bool, B: bool, ... }
  const env = { ...inputs };
  for (const step of circuit) {
    const a = typeof step.in[0] === 'string' ? env[step.in[0]] : step.in[0];
    const b = typeof step.in[1] === 'string' ? env[step.in[1]] : step.in[1];
    const fn = LOGIC_GATES[step.op];
    if (!fn) throw new Error('unknown gate: ' + step.op);
    env[step.out] = fn(a, b);
  }
  return env;
}

// find the unique input assignment that yields target for `outVar`, or null.
function solveCircuit(circuit, inputNames, outVar, target) {
  const n = inputNames.length;
  const total = 1 << n;
  const hits = [];
  for (let mask = 0; mask < total; mask++) {
    const inputs = {};
    inputNames.forEach((name, i) => { inputs[name] = !!((mask >> i) & 1); });
    const env = evaluateCircuit(circuit, inputs);
    if (!!env[outVar] === !!target) hits.push(inputs);
  }
  return hits;
}

async function logicPuzzle(game) {
  // Three-input circuit with known unique solution.
  const circuit = [
    { op: 'AND', in: ['A', 'B'], out: 'X' },
    { op: 'XOR', in: ['X', 'C'], out: 'Y' },
    { op: 'OR',  in: ['Y', 'A'], out: 'Z' }
  ];
  const inputs = ['A', 'B', 'C'];

  console.clear();
  console.log(colors.bold('Logic circuit'));
  console.log(colors.dim('Find input values A, B, C (0/1) so that Z = true AND Y = false.'));
  console.log(colors.dim('Circuit:'));
  console.log('  X = A AND B');
  console.log('  Y = X XOR C');
  console.log('  Z = Y OR A');
  console.log();
  console.log(colors.dim('Enter answer as three digits, e.g. 101 (type q to quit)'));
  console.log();

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  let attempts = 0;
  const maxAttempts = 4;

  return new Promise((resolve) => {
    let done = false;
    const finish = (r) => {
      if (done) return;
      done = true;
      rl.close();
      resolve(r);
    };
    const ask = () => {
      if (done) return;
      if (attempts >= maxAttempts) {
        console.log(colors.error('out of tries'));
        finish({ completed: true, win: false, attempts });
        return;
      }
      rl.question(colors.bold(`guess ${attempts + 1}/${maxAttempts}: `), (input) => {
        if (done) return;
        const s = (input || '').trim().toLowerCase();
        if (s === 'q' || s === 'quit') { finish({ completed: false, win: false, attempts }); return; }
        if (!/^[01]{3}$/.test(s)) {
          console.log(colors.error('please enter three bits (0 or 1)'));
          ask();
          return;
        }
        attempts++;
        const guess = { A: s[0] === '1', B: s[1] === '1', C: s[2] === '1' };
        const env = evaluateCircuit(circuit, guess);
        console.log(colors.dim(`  X=${env.X ? 1 : 0}  Y=${env.Y ? 1 : 0}  Z=${env.Z ? 1 : 0}`));
        if (env.Z === true && env.Y === false) {
          console.log(colors.success('circuit solved'));
          console.log(colors.gold('+80 EXP'));
          if (game && game.addExp) game.addExp(80, 'logic').catch(() => {});
          if (game && game.gameState) game.gameState.logicSolved = true;
          finish({ completed: true, win: true, attempts });
          return;
        }
        console.log(colors.warning('not yet'));
        ask();
      });
    };
    rl.on('close', () => finish({ completed: false, win: false, attempts }));
    ask();
  });
}
// make sure there is at least one such assignment (A=1,B=0,C=0 -> X=0,Y=0,Z=1 works)

// --- Morse decode ---
const MORSE_MAP = {
  'A': '.-',  'B': '-...','C': '-.-.','D': '-..', 'E': '.',   'F': '..-.',
  'G': '--.', 'H': '....','I': '..',  'J': '.---','K': '-.-', 'L': '.-..',
  'M': '--',  'N': '-.',  'O': '---', 'P': '.--.','Q': '--.-','R': '.-.',
  'S': '...', 'T': '-',   'U': '..-', 'V': '...-','W': '.--', 'X': '-..-',
  'Y': '-.--','Z': '--..',
  '0': '-----','1': '.----','2': '..---','3': '...--','4': '....-',
  '5': '.....','6': '-....','7': '--...','8': '---..','9': '----.'
};

function morseEncode(text) {
  return String(text).toUpperCase().split(' ').map((word) => {
    return word.split('').map((ch) => MORSE_MAP[ch] || '').filter(Boolean).join(' ');
  }).join('   ');
}

function morseDecode(code) {
  const rev = {};
  for (const [k, v] of Object.entries(MORSE_MAP)) rev[v] = k;
  return String(code).split('   ').map((word) => {
    return word.split(' ').map((sym) => rev[sym] || '').join('');
  }).join(' ');
}

async function morse(game) {
  const words = ['KIMI', 'AWAKE', 'NEXUS', 'SHADOW', 'EXPLORE', 'SECRET'];
  const answer = words[Math.floor(Math.random() * words.length)];
  const encoded = morseEncode(answer);

  console.clear();
  console.log(colors.bold('Morse decode'));
  console.log(colors.dim('Decode the message (single word). Type q to quit.'));
  console.log();
  console.log('  ' + colors.info(encoded));
  console.log();

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  let attempts = 0;
  const maxAttempts = 3;
  let hintsUsed = 0;

  return new Promise((resolve) => {
    let done = false;
    const finish = (r) => {
      if (done) return;
      done = true;
      rl.close();
      resolve(r);
    };
    const ask = () => {
      if (done) return;
      if (attempts >= maxAttempts) {
        console.log(colors.error(`out of tries - answer: ${answer}`));
        finish({ completed: true, win: false, attempts });
        return;
      }
      rl.question(colors.bold(`answer ${attempts + 1}/${maxAttempts} (or 'hint'): `), (input) => {
        if (done) return;
        const s = (input || '').trim().toUpperCase();
        if (s === 'Q' || s === 'QUIT') { finish({ completed: false, win: false, attempts }); return; }
        if (s === 'HINT' || s === 'H') {
          hintsUsed++;
          console.log(colors.dim(`hint: first letter is "${answer[0]}" (${MORSE_MAP[answer[0]]})`));
          ask();
          return;
        }
        attempts++;
        if (s === answer) {
          console.log(colors.success('decoded!'));
          let exp = 30;
          if (attempts === 1) exp = 80;
          else if (attempts === 2) exp = 50;
          console.log(colors.gold(`+${exp} EXP`));
          if (game && game.addExp) game.addExp(exp, 'morse').catch(() => {});
          if (game && game.gameState && hintsUsed === 0) game.gameState.morseSolved = true;
          finish({ completed: true, win: true, attempts });
          return;
        }
        console.log(colors.warning('not quite'));
        ask();
      });
    };
    rl.on('close', () => finish({ completed: false, win: false, attempts }));
    ask();
  });
}

// --- Chess puzzle (mate-in-1, pure helpers + tiny REPL) ---
// The puzzle is a fixed, well-known mate-in-1 with a single unique answer.
// We store only the solution move + a human-readable board for printing.
const CHESS_PUZZLES = [
  {
    board: [
      '  a b c d e f g h',
      '8 . . . . . . . k',
      '7 . . . . . . p p',
      '6 . . . . . . . .',
      '5 . . . . . . . .',
      '4 . . . . . . . .',
      '3 . . . . . . . .',
      '2 . . . . . . P P',
      '1 . . . . . R . K'
    ],
    // white to move, mate in 1: Rf8#
    answer: 'Rf8',
    hint: 'rook lift along the f-file'
  }
];

function isChessMateSolution(puzzle, answer) {
  if (!puzzle || typeof answer !== 'string') return false;
  // normalise: strip '#'/'+' suffixes and compare case-insensitive on the
  // piece letter, case-sensitive on the file/rank coords.
  const clean = (s) => s.replace(/[#+x]/g, '').trim();
  const a = clean(answer);
  const b = clean(puzzle.answer);
  if (a === b) return true;
  // accept "R f8" / "rook f8" / "f8" (the only rook move to f8 in puzzle)
  const lowered = a.toLowerCase();
  if (lowered.endsWith(b.slice(1).toLowerCase())) return true;
  if (lowered === 'f8' || lowered === 'rookf8' || lowered === 'rook f8') return true;
  return false;
}

async function chessPuzzle(game) {
  const puzzle = CHESS_PUZZLES[0];
  console.clear();
  console.log(colors.bold('Chess puzzle'));
  console.log(colors.dim('White to move. Mate in 1. Type the move in short algebraic, or q to quit.'));
  console.log();
  for (const line of puzzle.board) console.log('  ' + line);
  console.log();

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  let attempts = 0;
  const maxAttempts = 3;

  return new Promise((resolve) => {
    let done = false;
    const finish = (r) => {
      if (done) return;
      done = true;
      rl.close();
      resolve(r);
    };
    const ask = () => {
      if (done) return;
      if (attempts >= maxAttempts) {
        console.log(colors.error(`out of tries - answer: ${puzzle.answer}#`));
        finish({ completed: true, win: false, attempts });
        return;
      }
      rl.question(colors.bold(`move ${attempts + 1}/${maxAttempts}: `), (input) => {
        if (done) return;
        const s = (input || '').trim();
        if (s.toLowerCase() === 'q' || s.toLowerCase() === 'quit') {
          finish({ completed: false, win: false, attempts });
          return;
        }
        if (s.toLowerCase() === 'hint') {
          console.log(colors.dim(`hint: ${puzzle.hint}`));
          ask();
          return;
        }
        attempts++;
        if (isChessMateSolution(puzzle, s)) {
          console.log(colors.success('checkmate!'));
          let exp = 40;
          if (attempts === 1) exp = 120;
          else if (attempts === 2) exp = 70;
          console.log(colors.gold(`+${exp} EXP`));
          if (game && game.addExp) game.addExp(exp, 'chess').catch(() => {});
          finish({ completed: true, win: true, attempts });
          return;
        }
        console.log(colors.warning('not mate - try again'));
        ask();
      });
    };
    rl.on('close', () => finish({ completed: false, win: false, attempts }));
    ask();
  });
}

// --- Cipher decoder (Caesar shift) ---
function caesarEncode(text, shift) {
  const s = ((shift % 26) + 26) % 26;
  let out = '';
  for (const ch of String(text)) {
    const code = ch.charCodeAt(0);
    if (code >= 65 && code <= 90) {
      out += String.fromCharCode(((code - 65 + s) % 26) + 65);
    } else if (code >= 97 && code <= 122) {
      out += String.fromCharCode(((code - 97 + s) % 26) + 97);
    } else {
      out += ch;
    }
  }
  return out;
}

function caesarDecode(text, shift) {
  return caesarEncode(text, -shift);
}

// very small dictionary used to auto-score "looks like English" guesses
const CIPHER_DICT = ['the', 'and', 'you', 'are', 'for', 'kimi', 'terminal', 'quest', 'hello', 'explore', 'secret', 'dawn'];

function scoreCipherGuess(plaintext) {
  const lower = String(plaintext).toLowerCase();
  let score = 0;
  for (const w of CIPHER_DICT) {
    if (lower.includes(w)) score++;
  }
  return score;
}

async function cipherDecoder(game) {
  const phrases = [
    'Hello explorer the dawn is near',
    'KIMI remembers every quest you finish',
    'Secret door opens for kind explorers'
  ];
  const chosen = phrases[Math.floor(Math.random() * phrases.length)];
  const shift = 1 + Math.floor(Math.random() * 20);
  const encoded = caesarEncode(chosen, shift);

  console.clear();
  console.log(colors.bold('Cipher decoder'));
  console.log(colors.dim('A Caesar cipher. Find the shift (1-25) and reveal the message.'));
  console.log();
  console.log('  ' + colors.info(encoded));
  console.log();

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  let attempts = 0;
  const maxAttempts = 5;

  return new Promise((resolve) => {
    let done = false;
    const finish = (r) => {
      if (done) return;
      done = true;
      rl.close();
      resolve(r);
    };
    const ask = () => {
      if (done) return;
      if (attempts >= maxAttempts) {
        console.log(colors.error(`out of tries - shift was ${shift}, message: "${chosen}"`));
        finish({ completed: true, win: false, attempts });
        return;
      }
      rl.question(colors.bold(`shift ${attempts + 1}/${maxAttempts} (1-25, or 'q'): `), (input) => {
        if (done) return;
        const s = (input || '').trim().toLowerCase();
        if (s === 'q' || s === 'quit') { finish({ completed: false, win: false, attempts }); return; }
        const n = parseInt(s, 10);
        if (!Number.isFinite(n) || n < 1 || n > 25) {
          console.log(colors.error('please enter a number 1-25'));
          ask();
          return;
        }
        attempts++;
        const candidate = caesarDecode(encoded, n);
        const score = scoreCipherGuess(candidate);
        console.log(colors.dim('  -> ') + candidate);
        if (n === shift) {
          console.log(colors.success('cipher cracked!'));
          let exp = 30;
          if (attempts === 1) exp = 90;
          else if (attempts === 2) exp = 60;
          console.log(colors.gold(`+${exp} EXP`));
          if (game && game.addExp) game.addExp(exp, 'cipher').catch(() => {});
          finish({ completed: true, win: true, attempts });
          return;
        }
        if (score > 0) console.log(colors.warning(`  that looks almost readable (+${score})`));
        else console.log(colors.dim('  still gibberish'));
        ask();
      });
    };
    rl.on('close', () => finish({ completed: false, win: false, attempts }));
    ask();
  });
}

// --- iter-12: Sokobax (push-the-box, single-screen sokoban) ---
// Pure level model + step function. Levels are tiny ASCII grids:
//   '#' wall   '.' goal   '$' box   '@' player   ' ' floor
// Encoded levels keep boxes/goals/player as separate maps so we can
// render goals under boxes correctly.
const SOKOBAX_LEVELS = [
  [
    '########',
    '#  .   #',
    '# $    #',
    '#  @   #',
    '#      #',
    '########'
  ],
  [
    '#######',
    '#.   .#',
    '# $$  #',
    '# @   #',
    '#######'
  ]
];

function parseSokobaxLevel(rows) {
  const walls = new Set();
  const goals = new Set();
  const boxes = new Set();
  let player = null;
  for (let y = 0; y < rows.length; y++) {
    const line = rows[y];
    for (let x = 0; x < line.length; x++) {
      const ch = line[x];
      const k = x + ',' + y;
      if (ch === '#') walls.add(k);
      else if (ch === '.') goals.add(k);
      else if (ch === '$') boxes.add(k);
      else if (ch === '@') player = { x, y };
      else if (ch === '*') { boxes.add(k); goals.add(k); }
      else if (ch === '+') { player = { x, y }; goals.add(k); }
    }
  }
  return { walls, goals, boxes, player, w: rows[0].length, h: rows.length };
}

function sokobaxStep(state, dir) {
  // dir: 'up'|'down'|'left'|'right'
  const dx = dir === 'left' ? -1 : dir === 'right' ? 1 : 0;
  const dy = dir === 'up' ? -1 : dir === 'down' ? 1 : 0;
  if (dx === 0 && dy === 0) return state;
  const nx = state.player.x + dx;
  const ny = state.player.y + dy;
  const nk = nx + ',' + ny;
  if (state.walls.has(nk)) return state;
  // pushing a box?
  if (state.boxes.has(nk)) {
    const bx = nx + dx;
    const by = ny + dy;
    const bk = bx + ',' + by;
    if (state.walls.has(bk) || state.boxes.has(bk)) return state;
    const newBoxes = new Set(state.boxes);
    newBoxes.delete(nk);
    newBoxes.add(bk);
    return { ...state, boxes: newBoxes, player: { x: nx, y: ny } };
  }
  return { ...state, player: { x: nx, y: ny } };
}

function sokobaxIsSolved(state) {
  if (!state || !state.goals || !state.boxes) return false;
  if (state.boxes.size !== state.goals.size) return false;
  for (const g of state.goals) if (!state.boxes.has(g)) return false;
  return true;
}

function sokobaxRender(state) {
  const out = [];
  for (let y = 0; y < state.h; y++) {
    let line = '';
    for (let x = 0; x < state.w; x++) {
      const k = x + ',' + y;
      if (state.walls.has(k)) line += '#';
      else if (state.player && state.player.x === x && state.player.y === y) {
        line += state.goals.has(k) ? '+' : '@';
      } else if (state.boxes.has(k)) {
        line += state.goals.has(k) ? '*' : '$';
      } else if (state.goals.has(k)) line += '.';
      else line += ' ';
    }
    out.push(line);
  }
  return out;
}

async function sokobax(game, opts = {}) {
  const levelIdx = Math.min(SOKOBAX_LEVELS.length - 1, Math.max(0, opts.level || 0));
  let state = parseSokobaxLevel(SOKOBAX_LEVELS[levelIdx]);
  const maxMoves = opts.maxMoves || 60;
  let moves = 0;

  console.clear();
  console.log(colors.bold('Sokobax — push every $ onto a .'));
  console.log(colors.dim('w/a/s/d to move, r reset, q quit. Boxes only push.'));
  console.log();

  const draw = () => {
    if (!process.stdout.isTTY) return;
    process.stdout.write('\x1b[3;1H');
    for (const row of sokobaxRender(state)) console.log('  ' + row);
    console.log(colors.dim(`  moves: ${moves}/${maxMoves}`));
  };

  return new Promise((resolve) => {
    let done = false;
    const cleanup = setupKeyListener((key) => {
      if (done) return;
      if (key === 'q' || key === 'Q') { finish(false); return; }
      if (key === 'r' || key === 'R') {
        state = parseSokobaxLevel(SOKOBAX_LEVELS[levelIdx]);
        moves = 0;
        draw();
        return;
      }
      let dir = null;
      if (key === 'w' || key === 'W' || key === '[A') dir = 'up';
      else if (key === 's' || key === 'S' || key === '[B') dir = 'down';
      else if (key === 'a' || key === 'A' || key === '[D') dir = 'left';
      else if (key === 'd' || key === 'D' || key === '[C') dir = 'right';
      if (!dir) return;
      const next = sokobaxStep(state, dir);
      if (next !== state) { moves++; state = next; }
      draw();
      if (sokobaxIsSolved(state)) { finish(true); return; }
      if (moves >= maxMoves) finish(false);
    });

    const finish = (win) => {
      if (done) return;
      done = true;
      cleanup();
      console.log();
      if (win) {
        const exp = Math.max(20, 80 - moves);
        console.log(colors.success(`solved in ${moves} moves`));
        console.log(colors.gold(`+${exp} EXP`));
        if (game && game.addExp) game.addExp(exp, 'sokobax').catch(() => {});
        if (game && game.gameState) game.gameState.sokobaxSolved = true;
        resolve({ completed: true, win: true, score: moves });
      } else {
        console.log(colors.dim('sokobax: aborted'));
        resolve({ completed: false, win: false, score: moves });
      }
    };

    draw();
  });
}

// --- iter-12: Sliding puzzle (15-puzzle style, configurable size) ---
// Pure helpers so tests can drive moves and check solvability without a TTY.
function slidingMakeSolved(size = 3) {
  const tiles = [];
  for (let i = 0; i < size * size - 1; i++) tiles.push(i + 1);
  tiles.push(0);
  return tiles;
}

function slidingShuffle(size = 3, moves = 30, rng = Math.random) {
  // Generate a guaranteed-solvable board by walking the empty tile randomly.
  let board = slidingMakeSolved(size);
  let empty = board.length - 1;
  for (let i = 0; i < moves; i++) {
    const neigh = slidingNeighbors(empty, size);
    const pick = neigh[Math.floor(rng() * neigh.length)];
    [board[empty], board[pick]] = [board[pick], board[empty]];
    empty = pick;
  }
  return board;
}

function slidingNeighbors(idx, size) {
  const x = idx % size;
  const y = Math.floor(idx / size);
  const out = [];
  if (x > 0) out.push(idx - 1);
  if (x < size - 1) out.push(idx + 1);
  if (y > 0) out.push(idx - size);
  if (y < size - 1) out.push(idx + size);
  return out;
}

function slidingMove(board, tile, size) {
  // Move the tile with value `tile` into the empty slot if adjacent.
  // Returns new board (or same board if illegal).
  const idx = board.indexOf(tile);
  const empty = board.indexOf(0);
  if (idx < 0 || empty < 0) return board;
  if (!slidingNeighbors(empty, size).includes(idx)) return board;
  const next = board.slice();
  next[empty] = tile;
  next[idx] = 0;
  return next;
}

function slidingIsSolved(board) {
  for (let i = 0; i < board.length - 1; i++) {
    if (board[i] !== i + 1) return false;
  }
  return board[board.length - 1] === 0;
}

async function slidingPuzzle(game, opts = {}) {
  const size = opts.size || 3;
  let board = slidingShuffle(size, opts.shuffle || 30);
  const maxMoves = opts.maxMoves || 200;
  let moves = 0;

  console.clear();
  console.log(colors.bold(`Sliding puzzle — ${size}x${size}`));
  console.log(colors.dim('Type a tile number to slide it into the empty slot. q to quit.'));
  console.log();

  const render = () => {
    const out = [];
    for (let y = 0; y < size; y++) {
      let line = '  ';
      for (let x = 0; x < size; x++) {
        const v = board[y * size + x];
        line += (v === 0 ? '  .' : String(v).padStart(3, ' ')) + ' ';
      }
      out.push(line);
    }
    return out.join('\n');
  };

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    let done = false;
    const finish = (r) => { if (done) return; done = true; rl.close(); resolve(r); };
    const ask = () => {
      if (done) return;
      console.log(render());
      console.log(colors.dim(`  moves: ${moves}/${maxMoves}`));
      if (slidingIsSolved(board)) {
        const exp = Math.max(30, 120 - moves);
        console.log(colors.success(`solved in ${moves} moves`));
        console.log(colors.gold(`+${exp} EXP`));
        if (game && game.addExp) game.addExp(exp, 'sliding').catch(() => {});
        if (game && game.gameState) game.gameState.slidingSolved = true;
        finish({ completed: true, win: true, score: moves });
        return;
      }
      if (moves >= maxMoves) {
        console.log(colors.error('out of moves'));
        finish({ completed: true, win: false, score: moves });
        return;
      }
      rl.question(colors.bold('tile: '), (input) => {
        if (done) return;
        const s = (input || '').trim().toLowerCase();
        if (s === 'q' || s === 'quit') { finish({ completed: false, win: false, score: moves }); return; }
        const n = parseInt(s, 10);
        if (!Number.isFinite(n) || n < 1 || n > size * size - 1) {
          console.log(colors.error(`enter a number 1-${size * size - 1}`));
          ask();
          return;
        }
        const next = slidingMove(board, n, size);
        if (next === board) {
          console.log(colors.warning('that tile is not adjacent to the empty slot'));
        } else {
          board = next;
          moves++;
        }
        ask();
      });
    };
    rl.on('close', () => finish({ completed: false, win: false, score: moves }));
    ask();
  });
}

// --- iter-12: Connect-3 (text-version match-3, no animation) ---
// Pure helpers exposed for tests. Letters A-E. A "match" is 3+ same in a row
// horizontally or vertically. Resolving a match yields exp; cascades are
// not modelled (kept simple and deterministic).
const CONNECT3_LETTERS = ['A', 'B', 'C', 'D', 'E'];

function connect3MakeBoard(rows = 5, cols = 5, rng = Math.random) {
  const board = [];
  for (let y = 0; y < rows; y++) {
    const row = [];
    for (let x = 0; x < cols; x++) {
      // Avoid spawning an immediate triple at fill time.
      let pick;
      do {
        pick = CONNECT3_LETTERS[Math.floor(rng() * CONNECT3_LETTERS.length)];
      } while (
        (x >= 2 && row[x - 1] === pick && row[x - 2] === pick) ||
        (y >= 2 && board[y - 1][x] === pick && board[y - 2][x] === pick)
      );
      row.push(pick);
    }
    board.push(row);
  }
  return board;
}

function connect3FindMatches(board) {
  const rows = board.length;
  const cols = rows ? board[0].length : 0;
  const hits = new Set();
  // horizontal
  for (let y = 0; y < rows; y++) {
    let run = 1;
    for (let x = 1; x <= cols; x++) {
      if (x < cols && board[y][x] === board[y][x - 1] && board[y][x] !== null) run++;
      else {
        if (run >= 3) {
          for (let k = 0; k < run; k++) hits.add((x - 1 - k) + ',' + y);
        }
        run = 1;
      }
    }
  }
  // vertical
  for (let x = 0; x < cols; x++) {
    let run = 1;
    for (let y = 1; y <= rows; y++) {
      if (y < rows && board[y][x] === board[y - 1][x] && board[y][x] !== null) run++;
      else {
        if (run >= 3) {
          for (let k = 0; k < run; k++) hits.add(x + ',' + (y - 1 - k));
        }
        run = 1;
      }
    }
  }
  return hits;
}

function connect3Swap(board, ax, ay, bx, by) {
  // Adjacent-only swap that must produce at least one match, otherwise reverts.
  const rows = board.length;
  const cols = board[0].length;
  if (ax < 0 || ay < 0 || bx < 0 || by < 0 || ax >= cols || bx >= cols || ay >= rows || by >= rows) return { board, swapped: false };
  const dx = Math.abs(ax - bx);
  const dy = Math.abs(ay - by);
  if (dx + dy !== 1) return { board, swapped: false };
  const next = board.map((r) => r.slice());
  [next[ay][ax], next[by][bx]] = [next[by][bx], next[ay][ax]];
  const matches = connect3FindMatches(next);
  if (matches.size === 0) return { board, swapped: false };
  return { board: next, swapped: true, matches };
}

function connect3Resolve(board, matches) {
  // Replace matched cells with null, then collapse columns down (gravity).
  // Empty cells at the top stay null (no refill — kept deterministic).
  const rows = board.length;
  const cols = board[0].length;
  const next = board.map((r) => r.slice());
  for (const k of matches) {
    const [x, y] = k.split(',').map(Number);
    next[y][x] = null;
  }
  for (let x = 0; x < cols; x++) {
    let writeY = rows - 1;
    for (let y = rows - 1; y >= 0; y--) {
      if (next[y][x] !== null) {
        next[writeY][x] = next[y][x];
        if (writeY !== y) next[y][x] = null;
        writeY--;
      }
    }
  }
  return next;
}

async function connect3(game, opts = {}) {
  const rows = opts.rows || 5;
  const cols = opts.cols || 5;
  let board = connect3MakeBoard(rows, cols);
  const target = opts.target || 30;
  const maxMoves = opts.maxMoves || 12;
  let score = 0;
  let moves = 0;

  console.clear();
  console.log(colors.bold('Connect-3 (text)'));
  console.log(colors.dim('Swap two adjacent letters to form 3+ in a row.'));
  console.log(colors.dim(`Reach ${target} pts in ${maxMoves} swaps. type x,y x,y (1-indexed) or q.`));
  console.log();

  const render = () => {
    let head = '   ';
    for (let x = 0; x < cols; x++) head += (x + 1) + ' ';
    const lines = [head];
    for (let y = 0; y < rows; y++) {
      let line = ' ' + (y + 1) + ' ';
      for (let x = 0; x < cols; x++) {
        line += (board[y][x] || '.') + ' ';
      }
      lines.push(line);
    }
    return lines.join('\n');
  };

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    let done = false;
    const finish = (r) => { if (done) return; done = true; rl.close(); resolve(r); };
    const ask = () => {
      if (done) return;
      console.log(render());
      console.log(colors.dim(`  score: ${score}/${target}  moves: ${moves}/${maxMoves}`));
      if (score >= target) {
        const exp = 60 + (maxMoves - moves) * 5;
        console.log(colors.success('connect-3 cleared!'));
        console.log(colors.gold(`+${exp} EXP`));
        if (game && game.addExp) game.addExp(exp, 'connect3').catch(() => {});
        if (game && game.gameState) game.gameState.connect3Cleared = true;
        finish({ completed: true, win: true, score });
        return;
      }
      if (moves >= maxMoves) {
        console.log(colors.error('out of moves'));
        finish({ completed: true, win: false, score });
        return;
      }
      rl.question(colors.bold('swap (e.g. 1,1 2,1): '), (input) => {
        if (done) return;
        const s = (input || '').trim().toLowerCase();
        if (s === 'q' || s === 'quit') { finish({ completed: false, win: false, score }); return; }
        const m = s.match(/^(\d+)\s*,\s*(\d+)\s+(\d+)\s*,\s*(\d+)$/);
        if (!m) {
          console.log(colors.error('format: x,y x,y (1-indexed)'));
          ask();
          return;
        }
        const ax = parseInt(m[1], 10) - 1;
        const ay = parseInt(m[2], 10) - 1;
        const bx = parseInt(m[3], 10) - 1;
        const by = parseInt(m[4], 10) - 1;
        const res = connect3Swap(board, ax, ay, bx, by);
        if (!res.swapped) {
          console.log(colors.warning('no match formed - swap reverted'));
          ask();
          return;
        }
        moves++;
        score += res.matches.size * 5;
        board = connect3Resolve(res.board, res.matches);
        ask();
      });
    };
    rl.on('close', () => finish({ completed: false, win: false, score }));
    ask();
  });
}

module.exports = {
  snake, guess, matrix, pong, wordle, scoreGuess,
  qte, logicPuzzle, morse,
  evaluateCircuit, solveCircuit,
  morseEncode, morseDecode, MORSE_MAP, LOGIC_GATES,
  // v2.4 additions
  chessPuzzle, cipherDecoder,
  CHESS_PUZZLES, isChessMateSolution,
  caesarEncode, caesarDecode, scoreCipherGuess, CIPHER_DICT,
  // v2.6 (iter-12) additions
  sokobax, parseSokobaxLevel, sokobaxStep, sokobaxIsSolved, sokobaxRender, SOKOBAX_LEVELS,
  slidingPuzzle, slidingMakeSolved, slidingShuffle, slidingMove, slidingIsSolved, slidingNeighbors,
  connect3, connect3MakeBoard, connect3FindMatches, connect3Swap, connect3Resolve, CONNECT3_LETTERS
};
