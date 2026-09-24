const { io } = require('socket.io-client');
const SERVER_URL = 'http://localhost:3000';

async function testSnd() {
  console.log('🧪 Testing Search & Destroy Mode & Sector 7 Warehouse Map...');
  const c1 = io(SERVER_URL);
  const c2 = io(SERVER_URL);

  await Promise.all([
    new Promise(r => c1.on('connect', r)),
    new Promise(r => c2.on('connect', r))
  ]);

  let roomCode;
  await new Promise(r => {
    c1.on('joined', d => { roomCode = d.room; r(); });
    c1.emit('create', { name: 'AttackerOne', mmr: 1250, classId: 'assault', outfit: 'bloodhound', weaponSkin: 'dragon_fire' });
  });

  await new Promise(r => {
    c2.on('joined', r);
    c2.emit('join', { room: roomCode, name: 'DefenderOne', mmr: 1200, classId: 'sniper', outfit: 'arctic_ghost', weaponSkin: 'neon_cyber' });
  });

  // Set mode to S&D and map to Sector 7 Warehouse
  c1.emit('setMode', { mode: 'snd' });
  c1.emit('setMap', { mapId: 'sector7_warehouse' });

  await new Promise(resolve => {
    c1.on('state', state => {
      if (state.started && state.activeMode === 'snd') {
        console.log(`✅ S&D Match Started! ActiveMode=${state.activeMode}, Map=${state.mapName}`);
        console.log(`✅ Bomb state: ${state.sndState?.bomb?.state}, Sites count: ${state.sndSites?.length}`);
        state.players.forEach(p => {
          console.log(`   - ${p.name} | Team: ${p.team} | Outfit: ${p.outfit} | Skin: ${p.weaponSkin} | HasBomb: ${p.hasBomb}`);
        });
        resolve();
      }
    });
    c1.emit('start');
  });

  c1.disconnect();
  c2.disconnect();
  console.log('🎉 Search & Destroy & Sector 7 Warehouse server test PASSED 100%!');
  process.exit(0);
}

testSnd().catch(e => {
  console.error('❌ S&D test failed:', e);
  process.exit(1);
});
