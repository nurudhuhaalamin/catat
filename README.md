# Catat — Sistem Pencatatan Transaksi Multi-Usaha

Satu aplikasi untuk **semua lini usaha** Anda: catat **uang masuk/keluar, piutang, hutang**,
kelola **tim**, dan lihat **ringkasan keuangan**. Bisa dipakai dari **HP, tablet, dan laptop**,
**bisa dipakai offline** (PWA), dan tersinkron otomatis saat online.

Dibangun 100% di atas **GitHub + Cloudflare** dengan free tier yang murah/gratis untuk awal.

## Tumpukan teknologi (stack)

| Lapisan | Teknologi |
|---|---|
| Frontend | React + Vite + TypeScript + Tailwind, PWA (offline via IndexedDB/Dexie) |
| Backend/API | Cloudflare Workers + Hono |
| Database | Cloudflare D1 (SQLite) + Drizzle ORM |
| Auth | better-auth (email + password), peran per-usaha (owner/admin/staff) |
| Hosting | Satu Worker melayani aplikasi web **dan** API (Workers Static Assets) |
| CI/CD | GitHub Actions → Wrangler deploy |

## Struktur proyek

```
apps/web/         React PWA (UI, store offline Dexie, sync)
worker/           Cloudflare Worker: Hono API + better-auth + serve aset
packages/shared/  Skema Drizzle, tipe, validasi zod (dipakai web & worker)
migrations/       Migrasi D1 (SQL)
wrangler.toml     Konfigurasi Worker (binding D1 + aset)
```

## Pengembangan lokal

Prasyarat: **Node 22+** dan **pnpm 9+** (`corepack enable`).

```bash
pnpm install

# 1. Siapkan secret auth untuk dev
cp .dev.vars.example .dev.vars       # lalu isi BETTER_AUTH_SECRET dengan string acak

# 2. Buat & migrasi database lokal
pnpm --filter @catat/worker db:migrate:local

# 3. Jalankan worker (API + auth) di http://localhost:8787
pnpm dev:worker

# 4. Di terminal lain, jalankan web di http://localhost:5173
pnpm dev
```

Buka http://localhost:5173 → daftar akun → buat lini usaha → mulai mencatat.

## Deploy ke Cloudflare (produksi)

1. **Buat database D1** dan salin `database_id` ke `wrangler.toml`:
   ```bash
   npx wrangler d1 create catat
   ```
2. **Set secret & URL produksi**:
   ```bash
   npx wrangler secret put BETTER_AUTH_SECRET          # string acak >= 32 karakter
   # set BETTER_AUTH_URL di [vars] wrangler.toml ke domain produksi Anda
   ```
3. **Migrasi + deploy** (atau biarkan GitHub Actions melakukannya):
   ```bash
   pnpm --filter @catat/web build
   pnpm --filter @catat/worker db:migrate:remote
   pnpm --filter @catat/worker deploy
   ```

### Deploy otomatis via GitHub Actions

Tambahkan dua secret di repo (Settings → Secrets → Actions):
`CLOUDFLARE_API_TOKEN` dan `CLOUDFLARE_ACCOUNT_ID`. Setiap push ke `main` akan
otomatis build, migrasi D1, dan deploy (lihat `.github/workflows/deploy.yml`).

## Cara kerja offline-first

- Semua tampilan membaca dari **IndexedDB (Dexie)** → instan & jalan tanpa internet.
- Setiap catatan masuk ke **outbox**; saat online dikirim ke `/api/sync/push` (idempoten
  via primary key), lalu perubahan ditarik via `/api/sync/pull?since=<cursor>`.
- Entri keuangan bersifat *append-oriented* (hapus = soft-delete) sehingga bebas konflik.

## Status & roadmap

- ✅ **v1 (inti)**: multi-usaha, login tim + peran, uang masuk/keluar, kategori, kontak,
  piutang & hutang + pembayaran, dashboard, offline-first PWA.
- ✅ **Laporan**: laba-rugi (berbasis kas), arus kas per bulan, umur (aging) piutang & hutang,
  export CSV — semua dihitung offline dari data perangkat.
- ⏭️ **Opsional (dilewati untuk saat ini)**: pengelolaan stok produk + HPP. Bila ditambahkan,
  laporan laba-rugi bisa diperluas memasukkan HPP.
- ⏭️ **Lanjutan**: foto struk (R2), multi-currency, notifikasi jatuh tempo, email undangan.

> Catatan: skema tabel better-auth dapat diverifikasi/diperluas dengan
> `npx @better-auth/cli generate` bila Anda menambah fitur auth (mis. verifikasi email).
