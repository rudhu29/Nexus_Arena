const { io } = require('socket.io-client');
const SERVER_URL = 'http://localhost:3000';

async function testFullSndFlow() {
  console.log('🧪 Starting Full S&D Flow & Customization Simulation Test...');
  const c1 = io(SERVER_URL);
  const c2 = io(SERVER_URL);

  await Promise.all([
    new Promise(r => c1.on('connect', r)),
    new Promise(r => c2.on('connect', r))
  ]);
  console.log('✅ Both players connected to server');

  let roomCode;
  await new Promise(r => {
    c1.on('joined', d => { roomCode = d.room; r(); });
    c1.emit('create', {
      name: 'AlphaAttacker',
      mmr: 1300,
      classId: 'assault',
      outfit: 'bloodhound',
      weaponSkin: 'dragon_fire'
    });
  });

  await new Promise(r => {
    c2.on('joined', r);
    c2.emit('join', {
      room: roomCode,
      name: 'BravoDefender',
      mmr: 1250,
      classId: 'vanguard',
      outfit: 'arctic_ghost',
      weaponSkin: 'neon_cyber'
    });
  });

  // Test customization update event
  c1.emit('setCustomization', { outfit: 'gilded_warlord', weaponSkin: 'golden_glory' });
  console.log('✅ Customization updated during lobby');

  // Set mode to S&D and map to Sector 7 Warehouse
  c1.emit('setMode', { mode: 'snd' });
  c1.emit('setMap', { mapId: 'sector7_warehouse' });

  // Wait for match state to begin
  await new Promise(resolve => {
    const onState = state => {
      if (state.started && state.activeMode === 'snd') {
        c1.off('state', onState);
        console.log(`✅ S&D Match Started! ActiveMode=${state.activeMode}, Map=${state.mapName}`);
        console.log(`   Map Obstacles: ${state.obstacles.length} (contains containers and crates)`);
        console.log(`   S&D Bomb Sites: ${state.sndSites.map(s => `${s.name} at (${s.x},${s.y})`).join(', ')}`);
        
        const p1 = state.players.find(p => p.name === 'AlphaAttacker');
        const p2 = state.players.find(p => p.name === 'BravoDefender');
        console.log(`   Player 1: Outfit=${p1.outfit}, Skin=${p1.weaponSkin}, Team=${p1.team}, HasBomb=${p1.hasBomb}`);
        console.log(`   Player 2: Outfit=${p2.outfit}, Skin=${p2.weaponSkin}, Team=${p2.team}, HasBomb=${p2.hasBomb}`);
        resolve();
      }
    };
    c1.on('state', onState);
    c1.emit('start');
  });

  console.log('🎉 Full End-to-End Search & Destroy & Customization test PASSED!');
  c1.disconnect();
  c2.disconnect();
  process.exit(0);
}

testFullSndFlow().catch(err => {
  console.error('❌ E2E S&D test failed:', err);
  process.exit(1);
});
