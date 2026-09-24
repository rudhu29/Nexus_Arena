module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  res.status(200).json({
    status: 'online',
    platform: 'vercel',
    engine: 'Nexus Arena Cyber Warfare v1.0',
    modes: ['hunt', 'skirmish', 'siege', 'snd', 'gungame', 'infection', 'ctf'],
    defaultTunnel: 'https://calm-planets-visit.loca.lt',
    timestamp: Date.now()
  });
};
