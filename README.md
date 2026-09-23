<p align="center">
  <img src="favicon.svg" width="64" height="64" alt="ModelProof Logo" />
</p>

<h1 align="center">ModelProof</h1>

<p align="center">
  <strong>Zero-persistence client-side and CLI forensic scanner to detect LLM model spoofing, reverse-proxy masking, and silent downgrades.</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/modelproof"><img src="https://img.shields.io/npm/v/modelproof.svg?color=10b981&label=npm" alt="npm version" /></a>
  <a href="https://pypi.org/project/modelproof/"><img src="https://img.shields.io/pypi/v/modelproof.svg?color=10b981&label=pypi" alt="pypi version" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License" /></a>
  <img src="https://img.shields.io/badge/zero-telemetry-emerald" alt="Zero Telemetry" />
  <img src="https://img.shields.io/badge/dependencies-0-brightgreen" alt="Zero Dependencies" />
</p>

<p align="center">
  <strong>English</strong> | <a href="README.id.md">Bahasa Indonesia</a>
</p>

---

## Overview

Unauthorized LLM resellers and reverse-proxy providers often engage in model spoofing:
- Re-routing expensive requests (e.g. `claude-3-5-sonnet`, `gpt-4o`) to cheaper open-weights models (`qwen-2.5-72b`, `deepseek-v3`, or quantized mini variants).
- Stripping system instructions and inserting hidden proxy jailbreaks.
- Fabricating fake model IDs in `/v1/models` catalogs.

ModelProof provides developers, QA engineers, and consumers with a verifiable forensic audit trail and an authenticity confidence score (0-100%) before trusting an endpoint in production.

---

## Why This Matters

1. **Financial Arbitrage (Paying Flagship, Receiving Commodity)**:
   Resellers charge premium rates for flagship models while silently routing traffic to commodity models costing a fraction of the price. Users overpay up to 15x for degraded intelligence.

2. **Silent Production Breakage**:
   Substituted models fail on nuanced reasoning, strict JSON Schema compliance, tool calling, and high-order logic, causing silent corruption in autonomous agents and backend pipelines.

3. **Data Exfiltration and Prompt Manipulation**:
   Untrusted reverse-proxy layers may log raw prompts, inject hidden system preambles, or manipulate token streams before forwarding to unvetted upstream endpoints.

4. **Actionable Dispute Evidence**:
   ModelProof generates deterministic, timestamped forensic audit reports that can be used directly as technical proof for refund requests or merchant disputes.

---

## Distribution Modes

| Platform | Distribution | Execution Command | Zero Dependencies |
| :--- | :--- | :--- | :---: |
| **Terminal (Node.js)** | NPM Registry | `npx modelproof` | Yes |
| **Terminal (Python)** | PyPI Package | `pip install modelproof` | Yes |
| **Browser (Web Sandbox)** | Static Client | `index.html` (Local / Static Host) | Yes |

---

## 10-Vector Forensic Detection Matrix

ModelProof executes 10 adversarial probes calibrated against official model weight checkpoints:

