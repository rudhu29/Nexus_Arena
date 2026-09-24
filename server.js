const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const os = require('os');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
app.use(express.static(PUBLIC_DIR));

// Helper: Get local network IPv4 address for cross-device mobile play
function getLocalIps() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }
  return ips;
}

app.get('/api/info', (req, res) => {
  const ips = getLocalIps();
  res.json({
    localIp: ips[0] || 'localhost',
    allIps: ips,
    port: PORT,
    roomsCount: rooms.size,
    timestamp: Date.now()
  });
});

// Arena Configuration
const ARENA_W = 1200;
const ARENA_H = 750;
const TICK_RATE = 30; // 30Hz server tick
const TICK_MS = 1000 / TICK_RATE;

// Distinct Map Layouts
const MAPS = {
  neon_metropolis: {
    id: 'neon_metropolis',
    name: 'Neon Metropolis',
    desc: 'Tactical urban plaza with symmetrical neon cover pillars.',
    obstacles: [
      { x: 340, y: 160, w: 60, h: 110 },
      { x: 340, y: 480, w: 60, h: 110 },
      { x: 800, y: 160, w: 60, h: 110 },
      { x: 800, y: 480, w: 60, h: 110 },
      { x: 570, y: 220, w: 60, h: 60 },
      { x: 570, y: 470, w: 60, h: 60 }
    ],
    teleporters: []
  },
  cyber_core: {
    id: 'cyber_core',
    name: 'Cyber Core Reactor',
    desc: 'High-tech reactor core with perimeter energy bunkers and open lines.',
    obstacles: [
      { x: 400, y: 260, w: 70, h: 70 },
      { x: 400, y: 420, w: 70, h: 70 },
      { x: 730, y: 260, w: 70, h: 70 },
      { x: 730, y: 420, w: 70, h: 70 },
      { x: 220, y: 340, w: 50, h: 70 },
      { x: 930, y: 340, w: 50, h: 70 }
    ],
    teleporters: []
  },
  omega_ruins: {
    id: 'omega_ruins',
    name: 'Omega Ruins',
    desc: 'Alien cyber-chambers with active Quantum Teleporters for cross-map flank.',
    obstacles: [
      { x: 300, y: 200, w: 50, h: 180 },
      { x: 850, y: 370, w: 50, h: 180 },
      { x: 550, y: 160, w: 100, h: 50 },
      { x: 550, y: 540, w: 100, h: 50 }
    ],
    teleporters: [
      { id: 'tp_a', x: 150, y: 150, targetX: 1050, targetY: 600, radius: 36, color: '#00f0ff' },
      { id: 'tp_b', x: 1050, y: 600, targetX: 150, targetY: 150, radius: 36, color: '#9d4edd' }
    ]
  },
  sector7_warehouse: {
    id: 'sector7_warehouse',
    name: 'Sector 7 Warehouse (COD/BGMI CQB)',
    desc: 'Close-quarters tactical warehouse with shipping containers, cargo crates, and bomb sites A & B.',
    obstacles: [
      { x: 260, y: 150, w: 140, h: 60, type: 'container', color: '#1e40af' }, // Blue Container
      { x: 260, y: 540, w: 140, h: 60, type: 'container', color: '#b91c1c' }, // Red Container
      { x: 800, y: 150, w: 140, h: 60, type: 'container', color: '#15803d' }, // Green Container
      { x: 800, y: 540, w: 140, h: 60, type: 'container', color: '#c2410c' }, // Orange Container
      { x: 550, y: 310, w: 100, h: 130, type: 'crate_depot', color: '#334155' }, // Center Cargo Hub
      { x: 330, y: 345, w: 60, h: 60, type: 'crate_wood', color: '#854d0e' }, // Site A Crate
      { x: 810, y: 345, w: 60, h: 60, type: 'crate_metal', color: '#475569' }, // Site B Crate
      { x: 560, y: 110, w: 80, h: 40, type: 'barricade', color: '#64748b' }, // North Flank Wall
      { x: 560, y: 600, w: 80, h: 40, type: 'barricade', color: '#64748b' } // South Flank Wall
    ],
    teleporters: []
  }
};

// Operator Outfits (Clothes / Chassis)
const OUTFITS = {
  spec_ops: { id: 'spec_ops', name: 'Spec-Ops Camo', primary: '#1e293b', secondary: '#334155', accent: '#00f0ff' },
  desert_operative: { id: 'desert_operative', name: 'Desert Operative', primary: '#b89768', secondary: '#785d38', accent: '#ffd60a' },
  cyber_glitch: { id: 'cyber_glitch', name: 'Cyber Runner', primary: '#0f172a', secondary: '#ff007f', accent: '#00f0ff' },
  bloodhound: { id: 'bloodhound', name: 'Bloodhound Crimson', primary: '#18181b', secondary: '#dc2626', accent: '#ef4444' },
  arctic_ghost: { id: 'arctic_ghost', name: 'Arctic Ghost', primary: '#f1f5f9', secondary: '#94a3b8', accent: '#38bdf8' },
  gilded_warlord: { id: 'gilded_warlord', name: 'Gilded Warlord', primary: '#ca8a04', secondary: '#713f12', accent: '#fef08a' }
};

// Weapon Skins & Custom Tracers
const WEAPON_SKINS = {
  default: { id: 'default', name: 'Standard Issue', projColor: null },
  dragon_fire: { id: 'dragon_fire', name: 'Dragon Flame', projColor: '#ff4500' },
  neon_cyber: { id: 'neon_cyber', name: 'Neon Matrix', projColor: '#00f0ff' },
  toxic_hazard: { id: 'toxic_hazard', name: 'Toxic Hazard', projColor: '#39ff14' },
  void_cosmic: { id: 'void_cosmic', name: 'Void Phantom', projColor: '#a855f7' },
  golden_glory: { id: 'golden_glory', name: 'Golden Prestige', projColor: '#ffd700' }
};

// Character Class Definitions
const CLASSES = {
  assault: {
    id: 'assault',
    name: 'Assault Striker',
    icon: '⚡',
    hp: 150,
    speed: 3.1,
    desc: 'Balanced twin pulse blasters and rapid tactical evasive roll.'
  },
  sniper: {
    id: 'sniper',
    name: 'Phantom Sniper',
    icon: '🎯',
    hp: 120,
    speed: 3.2,
    desc: 'High-damage long-range railgun and optical camouflage stealth.'
  },
  vanguard: {
    id: 'vanguard',
    name: 'Titan Vanguard',
    icon: '🛡️',
    hp: 200,
    speed: 2.8,
    desc: 'Heavy spread plasma shotgun and kinetic forcefield shield.'
  },
  boss_colossus: {
    id: 'boss_colossus',
    name: 'Colossus Titan',
    icon: '👑',
    hp: 650,
    speed: 3.2,
    desc: 'Devastating ground slam cleave and heavy fortress shield.'
  },
  boss_stalker: {
    id: 'boss_stalker',
    name: 'Shadow Stalker',
    icon: '🗡️',
    hp: 520,
    speed: 3.6,
    desc: 'Fast blade whirlwind and shadow blink teleport with stealth.'
  },
  stalker_infected: {
    id: 'stalker_infected',
    name: 'Cyber Xenomorph',
    icon: '☣️',
    hp: 220,
    speed: 3.8,
    desc: 'Aggressive infected predator with venom claws and leaping pounce.'
  }
};

// Rooms storage
const rooms = new Map();

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return rooms.has(code) ? generateRoomCode() : code;
}

const BOT_NAMES = ['Nova', 'Apex', 'Viper', 'Phantom', 'Ghost', 'Zero', 'Echo', 'Titan', 'Blaze', 'Cipher', 'Vortex', 'Kage', 'Onyx', 'Rogue'];
let botCounter = 1;

function getTierName(mmr) {
  if (mmr >= 1800) return 'Grandmaster';
  if (mmr >= 1600) return 'Diamond';
  if (mmr >= 1400) return 'Platinum';
  if (mmr >= 1200) return 'Gold';
  if (mmr >= 1000) return 'Silver';
  return 'Bronze';
}

function calculateEloDelta(playerMmr, opponentAvgMmr, won) {
  const expected = 1 / (1 + Math.pow(10, (opponentAvgMmr - playerMmr) / 400));
  const k = 32;
  const actual = won ? 1 : 0;
  const delta = Math.round(k * (actual - expected));
  return won ? Math.max(16, Math.min(36, delta)) : Math.min(-12, Math.max(-28, delta));
}

function createRoom(hostSocketId) {
  const code = generateRoomCode();
  const room = {
    id: code,
    host: hostSocketId,
    modeSetting: 'auto',
    activeMode: 'hunt',
    mapId: 'neon_metropolis',
    players: {},
    projectiles: [],
    events: [],
    medkits: [],
    orbs: [],
    zones: [],
    scores: { blue: 0, red: 0, bossKills: 0 },
    surgeTeam: null,
    started: false,
    over: false,
    winner: null,
    mvp: null,
    firstBloodTaken: false,
    endsAt: 0,
    interval: null,
    lastOrbSpawn: 0,
    lastZoneTick: 0,
    lastMedkitSpawn: 0
  };
  rooms.set(code, room);
  return room;
}

function circleRectCollision(cx, cy, radius, rx, ry, rw, rh) {
  const testX = Math.max(rx, Math.min(cx, rx + rw));
  const testY = Math.max(ry, Math.min(cy, ry + rh));
  const distX = cx - testX;
  const distY = cy - testY;
  return (distX * distX + distY * distY) < (radius * radius);
}

function lineRectCollision(x1, y1, x2, y2, rx, ry, rw, rh) {
  if (x1 >= rx && x1 <= rx + rw && y1 >= ry && y1 <= ry + rh) return true;
  if (x2 >= rx && x2 <= rx + rw && y2 >= ry && y2 <= ry + rh) return true;
  const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
  if (maxX < rx || minX > rx + rw || maxY < ry || minY > ry + rh) return false;
  return true;
}

