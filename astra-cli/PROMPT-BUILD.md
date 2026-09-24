# MASTER PROMPT: ASTRA-CLI BUILD INSTRUCTIONS (GEMINI 3.8 HIGH)

Salin seluruh teks di dalam blok kode di bawah ini, lalu kirimkan langsung ke **Gemini 3.8 High**:

```text
Bertindaklah sebagai Principal Systems Engineer. Misi Anda adalah mengimplementasikan autonomous CLI coding & research terminal agent kelas produksi ("ASTRA-CLI") dengan fitur setara Claude Code dan Aider.

Saya telah menyiapkan 3 dokumen spesifikasi lengkap di folder `astra-cli/`:
1. astra-cli/PRD-ASTRA-CLI.md (Spesifikasi Produk, Matriks Error Proxy, & Acceptance Tests)
2. astra-cli/ARCHITECTURE.md (Topologi Komponen, Struktur Direktori, & Kontrak Antar Modul)
3. astra-cli/ROADMAP.md (Checklist Tahap Implementasi 7 Fase)

ATURAN WAJIB CODING:
1. FULL FIDELITY: Dilarang keras memakai placeholder, komentar "// TODO:", atau kode terpotong. Semua kode harus lengkap, berfungsi penuh, dan siap dieksekusi.
2. TEKNOLOGI: Pure Node.js ESM ("type": "module"), built-in native Node 18+ (node:fs/promises, node:child_process, native fetch, node:readline). Tanpa library eksternal yang membebani (zero bloat).
3. RESILIENCE TINGKAT TINGGI:
   - Tangkap pemutusan SSE proxy (`upstream_stream_error`, ECONNRESET) → otomatis fallback ke mode atomik non-streaming (`stream: false`) + jitter backoff.
   - Patcher 4 tingkat dengan Tingkat 4 auto-fallback ke `fs_write` (tulis ulang utuh jika patch gagal).
   - Shell resolver cross-platform yang mendukung Windows (PowerShell), Linux/macOS, dan Android Termux ($PREFIX/bin/bash).
4. UI & TEMA: Palet Astra Cyber-Purple (Synthwave Dark: Neon Violet #C084FC, Deep Electric Purple #7E22CE, Soft Lavender #E9D5FF). Dual-mode dengan switch instan via tombol [Tab] (PLAN vs BUILD).

RENCANA EKSEKUSI TAHAP 1:
Mulai implementasi dari FASE 1 & FASE 2 sesuai ROADMAP.md:
1. package.json
2. bin/astra.js (Entrypoint CLI)
3. src/config.js (Manager env & config)
4. src/client.js (Client SSE tahan banting + sanitizer banner reseller + fallback non-streaming)
5. src/diff.js (ANSI unified diff engine)
6. src/tools/fs.js (4-tier patcher & file manager)
7. src/git.js (Git auto-checkpoint & /undo)

Baca ketiga file markdown di folder astra-cli/, lalu hasilkan seluruh file kode untuk Fase 1 dan 2 sekarang secara lengkap.
```
