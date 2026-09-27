// Weapon tuning. Damage is per bullet; the bot has 100 health.
export const WEAPONS = {
  rifle: {
    name: 'ASSAULT RIFLE', short: 'RIFLE', kind: 'gun', auto: true, rate: 0.1, dmg: 20, headMult: 2.5,
    mag: 30, reserve: 90, reload: 2.0, spread: 0.002, hip: 0, bloomAdd: 0.0025, bloomMax: 0.018,
    recoil: 0.0085, moveSpread: 0.016, adsFov: 55, sound: 'rifle',
  },
  sniper: {
    name: 'SNIPER', short: 'SNIPER', kind: 'gun', auto: false, rate: 1.0, dmg: 100, headMult: 2,
    mag: 5, reserve: 15, reload: 2.6, spread: 0.0004, hip: 0.05, bloomAdd: 0, bloomMax: 0,
    recoil: 0.045, moveSpread: 0.02, adsFov: 22, scope: true, sound: 'sniper',
  },
  smg: {
    name: 'SPRAY GUN', short: 'SPRAY', kind: 'gun', auto: true, rate: 0.065, dmg: 13, headMult: 2,
    mag: 25, reserve: 75, reload: 1.6, spread: 0.004, hip: 0, bloomAdd: 0.003, bloomMax: 0.025,
    recoil: 0.006, moveSpread: 0.008, adsFov: 62, sound: 'smg',
  },
  pistol: {
    name: 'PISTOL', short: 'PISTOL', kind: 'gun', auto: false, rate: 0.25, dmg: 34, headMult: 2,
    mag: 8, reserve: 32, reload: 1.4, spread: 0.0015, hip: 0, bloomAdd: 0.004, bloomMax: 0.012,
    recoil: 0.02, moveSpread: 0.01, adsFov: 62, sound: 'pistol',
  },
  knife: { name: 'KNIFE', short: 'KNIFE', kind: 'melee', rate: 0.55, dmg: 40, range: 3.0, backstab: true },
  fists: { name: 'FISTS', short: 'FISTS', kind: 'melee', rate: 0.32, dmg: 25, range: 2.7 },
};

export const CHOICES = {
  primary: ['rifle', 'sniper'],
  secondary: ['smg', 'pistol'],
  melee: ['knife', 'fists'],
};

export const GRENADES = 2;