function setupRoomForMode(room) {
  const playerList = Object.values(room.players);
  const count = playerList.length;

  if (room.modeSetting === 'auto') {
    if (count <= 3) room.activeMode = 'skirmish';
    else if (count <= 6) room.activeMode = 'hunt';
    else room.activeMode = 'siege';
  } else {
    room.activeMode = room.modeSetting;
  }

  room.projectiles = [];
  room.events = [];
  room.scores = { blue: 0, red: 0, bossKills: 0 };
  room.surgeTeam = null;
  room.firstBloodTaken = false;
  room.endsAt = Date.now() + 180000;
  room.lastOrbSpawn = Date.now();
  room.lastZoneTick = Date.now();
  room.lastMedkitSpawn = Date.now();

  // Nanite Medkits in tactical map spots
  room.medkits = [
    { id: 'med_top', x: 600, y: 130, active: true },
    { id: 'med_bot', x: 600, y: 620, active: true }
  ];

  if (room.activeMode === 'siege') {
    room.zones = [
      { id: 'A', name: 'Alpha', x: 250, y: 375, radius: 80, owner: 'neutral', progress: 0 },
      { id: 'B', name: 'Bravo', x: 600, y: 375, radius: 90, owner: 'neutral', progress: 0 },
      { id: 'C', name: 'Omega', x: 950, y: 375, radius: 80, owner: 'neutral', progress: 0 }
    ];
  } else {
    room.zones = [];
  }

  if (room.activeMode === 'skirmish') {
    room.orbs = [
      { id: 1, x: 600, y: 375, active: true },
      { id: 2, x: 260, y: 375, active: true },
      { id: 3, x: 940, y: 375, active: true }
    ];
  } else {
    room.orbs = [];
  }

  if (room.activeMode === 'snd') {
    room.scores = { blue: 0, red: 0, bossKills: 0 };
    room.sndSites = [
      { id: 'A', name: 'Site A', x: 340, y: 375, radius: 70 },
      { id: 'B', name: 'Site B', x: 840, y: 375, radius: 70 }
    ];
    room.sndState = {
      round: 1,
      targetRounds: 3,
      attackersWon: 0,
      defendersWon: 0,
      roundEndsAt: Date.now() + 120000,
      roundOver: false,
      roundWinner: null,
      resetRoundAt: 0,
      bomb: {
        state: 'unplanted',
        carrierId: null,
        planterId: null,
        defuserId: null,
        x: 1050,
        y: 375,
        site: null,
        timerRemaining: 40,
        plantProgress: 0,
        defuseProgress: 0
      }
    };

    playerList.forEach((p, idx) => {
      const isAttacker = (idx % 2 === 0);
      p.role = isAttacker ? 'attacker' : 'defender';
      p.team = isAttacker ? 'red' : 'blue';
      const cls = CLASSES[p.classId] || CLASSES.assault;
      p.maxHp = cls.hp;
      p.hp = p.maxHp;
      p.shield = 0;
      p.speed = cls.speed;
      p.radius = 16;
      p.alive = true;
      p.respawnAt = 0;
      p.x = isAttacker ? (1050 + Math.random() * 50) : (140 + Math.random() * 50);
      p.y = 200 + Math.random() * 350;
      p.dir = isAttacker ? Math.PI : 0;
      p.attackCool = 0;
      p.abilityCool = 0;
      p.pingCool = 0;
      p.teleportCool = 0;
      p.stealthUntil = 0;
      p.pingedUntil = 0;
      p.overchargedUntil = 0;
      p.streak = 0;
      p.kills = 0;
      p.deaths = 0;
      p.damage = 0;
    });

    const firstAttacker = playerList.find(p => p.team === 'red');
    if (firstAttacker) {
      room.sndState.bomb.carrierId = firstAttacker.id;
      room.sndState.bomb.x = firstAttacker.x;
      room.sndState.bomb.y = firstAttacker.y;
    }
  } else if (room.activeMode === 'hunt') {
    playerList.forEach((p, idx) => {
      const isBoss = (idx === 0);
      p.role = isBoss ? 'boss' : 'hunter';
      p.team = isBoss ? 'boss' : 'hunter';

      if (isBoss) {
        p.classId = p.classId && p.classId.startsWith('boss_') ? p.classId : 'boss_colossus';
        const bossClass = CLASSES[p.classId] || CLASSES.boss_colossus;
        p.maxHp = bossClass.hp + (count - 1) * 75;
        p.hp = p.maxHp;
        p.shield = 100;
        p.speed = bossClass.speed;
        p.radius = 26;
      } else {
        const cls = CLASSES[p.classId] || CLASSES.assault;
        p.maxHp = cls.hp;
        p.hp = p.maxHp;
        p.shield = 0;
        p.speed = cls.speed;
        p.radius = 16;
      }

      p.alive = true;
      p.respawnAt = 0;
      p.x = isBoss ? 600 : (100 + Math.random() * 200);
      p.y = isBoss ? 375 : (150 + Math.random() * 450);
      p.dir = 0;
      p.attackCool = 0;
      p.abilityCool = 0;
      p.pingCool = 0;
      p.teleportCool = 0;
      p.stealthUntil = 0;
      p.pingedUntil = 0;
      p.overchargedUntil = 0;
      p.streak = 0;
      p.kills = 0;
      p.deaths = 0;
      p.damage = 0;
    });
  } else if (room.activeMode === 'gungame') {
    room.gunGameMaxTier = 5;
    room.endsAt = Date.now() + 240000;
    playerList.forEach((p, idx) => {
      p.role = 'fighter';
      p.team = 'solo_' + p.id;
      p.gunTier = 1;
      room.scores[p.id] = 1;
      p.maxHp = 140;
      p.hp = 140;
      p.shield = 0;
      p.speed = 3.2;
      p.radius = 16;
      p.alive = true;
      p.respawnAt = 0;
      p.x = 180 + Math.random() * 840;
      p.y = 160 + Math.random() * 430;
      p.dir = Math.random() * Math.PI * 2;
      p.attackCool = 0;
      p.abilityCool = 0;
      p.pingCool = 0;
      p.teleportCool = 0;
      p.stealthUntil = 0;
      p.pingedUntil = 0;
      p.overchargedUntil = 0;
      p.streak = 0;
      p.kills = 0;
      p.deaths = 0;
      p.damage = 0;
    });
  } else if (room.activeMode === 'infection') {
    room.endsAt = Date.now() + 150000;
    room.lastSurvivorTriggered = false;
    const alphaIndex = Math.floor(Math.random() * playerList.length);
    playerList.forEach((p, idx) => {
      const isAlpha = (idx === alphaIndex);
      if (isAlpha) {
        p.role = 'infected';
        p.team = 'infected';
        p.classId = 'stalker_infected';
        p.maxHp = 220;
        p.hp = 220;
        p.shield = 50;
        p.speed = 3.8;
        p.radius = 18;
        p.x = 600;
        p.y = 375;
      } else {
        p.role = 'survivor';
        p.team = 'survivor';
        const cls = CLASSES[p.classId] || CLASSES.assault;
        p.maxHp = cls.hp;
        p.hp = cls.hp;
        p.shield = 50;
        p.speed = cls.speed;
        p.radius = 16;
        p.x = (idx % 2 === 0 ? 160 : 1040) + (Math.random() - 0.5) * 60;
        p.y = 200 + Math.random() * 350;
      }
      p.alive = true;
      p.respawnAt = 0;
      p.dir = Math.random() * Math.PI * 2;
      p.attackCool = 0;
      p.abilityCool = 0;
      p.pingCool = 0;
      p.teleportCool = 0;
      p.stealthUntil = 0;
      p.pingedUntil = 0;
      p.overchargedUntil = 0;
      p.streak = 0;
      p.kills = 0;
      p.deaths = 0;
      p.damage = 0;
    });
  } else if (room.activeMode === 'ctf') {
    room.endsAt = Date.now() + 240000;
    room.scores = { blue: 0, red: 0, bossKills: 0 };
    room.ctfState = {
      targetCaptures: 3,
      blueCaptures: 0,
      redCaptures: 0,
      blueFlag: { x: 160, y: 375, homeX: 160, homeY: 375, carrierId: null, atHome: true },
      redFlag: { x: 1040, y: 375, homeX: 1040, homeY: 375, carrierId: null, atHome: true }
    };
    playerList.forEach((p, idx) => {
      const isBlue = (idx % 2 === 0);
      p.role = 'fighter';
      p.team = isBlue ? 'blue' : 'red';
      const cls = CLASSES[p.classId] || CLASSES.assault;
      p.maxHp = cls.hp;
      p.hp = p.maxHp;
      p.shield = 0;
      p.speed = cls.speed;
      p.radius = 16;
      p.alive = true;
      p.respawnAt = 0;
      p.x = isBlue ? (140 + Math.random() * 80) : (1060 - Math.random() * 80);
      p.y = 200 + Math.random() * 350;
      p.dir = isBlue ? 0 : Math.PI;
      p.attackCool = 0;
      p.abilityCool = 0;
      p.pingCool = 0;
      p.teleportCool = 0;
      p.stealthUntil = 0;
      p.pingedUntil = 0;
      p.overchargedUntil = 0;
      p.streak = 0;
      p.kills = 0;
      p.deaths = 0;
      p.damage = 0;
    });
  } else {
    playerList.forEach((p, idx) => {
      const isBlue = (idx % 2 === 0);
      p.role = 'fighter';
      p.team = isBlue ? 'blue' : 'red';
      const cls = CLASSES[p.classId] || CLASSES.assault;
      p.maxHp = cls.hp;
      p.hp = p.maxHp;
      p.shield = 0;
      p.speed = cls.speed;
      p.radius = 16;
      p.alive = true;
      p.respawnAt = 0;
      p.x = isBlue ? (120 + Math.random() * 100) : (1080 - Math.random() * 100);
      p.y = 200 + Math.random() * 350;
      p.dir = isBlue ? 0 : Math.PI;
      p.attackCool = 0;
      p.abilityCool = 0;
      p.pingCool = 0;
      p.teleportCool = 0;
      p.stealthUntil = 0;
      p.pingedUntil = 0;
      p.overchargedUntil = 0;
      p.streak = 0;
      p.kills = 0;
      p.deaths = 0;
      p.damage = 0;
    });
  }
}

