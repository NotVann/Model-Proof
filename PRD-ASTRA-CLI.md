# PRD: ASTRA-CLI (Autonomous Terminal Agent Engine)

## 1. OBJECTIVE & SCOPE
Bangun lightweight, production-grade autonomous CLI coding & research agent (Claude Code parity).
Transport: Universal OpenAI-compatible wire protocol (`/v1/chat/completions`) + proxy reseller target (`gpt-6-astra`).
Lingkungan: Windows (PowerShell/CMD), Linux, macOS (Bash/Zsh).

---

## 2. WIRE PROTOCOL & UPSTREAM SPEC
- **Endpoint**: `${BASE_URL}/chat/completions` (POST).
- **Auth**: `Bearer ${API_KEY}`.
- **Payload Schema**:
  - `model`: Target string (`gpt-6-astra`, `claude-3-7-sonnet`, custom alias).
  - `messages`: Array `{ role, content, tool_calls, tool_call_id }`.
  - `tools`: Native JSON Schema function definitions.
  - `stream`: Boolean (true default, fallback false).
- **Proxy Sanitizer Layer**:
  - Input: Raw SSE stream / JSON string.
  - Filter: Strip upstream quota banners (`🔔 Peringatan: sisa token...`, reseller wrapper texts).
  - Output: Clean JSON / tool call arguments.

---

## 3. ARCHITECTURE & REACT STATE MACHINE
```
User Prompt → Context Engine → LLM API Request
                                      ↓
LLM Decision ← Tool Results ← Tool Execution ← Permission Gate (Y/N)
      ↓ (No tools / Task complete)
Terminal Markdown Render → Wait Next Stdin
```

### State Definitions:
1. `IDLE`: Menunggu input user di prompt terminal.
2. `INFERENCE`: Stream request ke upstream model.
3. `VALIDATION`: Parse payload `tool_calls`. Sanitasi teks proxy non-JSON.
4. `GATE_CHECK`: Periksa safety level tool (read-only auto-allow, destructive perlu konfirmasi user).
5. `EXECUTION`: Menjalankan runner tool lokal.
6. `COMPACTION`: Pangkas history messages jika mendekati context window threshold.

---

## 4. TOOL REGISTRY SPECIFICATION

| Tool Name | Scope | Param Schema | Return Type | Permission Gate |
|---|---|---|---|---|
| `bash_exec` | Terminal shell | `{ command: string, timeout_ms?: number }` | `stdout` / `stderr` | Mandatory jika destructive (`rm`, `del`, `git push`, kill process) |
| `fs_read` | File system | `{ path: string, offset?: number, limit?: number }` | Text chunk | Auto-allow |
| `fs_write` | File system | `{ path: string, content: string }` | Status boolean | Auto-allow (log preview diff) |
| `fs_patch` | File system | `{ path: string, target: string, replacement: string }` | Diff result | Auto-allow |
| `fs_list` | File tree | `{ path: string, depth?: number }` | Tree string | Auto-allow |
| `web_search` | Internet research | `{ query: string, max_results?: number }` | JSON array `[{title, link, snippet}]` | Auto-allow |
| `web_fetch` | Web scraper | `{ url: string, raw?: boolean }` | Clean Markdown text (max 15k chars) | Auto-allow |

### Detail Implementasi Tool:
- **`fs_patch` (Resilient Diff Matcher)**:
  - **Tingkat 1 (Exact Match)**: String matching langsung pada target block.
  - **Tingkat 2 (Whitespace & CRLF Normalizer)**: Normalisasi otomatis `\r\n` ↔ `\n`, trim trailing whitespace pada setiap baris target vs file fisik.
  - **Tingkat 3 (Fuzzy Indent Matcher)**: Strip leading tabs/spaces pada target block dan file → match token struktur kode → apply patch dengan mempertahankan indentasi asli file fisik.
  - **Tingkat 4 (Self-Healing Fallback ke `fs_write`)**: Jika seluruh tingkat match gagal (akibat model halusinasi baris), engine TIDAK crash. Engine mengembalikan error informatif ke model: `"Patch failed: Target block not found in file. Fallback: Generate the entire file content using fs_write."` → model langsung beralih menulis file secara utuh tanpa menghentikan sesi user.
