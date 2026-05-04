const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const path = [
  { x: -40, y: 90 }, { x: 260, y: 90 }, { x: 260, y: 220 },
  { x: 570, y: 220 }, { x: 570, y: 480 }, { x: 980, y: 480 }, { x: 1060, y: 480 }
];

const slots = [
  { x: 350, y: 140 }, { x: 470, y: 300 }, { x: 650, y: 140 }, { x: 760, y: 380 }, { x: 870, y: 290 }
];

const TOWER_TYPES = [
  { key: 'focus', name: 'Focus', cost: 45, baseDmg: 10, range: 190, cooldown: 12, bulletColor: '#7effd6', sprite: 'tower_focus', bulletSpeed: 8.4 },
  { key: 'bandit', name: 'Bandit', cost: 60, baseDmg: 18, range: 175, cooldown: 20, bulletColor: '#ffd08a', sprite: 'tower_bandit', bulletSpeed: 7.2 },
  { key: 'salute', name: 'Salute', cost: 52, baseDmg: 9, range: 185, cooldown: 14, bulletColor: '#b5efff', sprite: 'tower_salute', slow: 0.78, bulletSpeed: 8.8 },
  { key: 'chief', name: 'Chief', cost: 70, baseDmg: 25, range: 170, cooldown: 30, bulletColor: '#ffa6a6', sprite: 'tower_chief', bulletSpeed: 6.8 }
];

const sprites = {
  road: loadImage('assets/road_tile.svg'),
  enemy: loadImage('assets/enemy_tank.svg'),
  tower_focus: loadImage('assets/tower_focus.svg'),
  tower_bandit: loadImage('assets/tower_bandit.svg'),
  tower_salute: loadImage('assets/tower_salute.svg'),
  tower_chief: loadImage('assets/tower_chief.svg')
};

let wave = 1;
let credits = 150;
let core = 20;
let pending = false;
let gameOver = false;
let lastTime = performance.now();
const castle = { x: 1030, y: 480, w: 66, h: 82 };

const enemies = [];
const turrets = [];
const bullets = [];

const stats = {
  wave: document.getElementById('wave'),
  credits: document.getElementById('credits'),
  core: document.getElementById('core')
};

canvas.addEventListener('click', (e) => {
  if (gameOver) return;
  const r = canvas.getBoundingClientRect();
  const mx = e.clientX - r.left;
  const my = e.clientY - r.top;

  for (const s of slots) {
    if (Math.hypot(mx - s.x, my - s.y) >= 28) continue;

    if (!s.built) {
      const towerType = TOWER_TYPES[turrets.length % TOWER_TYPES.length];
      if (credits < towerType.cost) break;
      credits -= towerType.cost;
      s.built = true;
      turrets.push({ x: s.x, y: s.y, cd: 0, lvl: 1, type: towerType.key });
      break;
    }

    const turret = turrets.find((t) => t.x === s.x && t.y === s.y);
    if (!turret || turret.lvl >= 3) break;
    const upgradeCost = 30 + turret.lvl * 20;
    if (credits >= upgradeCost) {
      credits -= upgradeCost;
      turret.lvl += 1;
    }
    break;
  }

  updateHUD();
});

window.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() === 'n' && !pending && !gameOver) spawnWave();
});

function loadImage(src) {
  const img = new Image();
  img.src = src;
  return img;
}

function spawnWave() {
  pending = true;
  for (let i = 0; i < wave * 7; i++) {
    enemies.push({ p: 0, hp: 26 + wave * 8, speed: 1.15 + wave * 0.11, t: -i * 32, slow: 1, slowTimer: 0 });
  }
}