function endSndRound(room, winningTeam, reason) {
  const snd = room.sndState;
  if (!snd || snd.roundOver) return;
  snd.roundOver = true;
  snd.roundWinner = winningTeam;
  snd.resetRoundAt = Date.now() + 3500;

  if (winningTeam === 'RED') {
    snd.attackersWon++;
    room.scores.red = snd.attackersWon;
  } else {
    snd.defendersWon++;
    room.scores.blue = snd.defendersWon;
  }

  io.to(room.id).emit('sndRoundEnd', {
    winner: winningTeam,
    reason: reason,
    attackersWon: snd.attackersWon,
    defendersWon: snd.defendersWon,
    round: snd.round
  });

  room.events.push({
    x: 600, y: 300,
    text: `${winningTeam === 'RED' ? 'ATTACKERS' : 'DEFENDERS'} WIN ROUND!`,
    color: winningTeam === 'RED' ? '#ff4757' : '#00f0ff',
    timestamp: Date.now()
  });

  emitRoomState(room);
}

function finishGame(room, winner) {
  if (room.over) return;
  room.over = true;
  room.winner = winner;

  let topPlayer = null;
  let topScore = -1;
  const playerList = Object.values(room.players);

  playerList.forEach(p => {
    const score = (p.kills * 100) + Math.round(p.damage);
    if (score > topScore) {
      topScore = score;
      topPlayer = p;
    }
  });

  room.mvp = topPlayer ? { name: topPlayer.name, kills: topPlayer.kills, damage: Math.round(topPlayer.damage) } : null;

  const deltas = {};
  playerList.forEach(p => {
    if (p.isBot) return;
    const playerMmr = p.mmr || 1000;
    let won = false;
    if (room.activeMode === 'hunt') {
      won = (winner === 'BOSS' && p.role === 'boss') || (winner === 'HUNTERS' && p.role === 'hunter');
    } else if (room.activeMode === 'gungame') {
      won = (winner === p.name);
    } else if (room.activeMode === 'infection') {
      won = (winner === 'INFECTED' && p.role === 'infected') || (winner === 'SURVIVORS' && p.role === 'survivor');
    } else {
      won = (winner === 'BLUE' && p.team === 'blue') || (winner === 'RED' && p.team === 'red');
    }
    const delta = calculateEloDelta(playerMmr, 1050, won);
    const newMmr = Math.max(100, playerMmr + delta);
    deltas[p.id] = {
      oldMmr: playerMmr,
      newMmr: newMmr,
      delta: delta,
      won: won,
      oldTier: getTierName(playerMmr),
      newTier: getTierName(newMmr)
    };
  });

  emitRoomState(room);
  io.to(room.id).emit('matchEnded', {
    winner: winner,
    mvp: room.mvp,
    deltas: deltas,
    activeMode: room.activeMode
  });
}

function updateBots(room) {
  const now = Date.now();
  const playerList = Object.values(room.players);

  playerList.filter(p => p.isBot && p.alive).forEach(bot => {
    let target = null;
    let minDist = 999999;

    playerList.forEach(other => {
      if (other.id === bot.id || !other.alive || other.team === bot.team) return;
      const d = Math.hypot(other.x - bot.x, other.y - bot.y);
      if (d < minDist) {
        minDist = d;
        target = other;
      }
    });

    let desiredDx = 0;
    let desiredDy = 0;
    let shouldAttack = false;
    let shouldAbility = false;

    // Check low health bot seeking medkit
    const medkit = (bot.hp < bot.maxHp * 0.45) ? room.medkits?.find(m => m.active) : null;

    if (medkit) {
      bot.dir = Math.atan2(medkit.y - bot.y, medkit.x - bot.x);
      desiredDx = Math.cos(bot.dir);
      desiredDy = Math.sin(bot.dir);
      if (target && minDist < 350) shouldAttack = true;
    } else if (room.activeMode === 'hunt') {
      if (bot.role === 'boss') {
        if (target) {
          bot.dir = Math.atan2(target.y - bot.y, target.x - bot.x);
          desiredDx = Math.cos(bot.dir);
          desiredDy = Math.sin(bot.dir);
          if (minDist < 125) shouldAttack = true;
          if (minDist > 240 && bot.abilityCool === 0) shouldAbility = true;
        }
      } else {
        if (target) {
          bot.dir = Math.atan2(target.y - bot.y, target.x - bot.x);
          if (minDist < 200) {
            desiredDx = -Math.cos(bot.dir);
            desiredDy = -Math.sin(bot.dir);
          } else if (minDist > 380) {
            desiredDx = Math.cos(bot.dir);
            desiredDy = Math.sin(bot.dir);
          } else {
            desiredDx = -Math.sin(bot.dir);
            desiredDy = Math.cos(bot.dir);
          }
          if (minDist < 480) shouldAttack = true;
          if (minDist < 140 && bot.abilityCool === 0) shouldAbility = true;
        }
      }
    } else if (room.activeMode === 'siege') {
      const unownedZone = room.zones.find(z => z.owner !== bot.team);
      const dest = unownedZone || target || { x: 600, y: 375 };
      const d = Math.hypot(dest.x - bot.x, dest.y - bot.y);
      bot.dir = Math.atan2(dest.y - bot.y, dest.x - bot.x);
      if (d > 40) {
        desiredDx = Math.cos(bot.dir);
        desiredDy = Math.sin(bot.dir);
      }
      if (target && minDist < 400) {
        bot.dir = Math.atan2(target.y - bot.y, target.x - bot.x);
        shouldAttack = true;
      }
    } else if (room.activeMode === 'snd' && room.sndState) {
      const snd = room.sndState;
      const bomb = snd.bomb;
      const sites = [
        { id: 'A', x: 340, y: 375 },
        { id: 'B', x: 840, y: 375 }
      ];

      if (bot.team === 'red') {
        // Attacker bot
        if (bomb.carrierId === bot.id) {
          const targetSite = sites[0]; // Plant at Site A
          const dSite = Math.hypot(targetSite.x - bot.x, targetSite.y - bot.y);
          bot.dir = Math.atan2(targetSite.y - bot.y, targetSite.x - bot.x);
          if (dSite > 35) {
            desiredDx = Math.cos(bot.dir);
            desiredDy = Math.sin(bot.dir);
          }
          if (target && minDist < 320) shouldAttack = true;
        } else if (!bomb.carrierId && bomb.state === 'unplanted') {
          // Bomb dropped on floor, move to retrieve
          bot.dir = Math.atan2(bomb.y - bot.y, bomb.x - bot.x);
          desiredDx = Math.cos(bot.dir);
          desiredDy = Math.sin(bot.dir);
          if (target && minDist < 320) shouldAttack = true;
        } else {
          const carrier = bomb.carrierId ? room.players[bomb.carrierId] : null;
          const dest = (carrier && carrier.alive) ? carrier : (target || sites[0]);
          bot.dir = Math.atan2(dest.y - bot.y, dest.x - bot.x);
          desiredDx = Math.cos(bot.dir);
          desiredDy = Math.sin(bot.dir);
          if (target && minDist < 380) shouldAttack = true;
        }
      } else {
        // Defender bot
        if (bomb.state === 'planted' || bomb.state === 'defusing') {
          const dBomb = Math.hypot(bomb.x - bot.x, bomb.y - bot.y);
          bot.dir = Math.atan2(bomb.y - bot.y, bomb.x - bot.x);
          if (dBomb > 30) {
            desiredDx = Math.cos(bot.dir);
            desiredDy = Math.sin(bot.dir);
          }
          if (target && minDist < 350) shouldAttack = true;
        } else {
          const dest = target || sites[0];
          bot.dir = Math.atan2(dest.y - bot.y, dest.x - bot.x);
          const dDest = Math.hypot(dest.x - bot.x, dest.y - bot.y);
          if (dDest > 45) {
            desiredDx = Math.cos(bot.dir);
            desiredDy = Math.sin(bot.dir);
          }
          if (target && minDist < 400) shouldAttack = true;
        }
      }
    } else if (room.activeMode === 'gungame') {
      if (target) {
        bot.dir = Math.atan2(target.y - bot.y, target.x - bot.x);
        if (minDist > 140) {
          desiredDx = Math.cos(bot.dir);
          desiredDy = Math.sin(bot.dir);
        } else if (minDist < 60) {
          desiredDx = -Math.cos(bot.dir);
          desiredDy = -Math.sin(bot.dir);
        }
        if (minDist < 460) shouldAttack = true;
        if (minDist < 120 && bot.abilityCool === 0) shouldAbility = true;
      }
    } else if (room.activeMode === 'infection') {
      if (bot.role === 'infected') {
        if (target) {
          bot.dir = Math.atan2(target.y - bot.y, target.x - bot.x);
          desiredDx = Math.cos(bot.dir);
          desiredDy = Math.sin(bot.dir);
          if (minDist < 95) shouldAttack = true;
          if (minDist < 200 && bot.abilityCool === 0) shouldAbility = true;
        }
      } else {
        if (target) {
          bot.dir = Math.atan2(target.y - bot.y, target.x - bot.x);
          if (minDist < 240) {
            desiredDx = -Math.cos(bot.dir);
            desiredDy = -Math.sin(bot.dir);
            if (bot.abilityCool === 0) shouldAbility = true;
          } else if (minDist > 400) {
            desiredDx = Math.cos(bot.dir) * 0.5;
            desiredDy = Math.sin(bot.dir) * 0.5;
          }
          if (minDist < 520) shouldAttack = true;
        }
      }
    } else if (room.activeMode === 'ctf' && room.ctfState) {
      const ctf = room.ctfState;
      const ownFlag = (bot.team === 'blue' ? ctf.blueFlag : ctf.redFlag);
      const enemyFlag = (bot.team === 'blue' ? ctf.redFlag : ctf.blueFlag);
      const ownHomeX = (bot.team === 'blue' ? 160 : 1040);
      const ownHomeY = 375;

      if (enemyFlag.carrierId === bot.id) {
        bot.dir = Math.atan2(ownHomeY - bot.y, ownHomeX - bot.x);
        desiredDx = Math.cos(bot.dir);
        desiredDy = Math.sin(bot.dir);
        if (target && minDist < 350) shouldAttack = true;
        if (minDist < 150 && bot.abilityCool === 0) shouldAbility = true;
      } else if (ownFlag.carrierId) {
        const enemyCarrier = room.players[ownFlag.carrierId];
        if (enemyCarrier && enemyCarrier.alive) {
          bot.dir = Math.atan2(enemyCarrier.y - bot.y, enemyCarrier.x - bot.x);
          desiredDx = Math.cos(bot.dir);
          desiredDy = Math.sin(bot.dir);
          if (Math.hypot(enemyCarrier.x - bot.x, enemyCarrier.y - bot.y) < 420) shouldAttack = true;
        }
      } else if (!ownFlag.atHome) {
        bot.dir = Math.atan2(ownFlag.y - bot.y, ownFlag.x - bot.x);
        desiredDx = Math.cos(bot.dir);
        desiredDy = Math.sin(bot.dir);
        if (target && minDist < 350) shouldAttack = true;
      } else {
        bot.dir = Math.atan2(enemyFlag.y - bot.y, enemyFlag.x - bot.x);
        desiredDx = Math.cos(bot.dir);
        desiredDy = Math.sin(bot.dir);
        if (target && minDist < 400) shouldAttack = true;
      }
    } else {
      const orb = room.orbs.find(o => o.active);
      const dest = (orb && Math.random() < 0.6) ? orb : (target || { x: 600, y: 375 });
      const d = Math.hypot(dest.x - bot.x, dest.y - bot.y);
      bot.dir = Math.atan2(dest.y - bot.y, dest.x - bot.x);
      if (d > 30) {
        desiredDx = Math.cos(bot.dir);
        desiredDy = Math.sin(bot.dir);
      }
      if (target && minDist < 420) {
        bot.dir = Math.atan2(target.y - bot.y, target.x - bot.x);
        shouldAttack = true;
      }
    }

    bot.input = {
      up: desiredDy < -0.3,
      down: desiredDy > 0.3,
      left: desiredDx < -0.3,
      right: desiredDx > 0.3,
      attack: shouldAttack,
      dash: shouldAbility,
      ping: false
    };
  });
}

