const express = require('express');
const session = require('express-session');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'crownps2026jayakarta';

const DATA_DIR = path.join(__dirname, 'data');
const PLAYERS_FILE = path.join(DATA_DIR, 'players.json');
const RESOURCES_FILE = path.join(DATA_DIR, 'resources.json');
const ADMINS_FILE = path.join(DATA_DIR, 'admins.json');
const UPLOAD_DIR = path.join(__dirname, 'public', 'uploads');
const VIEWS_DIR = path.join(__dirname, 'views');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
if (!fs.existsSync(PLAYERS_FILE)) fs.writeFileSync(PLAYERS_FILE, '[]');
if (!fs.existsSync(RESOURCES_FILE)) fs.writeFileSync(RESOURCES_FILE, '[]');
if (!fs.existsSync(ADMINS_FILE)) {
  // nick admin pertama (owner) sudah di-approve dari awal, biar bisa langsung login
  const seed = [{
    id: crypto.randomUUID(),
    username: 'reysenoor',
    email: '',
    whatsapp: '',
    status: 'approved'
  }];
  fs.writeFileSync(ADMINS_FILE, JSON.stringify(seed, null, 2));
}

function readJSON(file) { return JSON.parse(fs.readFileSync(file, 'utf-8')); }
function writeJSON(file, data) { fs.writeFileSync(file, JSON.stringify(data, null, 2)); }

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'crownps-ganti-secret-ini-di-railway',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 } // 7 hari
}));

// file publik (register/login/admin-login page + gambar upload)
app.use(express.static(path.join(__dirname, 'public')));

// ---------- multer (upload resource) ----------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + '-' + Math.round(Math.random() * 1e9) + ext);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 }, // maks 8MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|svg/;
    const ok = allowed.test(path.extname(file.originalname).toLowerCase());
    cb(ok ? null : new Error('Tipe file tidak didukung'), ok);
  }
});

// ---------- middleware auth ----------
function requirePlayer(req, res, next) {
  if (req.session.player) return next();
  return res.redirect('/login');
}
function requireAdmin(req, res, next) {
  if (req.session.admin) return next();
  return res.redirect('/admin-login');
}

// ---------- halaman ----------
app.get('/', (req, res) => {
  if (req.session.player) return res.redirect('/dashboard');
  return res.redirect('/register');
});
app.get('/register', (req, res) => {
  if (req.session.player) return res.redirect('/dashboard');
  res.sendFile(path.join(__dirname, 'public', 'register.html'));
});
app.get('/login', (req, res) => {
  if (req.session.player) return res.redirect('/dashboard');
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});
app.get('/admin-login', (req, res) => {
  if (req.session.admin) return res.redirect('/admin');
  res.sendFile(path.join(__dirname, 'public', 'admin-login.html'));
});
app.get('/dashboard', requirePlayer, (req, res) => res.sendFile(path.join(VIEWS_DIR, 'dashboard.html')));
app.get('/admin', requireAdmin, (req, res) => res.sendFile(path.join(VIEWS_DIR, 'admin.html')));

// ---------- API: player ----------
app.post('/api/register', async (req, res) => {
  const { growId, email, number, password, referral } = req.body;
  if (!growId || !email || !number || !password) {
    return res.status(400).json({ error: 'Grow ID, Email, Number, dan Password wajib diisi.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password minimal 6 karakter.' });
  }
  const players = readJSON(PLAYERS_FILE);
  if (players.find(p => p.growId.toLowerCase() === growId.toLowerCase())) {
    return res.status(409).json({ error: 'Grow ID sudah terdaftar. Coba login.' });
  }
  const hashed = await bcrypt.hash(password, 10);
  const player = {
    id: crypto.randomUUID(),
    growId, email, number,
    password: hashed,
    referral: referral || null,
    saldo: 0, coin: 0, ticket: 0, level: 1, xp: 0,
    createdAt: new Date().toISOString()
  };
  players.push(player);
  writeJSON(PLAYERS_FILE, players);
  req.session.player = { id: player.id, growId: player.growId };
  res.json({ ok: true, redirect: '/dashboard' });
});

