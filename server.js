// server.js – Finanz-App Server (JSON Speicher, kein SQLite)
// Funktioniert auf Render kostenlos!

const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT    = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'data.json');

function loadDB() {
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
  catch { return { transactions: [], fixkosten: [], settings: {} }; }
}

function saveDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

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

function newId() {
  return Date.now().toString() + Math.random().toString(36).slice(2, 6);
}

const server = http.createServer(async (req, res) => {
  const url    = req.url.split('?')[0];
  const method = req.method;

  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end(); return;
  }

  const db = loadDB();

  // Transactions
  if (url === '/api/transactions' && method === 'GET') {
    return sendJSON(res, [...db.transactions].sort((a,b) => b.date.localeCompare(a.date)));
  }
  if (url === '/api/transactions' && method === 'POST') {
    const b = await getBody(req);
    if (!b.name || !b.amount || !b.date || !b.type) return sendJSON(res, { error: 'Fehlende Felder' }, 400);
    const entry = { id: newId(), name: b.name, amount: b.amount, cat: b.cat||'Sonstiges', date: b.date, type: b.type };
    db.transactions.push(entry);
    saveDB(db);
    return sendJSON(res, entry, 201);
  }
  const delTx = url.match(/^\/api\/transactions\/(.+)$/);
  if (delTx && method === 'DELETE') {
    db.transactions = db.transactions.filter(t => t.id !== delTx[1]);
    saveDB(db); return sendJSON(res, { success: true });
  }

  // Fixkosten
  if (url === '/api/fixkosten' && method === 'GET') {
    return sendJSON(res, [...db.fixkosten].sort((a,b) => a.day - b.day));
  }
  if (url === '/api/fixkosten' && method === 'POST') {
    const b = await getBody(req);
    if (!b.name || !b.amount) return sendJSON(res, { error: 'Fehlende Felder' }, 400);
    const entry = { id: newId(), name: b.name, amount: b.amount, cat: b.cat||'Sonstiges', day: b.day||1 };
    db.fixkosten.push(entry);
    saveDB(db); return sendJSON(res, entry, 201);
  }
  const delFix = url.match(/^\/api\/fixkosten\/(.+)$/);
  if (delFix && method === 'DELETE') {
    db.fixkosten = db.fixkosten.filter(f => f.id !== delFix[1]);
    saveDB(db); return sendJSON(res, { success: true });
  }

  // Settings
  if (url === '/api/settings' && method === 'GET') return sendJSON(res, db.settings);
  if (url === '/api/settings' && method === 'POST') {
    const b = await getBody(req);
    Object.assign(db.settings, b);
    saveDB(db); return sendJSON(res, { success: true });
  }

  // Statische Dateien
  serveFile(res, path.join(__dirname, url === '/' ? 'index.html' : url));
});

server.listen(PORT, () => console.log(`✅ Finanz-Server läuft auf Port ${PORT}`));
