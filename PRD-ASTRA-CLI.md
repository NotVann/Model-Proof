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

## 6. CONTEXT MANAGEMENT & TOKEN BUDGETING
- **Max Window Threshold**: 80% dari target window model (default: 64k / 128k token).
- **Token Estimator**: Heuristik BPE (~3.8 char/token).
- **Compaction Strategy**:
  - `Keep System Prompt`: Lock index 0 (selalu utuh).
  - `Rolling Window Tool Truncation`: Pangkas output tool lama (`fs_read`, `bash_exec`, `web_fetch`) jadi placeholder: `[Output truncated. File content previously inspected.]`.
  - `Summary Injection`: Jika context > threshold, panggil LLM satu kali via payload khusus untuk merangkum percakapan lama → replace rentang message 1 s/d N dengan 1 summary block.

---

## 7. SECURITY & SAFETY SANDBOX
1. **Command Blocklist (Hard Reject)**:
   - Linux: `rm -rf /`, `mkfs`, `:(){ :|:& };:`, `dd if=/dev/zero`.
   - Windows: `format c:`, `Remove-Item -Recurse C:\Windows`.
2. **Interactive Gate**:
   - Tampilkan ANSI border merah saat model memanggil destructive command.
   - User harus ketik `y` / `n` di terminal sebelum eksekusi berjalan.
3. **Zero Leaks**:
   - Larang tool mengirim nilai `.env` / `API_KEY` ke internet via tool parameters.

---

## 8. CLI UI & INTERACTION SPEC
- **Dynamic Prompt String**:
  - Plan Mode: `astra-cli [PLAN] [main*]> ` (Cyan badge)
  - Build Mode: `astra-cli [BUILD] [main*]> ` (Emerald badge)
- **Keybinding Status Bar**: `[Tab] Switch Mode | [Ctrl+C] Abort | [exit] Quit`
- **Theme**: Minimalist dark CLI (Emerald primary, Cyan network/web, Rose error, Amber warning).
- **Status Indicators**:
  - `Thinking...` (Braille spinner).
  - `[TOOL] web_search("react 19 router")` (Cyan pill).
  - `[EXEC] npm test` (Emerald pill).
- **Output Renderer**: Streaming markdown token langsung ke stdout via terminal ANSI renderer.

---

## 9. ERROR RECOVERY MATRIX & PROXY RESILIENCY
- **`upstream_stream_error` / Mid-Stream Socket Drop**:
  - **Pemicu**: Proxy seller (`GPT 6 Astra` / Cloudflare gateway) memutus transmisi token di tengah jalan saat streaming output besar (SVG/kode panjang).
  - **Handling**:
    1. Tangkap error event `{"type":"upstream_stream_error"}` atau `ECONNRESET` / `fetch failed`.
    2. Flush & discard partial buffer yang terpotong untuk mencegah syntax korup.
    3. Cetak UI log: `[TRANSPORT] Upstream stream disconnected. Auto-switching to Non-Streaming Atomic Mode...`
    4. Auto-fallback transport untuk turn tersebut ke `stream: false` (request satu kali, tunggu payload JSON utuh).
    5. Jitter backoff `1200ms - 2000ms` sebelum dispatch retry. Max retries: 2x.
- **`Patch failed` / File Mismatch Self-Healing**:
  - **Pemicu**: Model halusinasi spasi/indentasi atau CRLF/LF file Windows berbeda dari generate model.
  - **Handling**:
    1. Lakukan normalisasi CRLF ↔ LF dan fuzzy indent matching (Tingkat 2 & 3).
    2. Jika tetap gagal, engine mengembalikan error terstruktur ke konteks model: `"Patch failed: Target block not found in file. Action required: Call fs_write with the entire updated file content."`
    3. Engine ReAct otomatis melanjutkan loop ke tool `fs_write` tanpa crash atau abort sesi.
- **HTTP 401 Unauthorized**: Cetak "Invalid API Key" → exit(1).
- **HTTP 429 Rate Limit**: Sleep backoff `(Math.random() * 1000) + 1500ms` → retry max 2x.
- **HTTP 502/504 Bad Gateway (Reseller Proxy Lag)**: Retry via non-streaming mode payload.
- **Model Loop Hallucination**: Max 10 consecutive tool calls tanpa text reply user → abort loop dan kembalikan kontrol ke stdin.

---

## 10. DELIVERABLES & ACCEPTANCE CRITERIA
1. **Single Binary / Entry point**: `npx astra-cli` atau `node bin/agent.js`.
2. **Acceptance Test 1 (Plan/Build Switch)**: Tekan `Tab` di prompt terminal → badge berubah `[PLAN]` ↔ `[BUILD]` seketika tanpa crash/buffer flush.
3. **Acceptance Test 2 (Plan Enforcement)**: Dalam mode `PLAN`, input `"hapus file temp.txt"` → model dilarang panggil `bash_exec`/`fs_write`, hanya buat rencana teks.
4. **Acceptance Test 3 (Coding)**: Dalam mode `BUILD`, input `"buat REST API hono di file index.ts lalu jalankan test"` → agent create file + run command tanpa human intervention.
5. **Acceptance Test 4 (Web Browser)**: Input `"baca changelog Next.js 15 dari web resminya dan rangkum"` → agent execute `web_search` → `web_fetch` → cetak markdown rangkuman akurat.
6. **Acceptance Test 5 (Stream Socket Drop Recovery)**: Simulasi socket close saat output > 2.000 token → agent otomatis tangkap `upstream_stream_error` → fallback ke `stream: false` → file SVG/HTML berhasil ditulis utuh.
7. **Acceptance Test 6 (Patch Self-Healing)**: File dengan CRLF Windows di-patch model dengan string LF → normalizer sukses merge diff; jika baris target halusinasi total → agent otomatis fallback memanggil `fs_write`.
