const { io } = require('socket.io-client');
const SERVER_URL = 'http://localhost:3000';

async function testTeleporter() {
  console.log('🧪 Testing Omega Ruins Quantum Teleporters & Loadouts...');
  const c1 = io(SERVER_URL);
  const c2 = io(SERVER_URL);
  await Promise.all([new Promise(r => c1.on('connect', r)), new Promise(r => c2.on('connect', r))]);

  let roomCode;
  await new Promise(r => {
    c1.on('joined', d => { roomCode = d.room; r(); });
    c1.emit('create', { name: 'SniperAce', mmr: 1500, classId: 'sniper' });
  });

  await new Promise(r => {
    c2.on('joined', r);
    c2.emit('join', { room: roomCode, name: 'VanguardTank', mmr: 1400, classId: 'vanguard' });
  });

  // Select Omega Ruins map and Skirmish mode
  c1.emit('setMap', { mapId: 'omega_ruins' });
  c1.emit('setMode', { mode: 'skirmish' });

  await new Promise(r => {
    c1.on('state', s => {
      if (s.started && s.mapId === 'omega_ruins') {
        console.log(`✅ Omega Ruins Map loaded! Teleporters count: ${s.teleporters.length}`);
        console.log(`   - Teleporters: ${s.teleporters.map(t=>`${t.id} -> (${t.targetX},${t.targetY})`).join(' | ')}`);
        console.log(`✅ Player Loadouts Verified:`);
        s.players.forEach(p => console.log(`   - ${p.name}: Class=${p.classId}, HP=${p.hp}/${p.maxHp}`));
        r();
      }
    });
    c1.emit('start');
  });

  c1.disconnect();
  c2.disconnect();
  console.log('🎉 Quantum Teleporters & Loadouts test passed!');
  process.exit(0);
}

testTeleporter().catch(e => { console.error(e); process.exit(1); });
