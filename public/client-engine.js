/**
 * NEXUS ARENA: CLIENT-SIDE VIRTUAL SIMULATION ENGINE
 * Provides 100% standalone, zero-latency 30Hz in-browser game server simulation.
 * Automatically activates when remote multiplayer WebSocket is unreachable.
 */

(function(window) {
  const ARENA_W = 1200;
  const ARENA_H = 750;
  const TICK_RATE = 30;
  const TICK_MS = 1000 / TICK_RATE;

  const MAPS = {
    neon_metropolis: {
      id: 'neon_metropolis',
      name: 'Neon Metropolis',
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
      obstacles: [
        { x: 260, y: 150, w: 140, h: 60, type: 'container', color: '#1e40af' },
        { x: 260, y: 540, w: 140, h: 60, type: 'container', color: '#b91c1c' },
        { x: 800, y: 150, w: 140, h: 60, type: 'container', color: '#15803d' },
        { x: 800, y: 540, w: 140, h: 60, type: 'container', color: '#c2410c' },
        { x: 550, y: 310, w: 100, h: 130, type: 'crate_depot', color: '#334155' },
        { x: 330, y: 345, w: 60, h: 60, type: 'crate_wood', color: '#854d0e' },
        { x: 810, y: 345, w: 60, h: 60, type: 'crate_metal', color: '#475569' },
        { x: 560, y: 110, w: 80, h: 40, type: 'barricade', color: '#64748b' },
        { x: 560, y: 600, w: 80, h: 40, type: 'barricade', color: '#64748b' }
      ],
      teleporters: []
    }
  };

  const CLASSES = {
    assault: { id: 'assault', name: 'Assault Striker', hp: 150, speed: 3.1 },
    sniper: { id: 'sniper', name: 'Phantom Sniper', hp: 120, speed: 3.2 },
    vanguard: { id: 'vanguard', name: 'Titan Vanguard', hp: 200, speed: 2.8 },
    boss_colossus: { id: 'boss_colossus', name: 'Colossus Titan', hp: 650, speed: 3.2 },
    boss_stalker: { id: 'boss_stalker', name: 'Shadow Stalker', hp: 520, speed: 3.6 },
    stalker_infected: { id: 'stalker_infected', name: 'Cyber Xenomorph', hp: 220, speed: 3.8 }
  };

  const BOT_NAMES = ['Nova', 'Apex', 'Viper', 'Phantom', 'Ghost', 'Zero', 'Echo', 'Titan', 'Blaze', 'Cipher', 'Vortex', 'Kage', 'Onyx', 'Rogue'];

  function circleRectCollision(cx, cy, radius, rx, ry, rw, rh) {
    const closestX = Math.max(rx, Math.min(cx, rx + rw));
    const closestY = Math.max(ry, Math.min(cy, ry + rh));
    const distX = cx - closestX;
    const distY = cy - closestY;
    return (distX * distX + distY * distY) < (radius * radius);
  }

  function resolveObstacleCollision(player, obstacles) {
    for (const ob of obstacles) {
      if (circleRectCollision(player.x, player.y, player.radius, ob.x, ob.y, ob.w, ob.h)) {
        const closestX = Math.max(ob.x, Math.min(player.x, ob.x + ob.w));
        const closestY = Math.max(ob.y, Math.min(player.y, ob.y + ob.h));
        const dx = player.x - closestX;
        const dy = player.y - closestY;
        const dist = Math.hypot(dx, dy) || 1;
        const push = (player.radius - dist) + 0.5;
        player.x += (dx / dist) * push;
        player.y += (dy / dist) * push;
      }
    }
    player.x = Math.max(player.radius, Math.min(ARENA_W - player.radius, player.x));
    player.y = Math.max(player.radius, Math.min(ARENA_H - player.radius, player.y));
  }

  class VirtualArena {
    constructor() {
      this.localPlayerId = 'local_' + Math.random().toString(36).substring(2, 8);
      this.emitCb = null;
      this.room = null;
      this.interval = null;
      this.botCounter = 1;
      this.projCounter = 1;
    }

    setEmitter(cb) {
      this.emitCb = cb;
    }

    emit(event, data) {
      if (this.emitCb) this.emitCb(event, data);
    }

    handle(event, data) {
      switch(event) {
        case 'create':
          this.createRoom(data);
          break;
        case 'join':
          this.createRoom(data);
          break;
        case 'setMode':
          if (this.room && !this.room.started) {
            this.room.modeSetting = data.mode;
            this.emitLobby();
          }
          break;
        case 'setMap':
          if (this.room && !this.room.started && MAPS[data.mapId]) {
            this.room.mapId = data.mapId;
            this.emitLobby();
          }
          break;
        case 'setLoadout':
          if (this.room && this.room.players[this.localPlayerId]) {
            this.room.players[this.localPlayerId].classId = data.classId;
            this.emitLobby();
          }
          break;
        case 'setCustomization':
          if (this.room && this.room.players[this.localPlayerId]) {
            if (data.outfit) this.room.players[this.localPlayerId].outfit = data.outfit;
            if (data.weaponSkin) this.room.players[this.localPlayerId].weaponSkin = data.weaponSkin;
            this.emitLobby();
          }
          break;
        case 'addBot':
          this.addBot();
          break;
        case 'removeBot':
          this.removeBot();
          break;
        case 'start':
          this.startMatch();
          break;
        case 'restart':
          this.restartMatch();
          break;
        case 'input':
          this.handleInput(data);
          break;
      }
    }

    createRoom(data) {
      const code = 'LOCAL';
      this.room = {
        id: code,
        host: this.localPlayerId,
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
        started: false,
        over: false,
        winner: null,
        endsAt: 0,
        lastOrbSpawn: 0,
        lastZoneTick: 0,
        lastMedkitSpawn: 0
      };

      const pName = data?.name || 'Commander Rudra';
      this.room.players[this.localPlayerId] = {
        id: this.localPlayerId,
        name: pName,
        classId: data?.classId || 'assault',
        outfit: data?.outfit || 'gilded_warlord',
        weaponSkin: data?.weaponSkin || 'golden_glory',
        mmr: data?.mmr || 2850,
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
        kills: 0,
        deaths: 0,
        damage: 0,
        input: {}
      };

      this.emit('joined', { room: code, host: true });
      this.emitLobby();
    }

    addBot() {
      if (!this.room || this.room.started) return;
      const botId = 'bot_' + (this.botCounter++);
      const botName = '[BOT] ' + BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)] + ' ' + (Math.floor(Math.random() * 90) + 10);
      const classes = ['assault', 'sniper', 'vanguard'];
      const botClass = classes[Math.floor(Math.random() * classes.length)];
      const outfits = ['spec_ops', 'desert_operative', 'cyber_glitch', 'bloodhound', 'arctic_ghost', 'gilded_warlord'];
      const skins = ['default', 'dragon_fire', 'neon_cyber', 'toxic_hazard', 'void_cosmic', 'golden_glory'];

      this.room.players[botId] = {
        id: botId,
        name: botName,
        classId: botClass,
        outfit: outfits[Math.floor(Math.random() * outfits.length)],
        weaponSkin: skins[Math.floor(Math.random() * skins.length)],
        mmr: 1100 + Math.floor(Math.random() * 400),
        isBot: true,
        x: ARENA_W / 2 + (Math.random() * 100 - 50),
        y: ARENA_H / 2 + (Math.random() * 100 - 50),
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
        kills: 0,
        deaths: 0,
        damage: 0,
        input: {}
      };

      this.emitLobby();
    }

    removeBot() {
      if (!this.room || this.room.started) return;
      const botKey = Object.keys(this.room.players).find(k => this.room.players[k].isBot);
      if (botKey) {
        delete this.room.players[botKey];
        this.emitLobby();
      }
    }

    emitLobby() {
      if (!this.room) return;
      const pList = Object.values(this.room.players).map(p => ({
        id: p.id,
        name: p.name,
        classId: p.classId,
        outfit: p.outfit,
        weaponSkin: p.weaponSkin,
        isBot: !!p.isBot,
        mmr: p.mmr
      }));
      this.emit('lobby', {
        roomId: this.room.id,
        host: this.room.host,
        modeSetting: this.room.modeSetting,
        mapId: this.room.mapId,
        players: pList
      });
    }

    startMatch() {
      if (!this.room) return;
      // If only 1 player, auto-add a bot for instant fun
      if (Object.keys(this.room.players).length < 2) {
        this.addBot();
      }

      this.room.started = true;
      this.room.over = false;
      this.setupMode();

      if (!this.interval) {
        this.interval = setInterval(() => this.tick(), TICK_MS);
      }
      this.emitState();
    }

    restartMatch() {
      if (!this.room) return;
      this.room.started = false;
      this.room.over = false;
      if (this.interval) {
        clearInterval(this.interval);
        this.interval = null;
      }
      this.emitLobby();
    }

    setupMode() {
      const r = this.room;
      const pKeys = Object.keys(r.players);
      let mode = r.modeSetting;
      if (mode === 'auto') {
        const c = pKeys.length;
        mode = c <= 2 ? 'skirmish' : (c <= 4 ? 'hunt' : 'siege');
      }
      r.activeMode = mode;
      r.endsAt = Date.now() + 180000;
      r.scores = { blue: 0, red: 0, bossKills: 0 };
      r.projectiles = [];
      r.events = [];
      r.orbs = [];
      r.medkits = [];
      r.zones = [];

      // Mode-specific initialization
      if (mode === 'hunt') {
        pKeys.forEach((k, idx) => {
          const p = r.players[k];
          if (idx === 0) {
            p.role = 'boss';
            p.team = 'boss';
            p.classId = 'boss_colossus';
            p.maxHp = 650;
            p.hp = 650;
            p.shield = 100;
            p.speed = 3.2;
            p.radius = 24;
            p.x = ARENA_W / 2;
            p.y = ARENA_H / 2;
          } else {
            p.role = 'hunter';
            p.team = 'hunters';
            p.maxHp = 150;
            p.hp = 150;
            p.shield = 0;
            p.speed = 3.1;
            p.radius = 16;
            p.x = 100 + Math.random() * 200;
            p.y = 100 + Math.random() * 550;
          }
        });
      } else if (mode === 'snd') {
        r.mapId = 'sector7_warehouse';
        r.sndSites = [
          { id: 'A', x: 340, y: 375, radius: 46, name: 'BOMB SITE ALPHA' },
          { id: 'B', x: 840, y: 375, radius: 46, name: 'BOMB SITE BRAVO' }
        ];
        r.sndState = {
          currentRound: 1,
          roundWins: { red: 0, blue: 0 },
          bomb: { x: 300, y: 375, carrierId: null, state: 'unplanted', plantSite: null, plantProgress: 0, defuseProgress: 0 },
          roundPhase: 'combat',
          roundEndsAt: Date.now() + 90000
        };
        pKeys.forEach((k, idx) => {
          const p = r.players[k];
          p.team = (idx % 2 === 0) ? 'red' : 'blue';
          p.role = p.team === 'red' ? 'attacker' : 'defender';
          p.x = p.team === 'red' ? 120 : (ARENA_W - 120);
          p.y = 375 + (idx * 40 - 60);
          p.hp = 150;
          p.maxHp = 150;
          p.alive = true;
          if (p.team === 'red' && !r.sndState.bomb.carrierId) {
            r.sndState.bomb.carrierId = p.id;
          }
        });
      } else if (mode === 'gungame') {
        r.gunGameMaxTier = 5;
        pKeys.forEach((k, idx) => {
          const p = r.players[k];
          p.team = 'ffa';
          p.role = 'fighter';
          p.gunTier = 1;
          p.hp = 150;
          p.maxHp = 150;
          p.x = 200 + Math.random() * (ARENA_W - 400);
          p.y = 150 + Math.random() * (ARENA_H - 300);
          r.scores[p.id] = 1;
        });
      } else if (mode === 'infection') {
        const alphaIndex = Math.floor(Math.random() * pKeys.length);
        pKeys.forEach((k, idx) => {
          const p = r.players[k];
          if (idx === alphaIndex) {
            p.role = 'infected';
            p.team = 'infected';
            p.classId = 'stalker_infected';
            p.hp = 220;
            p.maxHp = 220;
            p.shield = 50;
            p.speed = 3.8;
            p.radius = 18;
          } else {
            p.role = 'survivor';
            p.team = 'survivors';
            p.hp = 150;
            p.maxHp = 150;
            p.speed = 3.1;
            p.radius = 16;
          }
          p.x = 200 + Math.random() * (ARENA_W - 400);
          p.y = 150 + Math.random() * (ARENA_H - 300);
        });
      } else if (mode === 'ctf') {
        r.ctfState = {
          blueFlag: { x: 160, y: 375, homeX: 160, homeY: 375, carrierId: null, atHome: true },
          redFlag: { x: ARENA_W - 160, y: 375, homeX: ARENA_W - 160, homeY: 375, carrierId: null, atHome: true },
          captures: { blue: 0, red: 0 },
          targetCaptures: 3
        };
        pKeys.forEach((k, idx) => {
          const p = r.players[k];
          p.team = (idx % 2 === 0) ? 'blue' : 'red';
          p.role = 'fighter';
          p.x = p.team === 'blue' ? 180 : (ARENA_W - 180);
          p.y = 375 + (idx * 40 - 60);
          p.hp = 150;
          p.maxHp = 150;
        });
      } else {
        // Skirmish / Siege
        pKeys.forEach((k, idx) => {
          const p = r.players[k];
          p.team = (idx % 2 === 0) ? 'blue' : 'red';
          p.role = 'fighter';
          p.hp = 150;
          p.maxHp = 150;
          p.x = p.team === 'blue' ? 160 : (ARENA_W - 160);
          p.y = 375 + (idx * 40 - 60);
        });
        if (mode === 'siege') {
          r.zones = [
            { id: 'A', name: 'Alpha', x: 260, y: 375, radius: 48, owner: 'neutral', progress: 0 },
            { id: 'B', name: 'Bravo', x: 600, y: 375, radius: 48, owner: 'neutral', progress: 0 },
            { id: 'C', name: 'Omega', x: 940, y: 375, radius: 48, owner: 'neutral', progress: 0 }
          ];
        }
      }
    }

    handleInput(data) {
      if (!this.room || !this.room.players[this.localPlayerId]) return;
      const p = this.room.players[this.localPlayerId];
      p.input = data;
      if (Number.isFinite(data.dir)) p.dir = data.dir;
    }

    tick() {
      const r = this.room;
      if (!r || !r.started || r.over) return;
      const now = Date.now();
      const currentMap = MAPS[r.mapId] || MAPS.neon_metropolis;

      // Update Players
      Object.values(r.players).forEach(p => {
        if (!p.alive) {
          if (p.respawnAt && now >= p.respawnAt) {
            p.alive = true;
            p.hp = p.maxHp;
            p.respawnAt = 0;
            p.x = p.team === 'red' ? (ARENA_W - 140) : 140;
            p.y = 375 + (Math.random() * 100 - 50);
            r.events.push({ x: p.x, y: p.y - 30, text: 'RESPAWNED', color: '#00f0ff', timestamp: now });
          }
          return;
        }

        // Bot AI
        if (p.isBot) {
          this.updateBot(p, now);
        }

        // Movement
        let dx = 0;
        let dy = 0;
        if (p.input.left) dx -= 1;
        if (p.input.right) dx += 1;
        if (p.input.up) dy -= 1;
        if (p.input.down) dy += 1;

        if (dx !== 0 && dy !== 0) {
          dx *= 0.7071;
          dy *= 0.7071;
        }

        let speed = p.speed;
        if (p.overchargedUntil && now < p.overchargedUntil) speed *= 1.4;

        // Dash Ability
        if (p.input.dash && (!p.abilityCool || now >= p.abilityCool)) {
          p.abilityCool = now + 4000;
          p.x += Math.cos(p.dir) * 85;
          p.y += Math.sin(p.dir) * 85;
          r.events.push({ x: p.x, y: p.y - 20, text: 'DASH', color: '#00f0ff', timestamp: now });
        }

        p.x += dx * speed;
        p.y += dy * speed;
        resolveObstacleCollision(p, currentMap.obstacles);

        // Primary Attack
        if (p.input.attack && (!p.attackCool || now >= p.attackCool)) {
          this.fireWeapon(p, now);
        }
      });

      // Update Projectiles
      for (let i = r.projectiles.length - 1; i >= 0; i--) {
        const pr = r.projectiles[i];
        pr.x += pr.vx;
        pr.y += pr.vy;
        pr.dist += Math.hypot(pr.vx, pr.vy);

        let hit = false;
        // Obstacle collision
        for (const ob of currentMap.obstacles) {
          if (pr.x >= ob.x && pr.x <= ob.x + ob.w && pr.y >= ob.y && pr.y <= ob.y + ob.h) {
            hit = true;
            break;
          }
        }

        // Player collision
        if (!hit) {
          for (const target of Object.values(r.players)) {
            if (!target.alive || target.id === pr.ownerId) continue;
            // Team check
            if (r.activeMode !== 'gungame' && target.team === pr.team && target.team !== 'neutral') continue;

            const dist = Math.hypot(pr.x - target.x, pr.y - target.y);
            if (dist <= target.radius + pr.radius) {
              hit = true;
              const attacker = r.players[pr.ownerId];
              this.damagePlayer(attacker, target, pr.damage, pr.weaponType, now);
              break;
            }
          }
        }

        if (hit || pr.dist >= pr.maxDist || pr.x < 0 || pr.x > ARENA_W || pr.y < 0 || pr.y > ARENA_H) {
          r.projectiles.splice(i, 1);
        }
      }

      // Check Match Victory
      if (r.activeMode === 'hunt') {
        const boss = Object.values(r.players).find(p => p.role === 'boss');
        if (boss && !boss.alive) {
          this.finishMatch('HUNTERS');
          return;
        }
      } else if (r.activeMode === 'skirmish') {
        if (r.scores.blue >= 12) return this.finishMatch('BLUE TEAM');
        if (r.scores.red >= 12) return this.finishMatch('RED TEAM');
      } else if (r.activeMode === 'siege') {
        if (now - (r.lastZoneTick || 0) >= 1000) {
          r.lastZoneTick = now;
          r.zones.forEach(z => {
            const blues = Object.values(r.players).filter(p => p.alive && p.team === 'blue' && Math.hypot(p.x - z.x, p.y - z.y) <= z.radius).length;
            const reds = Object.values(r.players).filter(p => p.alive && p.team === 'red' && Math.hypot(p.x - z.x, p.y - z.y) <= z.radius).length;
            if (blues > reds) z.owner = 'blue';
            else if (reds > blues) z.owner = 'red';
            if (z.owner === 'blue') r.scores.blue += 2;
            if (z.owner === 'red') r.scores.red += 2;
          });
          if (r.scores.blue >= 100) return this.finishMatch('BLUE TEAM');
          if (r.scores.red >= 100) return this.finishMatch('RED TEAM');
        }
      }

      // Time limit check
      if (now >= r.endsAt) {
        let winnerName = 'BLUE SQUAD';
        if (r.scores.red > r.scores.blue) winnerName = 'RED SQUAD';
        this.finishMatch(winnerName);
        return;
      }

      this.emitState();
    }

    fireWeapon(p, now) {
      const r = this.room;
      let weaponType = 'blaster';
      let speed = 12;
      let damage = 25;
      let cooldown = 220;
      let color = '#00f0ff';

      if (r.activeMode === 'gungame') {
        const tier = p.gunTier || 1;
        if (tier === 1) { weaponType = 'blaster'; damage = 22; cooldown = 180; }
        else if (tier === 2) { weaponType = 'shotgun'; damage = 18; cooldown = 450; }
        else if (tier === 3) { weaponType = 'railgun'; damage = 70; speed = 22; cooldown = 650; }
        else if (tier === 4) { weaponType = 'mortar'; damage = 55; speed = 9; cooldown = 500; }
        else if (tier === 5) {
          weaponType = 'blade';
          p.attackCool = now + 400;
          this.emit('bladeSlash');
          this.handleMeleeSlice(p, 65, 80, now);
          return;
        }
      } else if (p.role === 'infected') {
        p.attackCool = now + 350;
        this.emit('clawSlash');
        this.handleMeleeSlice(p, 55, 60, now);
        return;
      } else if (p.classId === 'sniper') {
        weaponType = 'railgun';
        speed = 22;
        damage = 65;
        cooldown = 600;
      } else if (p.classId === 'vanguard') {
        weaponType = 'shotgun';
        damage = 16;
        cooldown = 420;
      }

      p.attackCool = now + cooldown;

      // Spawn projectile(s)
      if (weaponType === 'shotgun') {
        [-0.18, 0, 0.18].forEach(spread => {
          r.projectiles.push({
            id: 'pr_' + (this.projCounter++),
            ownerId: p.id,
            team: p.team,
            x: p.x + Math.cos(p.dir + spread) * 20,
            y: p.y + Math.sin(p.dir + spread) * 20,
            vx: Math.cos(p.dir + spread) * speed,
            vy: Math.sin(p.dir + spread) * speed,
            radius: 4,
            damage: damage,
            weaponType: 'shotgun',
            color: '#ffd60a',
            maxDist: 380,
            dist: 0
          });
        });
      } else {
        r.projectiles.push({
          id: 'pr_' + (this.projCounter++),
          ownerId: p.id,
          team: p.team,
          x: p.x + Math.cos(p.dir) * 20,
          y: p.y + Math.sin(p.dir) * 20,
          vx: Math.cos(p.dir) * speed,
          vy: Math.sin(p.dir) * speed,
          radius: 5,
          damage: damage,
          weaponType: weaponType,
          color: color,
          maxDist: 750,
          dist: 0
        });
      }
    }

    handleMeleeSlice(p, radius, damage, now) {
      const r = this.room;
      Object.values(r.players).forEach(target => {
        if (!target.alive || target.id === p.id) return;
        if (target.team === p.team && target.team !== 'neutral') return;
        const dist = Math.hypot(target.x - p.x, target.y - p.y);
        if (dist <= radius) {
          this.damagePlayer(p, target, damage, 'blade', now);
        }
      });
    }

    damagePlayer(attacker, target, damage, weaponType, now) {
      const r = this.room;
      target.hp -= damage;
      r.events.push({ x: target.x, y: target.y - 25, text: `-${damage}`, color: '#ff4757', timestamp: now });

      if (target.hp <= 0) {
        target.alive = false;
        target.deaths = (target.deaths || 0) + 1;
        if (attacker) attacker.kills = (attacker.kills || 0) + 1;

        this.emit('killEvent', {
          killerName: attacker ? attacker.name : 'Arena Hazard',
          victimName: target.name,
          weaponType: weaponType,
          announcerText: attacker?.kills === 3 ? 'TRIPLE KILL!' : (attacker?.kills >= 4 ? 'RAMPAGE!' : '')
        });

        // Mode scoring on kill
        if (r.activeMode === 'gungame' && attacker && attacker.id !== target.id) {
          attacker.gunTier = (attacker.gunTier || 1) + 1;
          r.scores[attacker.id] = attacker.gunTier;
          this.emit('gunTierUp', { playerId: attacker.id, playerName: attacker.name, newTier: attacker.gunTier });
          if (attacker.gunTier > (r.gunGameMaxTier || 5)) {
            return this.finishMatch(attacker.name);
          }
        } else if (r.activeMode === 'infection' && target.role === 'survivor') {
          target.role = 'infected';
          target.team = 'infected';
          target.classId = 'stalker_infected';
          target.hp = 220;
          target.maxHp = 220;
          target.speed = 3.8;
          target.respawnAt = now + 2500;
          this.emit('playerInfected', { victimId: target.id, victimName: target.name });
          const livingSurvivors = Object.values(r.players).filter(p => p.role === 'survivor' && p.alive);
          if (livingSurvivors.length === 0) {
            return this.finishMatch('INFECTED SWARM');
          }
        } else if (r.activeMode === 'skirmish') {
          if (target.team === 'blue') r.scores.red += 2;
          else if (target.team === 'red') r.scores.blue += 2;
          target.respawnAt = now + 3500;
        } else {
          target.respawnAt = now + 4000;
        }
      }
    }

    updateBot(bot, now) {
      const r = this.room;
      // Target closest opposing player
      let closestTarget = null;
      let closestDist = Infinity;
      Object.values(r.players).forEach(p => {
        if (!p.alive || p.id === bot.id) return;
        if (r.activeMode !== 'gungame' && p.team === bot.team && p.team !== 'neutral') return;
        const dist = Math.hypot(p.x - bot.x, p.y - bot.y);
        if (dist < closestDist) {
          closestDist = dist;
          closestTarget = p;
        }
      });

      if (closestTarget) {
        bot.dir = Math.atan2(closestTarget.y - bot.y, closestTarget.x - bot.x);
        bot.input.left = closestTarget.x < bot.x - 20;
        bot.input.right = closestTarget.x > bot.x + 20;
        bot.input.up = closestTarget.y < bot.y - 20;
        bot.input.down = closestTarget.y > bot.y + 20;
        bot.input.attack = closestDist < 450;
      } else {
        bot.input = {};
      }
    }

    finishMatch(winner) {
      const r = this.room;
      r.over = true;
      r.winner = winner;
      this.emit('matchEnded', { winner: winner, isHost: true });
      this.emitState();
      if (this.interval) {
        clearInterval(this.interval);
        this.interval = null;
      }
    }

    emitState() {
      if (!this.room) return;
      const r = this.room;
      const currentMap = MAPS[r.mapId] || MAPS.neon_metropolis;
      const snapshot = {
        id: r.id,
        started: r.started,
        over: r.over,
        winner: r.winner,
        activeMode: r.activeMode,
        mapId: r.mapId,
        mapName: currentMap.name,
        endsAt: r.endsAt,
        scores: r.scores,
        players: Object.values(r.players).map(p => ({
          id: p.id,
          name: p.name,
          classId: p.classId,
          outfit: p.outfit,
          weaponSkin: p.weaponSkin,
          gunTier: p.gunTier || 1,
          role: p.role,
          team: p.team,
          isBot: !!p.isBot,
          x: Math.round(p.x),
          y: Math.round(p.y),
          dir: p.dir,
          hp: Math.max(0, Math.round(p.hp)),
          maxHp: p.maxHp,
          shield: Math.round(p.shield || 0),
          alive: p.alive,
          kills: p.kills || 0,
          deaths: p.deaths || 0
        })),
        projectiles: r.projectiles.map(pr => ({
          id: pr.id,
          x: Math.round(pr.x),
          y: Math.round(pr.y),
          vx: pr.vx,
          vy: pr.vy,
          weaponType: pr.weaponType,
          color: pr.color
        })),
        zones: r.zones || [],
        orbs: r.orbs || [],
        medkits: r.medkits || [],
        sndState: r.sndState || null,
        sndSites: r.sndSites || [],
        ctfState: r.ctfState || null,
        events: r.events,
        obstacles: currentMap.obstacles,
        teleporters: currentMap.teleporters || []
      };
      this.emit('state', snapshot);
    }
  }

  window.VirtualArena = VirtualArena;
})(window);
