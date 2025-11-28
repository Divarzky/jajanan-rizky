# Kedai Riski - Kasir Mini (PWA, Offline)

## Ringkasan
Aplikasi kasir offline berbasis PWA + IndexedDB yang dioptimalkan untuk mobile. Bisa dijalankan langsung dengan membuka `index.html` di browser HP atau laptop.

## Fitur Utama
- ✅ **UI Responsif** - Optimized untuk mobile dengan touch-friendly controls
- ✅ **Manajemen Produk** - Tambah, edit, hapus, restock produk
- ✅ **Kasir & Keranjang** - Interface kasir yang intuitif
- ✅ **Multi Metode Bayar** - Cash, QRIS, Transfer dengan referensi
- ✅ **Backup/Restore** - JSON & CSV export/import
- ✅ **Auto Backup** - Backup otomatis dengan interval
- ✅ **Print Struk** - Thermal printer friendly receipt
- ✅ **PWA** - Installable & bekerja offline
- ✅ **Dashboard** - Grafik penjualan 7 hari terakhir
- ✅ **Terminal Mode** - Untuk development dan troubleshooting

## Cara Pakai (Mobile)

### Instalasi Cepat:
1. **Download** folder aplikasi ke HP
2. **Buka** file `index.html` dengan Chrome/Firefox
3. **Add to Home Screen** untuk install sebagai app

### Untuk Developer:
```bash
# Serve dengan local server untuk testing PWA
python -m http.server 8000
# atau
npx serve .