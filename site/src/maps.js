// Map definitions. Every map fits the same 60 x 60 walled square; world.js adds the floor and
// the perimeter walls. build(b) places everything else using:
//   b.box(x, z, w, d, h, y = 0, colour, tile)   solid block (x/z = centre, y = bottom)
//   b.crate(x, z, size = 1.2, y = 0, colour)    crate-textured cube
//   b.stairsZ / b.stairsX(...)                  steps up to a platform edge
//   b.decor(...)                                same as box but walk-through (road paint etc.)
// Colours are names looked up in the map's theme.colors.
// unlock: which leaderboard number opens the map, e.g. 10 duel wins on Normal.

const common = { crate: 0xe8913f, crate2: 0xc9733a };

function arena(b) {
  const box = b.box, crate = b.crate;
  box(0, 0, 10, 10, 2.5, 0, 'teal');
  b.stairsZ(0, 5, 1, 3, 2.5, 6, 0.6, 'teal');
  b.stairsZ(0, -5, -1, 3, 2.5, 6, 0.6, 'teal');
  for (const s of [1, -1]) {
    box(-3.5, 4.8 * s, 3, 0.4, 1.0, 2.5, 'low');
    box(3.5, 4.8 * s, 3, 0.4, 1.0, 2.5, 'low');
    box(4.8 * s, 0, 0.4, 4, 1.0, 2.5, 'low');
  }
  crate(0, 0, 1.2, 2.5);
  for (const s of [1, -1]) {
    box(24 * s, 24 * s, 8, 8, 2.4, 0, 'yellow');
    b.stairsZ(26 * s, 20 * s, -s, 2.5, 2.4, 6, 0.6, 'yellow');
    box(20.2 * s, 25 * s, 0.4, 5, 1.0, 2.4, 'low');
    crate(19.2 * s, 22.5 * s);
  }
  for (const s of [1, -1]) {
    box(-23 * s, 16 * s, 8, 0.8, 3.5, 0, 'blue');
    box(-19 * s, 20.6 * s, 0.8, 8.4, 3.5, 0, 'blue');
    crate(-25 * s, 27 * s);
    crate(-23.8 * s, 27 * s, 1.2, 0, 'crate2');
    crate(-25 * s, 27 * s, 1.2, 1.2);
  }
  for (const s of [1, -1]) {
    box(-14 * s, 2 * s, 0.8, 7, 3.5, 0, 'cream');
    crate(-12.8 * s, -3 * s);
    crate(-12.8 * s, -3 * s, 1.2, 1.2, 'crate2');
    crate(-12.8 * s, -4.2 * s);
    box(-24 * s, 0, 6, 0.6, 1.0, 0, 'low');
    crate(-21 * s, 6 * s);
  }
  box(0, 17, 10, 0.6, 1.0, 0, 'low');
  box(0, -17, 10, 0.6, 1.0, 0, 'low');
  for (const [x, z] of [[-8, 14], [8, -14], [8, 14], [-8, -14]]) box(x, z, 1.4, 1.4, 5, 0, 'pillar');
  crate(7, 8, 2); crate(-7, -8, 2);
  crate(-6, 11); crate(6, -11);
  crate(12, 24, 2, 0, 'crate2'); crate(-12, -24, 2, 0, 'crate2');
  box(-4, 24, 0.8, 5, 3, 0, 'purple');
  box(4, -24, 0.8, 5, 3, 0, 'purple');
}

