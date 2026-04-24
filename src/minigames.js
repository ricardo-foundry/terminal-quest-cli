// ============================================
// Terminal Quest CLI - minigames
// ============================================
// All games return a structured result object:
//   { completed: bool, win?: bool, score?: number, attempts?: number }

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

module.exports = { snake, guess, matrix, pong, wordle, scoreGuess };
