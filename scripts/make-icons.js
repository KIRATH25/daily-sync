// Generates Daily Sync app icons as PNGs with signed-distance rendering and
// 4x4 supersampling. Usage: node make-icons.js <assetsDir>
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const out = process.argv[2];
const GOLD = [244, 213, 77];
const GOLD_SOFT = [249, 233, 156];
const BG = [12, 13, 15];

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, rgba) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// Geometry in a unit space where the emblem spans roughly [-1, 1].
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}
const ARC_R = 0.78, ARC_W = 0.16;
const GAP_START = (-62 * Math.PI) / 180; // gap centred near the top-right
const GAP_END = (-18 * Math.PI) / 180;
const DOT = [Math.cos((-40 * Math.PI) / 180) * ARC_R, Math.sin((-40 * Math.PI) / 180) * ARC_R];

function shapes(x, y) {
  // returns { gold: bool, soft: bool }
  const a = Math.atan2(y, x);
  const r = Math.hypot(x, y);
  let inArc = false;
  const inGap = a > GAP_START && a < GAP_END;
  if (!inGap && Math.abs(r - ARC_R) <= ARC_W / 2) inArc = true;
  // round caps
  for (const ang of [GAP_START, GAP_END]) {
    const cx = Math.cos(ang) * ARC_R, cy = Math.sin(ang) * ARC_R;
    if (Math.hypot(x - cx, y - cy) <= ARC_W / 2) inArc = true;
  }
  const dot = Math.hypot(x - DOT[0], y - DOT[1]) <= 0.1;
  const outerRing = Math.abs(r - 0.96) <= 0.012;
  // check mark
  const cw = 0.13;
  const check = segDist(x, y, -0.36, 0.02, -0.1, 0.28) <= cw / 2 || segDist(x, y, -0.1, 0.28, 0.4, -0.24) <= cw / 2;
  return { gold: inArc || check || dot, soft: outerRing };
}

function render(size, { background, scale, mono }) {
  const buf = Buffer.alloc(size * size * 4);
  const SS = 4;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let gold = 0, soft = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = (((px + (sx + 0.5) / SS) / size) * 2 - 1) / scale;
          const y = (((py + (sy + 0.5) / SS) / size) * 2 - 1) / scale;
          const s = shapes(x, y);
          if (s.gold) gold++;
          else if (s.soft) soft++;
        }
      }
      gold /= SS * SS; soft /= SS * SS;
      const i = (py * size + px) * 4;
      if (mono) {
        const a = Math.min(1, gold + soft * 0.6);
        buf[i] = 255; buf[i + 1] = 255; buf[i + 2] = 255; buf[i + 3] = Math.round(a * 255);
        continue;
      }
      const softA = soft * 0.45;
      if (background) {
        let r = BG[0], g = BG[1], b = BG[2];
        // subtle radial warm glow
        const dx = px / size - 0.5, dy = py / size - 0.5;
        const glow = Math.max(0, 0.16 - Math.hypot(dx, dy) * 0.3);
        r += (GOLD[0] - r) * glow; g += (GOLD[1] - g) * glow; b += (GOLD[2] - b) * glow;
        r += (GOLD_SOFT[0] - r) * softA; g += (GOLD_SOFT[1] - g) * softA; b += (GOLD_SOFT[2] - b) * softA;
        r += (GOLD[0] - r) * gold; g += (GOLD[1] - g) * gold; b += (GOLD[2] - b) * gold;
        buf[i] = Math.round(r); buf[i + 1] = Math.round(g); buf[i + 2] = Math.round(b); buf[i + 3] = 255;
      } else {
        const a = Math.min(1, gold + softA);
        const mixGold = a > 0 ? gold / a : 0;
        buf[i] = Math.round(GOLD_SOFT[0] + (GOLD[0] - GOLD_SOFT[0]) * mixGold);
        buf[i + 1] = Math.round(GOLD_SOFT[1] + (GOLD[1] - GOLD_SOFT[1]) * mixGold);
        buf[i + 2] = Math.round(GOLD_SOFT[2] + (GOLD[2] - GOLD_SOFT[2]) * mixGold);
        buf[i + 3] = Math.round(a * 255);
      }
    }
  }
  return png(size, buf);
}

const jobs = process.argv[3] === 'pwa' ? [
  ['apple-touch-icon.png', 180, { background: true, scale: 0.62 }],
  ['icon-192.png', 192, { background: true, scale: 0.62 }],
  ['icon-512.png', 512, { background: true, scale: 0.62 }],
  ['icon-maskable-512.png', 512, { background: true, scale: 0.48 }],
] : [
  ['icon.png', 1024, { background: true, scale: 0.62 }],
  ['android-icon-foreground.png', 1024, { background: false, scale: 0.42 }],
  ['android-icon-monochrome.png', 1024, { background: false, scale: 0.42, mono: true }],
  ['splash-icon.png', 512, { background: false, scale: 0.9 }],
  ['favicon.png', 48, { background: true, scale: 0.7 }],
];
for (const [name, size, opts] of jobs) {
  fs.writeFileSync(path.join(out, name), render(size, opts));
  console.log('wrote', name);
}