- **`web_search`**: Engine DuckDuckGo HTML scraping (`https://html.duckduckgo.com/html/?q=...`) atau fallback Brave Search API. Header rotation anti-bot ban.
- **`web_fetch`**: HTTP GET via `undici` → parse Cheerio → buang tag non-konten (`script`, `style`, `svg`, `nav`, `footer`, `ad`) → Turndown HTML-to-Markdown converter → Hard slice 15.000 karakter (mencegah overflow context window).

---

## 5. DUAL OPERATING MODES & KEYBINDING SPECIFICATION (PLAN VS BUILD)

### 5.1 Mode Definition Matrix

| Parameter | PLAN Mode (Architect) | BUILD Mode (Engineer) |
|---|---|---|
| **Terminal Badge** | `[PLAN]` (Cyan / Text-Bold) | `[BUILD]` (Emerald / Text-Bold) |
| **System Directive** | "Analyze codebase, read files, search web, and design step-by-step implementation plan. Do NOT mutate files or run shell commands." | "Execute implementation, modify files, run tests, and verify code changes." |
| **Allowed Tools** | `fs_read`, `fs_list`, `web_search`, `web_fetch` | **ALL TOOLS** (`bash_exec`, `fs_write`, `fs_patch`, `fs_read`, `fs_list`, `web_search`, `web_fetch`) |
| **Filtered Tools** | `fs_write`, `fs_patch`, `bash_exec` **(Blocked)** | None |
| **File Mutation** | Strictly Forbidden (Zero Side Effects) | Allowed |

### 5.2 Keybinding Switch Engine (`Tab` Toggle)
- **Trigger**: Tombol `Tab` (Keycode 9 / `\t`) di prompt input terminal.
- **Perilaku Input**:
  - Buffer kosong: Toggle state `PLAN` ↔ `BUILD` langsung.
  - Buffer terisi teks: Tab tetap berfungsi toggle mode tanpa menghapus input teks user yang sedang diketik.
  - Prompt bar re-render in-place menggunakan ANSI escape codes (`\r\x1b[K`).
- **Implementasi Handler Node.js**:
  ```javascript
  // src/ui/keybinds.js
  import readline from 'readline';

  export function setupModeKeybind(state, renderPrompt) {
    readline.emitKeypressEvents(process.stdin);
    if (process.stdin.isTTY) process.stdin.setRawMode(true);

    process.stdin.on('keypress', (str, key) => {
      if (key && key.name === 'tab') {
        state.mode = state.mode === 'plan' ? 'build' : 'plan';
        renderPrompt();
      }
    });
  }
  ```

---

## 6. GIT AUTO-CHECKPOINTING & ATOMIC `/undo` ENGINE

### 6.1 Shadow Checkpoint Mechanism
- **Trigger**: Otomatis dieksekusi sebelum tool mutasi (`fs_write`, `fs_patch`, `bash_exec`) dijalankan.
- **Workflow**:
  1. Periksa repository Git lokal. Jika belum di-init → auto `git init` di background sandbox.
  2. Buat snapshot state direktori via temporary shadow tree ref (`refs/astra/checkpoints/<timestamp>`).
  3. Catat ID commit ke stack checkpoint sesi: `checkpointStack.push({ hash, timestamp, toolName, targetFile })`.
- **Command `/undo`**:
  - User mengetik `/undo` di terminal prompt.
  - Engine membaca checkpoint teratas dari stack → restore working tree ke hash tersebut:
    `git checkout <hash> -- .` (atau rollback file spesifik).
  - Terminal feedback: `[UNDO] Rolled back changes from turn #3 (2 files restored).`
- **Command `/diff`**:
  - Tampilkan uncommitted changes dari turn agent terakhir dalam format ANSI color diff.

---

## 7. AST REPO MAP & CODEBASE SKELETON (TREE-SITTER)