// Two streets crossing in the middle, city blocks on each corner with alleys and a courtyard
// between the buildings. Long street sightlines for snipers, tight alleys for close fights.
function crossroads(b) {
  const box = b.box;
  // road paint (walk-through)
  for (let t = -28; t <= 28; t += 4) {
    if (Math.abs(t) < 8) continue;
    b.decor(0, t, 0.25, 2, 0.02, 0, 'paint');
    b.decor(t, 0, 2, 0.25, 0.02, 0, 'paint');
  }
  for (let k = -4.5; k <= 4.5; k += 1.5) {
    for (const s of [1, -1]) {
      b.decor(k, 7.4 * s, 0.7, 2, 0.02, 0, 'paint');
      b.decor(7.4 * s, k, 2, 0.7, 0.02, 0, 'paint');
    }
  }
  // the four city blocks: a raised pavement with buildings on it
  const blocks = [
    { sx: 1, sz: 1, c: ['bldg1', 'bldg2', 'bldg3', 'bldg1'] },
    { sx: -1, sz: 1, c: ['bldg2', 'bldg3', 'bldg1', 'bldg2'] },
    { sx: 1, sz: -1, c: ['bldg3', 'bldg1', 'bldg2', 'bldg3'] },
    { sx: -1, sz: -1, c: ['bldg1', 'bldg3', 'bldg2', 'park'] },
  ];
  for (const { sx, sz, c } of blocks) {
    box(18 * sx, 18 * sz, 24, 24, 0.25, 0, 'walk');
    const y = 0.25;
    box(12 * sx, 13 * sz, 7, 8, 7, y, c[0]);
    box(24 * sx, 12 * sz, 8, 6, 5, y, c[1]);
    box(13 * sx, 25 * sz, 8, 6, 9, y, c[2]);
    if (c[3] === 'park') {
      // a little park instead of the fourth building
      box(24.5 * sx, 21 * sz, 7, 0.8, 0.9, y, 'hedge');
      box(21.4 * sx, 24.5 * sz, 0.8, 6, 0.9, y, 'hedge');
      tree(b, 25 * sx, 25 * sz, y);
    } else {
      box(24.5 * sx, 24 * sz, 7, 7, 6, y, c[3]);
    }
    box(17.7 * sx, 19 * sz, 1.6, 1.0, 1.3, y, 'dumpster');
  }
  // cars parked in the streets
  car(b, -3, -16, false, 'car1');
  car(b, 3.2, 18, false, 'car2');
  car(b, 17, -3, true, 'car3');
  car(b, -20, 2.8, true, 'car1');
  car(b, -3.2, 24, false, 'car3');
  // roundabout in the middle
  box(0, 0, 4, 4, 0.6, 0, 'walk');
  box(0, 0, 3, 3, 0.4, 0.6, 'hedge');
  tree(b, 0, 0, 1.0);
  // bus shelters
  for (const s of [1, -1]) {
    box(8.2 * s, -11 * s, 0.2, 3.2, 2.4, 0.25, 'glass');
    box(7.6 * s, -11 * s, 1.4, 3.2, 0.2, 2.65, 'bldg2');
  }
}

function car(b, x, z, alongX, colour) {
  const [w, d] = alongX ? [4.2, 2] : [2, 4.2];
  b.box(x, z, w, d, 1.0, 0, colour);
  b.box(x, z, alongX ? 2.2 : 1.8, alongX ? 1.8 : 2.2, 0.7, 1.0, 'glass');
}

function tree(b, x, z, y) {
  b.box(x, z, 0.5, 0.5, 2.4, y, 'trunk');
  b.box(x, z, 2.4, 2.4, 2, y + 2.4, 'leaves');
}