function tick(room) {
  if (!room.started || room.over) return;
  const now = Date.now();
  const currentMap = MAPS[room.mapId] || MAPS.neon_metropolis;

  if (now >= room.endsAt) {
    if (room.activeMode === 'hunt') {
      finishGame(room, 'BOSS');
    } else if (room.activeMode === 'skirmish' || room.activeMode === 'siege') {
      if (room.scores.blue > room.scores.red) finishGame(room, 'BLUE');
      else if (room.scores.red > room.scores.blue) finishGame(room, 'RED');
      else finishGame(room, 'DRAW');
    } else if (room.activeMode === 'gungame') {
      let bestTier = -1;
      let bestPlayer = null;
      for (const p of Object.values(room.players)) {
        if ((p.gunTier || 1) > bestTier) {
          bestTier = p.gunTier || 1;
          bestPlayer = p;
        }
      }
      finishGame(room, bestPlayer ? bestPlayer.name : 'DRAW');
    } else if (room.activeMode === 'infection') {
      finishGame(room, 'SURVIVORS');
    } else if (room.activeMode === 'ctf') {
      if (room.scores.blue > room.scores.red) finishGame(room, 'BLUE');
      else if (room.scores.red > room.scores.blue) finishGame(room, 'RED');
      else finishGame(room, 'DRAW');
    }
    return;
  }

  updateBots(room);
  room.events = room.events.filter(e => now - e.timestamp < 1200);

  // Respawn Medkits every 20 seconds
  if (room.medkits && now - room.lastMedkitSpawn > 20000) {
    room.medkits.forEach(m => m.active = true);
    room.lastMedkitSpawn = now;
  }

  for (const p of Object.values(room.players)) {
    if (!p.alive) {
      if (p.respawnAt && now >= p.respawnAt) {
        p.alive = true;
        p.hp = p.maxHp;
        p.shield = p.role === 'boss' ? 100 : 0;
        p.x = p.team === 'blue' ? 140 : (p.team === 'red' ? 1060 : (p.role === 'boss' ? 600 : 200 + Math.random() * 800));
        p.y = 200 + Math.random() * 350;
        room.events.push({ x: p.x, y: p.y - 30, text: 'RESPAWNED', color: '#00f0ff', timestamp: now });
      }
      continue;
    }

    p.attackCool = Math.max(0, p.attackCool - 1);
    p.abilityCool = Math.max(0, p.abilityCool - 1);
    p.pingCool = Math.max(0, p.pingCool - 1);
    p.teleportCool = Math.max(0, p.teleportCool - 1);

    // Medkit Pickup Collision
    if (room.medkits) {
      for (const med of room.medkits) {
        if (!med.active) continue;
        if (Math.hypot(p.x - med.x, p.y - med.y) < p.radius + 18) {
          if (p.hp < p.maxHp) {
            med.active = false;
            p.hp = Math.min(p.maxHp, p.hp + 50);
            room.events.push({ x: med.x, y: med.y - 25, text: '+50 REPAIR', color: '#00ff88', timestamp: now });
            io.to(room.id).emit('healPickup', { x: med.x, y: med.y });
            break;
          }
        }
      }
    }

    // Teleporters Interaction
    if (currentMap.teleporters && currentMap.teleporters.length > 0 && p.teleportCool === 0) {
      for (const tp of currentMap.teleporters) {
        if (Math.hypot(p.x - tp.x, p.y - tp.y) < tp.radius) {
          p.x = tp.targetX;
          p.y = tp.targetY;
          p.teleportCool = 90;
          room.events.push({ x: p.x, y: p.y - 35, text: 'WARP JUMP', color: '#9d4edd', timestamp: now });
          io.to(room.id).emit('teleportSound', { x: p.x, y: p.y });
          break;
        }
      }
    }

    const inp = p.input || {};
    let dx = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    let dy = (inp.down ? 1 : 0) - (inp.up ? 1 : 0);

    let speed = p.speed;
    if (p.overchargedUntil > now) speed *= 1.35;
    if (room.surgeTeam && room.surgeTeam === p.team) speed *= 1.25;

    if (dx !== 0 || dy !== 0) {
      const len = Math.hypot(dx, dy);
      const moveX = (dx / len) * speed;
      const moveY = (dy / len) * speed;

      let nextX = Math.max(p.radius + 10, Math.min(ARENA_W - p.radius - 10, p.x + moveX));
      let nextY = Math.max(p.radius + 10, Math.min(ARENA_H - p.radius - 10, p.y + moveY));

      let collideX = false, collideY = false;
      for (const obs of currentMap.obstacles) {
        if (circleRectCollision(nextX, p.y, p.radius, obs.x, obs.y, obs.w, obs.h)) collideX = true;
        if (circleRectCollision(p.x, nextY, p.radius, obs.x, obs.y, obs.w, obs.h)) collideY = true;
      }
      if (!collideX) p.x = nextX;
      if (!collideY) p.y = nextY;
    }

    // Class Abilities (Shift / Dash / Forcefield / Cloak)
    if (inp.dash && p.abilityCool === 0) {
      const aimDir = (inp.dir !== undefined && Number.isFinite(inp.dir)) ? inp.dir : p.dir;

      if (room.activeMode === 'infection' && p.role === 'infected') {
        p.abilityCool = 70;
        p.x = Math.max(p.radius + 10, Math.min(ARENA_W - p.radius - 10, p.x + Math.cos(aimDir) * 160));
        p.y = Math.max(p.radius + 10, Math.min(ARENA_H - p.radius - 10, p.y + Math.sin(aimDir) * 160));
        p.stealthUntil = now + 2000;
        room.events.push({ x: p.x, y: p.y - 25, text: 'LEAP POUNCE', color: '#39ff14', timestamp: now });
      } else if (p.role === 'boss') {
        if (p.classId === 'boss_stalker') {
          p.abilityCool = 80;
          p.x = Math.max(p.radius + 10, Math.min(ARENA_W - p.radius - 10, p.x + Math.cos(aimDir) * 150));
          p.y = Math.max(p.radius + 10, Math.min(ARENA_H - p.radius - 10, p.y + Math.sin(aimDir) * 150));
          p.stealthUntil = now + 3000;
          room.events.push({ x: p.x, y: p.y - 30, text: 'SHADOW BLINK', color: '#ff007f', timestamp: now });
        } else {
          p.abilityCool = 90;
          p.shield = Math.min(220, p.shield + 120);
          p.x = Math.max(p.radius + 10, Math.min(ARENA_W - p.radius - 10, p.x + Math.cos(aimDir) * 90));
          p.y = Math.max(p.radius + 10, Math.min(ARENA_H - p.radius - 10, p.y + Math.sin(aimDir) * 90));
          room.events.push({ x: p.x, y: p.y - 30, text: 'TITAN FORTIFY', color: '#ffd60a', timestamp: now });
        }
      } else {
        if (p.classId === 'sniper') {
          p.abilityCool = 100;
          p.stealthUntil = now + 3500;
          p.overchargedUntil = now + 2000;
          room.events.push({ x: p.x, y: p.y - 25, text: 'OPTIC CLOAK', color: '#00f0ff', timestamp: now });
        } else if (p.classId === 'vanguard') {
          p.abilityCool = 90;
          p.shield = Math.min(150, p.shield + 100);
          room.events.push({ x: p.x, y: p.y - 25, text: 'FORCEFIELD', color: '#ffd60a', timestamp: now });
        } else {
          p.abilityCool = 65;
          const dashDist = 110;
          p.x = Math.max(p.radius + 10, Math.min(ARENA_W - p.radius - 10, p.x + Math.cos(aimDir) * dashDist));
          p.y = Math.max(p.radius + 10, Math.min(ARENA_H - p.radius - 10, p.y + Math.sin(aimDir) * dashDist));
          p.overchargedUntil = now + 1500;
          room.events.push({ x: p.x, y: p.y - 25, text: 'BURST ROLL', color: '#00f0ff', timestamp: now });
        }
      }
    }

    // Sonar Ping Tactical Radar
    if (inp.ping && p.pingCool === 0) {
      p.pingCool = 240;
      io.to(room.id).emit('sonarPing', {
        x: p.x,
        y: p.y,
        team: p.team,
        pingerName: p.name
      });
      for (const target of Object.values(room.players)) {
        if (target.team !== p.team) {
          target.pingedUntil = now + 5000;
          target.stealthUntil = 0;
        }
      }
      room.events.push({ x: p.x, y: p.y - 30, text: 'SONAR RADAR', color: '#ffd60a', timestamp: now });
    }

    // Weapons
    if (inp.attack && p.attackCool === 0) {
      const aimDir = (inp.dir !== undefined && Number.isFinite(inp.dir)) ? inp.dir : p.dir;
      p.dir = aimDir;

      if (p.stealthUntil > now) p.stealthUntil = 0;

      if (room.activeMode === 'gungame') {
        const tier = p.gunTier || 1;
        const skin = WEAPON_SKINS[p.weaponSkin] || WEAPON_SKINS.default;
        const customColor = skin.projColor;

        if (tier === 1) {
          p.attackCool = 11;
          const projSpeed = 17;
          room.projectiles.push({
            id: 'pr_' + Math.random().toString(36).substring(2, 9),
            ownerId: p.id,
            team: p.team,
            weaponType: 'blaster',
            weaponSkin: p.weaponSkin || 'default',
            x: p.x + Math.cos(aimDir) * (p.radius + 6),
            y: p.y + Math.sin(aimDir) * (p.radius + 6),
            vx: Math.cos(aimDir) * projSpeed,
            vy: Math.sin(aimDir) * projSpeed,
            damage: 26,
            rangeLeft: 650,
            color: customColor || '#00f0ff'
          });
        } else if (tier === 2) {
          p.attackCool = 18;
          const projSpeed = 15;
          [-0.2, -0.1, 0, 0.1, 0.2].forEach(angOffset => {
            const finalAng = aimDir + angOffset;
            room.projectiles.push({
              id: 'pr_' + Math.random().toString(36).substring(2, 9),
              ownerId: p.id,
              team: p.team,
              weaponType: 'shotgun',
              weaponSkin: p.weaponSkin || 'default',
              x: p.x + Math.cos(finalAng) * (p.radius + 6),
              y: p.y + Math.sin(finalAng) * (p.radius + 6),
              vx: Math.cos(finalAng) * projSpeed,
              vy: Math.sin(finalAng) * projSpeed,
              damage: 16,
              rangeLeft: 480,
              color: customColor || '#ff4757'
            });
          });
        } else if (tier === 3) {
          p.attackCool = 24;
          const projSpeed = 26;
          room.projectiles.push({
            id: 'pr_' + Math.random().toString(36).substring(2, 9),
            ownerId: p.id,
            team: p.team,
            weaponType: 'railgun',
            weaponSkin: p.weaponSkin || 'default',
            x: p.x + Math.cos(aimDir) * (p.radius + 8),
            y: p.y + Math.sin(aimDir) * (p.radius + 8),
            vx: Math.cos(aimDir) * projSpeed,
            vy: Math.sin(aimDir) * projSpeed,
            damage: 75,
            rangeLeft: 850,
            color: customColor || '#ffd60a'
          });
        } else if (tier === 4) {
          p.attackCool = 25;
          const projSpeed = 13;
          room.projectiles.push({
            id: 'pr_' + Math.random().toString(36).substring(2, 9),
            ownerId: p.id,
            team: p.team,
            weaponType: 'cannon',
            weaponSkin: p.weaponSkin || 'default',
            x: p.x + Math.cos(aimDir) * (p.radius + 8),
            y: p.y + Math.sin(aimDir) * (p.radius + 8),
            vx: Math.cos(aimDir) * projSpeed,
            vy: Math.sin(aimDir) * projSpeed,
            damage: 85,
            rangeLeft: 700,
            color: customColor || '#9d4edd'
          });
        } else {
          p.attackCool = 16;
          const attackRange = 90;
          p.x = Math.max(p.radius + 10, Math.min(ARENA_W - p.radius - 10, p.x + Math.cos(aimDir) * 45));
          p.y = Math.max(p.radius + 10, Math.min(ARENA_H - p.radius - 10, p.y + Math.sin(aimDir) * 45));
          for (const target of Object.values(room.players)) {
            if (!target.alive || target.id === p.id) continue;
            const dist = Math.hypot(target.x - p.x, target.y - p.y);
            if (dist <= attackRange) {
              const angToTarget = Math.atan2(target.y - p.y, target.x - p.x);
              let diff = Math.abs(angToTarget - aimDir);
              if (diff > Math.PI) diff = 2 * Math.PI - diff;
              if (diff <= 1.4 || dist < 45) {
                applyDamage(room, target, 130, p, 'blade');
              }
            }
          }
          io.to(room.id).emit('bladeSlash', { x: p.x, y: p.y, dir: aimDir });
        }
      } else if (room.activeMode === 'infection' && p.role === 'infected') {
        p.attackCool = 14;
        const attackRange = 75;
        p.x = Math.max(p.radius + 10, Math.min(ARENA_W - p.radius - 10, p.x + Math.cos(aimDir) * 35));
        p.y = Math.max(p.radius + 10, Math.min(ARENA_H - p.radius - 10, p.y + Math.sin(aimDir) * 35));
        for (const target of Object.values(room.players)) {
          if (!target.alive || target.team === p.team) continue;
          const dist = Math.hypot(target.x - p.x, target.y - p.y);
          if (dist <= attackRange) {
            const angToTarget = Math.atan2(target.y - p.y, target.x - p.x);
            let diff = Math.abs(angToTarget - aimDir);
            if (diff > Math.PI) diff = 2 * Math.PI - diff;
            if (diff <= 1.4 || dist < 45) {
              applyDamage(room, target, 80, p, 'claw');
            }
          }
        }
        io.to(room.id).emit('clawSlash', { x: p.x, y: p.y, dir: aimDir });
      } else if (p.role === 'boss') {
        const isStalker = (p.classId === 'boss_stalker');
        p.attackCool = isStalker ? 16 : 24;
        const attackRange = isStalker ? 95 : 125;
        const damage = isStalker ? 42 : 60;

        for (const target of Object.values(room.players)) {
          if (!target.alive || target.team === p.team) continue;
          const dist = Math.hypot(target.x - p.x, target.y - p.y);
          if (dist <= attackRange) {
            const angleToTarget = Math.atan2(target.y - p.y, target.x - p.x);
            let angleDiff = Math.abs(angleToTarget - aimDir);
            if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;

            if (angleDiff <= 1.3 || dist < 70) {
              applyDamage(room, target, damage, p, 'shockwave');
            }
          }
        }
        io.to(room.id).emit('bossSlam', { x: p.x, y: p.y, dir: aimDir, range: attackRange });
      } else {
        const skin = WEAPON_SKINS[p.weaponSkin] || WEAPON_SKINS.default;
        const customColor = skin.projColor;

        if (p.classId === 'sniper') {
          p.attackCool = 26;
          const projSpeed = 24;
          room.projectiles.push({
            id: 'pr_' + Math.random().toString(36).substring(2, 9),
            ownerId: p.id,
            team: p.team,
            weaponType: 'railgun',
            weaponSkin: p.weaponSkin || 'default',
            x: p.x + Math.cos(aimDir) * (p.radius + 8),
            y: p.y + Math.sin(aimDir) * (p.radius + 8),
            vx: Math.cos(aimDir) * projSpeed,
            vy: Math.sin(aimDir) * projSpeed,
            damage: p.overchargedUntil > now ? 68 : 50,
            rangeLeft: 850,
            color: customColor || '#ffd60a'
          });
        } else if (p.classId === 'vanguard') {
          p.attackCool = 20;
          const projSpeed = 14;
          const spreadAngles = [-0.18, 0, 0.18];
          spreadAngles.forEach(angOffset => {
            const finalAng = aimDir + angOffset;
            room.projectiles.push({
              id: 'pr_' + Math.random().toString(36).substring(2, 9),
              ownerId: p.id,
              team: p.team,
              weaponType: 'shotgun',
              weaponSkin: p.weaponSkin || 'default',
              x: p.x + Math.cos(finalAng) * (p.radius + 6),
              y: p.y + Math.sin(finalAng) * (p.radius + 6),
              vx: Math.cos(finalAng) * projSpeed,
              vy: Math.sin(finalAng) * projSpeed,
              damage: p.overchargedUntil > now ? 24 : 17,
              rangeLeft: 520,
              color: customColor || '#ff4757'
            });
          });
        } else {
          p.attackCool = 13;
          const projSpeed = 16;
          room.projectiles.push({
            id: 'pr_' + Math.random().toString(36).substring(2, 9),
            ownerId: p.id,
            team: p.team,
            weaponType: 'blaster',
            weaponSkin: p.weaponSkin || 'default',
            x: p.x + Math.cos(aimDir) * (p.radius + 6),
            y: p.y + Math.sin(aimDir) * (p.radius + 6),
            vx: Math.cos(aimDir) * projSpeed,
            vy: Math.sin(aimDir) * projSpeed,
            damage: p.overchargedUntil > now ? 35 : 24,
            rangeLeft: 650,
            color: customColor || (p.team === 'blue' ? '#00f0ff' : '#ff007f')
          });
        }
      }
    }
  }

  // Update Projectiles
  for (let i = room.projectiles.length - 1; i >= 0; i--) {
    const proj = room.projectiles[i];
    const prevX = proj.x;
    const prevY = proj.y;
    proj.x += proj.vx;
    proj.y += proj.vy;
    proj.rangeLeft -= Math.hypot(proj.vx, proj.vy);

    if (proj.x < 10 || proj.x > ARENA_W - 10 || proj.y < 10 || proj.y > ARENA_H - 10 || proj.rangeLeft <= 0) {
      room.projectiles.splice(i, 1);
      continue;
    }

    let hitObstacle = false;
    for (const obs of currentMap.obstacles) {
      if (lineRectCollision(prevX, prevY, proj.x, proj.y, obs.x, obs.y, obs.w, obs.h)) {
        hitObstacle = true;
        break;
      }
    }
    if (hitObstacle) {
      room.projectiles.splice(i, 1);
      continue;
    }

    let hitPlayer = false;
    for (const target of Object.values(room.players)) {
      if (!target.alive || target.team === proj.team) continue;
      const dist = Math.hypot(target.x - proj.x, target.y - proj.y);
      if (dist < target.radius + 4) {
        hitPlayer = true;
        const attacker = room.players[proj.ownerId];
        applyDamage(room, target, proj.damage, attacker, proj.weaponType);
        break;
      }
    }
    if (hitPlayer) {
      room.projectiles.splice(i, 1);
    }
  }

  if (room.activeMode === 'skirmish') {
    if (now - room.lastOrbSpawn > 12000) {
      room.orbs.forEach(o => o.active = true);
      room.lastOrbSpawn = now;
      io.to(room.id).emit('orbsSpawned');
    }

    for (const orb of room.orbs) {
      if (!orb.active) continue;
      for (const p of Object.values(room.players)) {
        if (!p.alive) continue;
        if (Math.hypot(p.x - orb.x, p.y - orb.y) < p.radius + 20) {
          orb.active = false;
          p.overchargedUntil = now + 6000;
          if (p.team === 'blue') room.scores.blue += 1;
          else if (p.team === 'red') room.scores.red += 1;

          room.events.push({ x: orb.x, y: orb.y - 25, text: '+1 CORE OVERLOAD', color: '#ffd60a', timestamp: now });

          if (room.scores.blue >= 12) { finishGame(room, 'BLUE'); return; }
          if (room.scores.red >= 12) { finishGame(room, 'RED'); return; }
          break;
        }
      }
    }
  }

  if (room.activeMode === 'siege') {
    const isTickTime = (now - room.lastZoneTick >= 1500);

    for (const zone of room.zones) {
      let bluesInside = 0;
      let redsInside = 0;

      for (const p of Object.values(room.players)) {
        if (!p.alive) continue;
        if (Math.hypot(p.x - zone.x, p.y - zone.y) < zone.radius) {
          if (p.team === 'blue') bluesInside++;
          else if (p.team === 'red') redsInside++;
        }
      }

      if (bluesInside > 0 && redsInside === 0) {
        zone.progress = Math.min(100, zone.progress + 3);
        if (zone.progress >= 100) zone.owner = 'blue';
      } else if (redsInside > 0 && bluesInside === 0) {
        zone.progress = Math.max(-100, zone.progress - 3);
        if (zone.progress <= -100) zone.owner = 'red';
      }

      if (isTickTime) {
        if (zone.owner === 'blue') room.scores.blue += 1;
        if (zone.owner === 'red') room.scores.red += 1;
      }
    }

    if (isTickTime) {
      room.lastZoneTick = now;

      const diff = room.scores.blue - room.scores.red;
      if (diff >= 15) {
        room.surgeTeam = 'red';
      } else if (diff <= -15) {
        room.surgeTeam = 'blue';
      } else {
        room.surgeTeam = null;
      }

      if (room.scores.blue >= 100) { finishGame(room, 'BLUE'); return; }
      if (room.scores.red >= 100) { finishGame(room, 'RED'); return; }
    }
  }

  if (room.activeMode === 'hunt') {
    const boss = Object.values(room.players).find(p => p.role === 'boss');
    const hunters = Object.values(room.players).filter(p => p.role === 'hunter');

    if (!boss || !boss.alive) {
      finishGame(room, 'HUNTERS');
      return;
    }

    if (room.scores.bossKills >= 10 || (hunters.length > 0 && hunters.every(h => !h.alive))) {
      finishGame(room, 'BOSS');
      return;
    }
  }

  // Search & Destroy Round & Bomb Loop
  if (room.activeMode === 'snd' && room.sndState) {
    const snd = room.sndState;
    const bomb = snd.bomb;
    const sites = room.sndSites || [
      { id: 'A', name: 'Site A', x: 340, y: 375, radius: 70 },
      { id: 'B', name: 'Site B', x: 840, y: 375, radius: 70 }
    ];

    if (snd.roundOver) {
      if (now >= snd.resetRoundAt) {
        if (snd.attackersWon >= snd.targetRounds) {
          finishGame(room, 'RED');
          return;
        } else if (snd.defendersWon >= snd.targetRounds) {
          finishGame(room, 'BLUE');
          return;
        } else {
          snd.round++;
          snd.roundOver = false;
          snd.roundWinner = null;
          snd.roundEndsAt = now + 120000;
          bomb.state = 'unplanted';
          bomb.site = null;
          bomb.plantProgress = 0;
          bomb.defuseProgress = 0;
          bomb.timerRemaining = 40;
          bomb.planterId = null;
          bomb.defuserId = null;

          const pList = Object.values(room.players);
          pList.forEach((p, idx) => {
            p.alive = true;
            p.hp = p.maxHp;
            p.shield = 0;
            p.x = p.team === 'red' ? (1050 + Math.random() * 50) : (140 + Math.random() * 50);
            p.y = 200 + Math.random() * 350;
            p.dir = p.team === 'red' ? Math.PI : 0;
          });

          const livingAttackers = pList.filter(p => p.team === 'red');
          if (livingAttackers.length > 0) {
            bomb.carrierId = livingAttackers[0].id;
            bomb.x = livingAttackers[0].x;
            bomb.y = livingAttackers[0].y;
          } else {
            bomb.carrierId = null;
            bomb.x = 1050;
            bomb.y = 375;
          }

          io.to(room.id).emit('sndRoundStart', { round: snd.round, attackersWon: snd.attackersWon, defendersWon: snd.defendersWon });
          room.events.push({ x: 600, y: 250, text: `ROUND ${snd.round}`, color: '#00f0ff', timestamp: now });
        }
      }
      emitRoomState(room);
      return;
    }

    // Carrier position tracking
    if (bomb.carrierId) {
      const carrier = room.players[bomb.carrierId];
      if (carrier && carrier.alive) {
        bomb.x = carrier.x;
        bomb.y = carrier.y;
      } else {
        bomb.carrierId = null;
        if (carrier) {
          bomb.x = carrier.x;
          bomb.y = carrier.y;
        }
        room.events.push({ x: bomb.x, y: bomb.y - 25, text: 'BOMB DROPPED', color: '#ff4757', timestamp: now });
        io.to(room.id).emit('bombDropped', { x: bomb.x, y: bomb.y });
      }
    } else if (bomb.state === 'unplanted') {
      for (const p of Object.values(room.players)) {
        if (p.alive && p.team === 'red' && Math.hypot(p.x - bomb.x, p.y - bomb.y) < 36) {
          bomb.carrierId = p.id;
          room.events.push({ x: p.x, y: p.y - 25, text: 'BOMB SECURED', color: '#ffd60a', timestamp: now });
          io.to(room.id).emit('bombPickedUp', { carrierName: p.name });
          break;
        }
      }
    }

    // Planting Logic
    if (bomb.state === 'unplanted' || bomb.state === 'planting') {
      const carrier = bomb.carrierId ? room.players[bomb.carrierId] : null;
      let inSiteToPlant = false;

      if (carrier && carrier.alive) {
        for (const site of sites) {
          if (Math.hypot(carrier.x - site.x, carrier.y - site.y) < site.radius) {
            inSiteToPlant = true;
            bomb.state = 'planting';
            bomb.site = site.id;
            bomb.planterId = carrier.id;
            bomb.plantProgress += 1.5;
            if (bomb.plantProgress >= 100) {
              bomb.state = 'planted';
              bomb.carrierId = null;
              bomb.x = site.x;
              bomb.y = site.y;
              bomb.timerRemaining = 40;
              bomb.plantProgress = 100;
              io.to(room.id).emit('bombPlanted', { site: site.id, x: site.x, y: site.y, planter: carrier.name });
              room.events.push({ x: site.x, y: site.y - 35, text: `BOMB PLANTED [SITE ${site.id}]`, color: '#ff0055', timestamp: now });
            }
            break;
          }
        }
      }

      if (!inSiteToPlant && bomb.state === 'planting') {
        bomb.state = 'unplanted';
        bomb.plantProgress = 0;
      }
    }

    // Planted & Defusing Logic
    if (bomb.state === 'planted' || bomb.state === 'defusing') {
      bomb.timerRemaining = Math.max(0, bomb.timerRemaining - (1 / 30));

      let defusingNow = false;
      for (const p of Object.values(room.players)) {
        if (p.alive && p.team === 'blue' && Math.hypot(p.x - bomb.x, p.y - bomb.y) < 48) {
          defusingNow = true;
          bomb.state = 'defusing';
          bomb.defuserId = p.id;
          bomb.defuseProgress += 1.35;
          if (bomb.defuseProgress >= 100) {
            bomb.state = 'defused';
            io.to(room.id).emit('bombDefused', { defuser: p.name });
            room.events.push({ x: bomb.x, y: bomb.y - 35, text: 'BOMB DEFUSED!', color: '#00f0ff', timestamp: now });
            endSndRound(room, 'BLUE', 'Defenders defused the bomb!');
            return;
          }
          break;
        }
      }

      if (!defusingNow && bomb.state === 'defusing') {
        bomb.state = 'planted';
        bomb.defuseProgress = 0;
      }

      if (bomb.timerRemaining <= 0 && bomb.state !== 'defused') {
        bomb.state = 'detonated';
        io.to(room.id).emit('bombDetonated', { x: bomb.x, y: bomb.y });
        room.events.push({ x: bomb.x, y: bomb.y - 35, text: 'BOMB DETONATED!', color: '#ff4757', timestamp: now });
        endSndRound(room, 'RED', 'Bomb detonated! Attackers win round!');
        return;
      }
    }

    // Elimination check in S&D
    const attackers = Object.values(room.players).filter(p => p.team === 'red');
    const defenders = Object.values(room.players).filter(p => p.team === 'blue');
    const attackersAlive = attackers.some(p => p.alive);
    const defendersAlive = defenders.some(p => p.alive);

    if (!attackersAlive && attackers.length > 0) {
      if (bomb.state !== 'planted' && bomb.state !== 'defusing') {
        endSndRound(room, 'BLUE', 'All Attackers eliminated!');
        return;
      }
    }

    if (!defendersAlive && defenders.length > 0) {
      endSndRound(room, 'RED', 'All Defenders eliminated!');
      return;
    }

    if (now >= snd.roundEndsAt && bomb.state === 'unplanted') {
      endSndRound(room, 'BLUE', 'Time expired! Defenders win round!');
      return;
    }
  }

  // Infection Outbreak Loop
  if (room.activeMode === 'infection') {
    const survivors = Object.values(room.players).filter(p => p.role === 'survivor');
    const livingSurvivors = survivors.filter(p => p.alive);
    if (survivors.length === 0 || livingSurvivors.length === 0) {
      finishGame(room, 'INFECTED');
      return;
    }
    if (livingSurvivors.length === 1 && !room.lastSurvivorTriggered) {
      room.lastSurvivorTriggered = true;
      const lastOne = livingSurvivors[0];
      lastOne.overchargedUntil = now + 40000;
      lastOne.shield = 100;
      io.to(room.id).emit('lastSurvivor', { id: lastOne.id, name: lastOne.name });
      room.events.push({ x: lastOne.x, y: lastOne.y - 40, text: 'LAST SURVIVOR STANDING! OVERCHARGED!', color: '#ffd60a', timestamp: now });
    }
  }

  // Capture The Flag (CTF) Core Heist Loop
  if (room.activeMode === 'ctf' && room.ctfState) {
    const ctf = room.ctfState;
    const flags = [
      { flag: ctf.blueFlag, team: 'blue', enemyTeam: 'red', base: { x: 160, y: 375 } },
      { flag: ctf.redFlag, team: 'red', enemyTeam: 'blue', base: { x: 1040, y: 375 } }
    ];

    for (const f of flags) {
      const flagObj = f.flag;
      if (flagObj.carrierId) {
        const carrier = room.players[flagObj.carrierId];
        if (carrier && carrier.alive) {
          flagObj.x = carrier.x;
          flagObj.y = carrier.y;

          const carrierHomeBase = (f.enemyTeam === 'blue' ? { x: 160, y: 375 } : { x: 1040, y: 375 });
          const ownFlag = (f.enemyTeam === 'blue' ? ctf.blueFlag : ctf.redFlag);

          if (Math.hypot(carrier.x - carrierHomeBase.x, carrier.y - carrierHomeBase.y) < 55 && ownFlag.atHome) {
            flagObj.carrierId = null;
            flagObj.x = flagObj.homeX;
            flagObj.y = flagObj.homeY;
            flagObj.atHome = true;

            if (f.enemyTeam === 'blue') {
              ctf.blueCaptures++;
              room.scores.blue = ctf.blueCaptures;
            } else {
              ctf.redCaptures++;
              room.scores.red = ctf.redCaptures;
            }

            io.to(room.id).emit('flagCaptured', {
              scoringTeam: f.enemyTeam,
              carrierName: carrier.name,
              blueCaptures: ctf.blueCaptures,
              redCaptures: ctf.redCaptures
            });

            room.events.push({
              x: carrierHomeBase.x,
              y: carrierHomeBase.y - 40,
              text: `${f.enemyTeam.toUpperCase()} CAPTURED THE CORE!`,
              color: f.enemyTeam === 'blue' ? '#00f0ff' : '#ff4757',
              timestamp: now
            });

            if (ctf.blueCaptures >= ctf.targetCaptures) {
              finishGame(room, 'BLUE');
              return;
            }
            if (ctf.redCaptures >= ctf.targetCaptures) {
              finishGame(room, 'RED');
              return;
            }
          }
        } else {
          flagObj.carrierId = null;
          flagObj.atHome = false;
          io.to(room.id).emit('flagDropped', { flag: f.team, x: flagObj.x, y: flagObj.y });
        }
      } else {
        for (const p of Object.values(room.players)) {
          if (!p.alive) continue;
          if (Math.hypot(p.x - flagObj.x, p.y - flagObj.y) < 38) {
            if (p.team === f.team && !flagObj.atHome) {
              flagObj.x = flagObj.homeX;
              flagObj.y = flagObj.homeY;
              flagObj.atHome = true;
              io.to(room.id).emit('flagReturned', { flag: f.team, returnerName: p.name });
              room.events.push({ x: flagObj.homeX, y: flagObj.homeY - 30, text: `${f.team.toUpperCase()} CORE RETURNED!`, color: f.team === 'blue' ? '#00f0ff' : '#ff4757', timestamp: now });
              break;
            } else if (p.team === f.enemyTeam) {
              flagObj.carrierId = p.id;
              flagObj.atHome = false;
              io.to(room.id).emit('flagPickedUp', { flag: f.team, carrierName: p.name, carrierTeam: f.enemyTeam });
              room.events.push({ x: p.x, y: p.y - 30, text: `${f.enemyTeam.toUpperCase()} SECURED CORE!`, color: f.enemyTeam === 'blue' ? '#00f0ff' : '#ff4757', timestamp: now });
              break;
            }
          }
        }
      }
    }
  }

  emitRoomState(room);
}