### 7.1 Objective & Token Efficiency
- Mencegah token explosion: Dilarang membaca seluruh file ke context.
- Model butuh pemahaman relasi file, nama class, method, function signature, dan export.

### 7.2 Indexer Mechanism
- **Parser**: `web-tree-sitter` (WASM) untuk JavaScript, TypeScript, Python, Go, Rust, HTML, CSS.
- **Ekstraksi**:
  - JS/TS: `export function`, `class`, `interface`, `type`, `import`.
  - Python: `def`, `class`, `import`.
  - Rust/Go: `fn`, `struct`, `impl`, `package`.
- **Format Output Repo Map**:
  ```
  src/
    config.ts: Config, loadEnv()
    engine.ts: AgentEngine.run(), AgentEngine.step()
    tools/
      bash.ts: execCommand()
      fs.ts: readFile(), writeFile(), patchFile()
  ```
- **Budget**: Maksimal 1.500 token di-inject ke System Prompt. Peta arsitektur selalu up-to-date setiap ada file yang diubah.

---

## 8. INTERACTIVE UNIFIED DIFF VIEWER (ANSI COLOR ENGINE)

### 8.1 Visual Terminal Presentation
- Setiap mutasi file (`fs_patch` / `fs_write`) menampilkan diff inline di terminal sebelum diaplikasikan:
  - Header: `--- a/src/index.ts` (Red) / `+++ b/src/index.ts` (Green).
  - Chunk marker: `@@ -12,4 +12,6 @@` (Cyan).
  - Deletions: `- const port = 3000;` (Red background / bright red text).
  - Additions: `+ const port = process.env.PORT || 3000;` (Green background / bright green text).
- **Interactive Approval Switcher**:
  - Setting flag `--auto-apply`: Langsung commit diff tanpa menunggu tombol (default: true di Turbo mode).
  - Setting flag `--interactive`: Tampilkan diff → prompt `Apply this change? [y/n/e] (yes / no / edit)` sebelum file disk diubah.

---

## 9. CONTEXT MANAGEMENT & TOKEN BUDGETING
- **Project Rule Auto-Loader (`ASTRA.md` / `AGENTS.md`)**:
  - Engine otomatis mendeteksi keberadaan file `./ASTRA.md`, `./AGENTS.md`, atau `./.cursorrules` di root workspace saat startup.
  - Konten aturan proyek di-injeksi langsung ke System Prompt (di bawah Persona) sebagai panduan arsitektur lokal (coding standards, preferensi library, larangan khusus tim).
- **Persistent Context Pinning (`/add` & `/drop`)**:
  - Developer dapat mengunci file krusial ke prompt permanen agar tidak terpotong oleh sliding window truncation:
    - `/add <file_path>`: Membaca file dan menyematkannya ke `Pinned Context Memory`.
    - `/drop <file_path>`: Melepaskan file dari context pinning.
- **Max Window Threshold**: 80% dari target window model (default: 64k / 128k token).
- **Token Estimator**: Heuristik BPE (~3.8 char/token).
- **Compaction Strategy**:
  - `Keep System Prompt + Repo Map + Pinned Files`: Lock index 0, 1, dan pinned files (selalu utuh).
  - `Rolling Window Tool Truncation`: Pangkas output tool lama (`fs_read`, `bash_exec`, `web_fetch`) jadi placeholder: `[Output truncated. File content previously inspected.]`.
  - `Manual Compaction (/compact)`: User dapat sewaktu-waktu mengetik `/compact` untuk meringkas riwayat percakapan secara on-demand.
  - `Automatic Summary Injection`: Jika context > threshold, panggil LLM satu kali via payload khusus untuk merangkum percakapan lama → replace rentang message 2 s/d N dengan 1 summary block.

---

## 10. SECURITY & SAFETY SANDBOX
1. **Command Blocklist (Hard Reject)**:
   - Linux: `rm -rf /`, `mkfs`, `:(){ :|:& };:`, `dd if=/dev/zero`.
   - Windows: `format c:`, `Remove-Item -Recurse C:\Windows`.
