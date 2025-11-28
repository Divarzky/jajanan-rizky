# Kedai Riski - Kasir Mini (PWA, Offline)

## Ringkasan
Aplikasi kasir offline berbasis PWA + IndexedDB. Bisa dijalankan langsung dengan membuka `index.html` di browser HP atau laptop. Mendukung:
- Produk (lihat, tambah, edit, hapus)
- Kasir & keranjang
- Restock
- Riwayat transaksi
- Backup manual (JSON/CSV/TXT)
- Auto-backup (lokal, interval)
- Mode Terminal (do/while + switch)
- PWA installable & offline
- Print struk (thermal-friendly)

## Cara pakai (tanpa server)
1. Salin folder `kasir-riski/` ke HP.
2. Buka file `index.html` dengan Chrome/Firefox/Samsung Internet.
3. Pilih `Add to Home Screen` untuk menjadikan app.

## Backup & Restore
- Gunakan menu `Backup` untuk export / import.
- Auto-backup menyimpan snapshot ke database dan mencoba mendownload file secara otomatis.

## Print Struk (Thermal)
- Setelah checkout, struk akan terbuka di jendela baru, gunakan `Print`/`Save as PDF`.
- Untuk mencetak ke printer thermal dari HP, gunakan fitur print dari browser yang terhubung ke printer (via Wi-Fi/Cloud Print/OBD). Jika ingin koneksi Bluetooth/USB thermal printer, perlu aplikasi native atau bridge (diluar scope web-only).

## Catatan teknis
- Semua data disimpan di browser (IndexedDB). Data bersifat lokal per perangkat.
- Jika ingin sinkronisasi antar perangkat, butuh backend (opsional).

