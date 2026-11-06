# DibantuDigital — SaaS Meta Ads Report & ROAS Analytics

Aplikasi web SaaS komersial (multi-tenant) untuk pelaporan Meta Ads otomatis, mendukung:
1. **Tarik Data Langsung dari Meta Marketing API** per pelanggan (token dienkripsi `AES-256-GCM`).
2. **Import Laporan CSV / Excel (`.xlsx`, `.xls`, `.csv`)** dari Meta Ads Manager (mendukung header Bahasa Indonesia & Inggris) maupun format spreadsheet manual (`Report Ads 2026`).
3. **Dashboard Visual & Analisis**:
   - 8 KPI Cards (`Amount spend`, `Omset (Revenue)`, `ROAS`, `Impressions`, `Link clicks`, `CTR`, `Pesan Percakapan`, `Cost per Result`) lengkap dengan indikator persentase kenaikan/penurunan.
   - 4 Grafik Tren Harian (`Amount spent by Date`, `Impressions and Clicks by Date`, `Impressions and CTR over time`, `Clicks and performance over time`).
   - Breakdown berdasarkan **Source / Platform** (`Facebook Ads`, `Instagram Ads`) & **Campaign Type**.
   - Halaman **Campaign & Creative Performance** + Tabel Harian Lengkap (`Tanggal`, `Campaign`, `Adset`, `Creative`, `Amount Spend`, `Impression`, `Click`, `CTR`, `CPC`, `CPM`, `MESSAGE`, `CPA`, `Hook Rate`, `Iklan Ditonton 25%`, `Iklan Ditonton 50%`, `Nilai Deal`, `ROAS`).
   - **AI Insights**: rekomendasi optimasi otomatis berdasarkan performa ROAS, CTR, CPA, dan Hook Rate.
4. **Sistem Langganan SaaS (Xendit)**:
   - Pilihan durasi **1 Bulan**, **3 Bulan**, **6 Bulan**, dan **1 Tahun (12 Bulan)** + Free Trial 7 Hari.

---

## Cara Menjalankan di Komputer Lokal (Docker PostgreSQL)

1. Masuk ke folder `web`:
   ```powershell
   cd d:\PROJECT\METAADSREPORT\web
   ```
2. Nyalakan database PostgreSQL via Docker:
   ```powershell
   docker compose up -d
   ```
3. Jalankan server aplikasi:
   ```powershell
   npm run dev
   ```
4. Buka `http://localhost:3000`, daftar akun baru (`/register`), atau login dengan akun demo (`owner@appasco.id` / `demo12345`).

---

## Cara Deploy ke Server VPS (Ubuntu / Debian + Docker)

1. **Clone repository dari GitHub di VPS:**
   ```bash
   git clone <URL_REPO_GITHUB_ANDA> dibantudigital
   cd dibantudigital
   ```
2. **Siapkan file `.env` production:**
   ```bash
   cp .env.example .env
   ```
   Generate `ENCRYPTION_KEY` unik (32 byte base64) dan isi `APP_URL` dengan domain/IP VPS Anda:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```
3. **Jalankan seluruh stack (Aplikasi Next.js + PostgreSQL 17):**
   ```bash
   docker compose -f docker-compose.prod.yml up -d --build
   ```
4. Aplikasi langsung aktif di port `3000` (`http://IP_VPS_ANDA:3000` atau dihubungkan ke domain HTTPS via Nginx / Caddy / Cloudflare Tunnel).