2. **Interactive Gate**:
   - Tampilkan ANSI border merah saat model memanggil destructive command.
   - User harus ketik `y` / `n` di terminal sebelum eksekusi berjalan.
3. **Zero Leaks**:
   - Larang tool mengirim nilai `.env` / `API_KEY` ke internet via tool parameters.
4. **`.astraignore` Security & Context Filter**:
   - Parsing file `.astraignore` di root workspace (syntax identik dengan `.gitignore`).
   - Default ignores jika file tidak ada: `.git`, `node_modules`, `.env*`, `*.lock`, `*.pem`, `*.key`, `*.sqlite`, `dist/`, `build/`.
   - File/folder yang match diblokir dari `fs_read`, `fs_list`, dan di-exclude dari AST Repo Map untuk mencegah kebocoran secret & ledakan context token.

---

## 11. CLI UI & INTERACTION SPEC
- **Dynamic Prompt String**:
  - Plan Mode: `astra-cli [PLAN] [main*]> ` (Cyan badge)
  - Build Mode: `astra-cli [BUILD] [main*]> ` (Emerald badge)
- **Keybinding & Slash Commands Matrix**:
  | Input | Fungsi | Deskripsi |
  | :--- | :--- | :--- |
  | `Tab` | Switch Mode | Toggle seketika antara mode `[PLAN]` dan `[BUILD]` |
  | `/help` | Interactive Help | Tampilkan daftar command, panduan mode, status tools, dan keybindings |
  | `/undo` | Git Rollback | Kembalikan working directory ke state sebelum turn terakhir dijalankan |
  | `/add <path>` | Pin File | Sematkan file ke context memori permanen model |
  | `/drop <path>` | Unpin File | Lepaskan file dari context memori permanen model |
  | `/compact` | Manual Compact | Rangkum percakapan & kompres token history secara on-demand |
  | `/history` | Session History | Tampilkan daftar riwayat sesi percakapan sebelumnya |
  | `/resume <id>` | Resume Session | Lanjutkan kembali percakapan dari sesi yang tersimpan sebelumnya |
  | `/mcp` | MCP Status | Tampilkan status server Model Context Protocol yang terhubung |
  | `/clear` | Context Reset | Bersihkan buffer terminal dan reset riwayat memori percakapan |
  | `/map` | Inspect Repo Map | Tampilkan skeleton AST codebase yang saat ini di-cache & diinjeksi ke prompt |
  | `/cost` | Telemetry Detail | Rincian konsumsi token prompt/completion, biaya USD, dan rata-rata TTFT |
  | `/model <name>` | Switch Model | Ganti model aktif di sesi berjalan tanpa me-restart CLI |
  | `/exit` | Terminate | Keluar dari sesi ASTRA-CLI dengan aman |
- **Output `/help` Preview**:
  ```text
  ASTRA-CLI Commands:
    /help           Show this assistance manual
    /undo           Rollback codebase mutations from last turn
    /add <path>     Pin file to persistent LLM context
    /drop <path>    Unpin file from persistent LLM context
    /compact        Compress & summarize conversation memory
    /history        List previous conversation sessions
    /resume [id]    Resume saved session state
    /mcp            Show connected Model Context Protocol servers
    /clear          Reset conversation context & clear screen
    /map            Display AST codebase architecture skeleton
    /cost           Show token usage & estimated API cost
    /model [name]   View or set active LLM model
    /exit           Quit CLI session

  Shortcuts:
    [Tab]           Toggle PLAN (Read-only) / BUILD (Mutate)
    [Ctrl+C]        Abort current streaming or execution
    [Alt+Enter]     Insert newline for multi-line prompts
  ```
- **Multi-Line Input & Bracketed Paste**:
  - Mendukung paste blok kode panjang tanpa auto-submit parsial (ANSI bracketed paste mode `\x1b[?2004h`).
  - Ketik triple-quotes `"""` atau `Alt+Enter` / `Shift+Enter` untuk membuka multi-line input mode interaktif.
