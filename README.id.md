<p align="center">
  <img src="favicon.svg" width="64" height="64" alt="ModelProof Logo" />
</p>

<h1 align="center">ModelProof</h1>

<p align="center">
  <strong>Alat audit forensik berbasis klien dan CLI tanpa persistensi data untuk mendeteksi pemalsuan model LLM, rekayasa proxy (masking), dan downgrade diam-diam.</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/modelproof"><img src="https://img.shields.io/npm/v/modelproof.svg?color=10b981&label=npm" alt="npm version" /></a>
  <a href="https://pypi.org/project/modelproof/"><img src="https://img.shields.io/pypi/v/modelproof.svg?color=10b981&label=pypi" alt="pypi version" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License" /></a>
  <img src="https://img.shields.io/badge/zero-telemetry-emerald" alt="Zero Telemetry" />
  <img src="https://img.shields.io/badge/dependencies-0-brightgreen" alt="Zero Dependencies" />
</p>

<p align="center">
  <a href="README.md">English</a> | <strong>Bahasa Indonesia</strong>
</p>

---

## Ringkasan

Penjual API murah pihak ketiga, akun sharing, dan penyedia reverse-proxy sering melakukan **model spoofing / masking**:
- Mengalihkan request model mahal (seperti `claude-3-5-sonnet`, `gpt-4o`) ke model open-weights yang jauh lebih murah (`qwen-2.5-72b`, `deepseek-v3`, atau varian mini terkuantisasi).
- Menghapus sistem instruksi asli dan menyuntikkan jailbreak/kuota rahasia ke dalam prompt.
- Memanipulasi katalog `/v1/models` dengan nama-nama model fiktif.

**ModelProof** memberikan audit teknis independen dan **Skor Keaslian (0-100%)** yang dapat diverifikasi secara objektif sebelum Anda mempercayai suatu endpoint API untuk aplikasi produksi.

---

## Mengapa Ini Penting?

1. **Kerugian Finansial (Beli Flagship, Dapat Model Murahan)**:
   Penjual mematok harga untuk model tier atas resmi, namun secara diam-diam me-routing traffic ke model berbiaya sangat rendah. Pengguna membayar berkali-kali lipat lebih mahal untuk performa kecerdasan yang diturunkan drastis.

2. **Kerusakan Pipeline Aplikasi**:
   Model tiruan kerap gagal saat menangani penalaran rumit, validasi JSON Schema ketat, eksekusi function/tool calling, serta context window panjang. Hal ini memicu silent bugs pada agen otonom dan sistem backend.

3. **Risiko Kebocoran Data dan Manipulasi Prompt**:
   Server reverse-proxy perantara dapat mencatat isi prompt mentah Anda, menyuntikkan instruksi tersembunyi, atau merekayasa alur token sebelum diteruskan ke server upstream.

4. **Bukti Valid untuk Komplain & Refund**:
   ModelProof menyusun bukti forensik berstempel waktu yang dapat disalin langsung sebagai lampiran teknis saat mengajukan komplain atau pengembalian dana kepada penjual.

---

## Mode Distribusi

| Platform | Distribusi | Perintah Eksekusi | Bebas Dependensi |
| :--- | :--- | :--- | :---: |
| **Terminal (Node.js)** | NPM Registry | `npx modelproof` | Ya |
| **Terminal (Python)** | PyPI Package | `pip install modelproof` | Ya |
| **Browser (Web Sandbox)** | Klien Statis | `index.html` (Lokal / Hosting Statis) | Ya |

---

## Matriks Deteksi 10 Vektor Forensik

ModelProof mengeksekusi 10 probe adversarial yang dikalibrasi terhadap bobot arsitektur model resmi:

| # | Vektor Forensik | Kerentanan / Anomali Target | Mode |
| :-: | :--- | :--- | :-: |
| **01** | **Logika Spasial & Batas Karakter** | Jebakan hitung huruf terselubung (`'s-t-r-a-w-b-e-r-r-y'`) + aritmatika runtime | CEPAT |
| **02** | **Penggunaan Tokenizer & Presisi BPE** | Sekuens multi-byte Unicode untuk menguji diskrepansi token prompt dan pemotongan upstream | CEPAT |
| **03** | **Instruksi Sistem & Kebocoran Identitas** | Bypass prompt adversarial untuk mengungkap bobot model asli dan pengakuan vendor | CEPAT |
| **04** | **Telemetri Hardware & Profil TPS** | Parser SSE streaming real-time guna mendeteksi hardware LPU hiper-cepat (>220 TPS SambaNova/Groq) | CEPAT |
| **05** | **Kepatuhan Batasan Negatif** | Batasan format kaku tanpa basa-basi pembuka atau kalimat permintaan maaf | CEPAT |
| **06** | **Skema Ketat / Decoding Terbatas** | Penerapan JSON Schema strict native (gagal pada engine proxy abal-abal) | MENDALAM |
| **07** | **Anomali Glitched Token Embedding** | Uji perilaku tokenizer pada token tak terucapkan (`SolidGoldMagikarp`) | CEPAT |
| **08** | **Horizon Cutoff Temporal (2024-H2)** | Uji pengetahuan peristiwa pasca-cutoff 2024 (Python 3.13, Nobel Oktober 2024) | CEPAT |
| **09** | **Alur CoT Penalaran & Delimiter** | Deteksi OpenAI `o1`/`o3` yang dimasking ke DeepSeek-R1 via analisis token `<think>` | MENDALAM |
| **10** | **Logika Tipe Tingkat Tinggi & Lifetime** | Borrow checker Rust level-kompiler & penalaran lifetime HRTB (`for<'a>`) | MENDALAM |

