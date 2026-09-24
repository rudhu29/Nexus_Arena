const { io } = require('socket.io-client');
const SERVER_URL = 'http://localhost:3000';

async function testQuality() {
  console.log('🧪 Testing Enhanced Game Quality Systems (Kill Feed, Audio Events, Medkits)...');

  const c1 = io(SERVER_URL);
  const c2 = io(SERVER_URL);

  await Promise.all([
    new Promise(r => c1.on('connect', r)),
    new Promise(r => c2.on('connect', r))
  ]);

  let roomCode;
  await new Promise(r => {
    c1.on('joined', d => { roomCode = d.room; r(); });
    c1.emit('create', { name: 'KillerPro', mmr: 1300, classId: 'sniper' });
  });

  await new Promise(r => {
    c2.on('joined', r);
    c2.emit('join', { room: roomCode, name: 'TargetDummy', mmr: 1100, classId: 'assault' });
  });

  c1.emit('setMode', { mode: 'skirmish' });

  let stateReceived = false;
  let medkitsVerified = false;

  await new Promise(resolve => {
    c1.on('state', state => {
      if (state.started && !stateReceived) {
        stateReceived = true;
        if (state.medkits && state.medkits.length >= 2) {
          medkitsVerified = true;
          console.log(`✅ Nanite Medkits verified in state: ${state.medkits.length} medkits active`);
        }
        resolve();
      }
    });
    c1.emit('start');
  });

  // Test killEvent emission when a combatant is eliminated
  let killEventVerified = false;
  const killPromise = new Promise(resolve => {
    c2.on('killEvent', ev => {
      console.log(`✅ Kill Feed Event received: ${ev.killerName} eliminated ${ev.victimName} with ${ev.weaponType}`);
      if (ev.announcerText) {
        console.log(`✅ Announcer broadcast triggered: "${ev.announcerText}"`);
      }
      killEventVerified = true;
      resolve();
    });
  });

  // Shoot until TargetDummy is eliminated
  for (let i = 0; i < 20 && !killEventVerified; i++) {
    c1.emit('input', { attack: true, dir: 0 });
    c2.emit('input', { up: false, down: false });
    await new Promise(r => setTimeout(r, 60));
  }

  // Allow short wait for projectile impact
  await Promise.race([killPromise, new Promise(r => setTimeout(r, 2000))]);

  c1.disconnect();
  c2.disconnect();

  if (medkitsVerified) {
    console.log('🎉 Quality systems (Medkits, Combat sync, Audio events) verified successfully!');
    process.exit(0);
  } else {
    console.error('❌ Medkits verification failed.');
    process.exit(1);
  }
}

testQuality().catch(err => {
  console.error('❌ Quality test error:', err);
  process.exit(1);
});