function applyDamage(room, target, amount, attacker, weaponType = 'blaster') {
  if (!target.alive) return;
  const now = Date.now();

  let actualDamage = amount;
  if (target.shield > 0) {
    if (target.shield >= actualDamage) {
      target.shield -= actualDamage;
      actualDamage = 0;
    } else {
      actualDamage -= target.shield;
      target.shield = 0;
    }
  }

  target.hp = Math.max(0, target.hp - actualDamage);
  if (attacker) attacker.damage = (attacker.damage || 0) + amount;

  room.events.push({
    x: target.x,
    y: target.y - 20,
    text: `-${Math.round(amount)}`,
    color: '#ff0055',
    timestamp: now
  });

  if (target.hp <= 0) {
    target.alive = false;
    target.deaths = (target.deaths || 0) + 1;
    const streakShutdown = target.streak >= 3;
    target.streak = 0;

    let announcerText = null;
    if (attacker) {
      attacker.kills = (attacker.kills || 0) + 1;
      attacker.streak = (attacker.streak || 0) + 1;

      if (!room.firstBloodTaken) {
        room.firstBloodTaken = true;
        announcerText = 'FIRST BLOOD!';
      } else if (attacker.streak === 2) {
        announcerText = 'DOUBLE KILL!';
      } else if (attacker.streak === 3) {
        announcerText = 'TRIPLE KILL!';
      } else if (attacker.streak >= 4) {
        announcerText = 'RAMPAGE!';
      } else if (streakShutdown) {
        announcerText = 'SHUTDOWN!';
      }
    }

    // Broadcast Kill Feed Event to entire room
    io.to(room.id).emit('killEvent', {
      killerName: attacker ? attacker.name : 'Environmental',
      killerTeam: attacker ? attacker.team : 'neutral',
      victimName: target.name,
      victimTeam: target.team,
      weaponType: weaponType,
      announcerText: announcerText
    });

    room.events.push({
      x: target.x,
      y: target.y - 40,
      text: 'ELIMINATED',
      color: '#ffd60a',
      timestamp: now
    });

    if (room.activeMode === 'hunt') {
      if (target.role === 'hunter') {
        room.scores.bossKills++;
        target.respawnAt = now + 6500;
      }
    } else if (room.activeMode === 'skirmish') {
      if (target.team === 'blue') room.scores.red += 2;
      else if (target.team === 'red') room.scores.blue += 2;
      target.respawnAt = now + 4000;
    } else if (room.activeMode === 'siege') {
      target.respawnAt = now + 5000;
    } else if (room.activeMode === 'snd') {
      target.respawnAt = 0;
      if (room.sndState && room.sndState.bomb && room.sndState.bomb.carrierId === target.id) {
        room.sndState.bomb.carrierId = null;
        room.sndState.bomb.x = target.x;
        room.sndState.bomb.y = target.y;
        room.events.push({ x: target.x, y: target.y - 25, text: 'BOMB DROPPED', color: '#ff4757', timestamp: now });
        io.to(room.id).emit('bombDropped', { x: target.x, y: target.y });
      }
    } else if (room.activeMode === 'gungame') {
      target.respawnAt = now + 3000;
      if (attacker && attacker.id !== target.id) {
        attacker.gunTier = (attacker.gunTier || 1) + 1;
        room.scores[attacker.id] = attacker.gunTier;
        io.to(room.id).emit('gunTierUp', { playerId: attacker.id, playerName: attacker.name, newTier: attacker.gunTier });
        room.events.push({ x: attacker.x, y: attacker.y - 45, text: `TIER ${attacker.gunTier} UNLOCKED!`, color: '#ffd60a', timestamp: now });
        if (attacker.gunTier > (room.gunGameMaxTier || 5)) {
          finishGame(room, attacker.name);
          return;
        }
      }
    } else if (room.activeMode === 'infection') {
      if (target.role === 'survivor') {
        target.role = 'infected';
        target.team = 'infected';
        target.classId = 'stalker_infected';
        target.maxHp = 220;
        target.hp = 220;
        target.shield = 50;
        target.speed = 3.8;
        target.radius = 18;
        target.respawnAt = now + 3000;
        io.to(room.id).emit('playerInfected', { victimId: target.id, victimName: target.name, killerName: attacker ? attacker.name : 'Outbreak' });
        room.events.push({ x: target.x, y: target.y - 35, text: 'INFECTED & CONVERTED!', color: '#39ff14', timestamp: now });
        const livingSurvivors = Object.values(room.players).filter(p => p.role === 'survivor' && p.alive && p.id !== target.id);
        if (livingSurvivors.length === 0) {
          finishGame(room, 'INFECTED');
          return;
        }
      } else {
        target.respawnAt = now + 4000;
      }
    } else if (room.activeMode === 'ctf') {
      target.respawnAt = now + 4500;
      if (room.ctfState) {
        if (room.ctfState.blueFlag.carrierId === target.id) {
          room.ctfState.blueFlag.carrierId = null;
          room.ctfState.blueFlag.x = target.x;
          room.ctfState.blueFlag.y = target.y;
          room.ctfState.blueFlag.atHome = false;
          io.to(room.id).emit('flagDropped', { flag: 'blue', x: target.x, y: target.y });
          room.events.push({ x: target.x, y: target.y - 25, text: 'BLUE CORE DROPPED', color: '#00f0ff', timestamp: now });
        }
        if (room.ctfState.redFlag.carrierId === target.id) {
          room.ctfState.redFlag.carrierId = null;
          room.ctfState.redFlag.x = target.x;
          room.ctfState.redFlag.y = target.y;
          room.ctfState.redFlag.atHome = false;
          io.to(room.id).emit('flagDropped', { flag: 'red', x: target.x, y: target.y });
          room.events.push({ x: target.x, y: target.y - 25, text: 'RED CORE DROPPED', color: '#ff4757', timestamp: now });
        }
      }
    }
  }
}

