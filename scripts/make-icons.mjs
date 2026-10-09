// Erzeugt die PNG-Icons aus public/icon.svg:  node scripts/make-icons.mjs
import sharp from 'sharp'
import { readFileSync } from 'node:fs'

const svg = readFileSync('public/icon.svg')
const out = (name, size, pad = 0) =>
  sharp(svg, { density: 384 })
    .resize(size - pad * 2, size - pad * 2)
    .extend({ top: pad, bottom: pad, left: pad, right: pad, background: '#16a34a' })
    .png()
    .toFile(`public/${name}`)

await out('icon-192.png', 192)
await out('icon-512.png', 512)
await out('icon-maskable-512.png', 512, 64) // Safe-Zone für maskable
await out('apple-touch-icon.png', 180)
console.log('Icons erzeugt')