---

## Panduan Cepat CLI

Kedua versi CLI (Node.js dan Python) beroperasi **100% tanpa dependensi eksternal**, memanfaatkan native runtime (`fetch` dan standard library `urllib`).

### 1. Node.js (NPX)

Dapat dijalankan langsung tanpa instalasi:

```bash
# Scan standar ke endpoint reverse proxy
npx modelproof -u "https://my-proxy.com/v1" -k "sk-..." -m "claude-3-5-sonnet-20241022"

# Audit mendalam (10 vektor) dengan output JSON
npx modelproof -u "https://my-proxy.com/v1" -k "sk-..." -m "gpt-4o" --all --json

# Periksa katalog model yang disediakan upstream
npx modelproof -u "https://my-proxy.com/v1" -k "sk-..." --models-only
```

### 2. Python (PIP)

Instal dari PyPI:

```bash
pip install modelproof
```

Jalankan audit:

```bash
# Audit keaslian model
modelproof -u "https://my-proxy.com/v1" -k "sk-..." -m "gpt-4o"

# Jalankan dengan laporan Bahasa Indonesia
modelproof -u "https://my-proxy.com/v1" -k "sk-..." -m "claude-3-5-sonnet-20241022" --lang id

# Eksekusi seluruh 10 vektor mendalam
modelproof -u "https://my-proxy.com/v1" -k "sk-..." --all
```

Atau jalankan langsung tanpa instalasi global:
```bash
python -m modelproof.cli -u "https://my-proxy.com/v1" -k "sk-..." -m "gpt-4o"
```

---

## Parameter & Opsi CLI

```text
Penggunaan: modelproof [opsi]

Opsi:
  -u, --base-url <url>      Alamat reverse proxy target (default: "https://api.openai.com/v1")
  -k, --key <token>         API Token / Key (atau set env var OPENAI_API_KEY)
  -m, --model <id>          Model ID target yang diklaim (default: "claude-3-5-sonnet-20241022")
  -p, --protocol <proto>    Skema wire protocol: auto, openai, anthropic (default: "auto")
  -a, --all                 Jalankan seluruh 10 vektor (default: 8 vektor cepat)
  --models-only             Audit katalog /v1/models saja lalu keluar
  --lang <lang>             Bahasa laporan: en, id (default: "en")
  --json                    Tampilkan output JSON murni untuk integrasi CI/CD
  --timeout <detik>         Batas waktu per request dalam detik (default: 30)
  -v, --version             Tampilkan nomor versi
  -h, --help                Tampilkan bantuan
```

---

## Contoh Tampilan Terminal

```text
================================================================================
 MODELPROOF CLI // LLM Proxy & Masking Forensic Scanner (v1.0.1)
 Target: claude-3-5-sonnet-20241022 @ https://my-custom-proxy.com/v1
================================================================================
[*] Protocol Wire Schema: ANTHROPIC
[*] Catalog Audit: 42 models retrieved (Clean naming).

[+] RUNNING 8 FORENSIC VECTORS:
--------------------------------------------------------------------------------
  [01] Spatial Logic & Character Horizon    [PASS]  r=3, math=324
  [02] Tokenizer Usage & BPE Precision      [PASS]  Usage discrepancy within tolerance
  [03] System Instruction & Identity Leak   [PASS]  Responded as official Claude
  [04] Hardware Telemetry & TPS Profile     [PASS]  64 TPS (Realistic datacenter profile)
  [05] Negative Constraint Compliance       [PASS]  Zero preamble constraint honored
  [06] Strict JSON Schema Decoding          [PASS]  Schema enforced natively
  [07] Glitched Token Embedding             [PASS]  Token boundary verified
  [08] Temporal Cutoff Horizon (2024-H2)    [PASS]  Verified post-2024H2 event awareness
--------------------------------------------------------------------------------

============================= FORENSIC VERDICT =================================
 SKOR KEASLIAN        : 100%
 HASIL DIAGNOSTIK     : TERVERIFIKASI ASLI (GENUINE)
 VENDOR ASLI          : Anthropic Claude
 TINGKAT RISIKO       : AMAN

 [+] KESIMPULAN: Target terverifikasi konsisten dengan bobot model resmi.
================================================================================
```

---

## Keamanan & Privasi

- **Nol Retensi Telemetri**: ModelProof tidak pernah menyimpan, mengumpulkan, atau mengirimkan token API, base URL, atau percakapan Anda ke server eksternal mana pun.
- **Klien Sandbox Browser**: Pada antarmuka web, seluruh lalu lintas jaringan berjalan langsung dari browser lokal ke endpoint tujuan Anda.
- **Volatilitas Memori**: Kredensial hanya berada pada memori sementara aplikasi saat proses berjalan dan langsung dibersihkan saat jendela ditutup atau dimuat ulang.

---

## Lisensi

Didistribusikan di bawah [Lisensi MIT](LICENSE).
Bebas digunakan, diaudit, serta dimodifikasi untuk kebutuhan komersial maupun non-komersial.
