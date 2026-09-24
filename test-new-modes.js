const { io } = require('socket.io-client');
const SERVER_URL = 'http://localhost:3000';

async function testMode(modeName, validator) {
  return new Promise(async (resolve, reject) => {
    const c1 = io(SERVER_URL);
    const c2 = io(SERVER_URL);
    await Promise.all([new Promise(r => c1.on('connect', r)), new Promise(r => c2.on('connect', r))]);

    let roomCode;
    await new Promise(r => {
      c1.on('joined', d => { roomCode = d.room; r(); });
      c1.emit('create', { name: 'HostTester', mmr: 1500 });
    });
    await new Promise(r => {
      c2.on('joined', r);
      c2.emit('join', { room: roomCode, name: 'Challenger', mmr: 1550 });
    });

    c1.emit('setMode', { mode: modeName });
    const timer = setTimeout(() => {
      c1.disconnect();
      c2.disconnect();
      reject(new Error(`Timeout waiting for mode: ${modeName}`));
    }, 6000);

    c1.on('state', s => {
      if (s.started && s.activeMode === modeName) {
        clearTimeout(timer);
        validator(s);
        c1.disconnect();
        c2.disconnect();
        resolve();
      }
    });

    c1.emit('start');
  });
}

async function run() {
  console.log('🧪 Starting Verification of New Modes...');

  await testMode('gungame', state => {
    console.log(`✅ Gun Game Verified: maxTier=${state.gunGameMaxTier}, players=${state.players.length}, tiers=${state.players.map(p=>p.gunTier).join(',')}`);
    if (!state.gunGameMaxTier || state.gunGameMaxTier !== 5) throw new Error('Gun game max tier missing');
  });

  await testMode('infection', state => {
    const infected = state.players.filter(p => p.role === 'infected');
    const survivors = state.players.filter(p => p.role === 'survivor');
    console.log(`✅ Infection Mode Verified: Infected=${infected.length} (${infected[0]?.name}), Survivors=${survivors.length}`);
    if (infected.length !== 1 || survivors.length !== 1) throw new Error('Infection distribution error');
  });

  await testMode('ctf', state => {
    console.log(`✅ CTF Mode Verified: TargetCaptures=${state.ctfState?.targetCaptures}, BlueFlag=${state.ctfState?.blueFlag?.atHome}, RedFlag=${state.ctfState?.redFlag?.atHome}`);
    if (!state.ctfState || state.ctfState.targetCaptures !== 3) throw new Error('CTF state error');
  });

  console.log('🎉 ALL 3 NEW MODES FULLY OPERATIONAL ON SERVER!');
  process.exit(0);
}

run().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
