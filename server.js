const path = require('path');
const fs = require('fs');
const http = require('http');
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const multer = require('multer');
const { Server } = require('socket.io');
const Database = require('better-sqlite3');

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 3000);
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'bitte-aendern';
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-only-change-this-session-secret';
const uploadDir = path.join(ROOT, 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });
const db = new Database(path.join(ROOT, 'terminboard.sqlite'));
db.pragma('journal_mode = WAL');
db.exec(`CREATE TABLE IF NOT EXISTS events (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 title TEXT NOT NULL,
 description TEXT DEFAULT '',
 date TEXT NOT NULL,
 time TEXT NOT NULL DEFAULT '00:00',
 recurring INTEGER NOT NULL DEFAULT 0,
 image TEXT DEFAULT '',
 end_action TEXT NOT NULL DEFAULT 'none',
 end_message TEXT DEFAULT '',
 active INTEGER NOT NULL DEFAULT 1,
 last_triggered TEXT DEFAULT '',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);`);
const getSetting = db.prepare('SELECT value FROM settings WHERE key=?');
const setSetting = db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
if (!getSetting.get('board_title')) setSetting.run('board_title', 'TERMINBOARD');
if (!getSetting.get('board_subtitle')) setSetting.run('board_subtitle', 'Alle wichtigen Termine im Blick');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(session({ secret: SESSION_SECRET, resave: false, saveUninitialized: false, cookie: { httpOnly: true, sameSite: 'lax', secure: false, maxAge: 8 * 60 * 60 * 1000 } }));
app.use('/uploads', express.static(uploadDir, { maxAge: '1d' }));
app.use(express.static(path.join(ROOT, 'public')));
app.get('/admin', (_, res) => res.sendFile(path.join(ROOT, 'public', 'admin.html')));
const storage = multer.diskStorage({
 destination: (_, __, cb) => cb(null, uploadDir),
 filename: (_, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${path.extname(file.originalname).toLowerCase()}`)
});
const upload = multer({ storage, limits: { fileSize: 8 * 1024 * 1024 }, fileFilter: (_, file, cb) => cb(null, /^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) });
const requireAdmin = (req, res, next) => req.session && req.session.isAdmin ? next() : res.status(401).json({ error: 'Bitte zuerst anmelden.' });

function nextOccurrence(event, now = new Date()) {
  const [year, month, day] = event.date.split('-').map(Number);
  const [hour, minute] = (event.time || '00:00').split(':').map(Number);
  const make = y => new Date(y, month - 1, day, hour || 0, minute || 0, 0, 0);
  if (!event.recurring) return make(year);
  let candidate = make(now.getFullYear());
  if (candidate <= now) candidate = make(now.getFullYear() + 1);
  // If a recurring date was entered with a year, month/day still repeat every year.
  return candidate;
}
function serializeEvent(row, now = new Date()) {
  const due = nextOccurrence(row, now);
  return { ...row, recurring: !!row.recurring, active: !!row.active, dueAt: due.toISOString(), remainingMs: due.getTime() - now.getTime() };
}
function allEvents() {
  const now = new Date();
  return db.prepare('SELECT * FROM events WHERE active=1').all().map(row => serializeEvent(row, now)).sort((a,b) => a.remainingMs - b.remainingMs);
}
function boardState() {
  return { events: allEvents(), settings: Object.fromEntries(db.prepare('SELECT key,value FROM settings').all().map(x => [x.key, x.value])), serverTime: new Date().toISOString() };
}
function broadcast() { io.emit('board:update', boardState()); }
app.get('/api/board', (_, res) => res.json(boardState()));
app.get('/api/admin/status', (req, res) => res.json({ authenticated: !!req.session.isAdmin }));
app.post('/api/admin/login', (req, res) => {
  const provided = String(req.body.password || '');
  const expected = String(ADMIN_PASSWORD);
  const a = Buffer.from(provided), b = Buffer.from(expected);
  if (a.length === b.length && crypto.timingSafeEqual(a,b)) { req.session.isAdmin = true; return res.json({ ok: true }); }
  res.status(401).json({ error: 'Passwort stimmt nicht.' });
});
app.post('/api/admin/logout', requireAdmin, (req, res) => req.session.destroy(() => res.json({ ok: true })));
app.get('/api/admin/events', requireAdmin, (_, res) => res.json(db.prepare('SELECT * FROM events ORDER BY id DESC').all()));
app.post('/api/admin/events', requireAdmin, upload.single('imageFile'), (req, res) => {
  const b = req.body;
  if (!String(b.title || '').trim() || !/^\d{4}-\d{2}-\d{2}$/.test(b.date || '') || !/^\d{2}:\d{2}$/.test(b.time || '')) return res.status(400).json({ error: 'Bitte Titel, Datum und Uhrzeit korrekt ausfüllen.' });
  const recurring = b.recurring === 'true' || b.recurring === '1' || b.recurring === 'on';
  const image = req.file ? `/uploads/${req.file.filename}` : (b.image || '');
  const result = db.prepare(`INSERT INTO events(title,description,date,time,recurring,image,end_action,end_message,active) VALUES(?,?,?,?,?,?,?,?,1)`)
    .run(String(b.title).trim(), String(b.description || '').trim(), b.date, b.time, recurring ? 1 : 0, image, ['none','message','hide','sound','page'].includes(b.endAction) ? b.endAction : 'none', String(b.endMessage || '').trim());
  broadcast(); res.json({ ok: true, id: result.lastInsertRowid });
});
app.put('/api/admin/events/:id', requireAdmin, upload.single('imageFile'), (req, res) => {
  const b = req.body; const id = Number(req.params.id);
  const old = db.prepare('SELECT * FROM events WHERE id=?').get(id);
  if (!old) return res.status(404).json({ error: 'Termin nicht gefunden.' });
  if (!String(b.title || '').trim() || !/^\d{4}-\d{2}-\d{2}$/.test(b.date || '') || !/^\d{2}:\d{2}$/.test(b.time || '')) return res.status(400).json({ error: 'Bitte Titel, Datum und Uhrzeit korrekt ausfüllen.' });
  const recurring = b.recurring === 'true' || b.recurring === '1' || b.recurring === 'on';
  const image = req.file ? `/uploads/${req.file.filename}` : (b.removeImage === 'true' ? '' : (b.image !== undefined ? b.image : old.image));
  db.prepare(`UPDATE events SET title=?,description=?,date=?,time=?,recurring=?,image=?,end_action=?,end_message=?,last_triggered='' WHERE id=?`)
    .run(String(b.title).trim(), String(b.description || '').trim(), b.date, b.time, recurring ? 1 : 0, image, ['none','message','hide','sound','page'].includes(b.endAction) ? b.endAction : 'none', String(b.endMessage || '').trim(), id);
  broadcast(); res.json({ ok: true });
});
app.delete('/api/admin/events/:id', requireAdmin, (req, res) => {
  const row = db.prepare('SELECT image FROM events WHERE id=?').get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'Termin nicht gefunden.' });
  db.prepare('DELETE FROM events WHERE id=?').run(Number(req.params.id));
  if (row.image && row.image.startsWith('/uploads/')) fs.unlink(path.join(uploadDir, path.basename(row.image)), () => {});
  broadcast(); res.json({ ok: true });
});
app.post('/api/admin/settings', requireAdmin, (req, res) => {
  setSetting.run('board_title', String(req.body.title || 'TERMINBOARD').slice(0,80));
  setSetting.run('board_subtitle', String(req.body.subtitle || '').slice(0,160));
  broadcast(); res.json({ ok: true });
});
app.post('/api/admin/upload', requireAdmin, upload.single('imageFile'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Bitte eine JPG-, PNG-, WEBP- oder GIF-Datei bis 8 MB auswählen.' });
  res.json({ url: `/uploads/${req.file.filename}` });
});

// The server keeps checking deadlines even when no browser is open.
setInterval(() => {
  const now = new Date();
  const rows = db.prepare('SELECT * FROM events WHERE active=1').all();
  for (const row of rows) {
    const due = nextOccurrence(row, new Date(now.getTime() - 1100));
    if (due <= now && row.last_triggered !== due.toISOString()) {
      const payload = { id: row.id, title: row.title, action: row.end_action, message: row.end_message, image: row.image, occurredAt: now.toISOString() };
      io.emit('event:expired', payload);
      db.prepare('UPDATE events SET last_triggered=? WHERE id=?').run(due.toISOString(), row.id);
      // One-time events are removed from the live board; recurring dates stay and reset next year.
      if (!row.recurring || row.end_action === 'hide') db.prepare('UPDATE events SET active=0 WHERE id=?').run(row.id);
      broadcast();
    }
  }
}, 1000);
io.on('connection', socket => { socket.emit('board:update', boardState()); });
server.listen(PORT, '0.0.0.0', () => console.log(`Terminboard läuft: http://localhost:${PORT} | Admin: http://localhost:${PORT}/admin`));