// A warehouse at dusk: aisles of tall shelving, shipping containers you can climb,
// a raised walkway along one wall and a small office in the corner.
function warehouse(b) {
  const box = b.box, crate = b.crate;
  // shelving racks forming aisles, with a cross aisle through the middle
  for (const x of [-22, -16, -10]) {
    box(x, -10, 1.4, 12, 3.5, 0, 'rack');
    box(x, 12, 1.4, 12, 3.5, 0, 'rack');
  }
  // shipping containers; the first has stairs so you can get on top
  box(4, -18, 6, 2.6, 2.6, 0, 'cont1');
  box(5.5, -18, 3, 2.6, 2.6, 2.6, 'cont2');
  b.stairsX(-18, 1, -1, 2.6, 2.6, 6, 0.5, 'metal');
  box(8, 16, 2.6, 6, 2.6, 0, 'cont3');
  box(10, 4, 6, 2.6, 2.6, 0, 'cont1');
  box(-2, 20, 6, 2.6, 2.6, 0, 'cont2');
  // raised walkway along the east wall, stairs at both ends, railings with a gap to jump down
  box(26, 0, 8, 30, 3, 0, 'metal');
  b.stairsZ(24, -15, -1, 2.5, 3, 7, 0.55, 'metal');
  b.stairsZ(24, 15, 1, 2.5, 3, 7, 0.55, 'metal');
  box(22.2, -8.5, 0.3, 9, 1.0, 3, 'rail');
  box(22.2, 8.5, 0.3, 9, 1.0, 3, 'rail');
  // office in the north-west corner with a doorway
  box(-26.5, 20, 7, 0.4, 3, 0, 'office');
  box(-19.5, 20, 3, 0.4, 3, 0, 'office');
  box(-18, 24.8, 0.4, 9.6, 3, 0, 'office');
  crate(-26, 26); crate(-24.8, 26, 1.2, 0, 'crate2');
  // forklifts
  box(-4, -4, 1.4, 2.2, 1.4, 0, 'forklift');
  box(-4, -5.3, 1.2, 0.2, 2.6, 0, 'metal');
  box(14, -9, 2.2, 1.4, 1.4, 0, 'forklift');
  // crate stacks
  crate(0, 8); crate(1.2, 8); crate(0, 8, 1.2, 1.2, 'crate2');
  crate(-6, 18); crate(-6, 16.8, 1.2, 0, 'crate2');
  crate(14, -22); crate(15.2, -22); crate(14, -22, 1.2, 1.2);
  crate(-8, -24, 2, 0, 'crate2');
  crate(16, 24); crate(16, 24, 1.2, 1.2, 'crate2');
  // low pallets you can step over
  box(-13, 3, 2, 1.2, 0.3, 0, 'crate2');
  box(4, -6, 1.2, 2, 0.3, 0, 'crate2');
}

// Rooftops: nine flat roofs above the streets. Plank bridges link the outer ring of roofs,
// jump pads fling you up to the tall centre roof, and stairs lead back up from the street.
function rooftops(b) {
  const box = b.box;
  const H = 6, TOP = 9;
  for (const bx of [-20, 0, 20]) {
    for (const bz of [-20, 0, 20]) {
      const centre = bx === 0 && bz === 0;
      const h = centre ? TOP : H;
      box(bx, bz, 12, 12, h, 0, (bx + bz) % 40 === 0 ? 'roof' : 'roof2');
      if (centre) {
        // low cover walls on the centre roof
        for (const s of [1, -1]) { box(3.5 * s, 3.5 * s, 3, 0.4, 0.9, h, 'parapet'); box(-3.5 * s, 3.5 * s, 0.4, 3, 0.9, h, 'parapet'); }
        continue;
      }
      box(bx + 3, bz - 3, 1.6, 1.6, 1.2, h, 'ac');                       // air-con unit
      for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(bx - 3 + lx, bz + 3 + lz, 0.3, 0.3, 1.5, h, 'tank');
      box(bx - 3, bz + 3, 2.4, 2.4, 2, h + 1.5, 'tank');                  // water tower
      box(bx + 2.5, bz + 3.5, 2, 3, 0.4, h, 'glass');                     // skylight
    }
  }
  // plank bridges between neighbouring outer roofs
  for (const s of [1, -1]) {
    box(-10, 21 * s, 8, 1.8, 0.3, H - 0.3, 'bridge');
    box(10, 21 * s, 8, 1.8, 0.3, H - 0.3, 'bridge');
    box(21 * s, -10, 1.8, 8, 0.3, H - 0.3, 'bridge');
    box(21 * s, 10, 1.8, 8, 0.3, H - 0.3, 'bridge');
  }
  // jump pads from the side roofs up to the centre, and from the street up to the corner roofs
  b.pad(0, H, -15.5, 0, TOP, -3);
  b.pad(0, H, 15.5, 0, TOP, 3);
  b.pad(-15.5, H, 0, -3, TOP, 0);
  b.pad(15.5, H, 0, 3, TOP, 0);
  for (const [x, z] of [[-10, -10], [10, -10], [10, 10], [-10, 10]]) b.pad(x, 0, z, x * 1.8, H, z * 1.8);
  // stairs from the street up to the corner roofs
  b.stairsZ(-24, -14, 1, 2.5, H, 14, 0.5, 'stair');
  b.stairsZ(24, 14, -1, 2.5, H, 14, 0.5, 'stair');
  b.stairsX(-24, 14, -1, 2.5, H, 14, 0.5, 'stair');
  b.stairsX(24, -14, 1, 2.5, H, 14, 0.5, 'stair');
  // street clutter
  b.crate(-10, 0); b.crate(10, 1); b.crate(0, -10, 1.2, 0, 'crate2'); b.crate(1, 10);
  box(-27.5, 0, 1.6, 1.0, 1.3, 0, 'dumpster'); box(27.5, -4, 1.6, 1.0, 1.3, 0, 'dumpster');
}

