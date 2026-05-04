const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const path = [
  {x: -40, y: 90}, {x: 260, y: 90}, {x: 260, y: 220},
  {x: 570, y: 220}, {x: 570, y: 480}, {x: 980, y: 480}, {x: 1060, y: 480}
];

const slots = [
  {x: 350, y: 140}, {x: 470, y: 300}, {x: 650, y: 140}, {x: 760, y: 380}, {x: 870, y: 290}
];

let wave = 1, credits = 120, core = 20, pending = false;
const enemies = [], turrets = [], bullets = [];
const stats = {
  wave: document.getElementById('wave'),
  credits: document.getElementById('credits'),
  core: document.getElementById('core')
};

canvas.addEventListener('click', (e) => {
  const r = canvas.getBoundingClientRect();
  const mx = e.clientX - r.left, my = e.clientY - r.top;
  for (const s of slots) {
    if (Math.hypot(mx - s.x, my - s.y) < 28 && !s.built && credits >= 40) {
      s.built = true; credits -= 40; turrets.push({x:s.x, y:s.y, cd:0, lvl:1});
    }
  }
  updateHUD();
});

window.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() === 'n' && !pending) spawnWave();
});

function spawnWave() {
  pending = true;
  for (let i = 0; i < wave * 6; i++) {
    enemies.push({p:0, hp: 24 + wave * 6, speed:1.2 + wave * .1, t:-i*35});
  }
}

function posOnPath(enemy) {
  const seg = Math.floor(enemy.p);
  const t = enemy.p - seg;
  if (seg >= path.length - 1) return path.at(-1);
  const a = path[seg], b = path[seg + 1];
  return {x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t};
}

function update() {
  for (const e of enemies) {
    if (e.t < 0) { e.t++; continue; }
    e.p += e.speed / 140;
    if (e.p >= path.length - 1) { e.dead = true; core--; }
  }

  for (const t of turrets) {
    t.cd--;
    if (t.cd > 0) continue;
    const target = enemies.find(e => !e.dead && e.t >= 0 && Math.hypot(posOnPath(e).x - t.x, posOnPath(e).y - t.y) < 170);
    if (target) {
      const p = posOnPath(target);
      bullets.push({x:t.x, y:t.y, tx:p.x, ty:p.y, life:24, dmg:10 + 3*t.lvl});
      t.cd = 18;
    }
  }

  for (const b of bullets) {
    b.life--;
    b.x += (b.tx - b.x) * .25;
    b.y += (b.ty - b.y) * .25;
    for (const e of enemies) {
      if (e.dead || e.t < 0) continue;
      const p = posOnPath(e);
      if (Math.hypot(p.x - b.x, p.y - b.y) < 16) { e.hp -= b.dmg; b.life = 0; break; }
    }
    if (b.life <= 0) b.dead = true;
  }

  enemies.forEach(e => { if (e.hp <= 0 && !e.dead) { e.dead = true; credits += 8; } });
  if (pending && enemies.every(e => e.dead || e.t < 0)) { pending = false; wave++; }

  for (const s of [enemies, bullets]) {
    for (let i = s.length - 1; i >= 0; i--) if (s[i].dead) s.splice(i, 1);
  }

  if (core <= 0) { alert('Core destroyed. Refresh to retry.'); location.reload(); }
  updateHUD();
}

function draw() {
  ctx.fillStyle = '#8a7647'; ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.strokeStyle = '#4a535b'; ctx.lineWidth = 26; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(path[0].x, path[0].y);
  for (const p of path.slice(1)) ctx.lineTo(p.x,p.y);
  ctx.stroke();

  ctx.strokeStyle = '#aab4bb'; ctx.lineWidth = 2;
  for (let i=0;i<80;i++) { const x=(i*53)%canvas.width; ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x+40,canvas.height); ctx.stroke(); }

  for (const s of slots) {
    ctx.fillStyle = s.built ? '#2b353e' : '#3c4a55';
    ctx.beginPath(); ctx.arc(s.x,s.y,24,0,Math.PI*2); ctx.fill();
  }

  turrets.forEach(t => {
    ctx.fillStyle = '#69d49a'; ctx.beginPath(); ctx.arc(t.x,t.y,18,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = '#d8f7e7'; ctx.fillRect(t.x-2,t.y-22,4,16);
  });

  enemies.forEach(e => {
    if (e.t < 0) return;
    const p = posOnPath(e);
    ctx.fillStyle = '#ff7a59'; ctx.beginPath(); ctx.ellipse(p.x,p.y,15,11,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = '#111'; ctx.fillRect(p.x-6,p.y-2,3,3); ctx.fillRect(p.x+3,p.y-2,3,3);
  });

  bullets.forEach(b => { ctx.fillStyle = '#b3fbca'; ctx.beginPath(); ctx.arc(b.x,b.y,4,0,Math.PI*2); ctx.fill(); });

  ctx.fillStyle = '#111b'; ctx.fillRect(18,530,240,90);
  ctx.fillStyle = '#fff'; ctx.fillText('N: Next Wave', 30, 555);
  ctx.fillText('Turret Cost: 40', 30, 575);
  ctx.fillText('Kill reward: 8', 30, 595);
}

function updateHUD() {
  stats.wave.textContent = `Wave: ${wave}`;
  stats.credits.textContent = `Credits: ${credits}`;
  stats.core.textContent = `Core HP: ${core}`;
}

function loop() { update(); draw(); requestAnimationFrame(loop); }
spawnWave(); loop();