| # | Forensic Vector | Target Vulnerability / Anomaly | Mode |
| :-: | :--- | :--- | :-: |
| **01** | **Spatial Logic & Character Horizon** | Obfuscated character counting (`'s-t-r-a-w-b-e-r-r-y'`) + arithmetic runtime trap | FAST |
| **02** | **Tokenizer Usage & BPE Precision** | Multi-byte Unicode sequence testing token discrepancy and upstream token stripping | FAST |
| **03** | **System Instruction & Identity Leak** | Adversarial system prompt breakout probing true base weights and vendor confessions | FAST |
| **04** | **Hardware Telemetry & TPS Profile** | Real-time SSE stream parser detecting hyper-fast LPU hardware (>220 TPS SambaNova/Groq) | FAST |
| **05** | **Negative Constraint Compliance** | Rigid formatting constraints without conversational fluff or apology preambles | FAST |
| **06** | **Strict Schema / Constrained Decoding** | Enforces native JSON Schema strict parsing (crashes weak proxy engines) | DEEP |
| **07** | **Glitched Token Embedding Anomaly** | Unspeakable tokens (`SolidGoldMagikarp`) tokenizer behavior checks | FAST |
| **08** | **Temporal Cutoff Horizon (2024-H2)** | Probes post-training cutoff events (Python 3.13, Nobel Oct 2024) | FAST |
| **09** | **Reasoning CoT & Delimiter Trap** | Detects OpenAI `o1`/`o3` masked as DeepSeek-R1 via `<think>` token analysis | DEEP |
| **10** | **Type-Level Memory & Lifetime Logic** | Compiler-level Rust borrow checker & HRTB (`for<'a>`) lifetime reasoning | DEEP |

---

## CLI Quickstart

Both the Node.js and Python CLIs are 100% zero-dependency, running directly with native system runtimes (`fetch` and standard library `urllib`).

### 1. Node.js (NPX)

Run directly without installing:

```bash
# Basic scan against custom reverse proxy
npx modelproof -u "https://my-proxy.com/v1" -k "sk-..." -m "claude-3-5-sonnet-20241022"

# Deep audit running all 10 vectors with JSON output (CI/CD ready)
npx modelproof -u "https://my-proxy.com/v1" -k "sk-..." -m "gpt-4o" --all --json

# Inspect available models from upstream catalog
npx modelproof -u "https://my-proxy.com/v1" -k "sk-..." --models-only
```

### 2. Python (PIP)

Install from PyPI:

```bash
pip install modelproof
```

Run audit:

```bash
# Audit model authenticity
modelproof -u "https://my-proxy.com/v1" -k "sk-..." -m "gpt-4o"

# Run in Indonesian language
modelproof -u "https://my-proxy.com/v1" -k "sk-..." -m "claude-3-5-sonnet-20241022" --lang id

# Run all 10 deep vectors
modelproof -u "https://my-proxy.com/v1" -k "sk-..." --all
```

Or execute without global install:
```bash
python -m modelproof.cli -u "https://my-proxy.com/v1" -k "sk-..." -m "gpt-4o"
```

---

## CLI Options & Flags

```text
Usage: modelproof [options]

Options:
  -u, --base-url <url>      Reverse proxy base URL (default: "https://api.openai.com/v1")
  -k, --key <token>         API Token / Key (or set OPENAI_API_KEY env var)
  -m, --model <id>          Claimed target model ID (default: "claude-3-5-sonnet-20241022")
  -p, --protocol <proto>    Protocol wire schema: auto, openai, anthropic (default: "auto")
  -a, --all                 Run all 10 deep vectors (default: 8 fast vectors)
  --models-only             Audit upstream /v1/models catalog only and exit
  --lang <lang>             Output language: en, id (default: "en")
  --json                    Output pure machine-readable JSON report
  --timeout <sec>           Per-request timeout in seconds (default: 30)
  -v, --version             Show version number
  -h, --help                Display help message
```

---

## Sample Terminal Output

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
 AUTHENTICITY SCORE   : 100%
 VERDICT              : VERIFIED GENUINE
 DETECTED VENDOR      : Anthropic Claude
 RISK LEVEL           : SAFE

 [+] CONCLUSION: Target verified consistent with genuine foundational weights.
================================================================================
```

---

## Security, Privacy & Compliance

- **Zero Telemetry Retention**: ModelProof never logs, collects, or transmits API keys, base URLs, or payload data to any external server.
- **Client-Side Sandbox**: In the web interface, network traffic travels directly from your browser to your designated proxy endpoint.
- **In-Memory Volatility**: Credentials exist strictly in runtime volatile memory and are cleared upon termination or reload.

---

## License

Distributed under the [MIT License](LICENSE).