function posOnPath(enemy) {
  const seg = Math.floor(enemy.p);
  const t = enemy.p - seg;
  if (seg >= path.length - 1) return path.at(-1);
  const a = path[seg];
  const b = path[seg + 1];
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function getTowerType(key) {
  return TOWER_TYPES.find((t) => t.key === key);
}

function update(dt = 1) {
  if (gameOver) return;

  for (const e of enemies) {
    if (e.t < 0) {
      e.t += dt;
      continue;
    }
    if (e.slowTimer > 0) e.slowTimer -= dt;
    else e.slow = 1;

    e.p += ((e.speed * e.slow) / 140) * dt;
    if (e.p >= path.length - 1) {
      e.dead = true;
      core--;
    }
  }

  for (const t of turrets) {
    const cfg = getTowerType(t.type);
    t.cd -= dt;
    if (t.cd > 0) continue;
    const target = enemies.find((e) => !e.dead && e.t >= 0 && Math.hypot(posOnPath(e).x - t.x, posOnPath(e).y - t.y) < cfg.range + t.lvl * 6);
    if (target) {
      const p = posOnPath(target);
      bullets.push({
        x: t.x,
        y: t.y,
        target: target,
        life: 24,
        dmg: cfg.baseDmg + 4 * t.lvl,
        color: cfg.bulletColor,
        slow: cfg.slow || null,
        speed: (cfg.bulletSpeed || 7.5) + t.lvl * 0.35
      });
      t.cd = Math.max(8, cfg.cooldown - t.lvl);
    }
  }

  for (const b of bullets) {
    b.life -= dt;
    if (b.target && !b.target.dead && b.target.t >= 0) {
      const tp = posOnPath(b.target);
      const dx = tp.x - b.x;
      const dy = tp.y - b.y;
      const dist = Math.hypot(dx, dy) || 1;
      b.x += (dx / dist) * b.speed * dt;
      b.y += (dy / dist) * b.speed * dt;
    } else {
      b.dead = true;
      continue;
    }
    for (const e of enemies) {
      if (e.dead || e.t < 0) continue;
      const p = posOnPath(e);
      if (Math.hypot(p.x - b.x, p.y - b.y) < 16) {
        e.hp -= b.dmg;
        if (b.slow) {
          e.slow = b.slow;
          e.slowTimer = 80;
        }
        b.life = 0;
        break;
      }
    }
    if (b.life <= 0) b.dead = true;
  }

  enemies.forEach((e) => {
    if (e.hp <= 0 && !e.dead) {
      e.dead = true;
      credits += 9;
    }
  });

  if (pending && enemies.every((e) => e.dead || e.t < 0)) {
    pending = false;
    wave++;
  }

  for (const s of [enemies, bullets]) {
    for (let i = s.length - 1; i >= 0; i--) if (s[i].dead) s.splice(i, 1);
  }

  if (core <= 0) {
    core = 0;
    gameOver = true;
  }

  updateHUD();
}

function draw() {
  const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
  bg.addColorStop(0, '#233125');
  bg.addColorStop(1, '#101812');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawPath();
  drawCastle();

  for (const s of slots) {
    ctx.fillStyle = s.built ? '#2d3a43' : '#445563';
    ctx.beginPath();
    ctx.arc(s.x, s.y, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#b6ccd7';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  turrets.forEach((t) => {
    const cfg = getTowerType(t.type);
    const spr = sprites[cfg.sprite];
    ctx.drawImage(spr, t.x - 30, t.y - 38, 60, 60);
    ctx.fillStyle = '#f2f5fa';
    ctx.font = 'bold 12px Inter, sans-serif';
    ctx.fillText(`Lv.${t.lvl}`, t.x - 16, t.y + 36);
  });

  enemies.forEach((e) => {
    if (e.t < 0) return;
    const p = posOnPath(e);
    ctx.drawImage(sprites.enemy, p.x - 20, p.y - 16, 40, 32);
    ctx.fillStyle = '#000a';
    ctx.fillRect(p.x - 15, p.y - 23, 30, 4);
    ctx.fillStyle = '#ff6464';
    const hpw = Math.max(0, (e.hp / (26 + wave * 8)) * 30);
    ctx.fillRect(p.x - 15, p.y - 23, hpw, 4);
  });

  bullets.forEach((b) => {
    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = '#111c';
  ctx.fillRect(18, 520, 430, 106);
  ctx.fillStyle = '#fff';
  ctx.font = '14px Inter, sans-serif';
  ctx.fillText('Click empty slot: build next tower type (Focus/Bandit/Salute/Chief)', 30, 548);
  ctx.fillText('Click built tower: upgrade to Lv.3', 30, 570);
  ctx.fillText('N: Next Wave', 30, 592);

  if (gameOver) {
    ctx.fillStyle = '#000b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ff7676';
    ctx.font = 'bold 54px Inter, sans-serif';
    ctx.fillText('GAME OVER', 360, 290);
    ctx.fillStyle = '#fff';
    ctx.font = '22px Inter, sans-serif';
    ctx.fillText(`You survived until wave ${wave}. Refresh page to retry.`, 285, 332);
  }
}

function drawPath() {
  ctx.save();
  ctx.strokeStyle = ctx.createPattern(sprites.road, 'repeat') || '#56616c';
  ctx.lineWidth = 34;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(path[0].x, path[0].y);
  for (const p of path.slice(1)) ctx.lineTo(p.x, p.y);
  ctx.stroke();

  ctx.strokeStyle = '#d6dee7aa';
  ctx.setLineDash([15, 22]);
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();
}

function drawCastle() {
  ctx.fillStyle = '#6b6772';
  ctx.fillRect(castle.x - castle.w / 2, castle.y - castle.h / 2, castle.w, castle.h);
  ctx.fillStyle = '#8a8792';
  ctx.fillRect(castle.x - castle.w / 2 - 8, castle.y - castle.h / 2 - 12, 18, 24);
  ctx.fillRect(castle.x + castle.w / 2 - 10, castle.y - castle.h / 2 - 12, 18, 24);
  ctx.fillStyle = '#2a2730';
  ctx.fillRect(castle.x - 12, castle.y + 8, 24, 33);
  const hpW = 180;
  const hpX = castle.x - hpW / 2;
  const hpY = castle.y + 62;
  ctx.fillStyle = '#111a';
  ctx.fillRect(hpX, hpY, hpW, 12);
  ctx.fillStyle = '#ff6f6f';
  ctx.fillRect(hpX, hpY, (core / 20) * hpW, 12);
  ctx.strokeStyle = '#e4e8ee';
  ctx.strokeRect(hpX, hpY, hpW, 12);
  ctx.fillStyle = '#e9eef7';
  ctx.font = '12px Inter, sans-serif';
  ctx.fillText(`Castle HP: ${core}/20`, hpX + 44, hpY - 6);
}

function updateHUD() {
  stats.wave.textContent = `Wave: ${wave}`;
  stats.credits.textContent = `Credits: ${credits}`;
  stats.core.textContent = `Core HP: ${core}`;
}

function loop(now = performance.now()) {
  const delta = Math.min(2.2, (now - lastTime) / 16.6667);
  lastTime = now;
  update(delta);
  draw();
  requestAnimationFrame(loop);
}

spawnWave();
loop();