- **Terminal Completion Bell / Sound Chime**:
  - Saat giliran eksekusi atau streaming memakan waktu > 10 detik, terminal memicu audible bell (`\x07`) saat selesai untuk memberi notifikasi ketika developer berada di window lain.
- **Live Latency Stopwatch & Progress Spinner**:
  - Saat request dikirim ke upstream: Terminal merender stopwatch presisi tinggi yang update setiap 100ms:
    `[Thinking... ⠋ 1.8s | TTFT: 620ms]`
  - Menghitung **Time To First Token (TTFT)** untuk memonitor lag reseller proxy.
  - Setelah stream mulai mengalir, stopwatch lanjut menghitung total generation duration:
    `[Streaming... 3.4s (48 tok/s)]`
  - Stopwatch berhenti saat generation/tool execution selesai dan mencatat durasi final turn:
    `[Completed in 4.2s]`
- **Real-Time Token & Cost Telemetry**:
  - Footer bar menampilkan akumulasi token & perkiraan biaya per sesi:
    `[Tokens: 3,420 in / 512 out | Session: $0.0084 | Latency: 2.1s]`
  - Membantu developer mendeteksi reseller proxy yang boros atau membengkak context-nya.
- **Theme**: Minimalist dark CLI (Emerald primary, Cyan network/web, Rose error, Amber warning).
- **Status Indicators**:
  - `[DIFF] src/index.ts (+4, -1 lines)` (Purple badge).
  - `[TOOL] web_search("react 19 router")` (Cyan pill).
  - `[EXEC] npm test` (Emerald pill).
- **Output Renderer**: Streaming markdown token langsung ke stdout via terminal ANSI renderer.

---

## 12. ERROR RECOVERY MATRIX & PROXY RESILIENCY
- **`upstream_stream_error` / Mid-Stream Socket Drop**:
  - **Pemicu**: Proxy seller (`GPT 6 Astra` / Cloudflare gateway) memutus transmisi token di tengah jalan saat streaming output besar (SVG/kode panjang).
  - **Handling**:
    1. Tangkap error event `{"type":"upstream_stream_error"}` atau `ECONNRESET` / `fetch failed`.
    2. Flush & discard partial buffer yang terpotong untuk mencegah syntax korup.
    3. Cetak UI log: `[TRANSPORT] Upstream stream disconnected. Auto-switching to Non-Streaming Atomic Mode...`
    4. Auto-fallback transport untuk turn tersebut ke `stream: false` (request satu kali, tunggu payload JSON utuh).
    5. Jitter backoff `1200ms - 2000ms` sebelum dispatch retry. Max retries: 2x.
- **Multi-File Atomic Transaction Batching**:
  - **Pemicu**: Model memanggil mutasi 3 file berturut-turut dalam 1 turn, tetapi file ke-3 gagal patch/error.
  - **Handling**:
    1. Sebelum mutasi pertama dijalankan, simpan shadow state via Git working tree checkpoint.
    2. Jika ada salah satu patch/write yang melempar exception: Engine otomatis membatalkan file 1 dan file 2 (rollback atomic) dan mengembalikan pesan error ke model: `"Batch transaction aborted: Patch failed on file 3. Working tree restored to clean pre-turn state."`
    3. Mencegah status codebase 'setengah matang' yang merusak build project.
- **`Patch failed` / File Mismatch Self-Healing**:
  - **Pemicu**: Model halusinasi spasi/indentasi atau CRLF/LF file Windows berbeda dari generate model.
  - **Handling**:
    1. Lakukan normalisasi CRLF ↔ LF dan fuzzy indent matching (Tingkat 2 & 3).
    2. Jika tetap gagal, engine mengembalikan error terstruktur ke konteks model: `"Patch failed: Target block not found in file. Action required: Call fs_write with the entire updated file content."`
    3. Engine ReAct otomatis melanjutkan loop ke tool `fs_write` tanpa crash atau abort sesi.
