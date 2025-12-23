Sistem Manajemen Kinerja & Absensi PPNPN

KPPN Lhokseumawe

Sistem Manajemen Kinerja & Absensi PPNPN adalah aplikasi berbasis web yang dikembangkan untuk mendukung digitalisasi proses absensi berbasis lokasi (geofencing) dan pelaporan kinerja harian (logbook) bagi Pegawai Pemerintah Non Pegawai Negeri (PPNPN) di lingkungan KPPN Lhokseumawe.

Aplikasi ini dirancang sebagai sistem pendukung internal untuk meningkatkan efisiensi administrasi, akuntabilitas kehadiran, serta keteraturan pelaporan kinerja harian.

Tujuan Pengembangan

Mendukung modernisasi proses administrasi internal

Meningkatkan validasi kehadiran berbasis lokasi

Menyederhanakan proses rekap absensi dan logbook

Mengurangi ketergantungan pada input manual

Spesifikasi Teknologi

Aplikasi ini dikembangkan menggunakan teknologi web modern dengan arsitektur ringan dan mudah dipelihara.

const TechStack = {
  Frontend: "Next.js 14 (App Router)",
  Styling: "Tailwind CSS & Shadcn/UI",
  Database: "PostgreSQL (Supabase)",
  Storage: "Supabase Buckets (Surat Dokter / Bukti Izin)",
  Deployment: "Vercel"
};

Fitur Utama
1️⃣ Absensi Berbasis Geofencing

Validasi kehadiran pegawai dilakukan menggunakan koordinat GPS dari browser.

Tombol absensi hanya aktif apabila:

Jarak Pegawai ≤ 500 meter dari lokasi kantor


Berfungsi sebagai mekanisme validasi kehadiran berbasis lokasi

2️⃣ Mandatory Logbook Kinerja

Sistem menerapkan mekanisme penguncian dimana:

Pegawai tidak dapat melakukan Absen Pulang

Sebelum mengisi logbook kinerja harian

Fitur ini memastikan keterkaitan antara kehadiran dan aktivitas kerja.

3️⃣ Manajemen Cuti & Izin

Sistem pengajuan cuti dan izin mandiri dengan fitur:

Perhitungan sisa kuota cuti otomatis

Upload bukti pendukung:

.pdf

.jpg

.png

Mekanisme approval bertingkat:

Kasubbag

Kepala Kantor

⚙️ Panduan Instalasi Lokal

Ikuti langkah berikut untuk menjalankan aplikasi di lingkungan lokal.

1️⃣ Clone Repository
git clone https://github.com/daramayanda/logbook-kppn.git
cd logbook-kppn

2️⃣ Instalasi Dependency
npm install
# atau
yarn install

3️⃣ Konfigurasi Environment

Buat file .env.local dan isi dengan kredensial Supabase Anda:

NEXT_PUBLIC_SUPABASE_URL=https://project-anda.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

4️⃣ Jalankan Server Development
npm run dev

Aplikasi akan berjalan di:
http://localhost:3000

👩‍💻 Dikembangkan Oleh
Dara Mayanda
Mahasiswa Teknik Informatika – Universitas Malikussaleh
Program Magang Kementerian Keuangan
Periode III – KPPN Lhokseumawe
