const { io } = require('socket.io-client');
const SERVER_URL = 'http://localhost:3000';

async function testModes() {
  console.log('🧪 Testing Skirmish & Siege Modes...');
  const c1 = io(SERVER_URL);
  const c2 = io(SERVER_URL);
  await Promise.all([new Promise(r => c1.on('connect', r)), new Promise(r => c2.on('connect', r))]);

  let roomCode;
  await new Promise(r => {
    c1.on('joined', d => { roomCode = d.room; r(); });
    c1.emit('create', { name: 'Player1', mmr: 1100 });
  });
  await new Promise(r => {
    c2.on('joined', r);
    c2.emit('join', { room: roomCode, name: 'Player2', mmr: 1150 });
  });

  // Test Skirmish mode
  c1.emit('setMode', { mode: 'skirmish' });
  await new Promise(r => {
    c1.on('state', s => {
      if (s.started && s.activeMode === 'skirmish') {
        console.log(`✅ Skirmish mode active: Orbs=${s.orbs.length}, Blue score=${s.scores.blue}, Red score=${s.scores.red}`);
        r();
      }
    });
    c1.emit('start');
  });

  c1.disconnect();
  c2.disconnect();

  // Test Siege mode
  const c3 = io(SERVER_URL);
  const c4 = io(SERVER_URL);
  await Promise.all([new Promise(r => c3.on('connect', r)), new Promise(r => c4.on('connect', r))]);
  let room2;
  await new Promise(r => {
    c3.on('joined', d => { room2 = d.room; r(); });
    c3.emit('create', { name: 'SiegeHost', mmr: 1400 });
  });
  await new Promise(r => {
    c4.on('joined', r);
    c4.emit('join', { room: room2, name: 'SiegePeer', mmr: 1350 });
  });

  c3.emit('setMode', { mode: 'siege' });
  await new Promise(r => {
    c3.on('state', s => {
      if (s.started && s.activeMode === 'siege') {
        console.log(`✅ Siege mode active: Zones=${s.zones.length} (${s.zones.map(z=>z.id).join(', ')}), Target=100pts`);
        r();
      }
    });
    c3.emit('start');
  });

  c3.disconnect();
  c4.disconnect();
  console.log('🎉 Skirmish & Siege modes verified!');
  process.exit(0);
}

testModes().catch(e => { console.error(e); process.exit(1); });
