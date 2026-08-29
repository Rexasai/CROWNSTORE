# CROWNPS

Situs CROWNPS dengan sistem registrasi/login player, login admin pakai token, dan
Resource Manager dengan upload gambar/file sungguhan. Siap push ke GitHub dan
deploy ke Railway.

## Struktur folder

```
crownps-site/
├── public/                  → file yang bisa diakses browser langsung
│   ├── register.html        → GET /register  (form daftar player)
│   ├── login.html           → GET /login      (form masuk player)
│   ├── admin-login.html     → GET /admin-login (form masuk admin)
│   └── uploads/             → tempat file hasil upload Resource Manager
├── views/                   → halaman yang dilindungi sesi login
│   ├── dashboard.html       → GET /dashboard  (Gacha Hall, hanya untuk player login)
│   └── admin.html           → GET /admin      (Admin Panel, hanya untuk admin login)
├── data/                    → "database" file JSON sederhana
│   ├── players.json
│   ├── admins.json          → daftar nick yang boleh login sebagai admin
│   └── resources.json
├── server.js                → Express: routing, sesi, auth, upload
├── package.json
└── .gitignore
```

## Alur pakai

**Player**
1. Buka `/register` → isi Grow ID, Email, Number, Password (bisa klik "🔐 Sandi
   kuat" untuk saran password kuat), Referral (opsional) → **REGISTRASI**.
2. Langsung diarahkan ke `/dashboard` (Gacha Hall), sudah login otomatis.
3. Kunjungan berikutnya cukup lewat `/login` pakai Grow ID + Password.

**Admin**
1. Nick admin **harus sudah dibuat & di-Approve** dulu lewat menu **Team
   Members** di dalam Admin Panel (username, email, WhatsApp → status
   `pending` → di-Approve oleh admin lain yang sudah login).
2. Nick pertama yang sudah otomatis ter-Approve dari awal: **`reysenoor`**
   (ganti/hapus sendiri lewat Team Members setelah kamu bikin nick sendiri).
3. Buka `/admin-login` → isi **Nama Admin** (nick yang sudah Approved) +
   **Token**. Token default: `crownps2026jayakarta`
   (bisa diganti lewat environment variable `ADMIN_TOKEN` di Railway).
4. Berhasil login → masuk ke `/admin`.

**Resource Manager (di dalam Admin Panel)**
Tombol *Upload PNG / Upload Banner / Upload File* memicu file picker asli.
File tersimpan ke `public/uploads/`, tercatat di `data/resources.json`, dan
langsung muncul di tabel (bisa di-Preview / Delete). Maks ukuran file 8MB,
tipe yang didukung: jpg, jpeg, png, gif, webp, svg.

## Menjalankan di lokal (opsional, sebelum deploy)

```bash
npm install
npm start
```

Lalu buka:
- `http://localhost:3000/register` — daftar player
- `http://localhost:3000/login` — masuk player
- `http://localhost:3000/admin-login` — masuk admin (nick `reysenoor`, token `crownps2026jayakarta`)

## Deploy ke Railway

1. Push folder ini ke repository GitHub.
   ```bash
   git init
   git add .
   git commit -m "init crownps site"
   git branch -M main
   git remote add origin <url-repo-github-kamu>
   git push -u origin main
   ```
2. Di [railway.com](https://railway.com) → **New Project** → **Deploy from
   GitHub repo** → pilih repo `crownps-site`. Railway otomatis mengenali
   Node.js lewat `package.json` dan menjalankan `npm install` → `npm start`.
3. (Disarankan) Di tab **Variables**, tambahkan:
   - `ADMIN_TOKEN` → ganti dari default demi keamanan
   - `SESSION_SECRET` → string acak sendiri
4. Buka **Settings → Networking → Generate Domain** untuk mendapat URL publik.
5. Situs bisa diakses di:
   - `https://<domain-kamu>/register` — daftar player
   - `https://<domain-kamu>/admin-login` — masuk admin

## Catatan penting soal penyimpanan data

`data/*.json` dan `public/uploads/` disimpan di disk lokal container. Di
Railway, disk ini **tidak permanen** — isinya bisa reset saat redeploy,
kecuali kamu menambahkan **Railway Volume** dan mount ke folder `/app/data`
dan `/app/public/uploads` (Settings project → Volumes → New Volume).

Untuk penggunaan jangka panjang / banyak admin sekaligus, langkah wajar
berikutnya adalah pindah dari file JSON ke database sungguhan (Railway punya
add-on PostgreSQL tinggal klik "New" di project yang sama). Kalau sudah siap
ke tahap itu, tinggal bilang — bisa dibantu migrasi datanya.
