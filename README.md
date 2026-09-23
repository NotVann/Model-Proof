# ModelProof 🛡️
> Zero-persistence client-side and CLI forensic scanner to detect LLM model spoofing, proxy masking, and silent downgrades.

Available as:
- **Web App**: 100% Client-side sandbox deployable on GitHub Pages.
- **Node.js CLI**: Run instantly via `npx modelproof`.
- **Python CLI**: Run via `pip install modelproof` or `python -m modelproof.cli`.

---

## ⚡ 10-Vector Detection Matrix

1. **Spatial Logic & Character Horizon**: Obfuscated character counting trap (`'s-t-r-a-w-b-e-r-r-y'`) + runtime multiplication trap.
2. **Tokenizer Usage & BPE Precision**: Multi-byte Unicode sequence testing token discrepancy and upstream token stripping.
3. **Internal System Identity & Vendor Breakout**: Adversarial prompts probing foundational weights and vendor disavowal.
4. **Streaming Telemetry & Speed Profiling (TTFT & TPS)**: Real-time SSE stream parser measuring Time-to-First-Token and Tokens-per-Second.
5. **Negative Constraint Compliance**: Enforces strict negative constraints (zero fluff, raw CSV/SVG).
6. **Strict Schema / Constrained Decoding**: Tests native JSON Schema strict parsing (crashes weak proxy engines).
7. **Glitched Token Embedding Anomaly**: Probes unspeakable tokens (`SolidGoldMagikarp`) tokenizer behavior.
8. **Temporal Cutoff Horizon (2024-H2)**: Validates late-2024 events (Nobel October 2024, Python 3.13).
9. **Reasoning CoT & Delimiter Trap**: Checks reasoning tokens vs `<think>` tags (detects DeepSeek-R1 masked as OpenAI o1).
10. **High-Order Type Logic**: Tests compiler-level Rust lifetime borrow checker & HRTB syntax.

---

## 💻 CLI Quickstart

### Option A: NPX (No installation required)
```bash
# Instant audit via npx
npx modelproof -u "https://router.arzastore.com/v1" -k "sk-..." -m "qwen-3-8-max"

# Deep audit with all 10 vectors + JSON output
npx modelproof -u "https://api.openai.com/v1" -k "$OPENAI_API_KEY" -m "gpt-4o" --all --json
```

### Option B: Python (PIP)
```bash
# Install package
pip install modelproof

# Run audit
modelproof -u "https://router.arzastore.com/v1" -k "sk-..." -m "qwen-3-8-max"

# Audit catalog only
modelproof -u "https://router.arzastore.com/v1" -k "sk-..." --models-only
```

### CLI Options:
| Flag | Description | Default |
| :--- | :--- | :--- |
| `-u, --base-url` | Reverse proxy base URL | `https://api.openai.com/v1` |
| `-k, --key` | API Token / Key | `$OPENAI_API_KEY` |
| `-m, --model` | Claimed model profile | `claude-3-5-sonnet-20241022` |
| `-p, --protocol` | Protocol wire schema (`auto`, `openai`, `anthropic`) | `auto` |
| `-a, --all` | Run all 10 vectors (default: 8 fast vectors) | `false` |
| `--models-only` | Audit `/v1/models` catalog only | `false` |
| `--lang` | Report language (`en`, `id`) | `en` |
| `--json` | Output pure JSON for CI/CD | `false` |
| `--timeout` | Request timeout in seconds | `30` |

---

## 🌐 Web App Deployment (GitHub Pages)

1. Push this directory to your GitHub repository:
   ```bash
   git add .
   git commit -m "feat: initial release"
   git branch -M main
   git push -u origin main
   ```
2. In your GitHub repo:
   - Go to **Settings** → **Pages**.
   - Under **Build and deployment** > **Source**, choose **Deploy from a branch**.
   - Select branch `main` and folder `/ (root)`.
   - Click **Save**.
3. Your app is live at `https://<your-username>.github.io/<your-repo-name>/`.

---

## 🔒 Privacy & Security

- **Zero Telemetry**: All requests travel strictly between your client and your designated proxy.
- **In-Memory**: API keys are never persisted or shared.
- **Open Source**: Full code inspection available under the MIT License.