// Canyon: a sandy canyon floor between two cliffs. Ledges halfway up, cliff tops above,
// a rope bridge across the middle, and two pairs of teleporters.
function canyon(b) {
  const box = b.box;
  for (const s of [1, -1]) {
    box(22 * s, 0, 16, 60, 6, 0, 'cliff');          // cliff top (plateau)
    box(12 * s, 0, 4, 60, 3, 0, 'ledge');           // ledge halfway up
    // stairs: canyon floor to ledge, ledge to cliff top
    b.stairsX(-18 * s, 10 * s, -s, 2.5, 3, 7, 0.5, 'ledge');
    b.stairsX(12 * s, 10 * s, -s, 2.5, 3, 7, 0.5, 'ledge');
    b.stairsX(-6 * s, 14 * s, -s, 2.5, 3, 7, 0.5, 'cliff', 3);
    b.stairsX(20 * s, 14 * s, -s, 2.5, 3, 7, 0.5, 'cliff', 3);
    // rocks for cover on the cliff tops
    box(22 * s, -18 * s, 3, 2, 1.4, 6, 'rock2');
    box(20 * s, 8 * s, 2, 3, 1.4, 6, 'rock');
    box(25 * s, -4 * s, 2, 2, 2.2, 6, 'rock2');
    box(18 * s, 22 * s, 2.5, 2.5, 1.2, 6, 'rock');
  }
  // boulders and cactus on the canyon floor
  box(-4, -14, 3, 3, 2.2, 0, 'rock');
  box(5, -6, 2, 2, 1.2, 0, 'rock2');
  box(-5, 6, 2.5, 2, 1.6, 0, 'rock2');
  box(4, 15, 3, 3, 2.6, 0, 'rock');
  box(-2, 23, 2, 2, 1.2, 0, 'rock');
  box(6, 24, 0.6, 0.6, 2.2, 0, 'cactus'); box(-7, -22, 0.6, 0.6, 2.4, 0, 'cactus');
  box(-6.5, -2, 0.6, 0.6, 1.8, 0, 'cactus');
  // rope bridge across at cliff-top height
  box(0, 0, 28, 2, 0.3, 5.7, 'bridge');
  // teleporters: canyon floor end to end, and cliff top to cliff top
  b.portal('floor', 0, 0, -28.5, Math.PI, 0x40e0ff);
  b.portal('floor', 0, 0, 28.5, 0, 0x40e0ff);
  b.portal('cliffs', -28.5, 6, 0, -Math.PI / 2, 0xff5ad2);
  b.portal('cliffs', 28.5, 6, 0, Math.PI / 2, 0xff5ad2);
}