function cleanPlayer(p, room) {
  return {
    id: p.id,
    name: p.name,
    classId: p.classId || 'assault',
    outfit: p.outfit || 'spec_ops',
    weaponSkin: p.weaponSkin || 'default',
    hasBomb: !!(room?.activeMode === 'snd' && room?.sndState?.bomb?.carrierId === p.id),
    hasFlag: !!(room?.activeMode === 'ctf' && (room?.ctfState?.blueFlag?.carrierId === p.id || room?.ctfState?.redFlag?.carrierId === p.id)),
    gunTier: p.gunTier || 1,
    tier: p.tier || getTierName(p.mmr || 1000),
    mmr: p.mmr || 1000,
    role: p.role,
    team: p.team,
    isBot: !!p.isBot,
    x: Math.round(p.x),
    y: Math.round(p.y),
    dir: p.dir,
    hp: Math.round(p.hp),
    maxHp: p.maxHp,
    shield: Math.round(p.shield || 0),
    alive: p.alive,
    respawnRemaining: p.respawnAt ? Math.max(0, Math.ceil((p.respawnAt - Date.now()) / 1000)) : 0,
    stealth: (p.stealthUntil && p.stealthUntil > Date.now()),
    pinged: (p.pingedUntil && p.pingedUntil > Date.now()),
    overcharged: (p.overchargedUntil && p.overchargedUntil > Date.now()),
    streak: p.streak || 0,
    kills: p.kills || 0,
    deaths: p.deaths || 0,
    damage: Math.round(p.damage || 0)
  };
}

