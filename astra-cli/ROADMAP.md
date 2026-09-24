# IMPLEMENTATION ROADMAP: ASTRA-CLI
> Engineering Task Checklist & Milestones (Derived directly from PRD-ASTRA-CLI.md)

---

## FASE 1: CORE SCAFFOLDING & RESILIENT TRANSPORT
- [ ] **1.1 Project Setup**:
  - Inisialisasi ESM package (`"type": "module"`) dengan bin executable `bin/astra.js`.
  - Pasang zero-heavy-dependency philosophy (gunakan native `node:fs`, `node:child_process`, `fetch`).
- [ ] **1.2 Config Manager (`src/config.js`)**:
  - Auto-loader `.env`, `~/.astra/config.json`, dan CLI args (`--model`, `--base-url`, `--api-key`).
- [ ] **1.3 Resilient Upstream Client (`src/client.js`)**:
  - Implementasi SSE streaming parser berbasis native `fetch` Web Streams.
  - Tambah regex sanitizer untuk strip promo banner reseller (`🔔 Peringatan: ...`).
  - Implementasi handler `upstream_stream_error` & socket drop: auto-fallback ke `stream: false` (atomic mode) + jitter backoff `1200ms - 2000ms`.

---

## FASE 2: RESILIENT FILE SYSTEM & GIT AUTO-CHECKPOINTING
- [ ] **2.1 4-Tier Patching Engine (`src/tools/fs.js`)**:
  - Tier 1: Exact search-and-replace.
  - Tier 2: Normalisasi CRLF (`\r\n`) ↔ LF (`\n`).
  - Tier 3: Fuzzy line-by-line whitespace-trimmed matching.
  - Tier 4: Self-healing error signal yang memandu ReAct loop untuk beralih ke `fs_write` (full rewrite).
- [ ] **2.2 Git Checkpoint & `/undo` Manager (`src/git.js`)**:
  - Shadow commit otomatis sebelum tool mutasi dieksekusi.
  - Handler perintah `/undo` untuk rollback working tree & clean untracked files dalam < 0.2 detik.
- [ ] **2.3 Multi-File Atomic Rollback**:
  - Transaksi all-or-nothing: rollback working tree via git jika salah satu file dalam mutasi batch gagal di-patch.

---

## FASE 3: CODEBASE CONTEXT & TOKEN COMPACTION
- [ ] **3.1 AST Repo Map Indexer (`src/repomap.js`)**:
  - Recursive directory scanner dengan filter `.astraignore`, `.git`, dan `node_modules`.
  - Ekstraktor simbol regex/WASM untuk JS, TS, Python, Go, Rust (budget < 1.500 token).
- [ ] **3.2 Project Rules Auto-Loader**:
  - Injeksi otomatis isi `./ASTRA.md` atau `./AGENTS.md` ke dalam System Prompt.
- [ ] **3.3 Context Pinning & Compaction**:
  - Perintah `/add <path>` dan `/drop <path>` untuk persistent prompt attachments.
  - Perintah `/compact` untuk meringkas riwayat percakapan lama secara on-demand.

---

## FASE 4: EXECUTION ENGINES & DAEMON SUPERVISOR
- [ ] **4.1 Cross-Platform / Termux Shell Runner (`src/tools/bash.js`)**:
  - Windows: `powershell.exe -NoProfile -Command`.
  - Android (Termux): Deteksi `$PREFIX/bin/bash` atau `$SHELL` / `sh`.
  - Linux & macOS: Menggunakan `$SHELL` atau `/bin/sh`.
  - Security blocklist untuk perintah destruktif (`rm -rf /`, `format c:`, dll).
- [ ] **4.2 Background Process Supervisor (`src/tools/proc.js`)**:
  - Tool `proc_spawn` dan `proc_kill` untuk dev server (`npm run dev`, `docker`) tanpa memblokir sesi REPL.
  - Perintah slash `/bg` untuk inspeksi background process.
