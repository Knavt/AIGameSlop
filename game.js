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
  { key: 'laser', name: 'Laser', cost: 45, baseDmg: 11, range: 180, cooldown: 14, bulletColor: '#7effd6', sprite: 'tower_laser' },
  { key: 'cannon', name: 'Cannon', cost: 60, baseDmg: 24, range: 165, cooldown: 28, bulletColor: '#ffd08a', sprite: 'tower_cannon' },
  { key: 'ice', name: 'Cryo', cost: 55, baseDmg: 8, range: 190, cooldown: 20, bulletColor: '#b5efff', sprite: 'tower_ice', slow: 0.6 }
];

const sprites = {
  road: loadImage('assets/road_tile.svg'),
  enemy: loadImage('assets/enemy_tank.svg'),
  tower_laser: loadImage('assets/tower_laser.svg'),
  tower_cannon: loadImage('assets/tower_cannon.svg'),
  tower_ice: loadImage('assets/tower_ice.svg')
};

let wave = 1;
let credits = 150;
let core = 20;
let pending = false;
let gameOver = false;

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

function update() {
  if (gameOver) return;

  for (const e of enemies) {
    if (e.t < 0) {
      e.t++;
      continue;
    }
    if (e.slowTimer > 0) e.slowTimer--;
    else e.slow = 1;

    e.p += (e.speed * e.slow) / 140;
    if (e.p >= path.length - 1) {
      e.dead = true;
      core--;
    }
  }

  for (const t of turrets) {
    const cfg = getTowerType(t.type);
    t.cd--;
    if (t.cd > 0) continue;
    const target = enemies.find((e) => !e.dead && e.t >= 0 && Math.hypot(posOnPath(e).x - t.x, posOnPath(e).y - t.y) < cfg.range + t.lvl * 6);
    if (target) {
      const p = posOnPath(target);
      bullets.push({
        x: t.x,
        y: t.y,
        tx: p.x,
        ty: p.y,
        life: 24,
        dmg: cfg.baseDmg + 4 * t.lvl,
        color: cfg.bulletColor,
        slow: cfg.slow || null
      });
      t.cd = Math.max(8, cfg.cooldown - t.lvl);
    }
  }

  for (const b of bullets) {
    b.life--;
    b.x += (b.tx - b.x) * 0.25;
    b.y += (b.ty - b.y) * 0.25;
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
  ctx.fillText('Click empty slot: build next tower type (Laser/Cannon/Cryo)', 30, 548);
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

function updateHUD() {
  stats.wave.textContent = `Wave: ${wave}`;
  stats.credits.textContent = `Credits: ${credits}`;
  stats.core.textContent = `Core HP: ${core}`;
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

spawnWave();
loop();
