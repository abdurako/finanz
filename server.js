// server.js – Finanz-App Server mit Datenbank
// Starte mit: node server.js

const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// SQLite installieren falls nicht vorhanden
try {
  require('better-sqlite3');
} catch {
  console.log('📦 Installiere Datenbank...');
  execSync('npm install better-sqlite3', { stdio: 'inherit' });
}

const Database = require('better-sqlite3');
const db = new Database('finanzen.db');

// Tabellen erstellen
db.exec(`
  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    amount REAL NOT NULL,
    cat TEXT DEFAULT 'Sonstiges',
    date TEXT NOT NULL,
    type TEXT NOT NULL,
    createdAt TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS fixkosten (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    amount REAL NOT NULL,
    cat TEXT DEFAULT 'Sonstiges',
    day INTEGER DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

const PORT = process.env.PORT || 3000;

function sendJSON(res, data, status = 200) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
}

function serveFile(res, filePath) {
  const ext = path.extname(filePath);
  const types = {
    '.html': 'text/html; charset=utf-8',
    '.js':   'application/javascript',
    '.json': 'application/json',
    '.png':  'image/png',
    '.ico':  'image/x-icon',
  };
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Nicht gefunden'); return; }
    res.writeHead(200, { 'Content-Type': types[ext] || 'text/plain' });
    res.end(data);
  });
}

function getBody(req) {
  return new Promise(resolve => {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => { try { resolve(JSON.parse(body)); } catch { resolve({}); } });
  });
}

const server = http.createServer(async (req, res) => {
  const url = req.url.split('?')[0];
  const method = req.method;

  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end(); return;
  }

  // ── Transactions ──
  if (url === '/api/transactions' && method === 'GET') {
    const rows = db.prepare('SELECT * FROM transactions ORDER BY date DESC, createdAt DESC').all();
    return sendJSON(res, rows);
  }

  if (url === '/api/transactions' && method === 'POST') {
    const b = await getBody(req);
    if (!b.name || !b.amount || !b.date || !b.type) return sendJSON(res, { error: 'Fehlende Felder' }, 400);
    const id = Date.now().toString() + Math.random().toString(36).slice(2,6);
    db.prepare('INSERT INTO transactions (id,name,amount,cat,date,type) VALUES (?,?,?,?,?,?)')
      .run(id, b.name, b.amount, b.cat||'Sonstiges', b.date, b.type);
    return sendJSON(res, { id, ...b }, 201);
  }

  const delTx = url.match(/^\/api\/transactions\/(.+)$/);
  if (delTx && method === 'DELETE') {
    db.prepare('DELETE FROM transactions WHERE id=?').run(delTx[1]);
    return sendJSON(res, { success: true });
  }

  // ── Fixkosten ──
  if (url === '/api/fixkosten' && method === 'GET') {
    return sendJSON(res, db.prepare('SELECT * FROM fixkosten ORDER BY day ASC').all());
  }

  if (url === '/api/fixkosten' && method === 'POST') {
    const b = await getBody(req);
    if (!b.name || !b.amount) return sendJSON(res, { error: 'Fehlende Felder' }, 400);
    const id = Date.now().toString() + Math.random().toString(36).slice(2,6);
    db.prepare('INSERT INTO fixkosten (id,name,amount,cat,day) VALUES (?,?,?,?,?)')
      .run(id, b.name, b.amount, b.cat||'Sonstiges', b.day||1);
    return sendJSON(res, { id, ...b }, 201);
  }

  const delFix = url.match(/^\/api\/fixkosten\/(.+)$/);
  if (delFix && method === 'DELETE') {
    db.prepare('DELETE FROM fixkosten WHERE id=?').run(delFix[1]);
    return sendJSON(res, { success: true });
  }

  // ── Settings ──
  if (url === '/api/settings' && method === 'GET') {
    const rows = db.prepare('SELECT key, value FROM settings').all();
    const obj = {};
    rows.forEach(r => obj[r.key] = r.value);
    return sendJSON(res, obj);
  }

  if (url === '/api/settings' && method === 'POST') {
    const b = await getBody(req);
    const stmt = db.prepare('INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)');
    Object.entries(b).forEach(([k,v]) => stmt.run(k, String(v)));
    return sendJSON(res, { success: true });
  }

  // ── Static files ──
  serveFile(res, path.join(__dirname, url === '/' ? 'index.html' : url));
});

server.listen(PORT, () => {
  console.log(`\n✅ Finanz-Server läuft auf http://localhost:${PORT}`);
  console.log(`📱 iPhone: http://DEINE-IP:${PORT} in Safari öffnen`);
  console.log(`   IP findest du unter: Einstellungen → WLAN → dein Netz\n`);
});