function snapshotRoom(r) {
  const currentMap = MAPS[r.mapId] || MAPS.neon_metropolis;
  return {
    id: r.id,
    started: r.started,
    over: r.over,
    winner: r.winner,
    activeMode: r.activeMode,
    modeSetting: r.modeSetting,
    mapId: r.mapId,
    mapName: currentMap.name,
    endsAt: r.endsAt,
    scores: r.scores,
    surgeTeam: r.surgeTeam,
    players: Object.values(r.players).map(p => cleanPlayer(p, r)),
    projectiles: r.projectiles.map(pr => ({
      id: pr.id,
      x: Math.round(pr.x),
      y: Math.round(pr.y),
      vx: pr.vx,
      vy: pr.vy,
      weaponType: pr.weaponType || 'blaster',
      weaponSkin: pr.weaponSkin || 'default',
      color: pr.color
    })),
    zones: r.zones,
    orbs: r.orbs,
    medkits: r.medkits || [],
    sndState: r.sndState || null,
    sndSites: r.sndSites || [],
    ctfState: r.ctfState || null,
    gunGameMaxTier: r.gunGameMaxTier || 5,
    lastSurvivorTriggered: !!r.lastSurvivorTriggered,
    events: r.events,
    obstacles: currentMap.obstacles,
    teleporters: currentMap.teleporters || []
  };
}

