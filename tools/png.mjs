// PNG in and out, and the box filter between them. No dependencies.
//
// Shared by tools/art.mjs and tools/gen-icons.mjs, which both used to carry
// their own copy of the encoder. One copy, because two drift and a silent
// difference between them is an icon that does not match the artwork.

import { deflateSync, inflateSync } from 'node:zlib';

const crcTable = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

export function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

export function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** RGBA8 out of a PNG. Only what a design tool exports: 8-bit truecolour with
 *  or without alpha, no interlacing, no palette. Anything else says so. */
export function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let width = 0;
  let height = 0;
  let colour = 0;
  const idat = [];
  let i = 8;
  while (i < buf.length) {
    const len = buf.readUInt32BE(i);
    const type = buf.toString('ascii', i + 4, i + 8);
    const data = buf.subarray(i + 8, i + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      if (data[8] !== 8) throw new Error(`${data[8]}-bit PNG: export 8-bit`);
      colour = data[9];
      if (colour !== 6 && colour !== 2) throw new Error('export RGB or RGBA, not palette or greyscale');
      if (data[12] !== 0) throw new Error('interlaced PNG: export without Adam7');
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
    i += len + 12;
  }

  const channels = colour === 6 ? 4 : 3;
  const stride = width * channels;
  const raw = inflateSync(Buffer.concat(idat));
  const out = Buffer.alloc(width * height * 4);

  // Undo the per-line filters. Each line names its own, and every one of them
  // refers back to the line above, so this has to run in order.
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? line[x - channels] : 0;
      const b = prev[x];
      const c = x >= channels ? prev[x - channels] : 0;
      if (filter === 1) line[x] = (line[x] + a) & 0xff;
      else if (filter === 2) line[x] = (line[x] + b) & 0xff;
      else if (filter === 3) line[x] = (line[x] + ((a + b) >> 1)) & 0xff;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        line[x] = (line[x] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 0xff;
      }
    }
    for (let x = 0; x < width; x++) {
      const s = x * channels;
      const d = (y * width + x) * 4;
      out[d] = line[s];
      out[d + 1] = line[s + 1];
      out[d + 2] = line[s + 2];
      out[d + 3] = channels === 4 ? line[s + 3] : 255;
    }
    prev = line;
  }
  return { width, height, rgba: out };
}

export function encodePng(size, rgba) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ---------------- resize ---------------- */

/** Box filter, premultiplied, padded to square.
 *
 *  Premultiplied: averaging straight RGBA drags the colour of fully transparent
 *  pixels into the edge, which is the halo you get around cut-out artwork
 *  downscaled naively.
 *
 *  Padded: one scale for both axes, centred, and outside the source reads as
 *  transparent. A 626x616 export is a square canvas with a little air at the
 *  sides, never a squashed cup. */
export function resize(src, sw, sh, size) {
  const out = Buffer.alloc(size * size * 4);
  const step = Math.max(sw, sh) / size;
  const offX = (sw - step * size) / 2;
  const offY = (sh - step * size) / 2;
  for (let y = 0; y < size; y++) {
    const y0 = Math.floor(offY + y * step);
    const y1 = Math.max(y0 + 1, Math.floor(offY + (y + 1) * step));
    for (let x = 0; x < size; x++) {
      const x0 = Math.floor(offX + x * step);
      const x1 = Math.max(x0 + 1, Math.floor(offX + (x + 1) * step));
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let n = 0;
      for (let sy = y0; sy < y1; sy++) {
        for (let sx = x0; sx < x1; sx++) {
          n++;
          if (sy < 0 || sy >= sh || sx < 0 || sx >= sw) continue;
          const i = (sy * sw + sx) * 4;
          const al = src[i + 3] / 255;
          r += src[i] * al;
          g += src[i + 1] * al;
          b += src[i + 2] * al;
          a += src[i + 3];
        }
      }
      const d = (y * size + x) * 4;
      const alpha = a / n;
      const un = alpha > 0 ? 255 / alpha : 0;
      out[d] = Math.min(255, Math.round((r / n) * un));
      out[d + 1] = Math.min(255, Math.round((g / n) * un));
      out[d + 2] = Math.min(255, Math.round((b / n) * un));
      out[d + 3] = Math.round(alpha);
    }
  }
  return out;
}