- **Sidecar Linter & Type-Check Auto-Correction Loop (Lint-on-Save)**:
  - **Pemicu**: Tool `fs_patch` atau `fs_write` sukses memodifikasi file kode (`.ts`, `.tsx`, `.js`, `.jsx`, `.py`, `.go`, `.rs`).
  - **Mekanisme**:
    1. Engine mendeteksi runner linter lokal proyek:
       - TypeScript: `npx tsc --noEmit`
       - JavaScript/TypeScript: `npx eslint <file> --quiet`
       - Python: `ruff check <file>` atau `flake8 <file>`
       - Go: `go vet` / Rust: `cargo check --quiet`
    2. Jalankan check secara background (<1.5 detik timeout).
    3. Jika lint check mengembalikan error (exit code != 0): Engine tidak menyelesaikan turn, melainkan secara otomatis menyuntikkan pesan error diagnostik ke ReAct agent:
       `[Sidecar Linter Diagnostic]: Error in src/server.ts:42 - Property 'listen' does not exist on type 'App'. Action: Fix this compilation error.`
    4. Model langsung melakukan patch korektif otomatis tanpa campur tangan pengguna.

---

## 14. MCP (MODEL CONTEXT PROTOCOL) CLIENT INTEGRATION
- **Standard Protocol Support**: JSON-RPC 2.0 via standard I/O (`stdio`) dan SSE transport.
- **Configuration File (`~/.astra/mcp.json` atau `./.astra/mcp.json`)**:
  ```json
  {
    "mcpServers": {
      "postgres": {
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-postgres", "postgresql://localhost/mydb"]
      },
      "github": {
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-github"],
        "env": { "GITHUB_TOKEN": "ghp_xxx" }
      }
    }
  }
  ```
- **Lifecycle & Discovery**:
  1. Saat CLI start, engine spawn child process untuk setiap server di konfigurasi MCP.
  2. Engine memanggil `tools/list` RPC endpoint untuk mengambil daftar tool dan parameter schemas.
  3. Tool MCP otomatis digabungkan ke tool definitions OpenAI format bersama built-in tools (`fs_*`, `bash_exec`, `web_*`).
  4. Perintah `/mcp` di terminal menampilkan tabel server yang aktif, latensi koneksi, dan jumlah tool yang terekspos.

---

## 15. SESSION PERSISTENCE & RESUME ARCHITECTURE
- **Storage Location**: `~/.astra/sessions/<session-id>.json`.
- **Transcript Data Schema**:
  - `id`: UUIDv4 string.
  - `createdAt`: ISO 8601 timestamp.
  - `workspace`: Absolute root directory path.
  - `model`: Nama model LLM yang digunakan.
  - `tokenUsage`: Total input/output token & cost counter.
  - `messages`: Array lengkap riwayat percakapan (system, user, assistant, tool results).
- **CLI Commands & Flags**:
  - `astra --resume`: Melanjutkan sesi paling terakhir di workspace saat ini.
  - `astra --resume <session-id>`: Memuat ulang percakapan spesifik berdasarkan ID.
  - `/history`: Menampilkan tabel 10 sesi terakhir (ID, timestamp, prompt pertama, jumlah turn, token).
  - `/resume <session-id>`: Beralih ke sesi tersimpan langsung dari dalam REPL prompt yang sedang aktif.

---