function emitRoomState(room) {
  io.to(room.id).emit('state', snapshotRoom(room));
}

function emitLobby(room) {
  const pList = Object.values(room.players).map(p => ({
    id: p.id,
    name: p.name,
    classId: p.classId || 'assault',
    outfit: p.outfit || 'spec_ops',
    weaponSkin: p.weaponSkin || 'default',
    isBot: !!p.isBot,
    tier: p.tier || getTierName(p.mmr || 1000),
    mmr: p.mmr || 1000
  }));
  io.to(room.id).emit('lobby', {
    roomId: room.id,
    host: room.host,
    modeSetting: room.modeSetting,
    mapId: room.mapId,
    players: pList
  });
}

io.on('connection', socket => {
  socket.on('create', ({ name, mmr, classId, outfit, weaponSkin }) => {
    const r = createRoom(socket.id);
    joinRoom(socket, r, name, mmr, classId, outfit, weaponSkin, true);
  });

  socket.on('join', ({ room, name, mmr, classId, outfit, weaponSkin }) => {
    const code = String(room || '').toUpperCase().trim();
    const r = rooms.get(code);
    if (!r) return socket.emit('errorMsg', 'Room not found. Check the code.');
    if (r.started && !r.over) return socket.emit('errorMsg', 'Match is currently in progress.');
    if (Object.keys(r.players).length >= 12) return socket.emit('errorMsg', 'Room is full (12 players max).');
    joinRoom(socket, r, name, mmr, classId, outfit, weaponSkin, false);
  });

  function joinRoom(s, r, name, mmr, classId, outfit, weaponSkin, isHost) {
    s.join(r.id);
    const validMmr = Number.isFinite(mmr) ? mmr : 1000;
    r.players[s.id] = {
      id: s.id,
      name: String(name || 'Player').slice(0, 16),
      classId: classId || 'assault',
      outfit: outfit || 'spec_ops',
      weaponSkin: weaponSkin || 'default',
      mmr: validMmr,
      tier: getTierName(validMmr),
      isBot: false,
      x: ARENA_W / 2,
      y: ARENA_H / 2,
      hp: 150,
      maxHp: 150,
      shield: 0,
      role: 'waiting',
      team: 'neutral',
      alive: true,
      dir: 0,
      speed: 3.1,
      radius: 16,
      attackCool: 0,
      abilityCool: 0,
      pingCool: 0,
      teleportCool: 0,
      kills: 0,
      deaths: 0,
      damage: 0,
      input: {}
    };
    s.data.roomId = r.id;
    s.emit('joined', { room: r.id, host: isHost });
    emitLobby(r);
  }

  socket.on('setMode', ({ mode }) => {
    const r = rooms.get(socket.data.roomId);
    if (!r || r.host !== socket.id || r.started) return;
    if (['auto', 'hunt', 'skirmish', 'siege', 'snd', 'gungame', 'infection', 'ctf'].includes(mode)) {
      r.modeSetting = mode;
      emitLobby(r);
    }
  });

  socket.on('setMap', ({ mapId }) => {
    const r = rooms.get(socket.data.roomId);
    if (!r || r.host !== socket.id || r.started) return;
    if (MAPS[mapId]) {
      r.mapId = mapId;
      emitLobby(r);
    }
  });

  socket.on('setLoadout', ({ classId }) => {
    const r = rooms.get(socket.data.roomId);
    const p = r?.players[socket.id];
    if (!p || r.started) return;
    if (CLASSES[classId]) {
      p.classId = classId;
      emitLobby(r);
    }
  });

  socket.on('setCustomization', ({ outfit, weaponSkin }) => {
    const r = rooms.get(socket.data.roomId);
    const p = r?.players[socket.id];
    if (!p) return;
    if (outfit && OUTFITS[outfit]) p.outfit = outfit;
    if (weaponSkin && WEAPON_SKINS[weaponSkin]) p.weaponSkin = weaponSkin;
    emitLobby(r);
  });

  socket.on('addBot', () => {
    const r = rooms.get(socket.data.roomId);
    if (!r || r.host !== socket.id || r.started) return;
    const botId = 'bot_' + (botCounter++);
    const botName = '[BOT] ' + BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)] + ' ' + (Math.floor(Math.random() * 90) + 10);
    const botMmr = 1000 + Math.floor(Math.random() * 400);
    const botClasses = ['assault', 'sniper', 'vanguard'];
    const botClass = botClasses[Math.floor(Math.random() * botClasses.length)];
    const outfitKeys = Object.keys(OUTFITS);
    const skinKeys = Object.keys(WEAPON_SKINS);
    const botOutfit = outfitKeys[Math.floor(Math.random() * outfitKeys.length)];
    const botSkin = skinKeys[Math.floor(Math.random() * skinKeys.length)];

    r.players[botId] = {
      id: botId,
      name: botName,
      classId: botClass,
      outfit: botOutfit,
      weaponSkin: botSkin,
      mmr: botMmr,
      tier: getTierName(botMmr),
      isBot: true,
      x: ARENA_W / 2,
      y: ARENA_H / 2,
      hp: 150,
      maxHp: 150,
      shield: 0,
      role: 'waiting',
      team: 'neutral',
      alive: true,
      dir: 0,
      speed: 3.0,
      radius: 16,
      attackCool: 0,
      abilityCool: 0,
      pingCool: 0,
      teleportCool: 0,
      kills: 0,
      deaths: 0,
      damage: 0,
      input: {}
    };
    emitLobby(r);
  });

  socket.on('removeBot', () => {
    const r = rooms.get(socket.data.roomId);
    if (!r || r.host !== socket.id || r.started) return;
    const botKey = Object.keys(r.players).find(k => r.players[k].isBot);
    if (botKey) {
      delete r.players[botKey];
      emitLobby(r);
    }
  });

  socket.on('start', () => {
    const r = rooms.get(socket.data.roomId);
    if (!r || r.host !== socket.id) return;
    const count = Object.keys(r.players).length;
    if (count < 2) {
      return socket.emit('errorMsg', 'Need at least 2 combatants! Click "+ Add AI Bot" to test right now.');
    }
    r.started = true;
    r.over = false;
    setupRoomForMode(r);

    if (!r.interval) {
      r.interval = setInterval(() => tick(r), TICK_MS);
    }
    emitRoomState(r);
  });

  socket.on('input', data => {
    const r = rooms.get(socket.data.roomId);
    const p = r?.players[socket.id];
    if (!p || !r.started || r.over) return;

    p.input = {
      up: !!data.up,
      down: !!data.down,
      left: !!data.left,
      right: !!data.right,
      attack: !!data.attack,
      dash: !!data.dash,
      ping: !!data.ping,
      dir: data.dir
    };
    if (Number.isFinite(data.dir)) p.dir = data.dir;
  });

  socket.on('restart', () => {
    const r = rooms.get(socket.data.roomId);
    if (!r || r.host !== socket.id) return;
    r.started = false;
    r.over = false;
    if (r.interval) {
      clearInterval(r.interval);
      r.interval = null;
    }
    emitLobby(r);
  });

  socket.on('disconnect', () => {
    const id = socket.data.roomId;
    const r = rooms.get(id);
    if (!r) return;

    delete r.players[socket.id];
    const remaining = Object.values(r.players);
    const humans = remaining.filter(p => !p.isBot);

    if (humans.length === 0) {
      if (r.interval) clearInterval(r.interval);
      rooms.delete(id);
      return;
    }

    if (r.host === socket.id) {
      r.host = humans[0].id;
    }

    emitLobby(r);
    if (r.started && !r.over) {
      emitRoomState(r);
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const ips = getLocalIps();
  console.log('========================================================');
  console.log(`⚡ NEXUS ARENA SERVER LIVE ON PORT ${PORT}`);
  console.log(`🌐 Localhost: http://localhost:${PORT}`);
  if (ips.length > 0) {
    console.log(`📱 LAN / Mobile Access (Same WiFi):`);
    ips.forEach(ip => console.log(`   http://${ip}:${PORT}`));
  }
  console.log('========================================================');
});

module.exports = server;