// Fort: a stone fort on a green hill. Walk the walls, fight through the gates, and grab the
// power-up in the courtyard: Speed, Shield or Double Damage.
function fort(b) {
  const box = b.box;
  const WALL = 4;
  for (const s of [1, -1]) {
    // walls with a gate in the middle of each side; their tops are walkways
    box(-7, 11 * s, 10, 2, WALL, 0, 'stone'); box(7, 11 * s, 10, 2, WALL, 0, 'stone');
    box(11 * s, -6, 2, 8, WALL, 0, 'stone'); box(11 * s, 6, 2, 8, WALL, 0, 'stone');
    // battlements on the outer edge of the walkways
    for (const x of [-10, -6, 6, 10]) box(x, 11.8 * s, 1.2, 0.4, 0.8, WALL, 'stone2');
    for (const z of [-8, -4, 4, 8]) box(11.8 * s, z, 0.4, 1.2, 0.8, WALL, 'stone2');
    // corner towers
    box(11 * s, 11, 4, 4, 6.5, 0, 'stone2'); box(11 * s, -11, 4, 4, 6.5, 0, 'stone2');
    box(11 * s, 11, 4.4, 4.4, 0.8, 6.5, 'roof'); box(11 * s, -11, 4.4, 4.4, 0.8, 6.5, 'roof');
  }
  // stairs up to the walls from inside the courtyard
  b.stairsZ(-6, 10, -1, 2, WALL, 10, 0.5, 'wood');
  b.stairsZ(6, -10, 1, 2, WALL, 10, 0.5, 'wood');
  b.stairsX(6, 10, -1, 2, WALL, 10, 0.5, 'wood');
  b.stairsX(-6, -10, 1, 2, WALL, 10, 0.5, 'wood');
  // courtyard: the power-up in the middle, low planters around it for cover
  b.power(0, 0, 0);
  for (const [x, z] of [[-3, -3], [3, 3], [-3, 3], [3, -3]]) box(x, z, 1.6, 1.6, 0.9, 0, 'stone2');
  // outside: hay bales, trees, rocks, fences
  const hay = [[-18, -6], [18, 6], [-6, -18], [6, 18], [-20, 18], [20, -18]];
  for (const [x, z] of hay) box(x, z, 2, 1.4, 1.2, 0, 'hay');
  for (const [x, z] of [[-24, -14], [24, 14], [-14, 24], [14, -24], [-25, 25], [25, -25]]) {
    box(x, z, 0.6, 0.6, 2.6, 0, 'trunk');
    box(x, z, 2.8, 2.8, 2.2, 2.6, 'leaves');
  }
  box(-22, 6, 3, 2, 1.8, 0, 'rock'); box(22, -6, 3, 2, 1.8, 0, 'rock');
  box(0, -22, 8, 0.3, 1.0, 0, 'fence'); box(0, 22, 8, 0.3, 1.0, 0, 'fence');
}