- [ ] **4.3 Sidecar Linter Self-Correction (Lint-on-Save)**:
  - Eksekusi background `tsc --noEmit`, `eslint`, `ruff` pasca-patch.
  - Umpan balik error compiler diagnostik langsung ke prompt model.

---

## FASE 5: TERMINAL UI & INTERACTION REPL
- [ ] **5.1 Astra Cyber-Purple ANSI Theme (`src/ui/ansi.js`)**:
  - Palet Synthwave Violet: Neon Violet (`#C084FC`), Deep Electric Purple (`#7E22CE`), Soft Lavender (`#E9D5FF`).
  - Unified ANSI diff viewer (hijau untuk baris tambah, merah untuk baris hapus).
- [ ] **5.2 Dual-Mode Engine & `Tab` Keybinding (`src/ui/repl.js`)**:
  - Stdin Raw Mode listener untuk keycode `Tab` (9): Switch instan `[PLAN]` (Read-only) ↔ `[BUILD]` (Mutasi).
  - Bracketed paste mode (`\x1b[?2004h`) untuk paste blok kode multi-baris.
- [ ] **5.3 Live Latency Stopwatch & Telemetry Counter**:
  - Stopwatch display real-time (update tiap 100ms) dengan Time-To-First-Token (TTFT) marker.
  - Live token in/out & session cost estimator di footer bar.
  - Terminal completion audio chime (`\x07`) untuk task > 10 detik.

---

## FASE 6: PROTOCOL EXTENSIONS & PERSISTENCE
- [ ] **6.1 MCP (Model Context Protocol) Client (`src/mcp.js`)**:
  - Loader config `~/.astra/mcp.json`.
  - JSON-RPC 2.0 stdio transport & dynamic tool schema discovery.
- [ ] **6.2 Session Persistence & Resume (`src/session.js`)**:
  - JSON transcript storage di `~/.astra/sessions/<session-id>.json`.
  - Flag CLI `astra --resume` dan slash command `/history` / `/resume <id>`.
- [ ] **6.3 Autonomous Git Workflow**:
  - Perintah `/commit` untuk conventional commit message otomatis dari diff.
  - Perintah `/pr` untuk integrasi branch & pull request submission.

---

## FASE 7: VERIFIKASI & ACCEPTANCE CRITERIA
- [ ] Uji 1: Toggle `Tab` switch mode `[PLAN]` ↔ `[BUILD]`.
- [ ] Uji 2: Penolakan mutasi file saat mode `PLAN`.
- [ ] Uji 3: Eksekusi coding mandiri (create file + run test) di mode `BUILD`.
- [ ] Uji 4: Web search & fetch markdown extraction.
- [ ] Uji 5: Simulasi error upstream socket drop & auto-recovery non-streaming.
- [ ] Uji 6: Patch self-healing CRLF Windows & auto-fallback ke `fs_write`.
- [ ] Uji 7: Rollback instan via `/undo` (<0.2 detik).
- [ ] Uji 8: AST Repo Map context generation (<1.500 token).
- [ ] Uji 9: ANSI Unified diff viewer rendering.
- [ ] Uji 10: Stopwatch latency display & TTFT measurement.
- [ ] Uji 11: `.astraignore` security restriction.
- [ ] Uji 12: Multi-file atomic transaction rollback.
- [ ] Uji 13: Project rules auto-load (`ASTRA.md`).
- [ ] Uji 14: Context pinning via `/add` dan `/drop`.
- [ ] Uji 15: Manual context compaction via `/compact`.
- [ ] Uji 16: Bracketed paste & terminal audio chime.
- [ ] Uji 17: Lint-on-save compiler self-correction loop.
- [ ] Uji 18: MCP server invocation.
- [ ] Uji 19: Session persistence & resume (`astra --resume`).
- [ ] Uji 20: Background daemon supervisor (`proc_spawn` & `/bg`).
- [ ] Uji 21: Autonomous `/commit` & `/pr` generator.
- [ ] Uji 22: Termux Android compatibility check (shell resolution & ANSI rendering).
