// Local server: serves site/ and the leaderboard API, storing data in .netlify/local-scores.json.
// Used by play.command so the local copy works like the live site (with its own separate board).
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handle } from './core.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const site = join(root, 'site');
const dataFile = join(root, '.netlify', 'local-scores.json');
const PORT = Number(process.env.PORT) || 8765;

let data = {};
try { data = JSON.parse(await readFile(dataFile, 'utf8')); } catch {}
const persist = async () => { await mkdir(dirname(dataFile), { recursive: true }); await writeFile(dataFile, JSON.stringify(data)); };

// Same methods the API uses on a Netlify Blobs store
const store = {
  async get(k) { return data[k] ? structuredClone(data[k]) : null; },
  async setJSON(k, v) { data[k] = structuredClone(v); await persist(); },
  async list({ prefix }) { return { blobs: Object.keys(data).filter(k => k.startsWith(prefix)).map(key => ({ key })) }; },
};

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname.startsWith('/api/')) {
    const body = ['GET', 'HEAD'].includes(req.method) ? undefined : await new Promise(r => {
      const chunks = []; req.on('data', c => chunks.push(c)); req.on('end', () => r(Buffer.concat(chunks)));
    });
    const out = await handle(new Request(url, { method: req.method, headers: req.headers, body }), store);
    res.writeHead(out.status, Object.fromEntries(out.headers));
    res.end(await out.text());
    return;
  }
  const path = normalize(join(site, url.pathname.endsWith('/') ? url.pathname + 'index.html' : url.pathname));
  if (!path.startsWith(site)) { res.writeHead(403).end(); return; }
  try {
    const file = await readFile(path);
    res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'application/octet-stream' });
    res.end(file);
  } catch {
    res.writeHead(404).end('Not found');
  }
}).listen(PORT, () => console.log(`Block Strike on http://localhost:${PORT}`));
