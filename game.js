(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const canvas = $('game');
  const ctx = canvas.getContext('2d');
  const ui = {
    menu: $('menu'), hud: $('hud'), levelup: $('levelup'), pause: $('pause'), end: $('end'),
    start: $('start-btn'), resume: $('resume-btn'), restart: $('restart-btn'), quit: $('quit-btn'), again: $('again-btn'), menuBtn: $('menu-btn'),
    horde: $('horde-count'), cap: $('horde-cap'), rate: $('spawn-rate'), champNum: $('champion-num'), champLv: $('champion-lv'), champName: $('champion-name'), champHp: $('champion-hp-fill'), champHpText: $('champion-hp-text'), weapons: $('champion-weapons'), timer: $('run-timer'), slain: $('slain-count'),
    commanderHp: $('commander-hp-fill'), commanderText: $('commander-hp-text'), level: $('level-num'), xp: $('xp-text'), xpFill: $('xp-fill'), surge: $('surge-btn'), surgeFill: $('surge-fill'), pauseBtn: $('pause-btn'), mute: $('mute-btn'), toast: $('toast-layer'), banner: $('banner'), bannerKick: $('banner-kicker'), bannerTitle: $('banner-title'), bannerSub: $('banner-sub'), flash: $('damage-flash'), cards: $('upgrade-cards'), upgradeTitle: $('upgrade-title'), upgradeSub: $('upgrade-sub'), endTitle: $('end-title'), endSub: $('end-sub'), endStats: $('end-stats'), touch: $('touch-ui'), joystick: $('joystick'), knob: $('joystick-knob'),
  };

  const W = 2400, H = 1800, TAU = Math.PI * 2;
  const names = [
    ['Sera the Novice', 'Dame Yselle', 'Brother Caine', 'The Ashen Knight', 'Saint of Dawn'],
    ['Lantern Adept', 'Sister Maud', 'The Red Marshal', 'Grave-Inquisitor', 'The Sun-Eater'],
  ];
  const upgrades = [
    { icon: '☠', name: 'Broodmother', desc: 'Raise the horde cap by 12 and spawn 35% faster.', rarity: 'rare', apply: g => { g.cap += 12; g.spawnRate *= 1.35; } },
    { icon: '🩸', name: 'Blood Tithe', desc: 'Your minions deal 30% more damage.', rarity: 'common', apply: g => { g.minionDamage *= 1.3; } },
    { icon: '✦', name: 'Grave Whispers', desc: 'Essence orbs are drawn from farther away and worth more.', rarity: 'common', apply: g => { g.pickupRadius += 95; g.essenceMult += 0.3; } },
    { icon: '♜', name: 'Bone March', desc: 'Minions move and attack 18% faster.', rarity: 'rare', apply: g => { g.minionSpeed *= 1.18; g.minionRate *= 1.18; } },
    { icon: '♥', name: 'Unhallowed Vitality', desc: 'Restore 45 health and increase your maximum health by 25.', rarity: 'common', apply: g => { g.playerMax += 25; g.playerHp = Math.min(g.playerMax, g.playerHp + 45); } },
    { icon: '⛧', name: 'Grave Surge', desc: 'Surge cooldown is 25% shorter and its blast grows wider.', rarity: 'epic', apply: g => { g.surgeCooldown *= 0.75; g.surgeRadius += 65; } },
    { icon: '◉', name: 'Corpse Harvest', desc: 'The champion yields more essence whenever struck.', rarity: 'rare', apply: g => { g.hitEssence += 1; } },
    { icon: '♧', name: 'Thickened Veil', desc: 'Reduce damage to your necromancer by 25%.', rarity: 'rare', apply: g => { g.playerArmor = Math.min(0.65, g.playerArmor + 0.25); } },
  ];
  const state = {
    mode: 'menu', time: 0, last: 0, dt: 0, player: null, champion: null, minions: [], shots: [], particles: [], orbs: [], decor: [],
    slain: 0, level: 1, xp: 0, xpNeed: 80, cap: 55, spawnRate: 1.6, spawnClock: 0, minionDamage: 15, minionSpeed: 1, minionRate: 1, pickupRadius: 100, essenceMult: 1, hitEssence: 2,
    surgeCooldown: 12, surgeRadius: 210, surgeTimer: 0, camera: { x: 0, y: 0 }, keys: {}, pointer: null, muted: true, toastClock: 0, bannerClock: 0, flashClock: 0, kills: 0, totalSpawned: 0, upgradesTaken: 0,
    championsKilled: [],
  };

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.floor(innerWidth * dpr);
    canvas.height = Math.floor(innerHeight * dpr);
    canvas.style.width = `${innerWidth}px`;
    canvas.style.height = `${innerHeight}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  function rand(a, b) { return a + Math.random() * (b - a); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function norm(x, y) { const d = Math.hypot(x, y) || 1; return { x: x / d, y: y / d }; }
  function show(el, yes) { el.classList.toggle('hidden', !yes); }
  function toast(text, color = '') {
    const node = document.createElement('div'); node.className = `toast ${color}`; node.textContent = text;
    ui.toast.appendChild(node); setTimeout(() => { node.classList.add('fade'); setTimeout(() => node.remove(), 450); }, 2300);
  }
  function banner(kicker, title, sub, boss = false, duration = 3) {
    ui.bannerKick.textContent = kicker; ui.bannerTitle.textContent = title; ui.bannerSub.textContent = sub;
    ui.banner.classList.toggle('boss', boss); show(ui.banner, true); state.bannerClock = duration;
  }
  function makeDecor() {
    state.decor = [];
    for (let i = 0; i < 145; i++) state.decor.push({ x: rand(20, W - 20), y: rand(20, H - 20), type: Math.random() < 0.55 ? 'stone' : 'dead', size: rand(5, 16), rot: rand(0, TAU), hue: rand(0, 1) });
    for (let i = 0; i < 7; i++) state.decor.push({ x: rand(130, W - 130), y: rand(130, H - 130), type: 'rune', size: rand(60, 110), rot: rand(0, TAU) });
  }
  function reset() {
    Object.assign(state, { mode: 'playing', time: 0, last: performance.now(), dt: 0, slain: 0, level: 1, xp: 0, xpNeed: 80, cap: 55, spawnRate: 1.6, spawnClock: 0, minionDamage: 15, minionSpeed: 1, minionRate: 1, pickupRadius: 100, essenceMult: 1, hitEssence: 2, surgeCooldown: 12, surgeRadius: 210, surgeTimer: 3, kills: 0, totalSpawned: 0, upgradesTaken: 0, minions: [], shots: [], particles: [], orbs: [], championsKilled: [], playerMax: 120, playerHp: 120, playerArmor: 0, champMax: 900, champHp: 900, champLevel: 1, champAttack: 0, champXp: 0, champXpNeed: 9, champWeapons: 1, champFire: 0, champMelee: 0, champIndex: 0, essenceTotal: 0 });
    state.player = { x: W / 2, y: H / 2, r: 15, speed: 218, angle: -Math.PI / 2, invuln: 0 };
    state.champion = { x: W / 2 + 320, y: H / 2 - 100, r: 21, speed: 108, attackTimer: 0, hitFlash: 0, phase: 1 };
    state.camera.x = state.player.x; state.camera.y = state.player.y;
    makeDecor(); ui.toast.innerHTML = ''; show(ui.menu, false); show(ui.end, false); show(ui.pause, false); show(ui.levelup, false); show(ui.hud, true);
    show(ui.touch, matchMedia('(pointer: coarse)').matches); ui.touch.classList.toggle('hidden', !matchMedia('(pointer: coarse)').matches);
    banner('A HERO APPROACHES', names[0][0], 'The feast begins', false, 2.4); updateHud();
  }
  function playerAt(x, y) { return { x: clamp(x, 30, W - 30), y: clamp(y, 30, H - 30) }; }
  function spawnMinion(x, y, kind = 'ghoul') {
    if (state.minions.length >= state.cap) return false;
    const p = x == null ? { x: state.player.x + rand(-42, 42), y: state.player.y + rand(-42, 42) } : { x, y };
    const types = kind === 'surge' ? 'wraith' : kind;
    state.minions.push({ x: p.x, y: p.y, r: types === 'wraith' ? 8 : rand(8, 11), hp: types === 'wraith' ? 24 : 36, maxHp: types === 'wraith' ? 24 : 36, type: types, speed: rand(69, 92) * state.minionSpeed, attack: 0, wobble: rand(0, TAU), flash: 0 });
    state.totalSpawned++; return true;
  }
  function spawnParticles(x, y, color, count = 8, force = 1) {
    for (let i = 0; i < count; i++) { const a = rand(0, TAU), s = rand(22, 105) * force; state.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(.25, .75), max: .75, color, size: rand(1.5, 4) }); }
  }
  function dropOrb(x, y, value = 18) { state.orbs.push({ x, y, r: 5, value, life: 22, wobble: rand(0, TAU) }); }
  function gainXp(amount) {
    state.xp += amount * state.essenceMult; state.essenceTotal += amount;
    if (state.xp >= state.xpNeed) { state.xp -= state.xpNeed; state.level++; state.xpNeed = Math.floor(state.xpNeed * 1.32 + 22); openUpgrade(); }
  }
  function openUpgrade() {
    state.mode = 'upgrade'; show(ui.levelup, true); ui.cards.innerHTML = '';
    ui.upgradeTitle.textContent = `ESSENCE AWAKENS · LEVEL ${state.level}`; ui.upgradeSub.textContent = 'Choose a mutation for your horde.';
    const choices = [...upgrades].sort(() => Math.random() - .5).slice(0, 3);
    choices.forEach((u, i) => { const card = document.createElement('button'); card.className = `upgrade-card ${u.rarity}`; card.innerHTML = `<span class="card-rarity">${u.rarity}</span><span class="card-icon">${u.icon}</span><span><span class="card-name">${u.name}</span><span class="card-desc">${u.desc}</span></span><span class="card-key">${i + 1}</span>`; card.addEventListener('click', () => chooseUpgrade(u)); ui.cards.appendChild(card); });
  }
  function chooseUpgrade(u) { if (state.mode !== 'upgrade') return; u.apply(state); state.upgradesTaken++; show(ui.levelup, false); state.mode = 'playing'; toast(`${u.name.toUpperCase()} MUTATION AWAKENED`, 'green'); updateHud(); }
  function applyDamageToChamp(damage, source) {
    const c = state.champion; if (!c) return;
    state.champHp -= damage; c.hitFlash = .12; state.champAttack += damage;
    if (state.champAttack >= 100) { state.champAttack -= 100; gainXp(state.hitEssence); }
    if (source === 'minion' && Math.random() < .08) spawnParticles(c.x, c.y, '#ffd479', 3, .45);
    if (state.champHp <= 0) killChampion();
  }
  function killChampion() {
    const c = state.champion; if (!c) return;
    spawnParticles(c.x, c.y, '#ffe4a3', 44, 1.5); dropOrb(c.x, c.y, 100 + state.champLevel * 25);
    state.slain++; state.kills++; state.championsKilled.push(names[state.champIndex % 2][state.slain - 1] || 'Champion');
    state.minions.forEach(m => { if (dist(m, c) < 280) { m.speed *= 1.2; m.attack = 0; } });
    if (state.slain >= 5) { endGame(true); return; }
    state.champIndex++; state.champLevel = 1; state.champXp = 0; state.champXpNeed = 9; state.champWeapons = 1; state.champMax = 900 + state.slain * 380; state.champHp = state.champMax;
    const angle = rand(0, TAU), radius = rand(520, 720);
    state.champion = { x: clamp(state.player.x + Math.cos(angle) * radius, 80, W - 80), y: clamp(state.player.y + Math.sin(angle) * radius, 80, H - 80), r: 22 + state.slain, speed: 108 + state.slain * 9, attackTimer: .8, hitFlash: 0, phase: 1 };
    state.spawnRate *= 1.08; state.cap += 4;
    banner('HERO SLAIN', `${state.slain} OF 5`, 'The next champion is already hunting', true, 3.2); toast('THE HORDE FEASTS — ESSENCE GATHERED', 'gold'); updateHud();
  }
  function playerHit(amount) {
    if (state.player.invuln > 0) return;
    state.playerHp -= amount * (1 - state.playerArmor); state.player.invuln = .75;
    state.flashClock = .2; ui.flash.classList.add('on'); spawnParticles(state.player.x, state.player.y, '#ff4965', 9, .7);
    if (state.playerHp <= 0) endGame(false);
  }
  function fireShot(target, damage, color, speed, size = 4) {
    const n = norm(target.x - state.champion.x, target.y - state.champion.y);
    state.shots.push({ x: state.champion.x + n.x * 17, y: state.champion.y + n.y * 17, vx: n.x * speed, vy: n.y * speed, damage, color, size, life: 2.4 });
  }
  function championLevelUp() {
    state.champLevel++; state.champXp -= state.champXpNeed; state.champXpNeed = Math.floor(state.champXpNeed * 1.27 + 4);
    state.champMax += 105 + state.slain * 22; state.champHp = Math.min(state.champMax, state.champHp + 125);
    state.champWeapons = Math.min(4, 1 + Math.floor((state.champLevel - 1) / 2));
    const weapons = ['SUNBOLT', 'HOLY NOVA', 'ASHEN ORB', 'DAWNLANCE'];
    banner('CHAMPION ASCENDS', `LEVEL ${state.champLevel}`, `${weapons[Math.min(3, state.champWeapons - 1)]} · the light grows stronger`, false, 2.3);
  }
  function update(dt) {
    if (state.mode !== 'playing') return;
    state.time += dt;
    const p = state.player, c = state.champion;
    const moveX = (state.keys.d || state.keys.ArrowRight ? 1 : 0) - (state.keys.a || state.keys.ArrowLeft ? 1 : 0) + (state.stickX || 0);
    const moveY = (state.keys.s || state.keys.ArrowDown ? 1 : 0) - (state.keys.w || state.keys.ArrowUp ? 1 : 0) + (state.stickY || 0);
    if (moveX || moveY) { const v = norm(moveX, moveY); p.x = clamp(p.x + v.x * p.speed * dt, 28, W - 28); p.y = clamp(p.y + v.y * p.speed * dt, 28, H - 28); p.angle = Math.atan2(v.y, v.x); }
    p.invuln = Math.max(0, p.invuln - dt);
    state.camera.x += (p.x - state.camera.x) * Math.min(1, dt * 5);
    state.camera.y += (p.y - state.camera.y) * Math.min(1, dt * 5);

    state.spawnClock += dt;
    while (state.spawnClock > 1 / state.spawnRate) { state.spawnClock -= 1 / state.spawnRate; if (state.minions.length < state.cap) spawnMinion(); }
    // Horde AI: small groups swarm the champion, surround, then bite.
    for (const m of state.minions) {
      m.wobble += dt * 5; m.attack = Math.max(0, m.attack - dt); m.flash = Math.max(0, m.flash - dt);
      if (!c) continue;
      const d = dist(m, c), n = norm(c.x - m.x, c.y - m.y);
      if (d > c.r + m.r + 5) { m.x += n.x * m.speed * dt; m.y += n.y * m.speed * dt; }
      else if (m.attack <= 0) { m.attack = .72 / state.minionRate; applyDamageToChamp(state.minionDamage * state.minionRate, 'minion'); spawnParticles(c.x + rand(-10, 10), c.y + rand(-10, 10), '#d5a5ff', 2, .4); }
    }
    // Champion actively hunts the commander but prioritizes nearby brood with attacks.
    const pd = dist(c, p); const nearest = state.minions.reduce((best, m) => dist(m, c) < (best ? dist(best, c) : Infinity) ? m : best, null);
    const target = nearest && dist(nearest, c) < 225 ? nearest : p;
    const cd = dist(c, target), cn = norm(target.x - c.x, target.y - c.y);
    if (cd > (target === p ? 105 : target.r + c.r + 17)) { c.x = clamp(c.x + cn.x * c.speed * dt, 25, W - 25); c.y = clamp(c.y + cn.y * c.speed * dt, 25, H - 25); }
    c.hitFlash = Math.max(0, c.hitFlash - dt); c.attackTimer -= dt; c.champFire = (c.champFire || 0) - dt;
    if (c.attackTimer <= 0) {
      c.attackTimer = Math.max(.42, 1.18 - state.slain * .07);
      if (target === p && cd < 190) { playerHit(10 + state.slain * 2 + state.champLevel); }
      else if (target !== p && cd < 210) { target.hp -= 13 + state.slain * 2; target.flash = .12; if (target.hp <= 0) { const ix = state.minions.indexOf(target); if (ix >= 0) { state.minions.splice(ix, 1); state.kills++; dropOrb(target.x, target.y, 13); spawnParticles(target.x, target.y, '#b98cff', 7); } } }
    }
    // Survivor's automatic weapon fires bolts toward its nearest threat.
    c.champFire -= dt;
    if (c.champFire <= 0) {
      c.champFire = Math.max(.42, 1.06 - state.champLevel * .035);
      let victim = state.minions.reduce((best, m) => dist(m, c) < (best ? dist(best, c) : Infinity) ? m : best, null);
      if (!victim || dist(victim, c) > 500) victim = p;
      for (let i = 0; i < state.champWeapons; i++) {
        if (victim === p && i > 0) break;
        const spread = (i - (state.champWeapons - 1) / 2) * .17;
        const fake = { x: c.x + (victim.y - c.y) * Math.sin(spread), y: c.y - (victim.x - c.x) * Math.sin(spread) };
        const before = state.shots.length; fireShot(fake.x === c.x && fake.y === c.y ? victim : fake, 18 + state.champLevel * 2 + state.slain * 3, '#ffe49a', 390, 4 + state.champWeapons * .35);
        if (state.shots.length > before && spread) { const shot = state.shots[state.shots.length - 1]; const rot = spread; const vx = shot.vx, vy = shot.vy; shot.vx = vx * Math.cos(rot) - vy * Math.sin(rot); shot.vy = vx * Math.sin(rot) + vy * Math.cos(rot); }
      }
    }
    for (let i = state.shots.length - 1; i >= 0; i--) {
      const s = state.shots[i]; s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
      if (s.life <= 0 || s.x < 0 || s.y < 0 || s.x > W || s.y > H) { state.shots.splice(i, 1); continue; }
      const targetPlayer = Math.hypot(s.x - p.x, s.y - p.y) < p.r + s.size;
      if (targetPlayer) { playerHit(s.damage); state.shots.splice(i, 1); continue; }
      const hitMinion = state.minions.find(m => Math.hypot(s.x - m.x, s.y - m.y) < m.r + s.size);
      if (hitMinion) { hitMinion.hp -= s.damage; hitMinion.flash = .14; state.champXp += .45; if (state.champXp >= state.champXpNeed) championLevelUp(); if (hitMinion.hp <= 0) { state.minions.splice(state.minions.indexOf(hitMinion), 1); state.kills++; dropOrb(hitMinion.x, hitMinion.y, 13); spawnParticles(hitMinion.x, hitMinion.y, '#b98cff', 7); } state.shots.splice(i, 1); }
    }
    for (let i = state.orbs.length - 1; i >= 0; i--) {
      const o = state.orbs[i]; o.life -= dt; o.wobble += dt * 3;
      const d = dist(o, p);
      if (d < state.pickupRadius) { const n = norm(p.x - o.x, p.y - o.y); o.x += n.x * (150 + (state.pickupRadius - d) * 2) * dt; o.y += n.y * (150 + (state.pickupRadius - d) * 2) * dt; }
      if (d < p.r + 12) { gainXp(o.value); state.orbs.splice(i, 1); spawnParticles(o.x, o.y, '#bb8cff', 5, .45); }
      else if (o.life <= 0) state.orbs.splice(i, 1);
    }
    for (let i = state.particles.length - 1; i >= 0; i--) { const q = state.particles[i]; q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= .96; q.vy *= .96; q.life -= dt; if (q.life <= 0) state.particles.splice(i, 1); }
    state.surgeTimer = Math.min(state.surgeCooldown, state.surgeTimer + dt);
    state.bannerClock -= dt; if (state.bannerClock <= 0) show(ui.banner, false);
    state.flashClock -= dt; if (state.flashClock <= 0) ui.flash.classList.remove('on');
    updateHud();
    if (state.time >= 420) endGame(false, true);
  }
  function useSurge() {
    if (state.mode !== 'playing' || state.surgeTimer < state.surgeCooldown) return;
    state.surgeTimer = 0; const c = state.champion; let made = 0;
    for (let i = 0; i < 18; i++) { const a = i * TAU / 18 + rand(-.12, .12); if (spawnMinion(state.player.x + Math.cos(a) * rand(35, 75), state.player.y + Math.sin(a) * rand(35, 75), 'surge')) made++; }
    state.minions.forEach(m => { const d = dist(m, c); if (d < state.surgeRadius) { const n = norm(c.x - m.x, c.y - m.y); m.x -= n.x * 36; m.y -= n.y * 36; } });
    spawnParticles(state.player.x, state.player.y, '#ff5470', 32, 1.4); toast(`SURGE — ${made} WRAITHS RISE`, 'red');
  }
  function updateHud() {
    if (!state.player) return;
    const c = state.champion;
    ui.horde.textContent = state.minions.length; ui.cap.textContent = state.cap; ui.rate.textContent = state.spawnRate.toFixed(1);
    ui.champNum.textContent = `CHAMPION ${['I','II','III','IV','V'][state.slain] || 'V'}`; ui.champLv.textContent = `LV ${state.champLevel}`;
    ui.champName.textContent = names[state.champIndex % 2][Math.min(4, state.slain)] || 'Saint of Dawn';
    ui.champHp.style.width = `${clamp(state.champHp / state.champMax, 0, 1) * 100}%`; ui.champHpText.textContent = `${Math.max(0, Math.ceil(state.champHp))} / ${state.champMax}`;
    const weapons = ['☀ SUNBOLT', '✦ NOVA', '◉ ORB', '† LANCE'];
    ui.weapons.innerHTML = weapons.slice(0, state.champWeapons).map((w, i) => `<span class="weapon-chip"><i>${w.split(' ')[0]}</i>${w.split(' ').slice(1).join(' ')}</span>`).join('');
    const mm = Math.floor(state.time / 60).toString().padStart(2, '0'), ss = Math.floor(state.time % 60).toString().padStart(2, '0'); ui.timer.textContent = `${mm}:${ss}`;
    ui.slain.textContent = `${state.slain} / 5`; ui.commanderHp.style.width = `${clamp(state.playerHp / state.playerMax, 0, 1) * 100}%`; ui.commanderText.textContent = `${Math.max(0, Math.ceil(state.playerHp))} / ${state.playerMax}`;
    ui.level.textContent = state.level; ui.xp.textContent = `${Math.floor(state.xp)} / ${state.xpNeed}`; ui.xpFill.style.width = `${clamp(state.xp / state.xpNeed, 0, 1) * 100}%`;
    const ready = state.surgeTimer >= state.surgeCooldown; ui.surge.classList.toggle('ready', ready); ui.surgeFill.style.setProperty('--p', clamp(state.surgeTimer / state.surgeCooldown, 0, 1)); ui.surge.setAttribute('aria-label', ready ? 'Unleash surge' : 'Surge recharging');
  }
  function endGame(victory, dawn = false) {
    if (state.mode === 'ended') return;
    state.mode = 'ended'; show(ui.end, true); ui.endTitle.textContent = victory ? 'THE NIGHT IS YOURS' : 'THE HORDE SCATTERS'; ui.endTitle.classList.toggle('victory', victory);
    ui.endSub.textContent = victory ? 'Five champions devoured. The dawn belongs to the dead.' : dawn ? 'The Saint of Dawn survived until sunrise.' : 'Your necromancer has fallen.';
    const stats = [['Champions slain', `${state.slain} / 5`], ['Minions raised', state.totalSpawned], ['Essence gathered', Math.floor(state.essenceTotal)], ['Survival time', ui.timer.textContent]];
    ui.endStats.innerHTML = stats.map(([a, b]) => `<div class="end-stat"><span>${a}</span><b>${b}</b></div>`).join('');
  }
  function pause() { if (state.mode === 'playing') { state.mode = 'paused'; show(ui.pause, true); } }
  function resume() { if (state.mode === 'paused') { state.mode = 'playing'; state.last = performance.now(); show(ui.pause, false); } }

  function draw() {
    const vw = innerWidth, vh = innerHeight, sx = vw / 2 - state.camera.x, sy = vh / 2 - state.camera.y;
    ctx.clearRect(0, 0, vw, vh);
    // Night-sky field and a subtle square grid make the arena feel legible.
    const grad = ctx.createRadialGradient(vw * .5, vh * .45, 50, vw * .5, vh * .5, Math.max(vw, vh) * .78);
    grad.addColorStop(0, '#171020'); grad.addColorStop(.58, '#0c0912'); grad.addColorStop(1, '#07060b'); ctx.fillStyle = grad; ctx.fillRect(0, 0, vw, vh);
    ctx.save(); ctx.translate(sx, sy);
    ctx.fillStyle = '#100d15'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(177,145,207,.045)'; ctx.lineWidth = 1;
    for (let x = Math.floor((state.camera.x - vw / 2) / 100) * 100; x < state.camera.x + vw / 2 + 100; x += 100) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = Math.floor((state.camera.y - vh / 2) / 100) * 100; y < state.camera.y + vh / 2 + 100; y += 100) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    // Arena edge
    ctx.strokeStyle = 'rgba(185,140,255,.25)'; ctx.lineWidth = 4; ctx.strokeRect(4, 4, W - 8, H - 8);
    for (const d of state.decor) {
      if (Math.abs(d.x - state.camera.x) > vw * .7 || Math.abs(d.y - state.camera.y) > vh * .7) continue;
      if (d.type === 'rune') { ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(d.rot); ctx.strokeStyle = 'rgba(185,140,255,.10)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, d.size, 0, TAU); ctx.arc(0, 0, d.size * .72, 0, TAU); ctx.moveTo(-d.size, 0); ctx.lineTo(d.size, 0); ctx.moveTo(0, -d.size); ctx.lineTo(0, d.size); ctx.stroke(); ctx.restore(); }
      else if (d.type === 'stone') { ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(d.rot); ctx.fillStyle = `rgba(119,104,129,${.08 + d.hue * .07})`; ctx.beginPath(); ctx.ellipse(0, 0, d.size, d.size * .55, 0, 0, TAU); ctx.fill(); ctx.restore(); }
      else { ctx.strokeStyle = 'rgba(89,101,83,.19)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x + Math.cos(d.rot) * d.size, d.y + Math.sin(d.rot) * d.size); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x + Math.cos(d.rot + 1.3) * d.size * .75, d.y + Math.sin(d.rot + 1.3) * d.size * .75); ctx.stroke(); }
    }
    for (const o of state.orbs) { ctx.save(); ctx.shadowBlur = 17; ctx.shadowColor = '#b98cff'; ctx.fillStyle = '#d8baff'; ctx.beginPath(); ctx.arc(o.x, o.y + Math.sin(o.wobble) * 3, o.r, 0, TAU); ctx.fill(); ctx.restore(); }
    for (const s of state.shots) { ctx.save(); ctx.shadowBlur = 12; ctx.shadowColor = s.color; ctx.fillStyle = s.color; ctx.beginPath(); ctx.arc(s.x, s.y, s.size, 0, TAU); ctx.fill(); ctx.restore(); }
    for (const m of state.minions) drawMinion(m);
    if (state.champion) drawChampion(state.champion);
    drawPlayer(state.player);
    for (const q of state.particles) { ctx.globalAlpha = clamp(q.life / q.max, 0, 1); ctx.fillStyle = q.color; ctx.beginPath(); ctx.arc(q.x, q.y, q.size, 0, TAU); ctx.fill(); } ctx.globalAlpha = 1;
    ctx.restore();
    drawVignette(vw, vh);
  }
  function drawMinion(m) {
    const bob = Math.sin(m.wobble) * 2; ctx.save(); ctx.translate(m.x, m.y + bob);
    ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.beginPath(); ctx.ellipse(0, m.r * .8, m.r * 1.1, m.r * .48, 0, 0, TAU); ctx.fill();
    ctx.shadowBlur = m.type === 'wraith' ? 16 : 9; ctx.shadowColor = m.flash ? '#fff' : m.type === 'wraith' ? '#e575ff' : '#9d68cd';
    ctx.fillStyle = m.flash ? '#f4dfff' : m.type === 'wraith' ? '#d29af3' : '#76538f';
    ctx.beginPath(); ctx.ellipse(0, 0, m.r * .8, m.r * 1.1, 0, 0, TAU); ctx.fill(); ctx.shadowBlur = 0;
    ctx.fillStyle = '#ff7188'; ctx.fillRect(-m.r * .42, -2, 2.4, 2.4); ctx.fillRect(m.r * .16, -2, 2.4, 2.4);
    ctx.restore();
  }
  function drawChampion(c) {
    const pulse = 1 + Math.sin(state.time * 4) * .035;
    ctx.save(); ctx.translate(c.x, c.y); ctx.scale(pulse, pulse);
    ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.beginPath(); ctx.ellipse(0, c.r * .85, c.r * 1.25, c.r * .52, 0, 0, TAU); ctx.fill();
    ctx.shadowBlur = 24; ctx.shadowColor = c.hitFlash ? '#fff' : '#ffe49a';
    ctx.fillStyle = c.hitFlash ? '#fff9dc' : '#d4c6a9'; ctx.beginPath(); ctx.arc(0, 0, c.r * .68, 0, TAU); ctx.fill();
    ctx.fillStyle = '#6e6475'; ctx.beginPath(); ctx.moveTo(-c.r * .9, c.r * .1); ctx.lineTo(-c.r * .72, c.r * 1.15); ctx.lineTo(0, c.r * .95); ctx.lineTo(c.r * .76, c.r * 1.1); ctx.lineTo(c.r * .92, 0); ctx.lineTo(c.r * .5, -c.r * .3); ctx.lineTo(-c.r * .5, -c.r * .3); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#e9dfc9'; ctx.beginPath(); ctx.arc(0, -c.r * .34, c.r * .4, 0, TAU); ctx.fill();
    ctx.fillStyle = '#f9df92'; ctx.shadowBlur = 12; ctx.shadowColor = '#ffe49a'; ctx.beginPath(); ctx.arc(-c.r * .14, -c.r * .38, 2.2, 0, TAU); ctx.arc(c.r * .14, -c.r * .38, 2.2, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#f4d184'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(c.r * .68, -c.r * .15); ctx.lineTo(c.r * 1.2, c.r * .8); ctx.stroke();
    ctx.restore();
    const barW = 58, ratio = clamp(state.champHp / state.champMax, 0, 1);
    ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.fillRect(c.x - barW / 2, c.y - c.r - 17, barW, 5);
    ctx.fillStyle = '#ff546b'; ctx.fillRect(c.x - barW / 2, c.y - c.r - 17, barW * ratio, 5);
  }
  function drawPlayer(p) {
    if (!p) return;
    ctx.save(); ctx.translate(p.x, p.y);
    ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.beginPath(); ctx.ellipse(0, 15, 19, 8, 0, 0, TAU); ctx.fill();
    ctx.shadowBlur = 20; ctx.shadowColor = '#a86fff';
    ctx.fillStyle = p.invuln > 0 && Math.floor(state.time * 18) % 2 ? '#f6dfff' : '#352747';
    ctx.beginPath(); ctx.moveTo(-14, -5); ctx.lineTo(-10, 12); ctx.lineTo(0, 18); ctx.lineTo(10, 12); ctx.lineTo(14, -5); ctx.lineTo(8, -14); ctx.lineTo(-8, -14); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#b98cff'; ctx.beginPath(); ctx.arc(0, -9, 8, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ff647c'; ctx.beginPath(); ctx.arc(-3, -10, 1.6, 0, TAU); ctx.arc(3, -10, 1.6, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#d7b4ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(Math.cos(p.angle) * 10, Math.sin(p.angle) * 10); ctx.lineTo(Math.cos(p.angle) * 22, Math.sin(p.angle) * 22); ctx.stroke();
    ctx.restore();
  }
  function drawVignette(w, h) {
    const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * .22, w / 2, h / 2, Math.max(w, h) * .76);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.55)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }
  function frame(now) {
    const dt = Math.min(.05, Math.max(0, (now - state.last) / 1000)); state.last = now;
    update(dt); draw(); requestAnimationFrame(frame);
  }
  function returnToMenu() {
    state.mode = 'menu'; show(ui.pause, false); show(ui.end, false); show(ui.hud, false); show(ui.touch, false); show(ui.menu, true);
  }
  function bindInput() {
    ui.start.addEventListener('click', reset); ui.again.addEventListener('click', reset); ui.restart.addEventListener('click', reset);
    ui.resume.addEventListener('click', resume); ui.quit.addEventListener('click', returnToMenu); ui.menuBtn.addEventListener('click', returnToMenu);
    ui.pauseBtn.addEventListener('click', () => state.mode === 'paused' ? resume() : pause()); ui.surge.addEventListener('click', useSurge);
    ui.mute.addEventListener('click', () => { state.muted = !state.muted; ui.mute.textContent = state.muted ? '♪' : '♫'; ui.mute.setAttribute('aria-label', state.muted ? 'Sound off' : 'Sound on'); toast(state.muted ? 'SOUND OFF' : 'SOUND ON'); });
    window.addEventListener('keydown', e => {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault();
      if (key === 'Enter' && (state.mode === 'menu' || state.mode === 'ended')) { reset(); return; }
      if ((key === 'p' || key === 'Escape') && (state.mode === 'playing' || state.mode === 'paused')) { state.mode === 'paused' ? resume() : pause(); return; }
      if (key === ' ' || key === 'Spacebar') { useSurge(); return; }
      if (state.mode === 'upgrade' && /^[1-3]$/.test(key)) ui.cards.children[Number(key) - 1]?.click();
      state.keys[key] = true;
    });
    window.addEventListener('keyup', e => { const key = e.key.length === 1 ? e.key.toLowerCase() : e.key; state.keys[key] = false; });
    window.addEventListener('blur', () => { state.keys = {}; if (state.mode === 'playing') pause(); });
    let pointerId = null;
    ui.joystick.addEventListener('pointerdown', e => { pointerId = e.pointerId; ui.joystick.setPointerCapture(pointerId); moveStick(e); });
    ui.joystick.addEventListener('pointermove', e => { if (pointerId === e.pointerId) moveStick(e); });
    const stopStick = e => { if (pointerId !== e.pointerId) return; pointerId = null; state.stickX = state.stickY = 0; ui.knob.style.transform = 'translate(0, 0)'; };
    ui.joystick.addEventListener('pointerup', stopStick); ui.joystick.addEventListener('pointercancel', stopStick);
    function moveStick(e) {
      const r = ui.joystick.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2), max = r.width * .32;
      const n = Math.hypot(dx, dy), scale = n > max ? max / n : 1;
      state.stickX = dx * scale / max; state.stickY = dy * scale / max;
      ui.knob.style.transform = `translate(${dx * scale}px, ${dy * scale}px)`;
    }
  }
  state.camera.x = W / 2; state.camera.y = H / 2; state.last = performance.now();
  bindInput(); updateHud(); requestAnimationFrame(frame);
})();