app.post('/api/login', async (req, res) => {
  const { growId, password } = req.body;
  const players = readJSON(PLAYERS_FILE);
  const player = players.find(p => p.growId.toLowerCase() === (growId || '').toLowerCase());
  if (!player || !(await bcrypt.compare(password || '', player.password))) {
    return res.status(401).json({ error: 'Grow ID atau password salah.' });
  }
  req.session.player = { id: player.id, growId: player.growId };
  res.json({ ok: true, redirect: '/dashboard' });
});

app.get('/api/me', requirePlayer, (req, res) => {
  const players = readJSON(PLAYERS_FILE);
  const player = players.find(p => p.id === req.session.player.id);
  if (!player) return res.status(404).json({ error: 'Player tidak ditemukan.' });
  const { password, ...safe } = player;
  res.json(safe);
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true, redirect: '/login' }));
});

// ---------- API: admin ----------
app.post('/api/admin-login', (req, res) => {
  const { namaAdmin, token } = req.body;
  if (!namaAdmin || !token) {
    return res.status(400).json({ error: 'Nama admin dan token wajib diisi.' });
  }
  if (token !== ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Token salah.' });
  }
  const admins = readJSON(ADMINS_FILE);
  const admin = admins.find(a => a.username.toLowerCase() === namaAdmin.toLowerCase() && a.status === 'approved');
  if (!admin) {
    return res.status(401).json({ error: 'Nick admin belum terdaftar atau belum di-approve. Minta owner menambahkan lewat Team Members.' });
  }
  req.session.admin = { name: admin.username };
  res.json({ ok: true, redirect: '/admin' });
});

// ---------- API: team members (yang berhak dapat nick admin) ----------
app.get('/api/team', requireAdmin, (req, res) => {
  res.json(readJSON(ADMINS_FILE));
});

app.post('/api/team', requireAdmin, (req, res) => {
  const { username, email, whatsapp } = req.body;
  if (!username) return res.status(400).json({ error: 'Username wajib diisi.' });
  const admins = readJSON(ADMINS_FILE);
  if (admins.find(a => a.username.toLowerCase() === username.toLowerCase())) {
    return res.status(409).json({ error: 'Username sudah ada di daftar team.' });
  }
  const entry = {
    id: crypto.randomUUID(),
    username, email: email || '', whatsapp: whatsapp || '',
    status: 'pending'
  };
  admins.push(entry);
  writeJSON(ADMINS_FILE, admins);
  res.json(entry);
});

app.post('/api/team/:id/:action', requireAdmin, (req, res) => {
  const { id, action } = req.params;
  if (!['approve', 'reject'].includes(action)) return res.status(400).json({ error: 'Aksi tidak dikenal.' });
  const admins = readJSON(ADMINS_FILE);
  const entry = admins.find(a => a.id === id);
  if (!entry) return res.status(404).json({ error: 'Tidak ditemukan.' });
  entry.status = action === 'approve' ? 'approved' : 'rejected';
  writeJSON(ADMINS_FILE, admins);
  res.json(entry);
});

app.post('/api/admin-logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true, redirect: '/admin-login' }));
});

app.get('/api/admin-me', requireAdmin, (req, res) => {
  res.json(req.session.admin);
});

// ---------- API: resource manager (upload gambar/file asli) ----------
app.get('/api/resources', requireAdmin, (req, res) => {
  res.json(readJSON(RESOURCES_FILE));
});

app.post('/api/resources', requireAdmin, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'File tidak ditemukan.' });
  const resources = readJSON(RESOURCES_FILE);
  const item = {
    id: crypto.randomUUID(),
    name: req.file.originalname,
    type: req.body.type || 'File',
    url: '/uploads/' + req.file.filename,
    size: req.file.size,
    uploadedBy: req.session.admin.name,
    uploadedAt: new Date().toISOString()
  };
  resources.push(item);
  writeJSON(RESOURCES_FILE, resources);
  res.json(item);
});

app.delete('/api/resources/:id', requireAdmin, (req, res) => {
  const resources = readJSON(RESOURCES_FILE);
  const item = resources.find(r => r.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Tidak ditemukan.' });
  const filePath = path.join(UPLOAD_DIR, path.basename(item.url));
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  writeJSON(RESOURCES_FILE, resources.filter(r => r.id !== req.params.id));
  res.json({ ok: true });
});

app.listen(PORT, () => console.log(`CROWNPS server jalan di port ${PORT}`));
