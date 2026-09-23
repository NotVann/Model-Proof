# ModelMaskScanner 🛡️

100% Serverless, client-side tool to detect AI model masking, reverse-proxy downgrading, and inference spoofing (e.g. seller claiming Claude 3.5 Sonnet or GPT-4o, but routing to GPT-4o-mini or Llama-3-8B).

Live on **GitHub Pages** with zero backend infrastructure.

---

## ⚡ 5-Vector Detection Matrix

1. **Logic & Spatial Reasoning Horizon**
   - Obfuscated character counting trap (`'s-t-r-a-w-b-e-r-r-y'`) + multi-step constraints.
   - Low-tier models (GPT-3.5, Mini, Llama-8B) fail character indexing while Flagship models pass.
2. **Tokenizer Usage & BPE Precision**
   - Sends crafted multi-byte Unicode sequence.
   - Flags anomalies when reported `prompt_tokens` diverges from target tokenizer standards (e.g. `o200k_base` vs `cl100k_base`).
3. **Internal System Identity & Vendor Reflection**
   - Adversarial prompt designed to bypass seller's custom system prompt injection.
   - Catches cross-vendor spoofs (e.g. seller claiming Claude, model answers with OpenAI/DeepSeek identity).
4. **Streaming Telemetry & Speed Profiling (TTFT & TPS)**
   - Real-time SSE stream parser measuring Time-to-First-Token (TTFT) and Tokens-per-Second (TPS).
   - Catches ultra-fast hardware spoofing (e.g. Groq/SambaNova running Llama at 300+ TPS sold as Claude).
5. **Zero-Fluff Formatting Discipline**
   - Enforces strict negative constraints (no conversational preambles, pure raw SVG tags).
   - Mini/low-tier models consistently fail negative constraints.

---

## 🚀 How to Deploy to GitHub Pages (1 Minute)

1. Push this directory to your GitHub repository:
   ```bash
   git add .
   git commit -m "feat: initial release"
   git remote add origin https://github.com/<your-username>/<your-repo-name>.git
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

## 🌐 CORS Notice & Optional Relay Worker

Most reseller proxies (NewAPI, OneAPI, LiteLLM) have `Access-Control-Allow-Origin: *` enabled by default, so direct browser calls work out-of-the-box.

If a seller's custom domain blocks browser CORS, deploy this 10-line Cloudflare Worker (Free tier) as a transparent relay:

```javascript
export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "*"
        }
      });
    }
    const url = new URL(request.url);
    const target = url.searchParams.get("url") || url.pathname.slice(1);
    const res = await fetch(target, {
      method: request.method,
      headers: request.headers,
      body: request.body
    });
    const newHeaders = new Headers(res.headers);
    newHeaders.set("Access-Control-Allow-Origin", "*");
    return new Response(res.body, { status: res.status, headers: newHeaders });
  }
};
```
Paste your worker URL into the **CORS Relay Settings** field in the UI.

---

## 🔒 Privacy & Security

- 100% Client-Side execution (`fetch()` directly from browser).
- API keys are stored solely in browser `localStorage` or memory.
- Zero server-side logging or tracking.