// Night City: neon-lit streets after dark, an elevated train track, jump pads up to it,
// and two pairs of teleporters. Bots' eyes glow red.
function nightcity(b) {
  const box = b.box, decor = b.decor;
  // buildings
  box(-19, -19, 10, 10, 8, 0, 'bldgA');
  box(0, -21, 10, 8, 6, 0, 'bldgB');
  box(19, -19, 10, 10, 10, 0, 'bldgC');
  box(-20, 2, 8, 10, 7, 0, 'bldgB');
  box(20, 2, 8, 10, 5, 0, 'bldgA');
  // neon signs and lit windows
  decor(-13.9, -19, 0.1, 6, 0.4, 5, 'neonPink');
  decor(13.9, -19, 0.1, 6, 0.4, 6.5, 'neonCyan');
  decor(0, -16.9, 8, 0.1, 0.5, 4.5, 'neonYellow');
  decor(-15.9, 2, 0.1, 8, 0.4, 5, 'neonGreen');
  decor(15.9, 2, 0.1, 8, 0.4, 3.5, 'neonPink');
  for (let k = 0; k < 4; k++) {
    decor(-13.9, -22 + k * 2, 0.1, 1, 1, 2, 'neonWindow');
    decor(13.9, -22 + k * 2, 0.1, 1, 1, 3, 'neonWindow');
    decor(-15.9, -1 + k * 2, 0.1, 1, 1, 2, 'neonWindow');
  }
  // elevated train track across the north, on pillars you can walk under
  box(0, 21, 52, 4, 0.6, 3.4, 'rail');
  for (const x of [-24, -12, 0, 12, 24]) box(x, 21, 1, 1, 3.4, 0, 'rail');
  decor(0, 18.95, 52, 0.1, 0.25, 3.5, 'neonCyan');
  b.stairsX(21, -26, -1, 3, 4, 10, 0.35, 'rail');
  b.stairsX(21, 26, 1, 3, 4, 10, 0.35, 'rail');
  // plaza fountain with a neon rim
  box(0, 0, 5, 5, 0.8, 0, 'walk');
  decor(0, 0, 5.1, 5.1, 0.12, 0.8, 'neonPink');
  // street lamps
  for (const [x, z] of [[-10, -10], [10, -10], [-10, 8], [10, 8], [0, -14.5], [-26, 12], [26, 12]]) {
    box(x, z, 0.3, 0.3, 4.5, 0, 'lamp');
    decor(x, z, 0.8, 0.8, 0.3, 4.5, 'neonYellow');
    b.light(x, 4.2, z, 0xffd9a0, 45, 16);
  }
  b.light(0, 3, 0, 0xff3fa4, 30, 12);
  // alley clutter
  b.crate(-8, 26); b.crate(8, 27, 1.2, 0, 'crate2'); b.crate(-27, -4); b.crate(27, 20);
  box(-9, -27, 1.6, 1, 1.3, 0, 'dumpster');
  // jump pads from the plaza up onto the track
  b.pad(-8, 0, 13, -8, 4, 21);
  b.pad(8, 0, 13, 8, 4, 21);
  // teleporters
  b.portal('alleys', -10, 0, -28.5, Math.PI, 0xff3fa4);
  b.portal('alleys', 12, 0, 28.5, 0, 0xff3fa4);
  b.portal('track', -22, 4, 21, -Math.PI / 2, 0x3ff0ff);
  b.portal('track', 28.5, 0, -8, Math.PI / 2, 0x3ff0ff);
}

