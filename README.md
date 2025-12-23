Sistem Manajemen Kinerja & Absensi PPNPN (KPPN Lhokseumawe)

Sistem aplikasi berbasis web yang dikembangkan khusus untuk KPPN Lhokseumawe guna mendigitalisasi proses absensi berbasis lokasi (Geofencing) dan pelaporan kinerja harian (Logbook) bagi PPNPN.

Spesifikasi Teknologi

Dalam pengembangan aplikasi ini, saya menggunakan tech stack berikut:

const TechStack = {
  Frontend: "Next.js 14 (App Router)",
  Styling: "Tailwind CSS & Shadcn/UI",
  Database: "PostgreSQL (Supabase)",
  Storage: "Supabase Buckets (Surat Dokter/Bukti Izin)",
  Deployment: "Vercel"
};


Fitur Utama

Aplikasi ini memiliki beberapa fitur krusial yang diintegrasikan dengan kebijakan internal kantor:

1. Absensi Geofencing

Validasi kehadiran pegawai menggunakan koordinat GPS. Tombol absen hanya aktif jika:
$$ JarakPegawai \le 500 \text{ meter dari Kantor} $$

2. Mandatory Logbook

Mekanisme penguncian sistem dimana pegawai tidak dapat melakukan Absen Pulang sebelum mengisi logbook kinerja harian.

3. Manajemen Cuti & Izin

Sistem pengajuan mandiri dengan fitur:

Sisa kuota cuti otomatis.

Upload bukti surat sakit (Format: .pdf, .jpg, .png).

Status Approval 2 tingkat (Kasubbag & Kepala Kantor).

Panduan Instalasi Lokal

Ikuti langkah-langkah berikut untuk menjalankan proyek di komputer Anda:

1. Clone Project

git clone [https://github.com/daramayanda/logbook-kppn.git](https://github.com/daramayanda/logbook-kppn.git)
cd logbook-kppn


2. Instalasi Library

npm install
# atau menggunakan yarn
yarn install


3. Konfigurasi Environment (.env.local)

Dapatkan kredensial dari dashboard Supabase Anda:

NEXT_PUBLIC_SUPABASE_URL=[https://projek-anda.supabase.co](https://projek-anda.supabase.co)
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...


4. Jalankan Server

npm run dev

Dikembangkan Oleh
Dara Mayanda Teknik Informatika - Universitas Malikussaleh Magang Kemenkeu Periode III - KPPN Lhokseumawe