## 16. DELIVERABLES & ACCEPTANCE CRITERIA
1. **Single Entry Point**: `npx astra-cli` atau `node bin/agent.js`.
2. **Acceptance Test 1 (Plan/Build Switch)**: Tekan `Tab` di prompt terminal → badge berubah `[PLAN]` ↔ `[BUILD]` seketika tanpa crash/buffer flush.
3. **Acceptance Test 2 (Plan Enforcement)**: Dalam mode `PLAN`, input `"hapus file temp.txt"` → model dilarang panggil `bash_exec`/`fs_write`, hanya buat rencana teks.
4. **Acceptance Test 3 (Coding)**: Dalam mode `BUILD`, input `"buat REST API hono di file index.ts lalu jalankan test"` → agent create file + run command tanpa human intervention.
5. **Acceptance Test 4 (Web Browser)**: Input `"baca changelog Next.js 15 dari web resminya dan rangkum"` → agent execute `web_search` → `web_fetch` → cetak markdown rangkuman akurat.
6. **Acceptance Test 5 (Stream Socket Drop Recovery)**: Simulasi socket close saat output > 2.000 token → agent otomatis tangkap `upstream_stream_error` → fallback ke `stream: false` → file SVG/HTML berhasil ditulis utuh.
7. **Acceptance Test 6 (Patch Self-Healing)**: File dengan CRLF Windows di-patch model dengan string LF → normalizer sukses merge diff; jika baris target halusinasi total → agent otomatis fallback memanggil `fs_write`.
8. **Acceptance Test 7 (Git Auto-Checkpoint & /undo)**: Jalankan prompt yang mengubah 3 file → ketik `/undo` → working directory kembali identik ke state awal dalam <0.2 detik.
9. **Acceptance Test 8 (AST Repo Map Indexing)**: Di project berukuran 50 file → jalankan ASTRA-CLI → periksa context LLM: berisi signature kelas/fungsi ringkas <1.500 token tanpa membaca isi file utuh.
10. **Acceptance Test 9 (Unified ANSI Diff Viewer)**: Model mengubah fungsi → terminal merender blok diff hijau/merah dengan hunk line numbers sebelum perubahan ditulis ke disk.
11. **Acceptance Test 10 (Stopwatch & Telemetry)**: Kirim prompt complex → terminal menampilkan live timer berkedip `Thinking... (X.Xs)` dan mengunci `TTFT` saat token 1 muncul, diakhiri total token + cost display di status footer.
12. **Acceptance Test 11 (.astraignore Enforcement)**: Tambahkan file rahasia `.env.production` ke `.astraignore` → suruh agent membaca isi file tersebut → engine melempar access denied tanpa mengirim konten ke prompt.
13. **Acceptance Test 12 (Multi-File Atomic Rollback)**: Turn memodifikasi 2 file sukses dan file ke-3 gagal patch → verifikasi disk: file 1 dan 2 otomatis dikembalikan ke kondisi awal tanpa artefak tertinggal.
14. **Acceptance Test 13 (Project Rule Auto-Load)**: Buat file `ASTRA.md` berisi aturan `"Selalu gunakan TypeScript strict mode"` → jalankan sesi baru → verifikasi pesan system prompt pertama: aturan `ASTRA.md` otomatis terinjeksi.
15. **Acceptance Test 14 (Context Pinning /add & /drop)**: Ketik `/add src/auth.ts` → status bar menampilkan `Pinned: [src/auth.ts]` dan konten file selalu disematkan di prompt tanpa tergantung tool call `fs_read`; ketik `/drop src/auth.ts` → file terlepas dari pinned memory.
16. **Acceptance Test 15 (Manual /compact)**: Setelah percakapan 15 giliran → ketik `/compact` → engine merangkum riwayat lama jadi 1 pesan ringkasan terkompresi dan token usage context berkurang drastis.
17. **Acceptance Test 16 (Bracketed Paste & Audio Chime)**: Paste 200 baris kode sekaligus → terminal menerima tanpa glitch parsial; jalankan task yang memakan waktu > 10 detik → terminal membunyikan ASCII BEL chime (`\x07`) saat task selesai.
18. **Acceptance Test 17 (Lint-on-Save Self-Correction)**: Model menulis fungsi TypeScript dengan type error sengaja → background linter mendeteksi error → engine otomatis feed error ke model → model memperbaiki kode secara mandiri hingga lulus tsc.
19. **Acceptance Test 18 (MCP Server Invocation)**: Hubungkan server `@modelcontextprotocol/server-postgres` di `mcp.json` → ketik `/mcp` → tabel menampilkan server connected; model dapat mengeksekusi query database via tool RPC.
20. **Acceptance Test 19 (Session Resume)**: Tutup terminal saat sesi berjalan → ketik `astra --resume` di terminal baru → context 100% pulih lengkap dengan riwayat git checkpoint dan memory conversation.