export const MAPS = [
  {
    id: 'arena', name: 'ARENA', unlock: null, build: arena,
    spawn: { x: 0, z: -26.5, yaw: Math.PI },
    ammo: [[2.8, 2.5, -2.8], [25, 2.4, 26], [-25, 2.4, -26], [-25, 0, 3], [25, 0, -3], [-23, 0, 21], [23, 0, -21],
      [-10, 0, 6], [10, 0, -6], [0, 0, 12], [0, 0, -12], [15, 0, 25], [-15, 0, -25], [-18, 0, -12], [18, 0, 12]],
    theme: {
      sky: [0x3d9cf0, 0xd6efff], fog: 0xcfe6fb, sun: [0xfff4e0, 2.4], hemi: [0xdcecff, 0x8a7c66, 1.4], wallHeight: 5,
      skyline: [0xf6c28b, 0x9fd3c7, 0xf4a6a6, 0xb8c4f0, 0xf7e08c],
      colors: {
        ...common, floor: 0xd3d9e2, wall: 0x6f7f9c, teal: 0x33b5c7, yellow: 0xf4b63f, cream: 0xeee5d3,
        blue: 0x5a6fe0, low: 0xa3adb9, pillar: 0xe0605a, purple: 0x9b6be0,
      },
    },
  },
  {
    id: 'crossroads', name: 'CROSSROADS', unlock: { mode: 'duel', d: 'normal', n: 10 }, build: crossroads,
    spawn: { x: 0, z: -27, yaw: Math.PI },
    ammo: [[0, 0, -20], [0, 0, 20], [-20, 0, 0], [20, 0, 0], [17.7, 0.25, 17.7], [-17.7, 0.25, 17.7],
      [17.7, 0.25, -17.7], [-17.7, 0.25, -17.7], [10, 0.25, 28], [-28, 0.25, -10], [28, 0.25, 10], [-10, 0.25, -28]],
    theme: {
      sky: [0x4d8fe0, 0xffdcb8], fog: 0xf2dcc4, sun: [0xffe2b8, 2.6], hemi: [0xe6f0ff, 0x7a6a58, 1.3], wallHeight: 7,
      skyline: [0xd9a38c, 0xa9bcd6, 0xe8cf9a, 0xb7a3c9, 0x9fc0a8],
      colors: {
        ...common, floor: 0x59616d, wall: 0xa0604e, walk: 0xc5c9cf, paint: 0xf5f3ea,
        bldg1: 0xe9b6a2, bldg2: 0x9fc3e6, bldg3: 0xf1d98c, hedge: 0x4f9a4a, trunk: 0x7a5230, leaves: 0x5cb85c,
        car1: 0xd9483b, car2: 0x3b6fd9, car3: 0xf2c14e, dumpster: 0x3f7f5a, glass: 0x9fd7ff,
      },
    },
  },
  {
    id: 'warehouse', name: 'WAREHOUSE', unlock: { mode: 'survival', d: 'normal', n: 5 }, build: warehouse,
    spawn: { x: 0, z: -27, yaw: Math.PI },
    ammo: [[-19, 0, -10], [-19, 0, 12], [-13, 0, 0], [0, 0, 0], [12, 0, -12], [26, 3, 0], [2.5, 2.6, -18],
      [-22, 0, 24], [14, 0, 22], [-8, 0, -27], [18, 0, 5], [5, 0, 12]],
    theme: {
      sky: [0x2e3a6b, 0xf6a45c], fog: 0xe0a877, sun: [0xffb070, 2.1], hemi: [0xffd9b0, 0x5a4a3a, 1.25], wallHeight: 8,
      skyline: [0x5a4a6a, 0x6a5a7a, 0x7a5a6a, 0x4a4a6a, 0x6a6a8a],
      colors: {
        ...common, floor: 0x8f959c, wall: 0x6e6259, rack: 0x3d6fb6, cont1: 0xc0392b, cont2: 0x2e8b57,
        cont3: 0x2c6fbb, metal: 0x7b8591, rail: 0xf2b134, forklift: 0xf2c14e, office: 0xd8d2c4,
      },
    },
  },
  {
    id: 'rooftops', name: 'ROOFTOPS', feature: 'Jump pads', unlock: { mode: 'duel', d: 'hard', n: 10 }, build: rooftops,
    spawn: { x: -20, y: 6, z: -20, yaw: Math.atan2(-20, -20) },
    ammo: [[-17, 6, -17], [17, 6, 17], [0, 9, 0], [20, 6, -23], [-20, 6, 23], [-10, 0, 3], [10, 0, -3],
      [3, 0, -10], [-3, 0, 10], [-28, 0, -8], [28, 0, 8], [0, 6, -23], [0, 6, 23]],
    theme: {
      sky: [0x2f7fe6, 0xd2ebff], fog: 0xd6e9ff, sun: [0xffffff, 2.6], hemi: [0xe0efff, 0x6a6a70, 1.35], wallHeight: 14,
      skyline: [0xb8c4d8, 0xa7b4c9, 0xc9d2e0, 0x98a6bd, 0xd5dbe6],
      colors: {
        ...common, floor: 0x656b75, wall: 0x8c96a8, roof: 0xcdc4b4, roof2: 0xb7bfcb, parapet: 0x9aa3ad, ac: 0xdfe3e8,
        tank: 0x8b5a3c, glass: 0x9fd7ff, bridge: 0x9a6b3c, stair: 0x9aa3ad, dumpster: 0x3f7f5a,
      },
    },
  },
  {
    id: 'canyon', name: 'CANYON', feature: 'Teleporters', unlock: { mode: 'survival', d: 'hard', n: 5 }, build: canyon,
    spawn: { x: 0, z: -24, yaw: Math.PI },
    ammo: [[0, 0, -16], [0, 0, 18], [-7, 0, 0], [7, 0, 2], [-12, 3, -8], [12, 3, 8], [-22, 6, -12], [22, 6, 12],
      [-22, 6, 22], [22, 6, -22], [0, 6, 0]],
    theme: {
      sky: [0x3a6fd0, 0xffc98a], fog: 0xf0c090, sun: [0xffd2a0, 2.5], hemi: [0xffe8c8, 0x8a5a3a, 1.3], wallHeight: 9,
      skyline: [0xc98a5a, 0xb0704a, 0xd9a070, 0xa06040, 0xe0b080],
      colors: {
        ...common, floor: 0xdcb47e, wall: 0xb0663e, cliff: 0xc27b4b, ledge: 0xd08c5a, rock: 0xa9653d, rock2: 0x8f5536,
        bridge: 0x7a5230, cactus: 0x5a9a4a,
      },
    },
  },
  {
    id: 'fort', name: 'FORT', feature: 'Power-ups', unlock: { mode: 'duel', d: 'extreme', n: 10 }, build: fort,
    spawn: { x: 0, z: -26, yaw: Math.PI },
    ammo: [[0, 0, -20], [0, 0, 20], [-20, 0, 0], [20, 0, 0], [-7, 4, 11], [7, 4, -11], [-6, 0, 6], [6, 0, -6],
      [-24, 0, -24], [24, 0, 24]],
    theme: {
      sky: [0x3d9cf0, 0xdff4ff], fog: 0xd8efe0, sun: [0xfff4e0, 2.5], hemi: [0xe6f5ff, 0x5a7a3a, 1.35], wallHeight: 3,
      skyline: [0x6aa05a, 0x7fb06a, 0x5a8a4a, 0x8fbf7a, 0x9ac08a],
      colors: {
        ...common, floor: 0x6aa84f, wall: 0x7c8a5e, stone: 0xaaa597, stone2: 0x8f8a7e, wood: 0x8b5a2b, roof: 0xb0452f,
        hay: 0xe8c860, trunk: 0x7a5230, leaves: 0x4f9a3a, rock: 0x8a8a8a, fence: 0x9a6b3c,
      },
    },
  },
  {
    id: 'nightcity', name: 'NIGHT CITY', feature: 'Night, teleporters and jump pads', unlock: { mode: 'survival', d: 'extreme', n: 5 }, build: nightcity,
    spawn: { x: 0, z: -13.5, yaw: Math.PI },
    ammo: [[0, 0, -10], [0, 0, 8], [-10, 0, -2], [10, 0, -2], [0, 4, 21], [-16, 4, 21], [20, 0, 26], [-20, 0, 26],
      [-27, 0, -20], [27, 0, 20], [-5, 0, -27], [6, 0, -27]],
    theme: {
      sky: [0x05081a, 0x1c2350], fog: 0x121633, fogRange: [35, 150], sun: [0x8fa8ff, 0.55], hemi: [0x5566aa, 0x1a1a2a, 0.5],
      wallHeight: 10, glowEyes: true,
      skyline: [0x1a1f3a, 0x241c3a, 0x16263a, 0x2a2244, 0x1c2a44],
      colors: {
        ...common, floor: 0x2a2d38, wall: 0x2b2f45, bldgA: 0x3a3f5a, bldgB: 0x4a3a55, bldgC: 0x2f4a55, walk: 0x4a4f5e,
        rail: 0x5a5f70, lamp: 0x333844, dumpster: 0x2f5a44,
        neonPink: 0xff3fa4, neonCyan: 0x3ff0ff, neonYellow: 0xffe14a, neonGreen: 0x5dff7a, neonWindow: 0xffe9a8,
      },
    },
  },
];

export const mapById = id => MAPS.find(m => m.id === id) || MAPS[0];

// Progress towards a map: { have, need, open }. stats = { duel: { normal: 3, ... }, surv: { ... } }
export function progress(map, stats) {
  if (!map.unlock) return { have: 0, need: 0, open: true };
  const { mode, d, n } = map.unlock;
  const have = (mode === 'duel' ? stats?.duel?.[d] : stats?.surv?.[d]) || 0;
  return { have: Math.min(have, n), need: n, open: have >= n };
}

export function unlockText(map) {
  const { mode, d, n } = map.unlock;
  return mode === 'duel' ? `Win ${n} duels on ${d.toUpperCase()}` : `Survive ${n} waves on ${d.toUpperCase()}`;
}
