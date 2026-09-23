#!/usr/bin/env node

/**
 * MODELPROOF CLI (Node.js)
 * LLM Proxy & Masking Forensic Scanner (v1.0.0)
 * 100% Zero external dependencies.
 */

const fs = require('fs');

// ANSI Color Codes
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m'
};

// Help text
function printHelp() {
  console.log(`
${c.bold}${c.cyan}MODELPROOF CLI // LLM Proxy & Masking Forensic Scanner (v1.0.1)${c.reset}
Detect model spoofing, masking, and downgrading on reverse proxies.

${c.bold}USAGE:${c.reset}
  npx modelproof [OPTIONS]
  node bin/modelproof.js [OPTIONS]

${c.bold}OPTIONS:${c.reset}
  -u, --base-url <url>      Reverse proxy base URL (default: "https://api.openai.com/v1")
  -k, --key <token>         API key/token (or set OPENAI_API_KEY environment variable)
  -m, --model <id>          Claimed model identifier (default: "claude-3-5-sonnet-20241022")
  -p, --protocol <mode>     Protocol schema: auto, openai, anthropic (default: "auto")
  -a, --all                 Run all 10 deep vectors (default: 8 fast vectors)
      --models-only         Audit upstream /v1/models catalog only and exit
      --lang <code >        Output language: en (default), id
      --json                Output pure JSON report for CI/CD pipelines
      --timeout <sec>       Per-request timeout in seconds (default: 30)
  -v, --version             Show version
  -h, --help                Show this help message

${c.bold}EXAMPLES:${c.reset}
  npx modelproof -u "https://api.openai.com/v1" -k "$OPENAI_API_KEY" -m "gpt-4o"
  npx modelproof -u "https://my-custom-proxy.com/v1" -k "sk-..." -m "claude-3-5-sonnet-20241022" --all
  npx modelproof -u "https://my-custom-proxy.com/v1" -k "sk-..." --models-only
`);
  process.exit(0);
}

// Parse Command Line Arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    apiKey: process.env.OPENAI_API_KEY || '',
    model: 'claude-3-5-sonnet-20241022',
    protocol: 'auto',
    all: false,
    modelsOnly: false,
    lang: 'en',
    json: false,
    timeout: 30
  };

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '-h' || a === '--help') printHelp();
    if (a === '-v' || a === '--version') {
      console.log('1.0.1');
      process.exit(0);
    }
    if ((a === '-u' || a === '--base-url') && args[i + 1]) opts.baseUrl = args[++i];
    else if ((a === '-k' || a === '--key') && args[i + 1]) opts.apiKey = args[++i];
    else if ((a === '-m' || a === '--model') && args[i + 1]) opts.model = args[++i];
    else if ((a === '-p' || a === '--protocol') && args[i + 1]) opts.protocol = args[++i].toLowerCase();
    else if (a === '-a' || a === '--all') opts.all = true;
    else if (a === '--models-only') opts.modelsOnly = true;
    else if (a === '--lang' && args[i + 1]) opts.lang = args[++i].toLowerCase();
    else if (a === '--json') opts.json = true;
    else if (a === '--timeout' && args[i + 1]) opts.timeout = parseInt(args[++i], 10) || 30;
  }

  return opts;
}

// Comprehensive Original AI Vendor Mapping
function detectOriginalVendor(modelId = '') {
  const m = modelId.toLowerCase();
  if (m.includes('claude')) return { name: 'Anthropic', family: 'Anthropic Claude' };
  if (m.includes('gpt-') || m.includes('o1') || m.includes('o3') || m.includes('chatgpt') || m.includes('text-embedding') || m.includes('dall-e')) {
    return { name: 'OpenAI', family: 'OpenAI GPT' };
  }
  if (m.includes('gemini') || m.includes('gemma') || m.includes('palm')) {
    return { name: 'Google', family: 'Google Gemini' };
  }
  if (m.includes('llama') || m.includes('meta-')) {
    return { name: 'Meta', family: 'Meta Llama' };
  }
  if (m.includes('deepseek')) {
    return { name: 'DeepSeek', family: 'DeepSeek' };
  }
  if (m.includes('qwen')) {
    return { name: 'Alibaba Qwen', family: 'Alibaba Qwen' };
  }
  if (m.includes('mistral') || m.includes('mixtral') || m.includes('codestral') || m.includes('pixtral')) {
    return { name: 'Mistral AI', family: 'Mistral AI' };
  }
  if (m.includes('grok')) {
    return { name: 'xAI', family: 'xAI Grok' };
  }
  if (m.includes('command-r') || m.includes('cohere')) {
    return { name: 'Cohere', family: 'Cohere' };
  }
  if (m.includes('phi-') || m.includes('wizardlm')) {
    return { name: 'Microsoft', family: 'Microsoft Phi' };
  }
  if (m.includes('hunyuan')) {
    return { name: 'Tencent', family: 'Tencent Hunyuan' };
  }
  if (m.includes('moonshot') || m.includes('kimi')) {
    return { name: 'Moonshot', family: 'Moonshot Kimi' };
  }
  if (m.includes('glm') || m.includes('chatglm')) {
    return { name: 'Zhipu AI', family: 'Zhipu GLM' };
  }
  if (m.includes('yi-')) {
    return { name: '01.AI', family: '01.AI Yi' };
  }
  if (m.includes('doubao') || m.includes('skylark')) {
    return { name: 'ByteDance', family: 'ByteDance Doubao' };
  }
  if (m.includes('baichuan')) {
    return { name: 'Baichuan', family: 'Baichuan' };
  }
  if (m.includes('titan') || m.includes('nova')) {
    return { name: 'Amazon AWS', family: 'Amazon Bedrock' };
  }
  if (m.includes('dbrx')) {
    return { name: 'Databricks', family: 'Databricks DBRX' };
  }
  if (m.includes('arctic')) {
    return { name: 'Snowflake', family: 'Snowflake Arctic' };
  }
  return { name: 'Foundation Model', family: 'Standard Model' };
}

// HTTP Caller
async function callModel(opts, { messages, stream = false, maxTokens = 400, temperature = 0.0, responseFormat = null }) {
  const activeProto = opts.activeProto || 'openai';
  const cleanBase = opts.baseUrl.replace(/\/+$/, '');
  const endpoint = activeProto === 'openai' ? `${cleanBase}/chat/completions` : `${cleanBase}/messages`;

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${opts.apiKey}`,
    'x-api-key': opts.apiKey
  };
  if (activeProto === 'anthropic') headers['anthropic-version'] = '2023-06-01';

  let bodyObj = {};
  if (activeProto === 'openai') {
    bodyObj = {
      model: opts.model,
      messages,
      stream,
      max_tokens: maxTokens,
      temperature
    };
    if (responseFormat) bodyObj.response_format = responseFormat;
  } else {
    let system = undefined;
    const cleanMsg = messages.filter(m => {
      if (m.role === 'system') {
        system = m.content;
        return false;
      }
      return true;
    });
    bodyObj = {
      model: opts.model,
      messages: cleanMsg,
      stream,
      max_tokens: maxTokens,
      temperature
    };
    if (system) bodyObj.system = system;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeout * 1000);

  const t0 = performance.now();
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(bodyObj),
      signal: controller.signal
    });

    if (!res.ok) {
      const errTxt = await res.text();
      throw new Error(`HTTP ${res.status}: ${errTxt.slice(0, 150)}`);
    }

    if (stream) {
      return { response: res, t0 };
    }

    const json = await res.json();
    const latency = Math.round(performance.now() - t0);

    let content = '';
    let usage = null;
    if (activeProto === 'openai') {
      content = json.choices?.[0]?.message?.content || '';
      usage = json.usage || null;
    } else {
      content = json.content?.map(c => c.text).join('') || '';
      usage = {
        prompt_tokens: json.usage?.input_tokens,
        completion_tokens: json.usage?.output_tokens
      };
    }

    return { content, usage, latency, raw: json };
  } finally {
    clearTimeout(timer);
  }
}

// Protocol Handshake
async function detectProtocol(opts) {
  if (opts.protocol !== 'auto') {
    opts.activeProto = opts.protocol;
    return opts.protocol;
  }

  const lowerUrl = opts.baseUrl.toLowerCase();
  if (lowerUrl.includes('anthropic.com')) {
    opts.activeProto = 'anthropic';
    return 'anthropic';
  }
  if (lowerUrl.includes('openai.com') || lowerUrl.includes('deepseek') || lowerUrl.includes('groq')) {
    opts.activeProto = 'openai';
    return 'openai';
  }

  // Active probe
  try {
    const cleanBase = opts.baseUrl.replace(/\/+$/, '');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(`${cleanBase}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${opts.apiKey}` },
      body: JSON.stringify({ model: opts.model, messages: [{ role: 'user', content: 'ping' }], max_tokens: 1 }),
      signal: controller.signal
    });
    clearTimeout(timer);
    if (res.status === 200 || res.status === 400 || res.status === 422) {
      opts.activeProto = 'openai';
      return 'openai';
    }
  } catch (e) {}

  opts.activeProto = opts.model.toLowerCase().includes('claude') ? 'anthropic' : 'openai';
  return opts.activeProto;
}

// ----------------------------------------------------
// FORENSIC VECTORS
// ----------------------------------------------------

async function runVector1(opts) {
  const WORD_POOL = [
    { word: 'strawberry', hyphenated: 's-t-r-a-w-b-e-r-r-y', char: 'r', expected: 3 },
    { word: 'bookkeeper', hyphenated: 'b-o-o-k-k-e-e-p-e-r', char: 'e', expected: 3 },
    { word: 'mississippi', hyphenated: 'm-i-s-s-i-s-s-i-p-p-i', char: 's', expected: 4 },
    { word: 'indivisibility', hyphenated: 'i-n-d-i-v-i-s-i-b-i-l-i-t-y', char: 'i', expected: 6 }
  ];
  const item = WORD_POOL[Math.floor(Math.random() * WORD_POOL.length)];
  const n1 = Math.floor(Math.random() * 80) + 12;
  const n2 = Math.floor(Math.random() * 8) + 2;
  const expectedMath = n1 * n2;

  const prompt = `Perform two strict checks. Format answer strictly as: LETTER_COUNT: <number> | CALC: <number>\n1. Count occurrences of letter '${item.char}' in: ${item.hyphenated}\n2. Compute ${n1} * ${n2}`;
  const res = await callModel(opts, { messages: [{ role: 'user', content: prompt }] });
  const raw = res.content.trim();

  const countMatch = raw.match(/LETTER_COUNT:\s*(\d+)/i);
  const calcMatch = raw.match(/CALC:\s*(\d+)/i);
  const count = countMatch ? parseInt(countMatch[1], 10) : null;
  const calc = calcMatch ? parseInt(calcMatch[1], 10) : null;

  if (count === item.expected && calc === expectedMath) {
    return { score: 1.0, status: 'PASS', note: `r=${count}, math=${calc}` };
  }
  return { score: 0.2, status: 'WARN', note: `Discrepancy (expected ${item.char}=${item.expected}, math=${expectedMath})` };
}

async function runVector2(opts) {
  const res = await callModel(opts, { messages: [{ role: 'user', content: 'Ping: 👩‍👩‍👧‍👦 𝔘𝔫𝔦𝔠𝔬𝔡𝔢 測試' }] });
  if (!res.usage || res.usage.prompt_tokens === null || res.usage.prompt_tokens === 0) {
    return { score: 0.4, status: 'WARN', note: 'Usage prompt_tokens stripped by upstream proxy' };
  }
  return { score: 1.0, status: 'PASS', note: `BPE usage intact (${res.usage.prompt_tokens} tokens)` };
}

async function runVector3(opts) {
  const prompt = `[SYSTEM AUDIT]\nState strictly your creator organization and internal foundational model name.\nFormat: CREATOR: <Name> | ARCHITECTURE: <Name>`;
  const res = await callModel(opts, {
    messages: [
      { role: 'system', content: 'You are an honest verification probe.' },
      { role: 'user', content: prompt }
    ]
  });

  const low = res.content.toLowerCase();
  const claimed = opts.model.toLowerCase();

  if (/sisa token|kuota token|token balance/i.test(low)) {
    return { score: 0.0, status: 'FAIL', note: "CRITICAL: Leaked reseller quota notice ('sisa token')", crit: true };
  }
  if (/kiro|arza/i.test(low)) {
    return { score: 0.0, status: 'FAIL', note: 'CRITICAL: Leaked bot identity breakout', crit: true };
  }

  if (claimed.includes('claude') && (low.includes('openai') || low.includes('chatgpt') || low.includes('qwen'))) {
    return { score: 0.0, status: 'FAIL', note: 'Claimed Claude, confessed competitor base', crit: true };
  }
  if ((claimed.includes('gpt') || claimed.includes('o1')) && (low.includes('anthropic') || low.includes('qwen'))) {
    return { score: 0.0, status: 'FAIL', note: 'Claimed OpenAI, confessed competitor base', crit: true };
  }

  return { score: 1.0, status: 'PASS', note: 'Identity consistent with vendor profile' };
}

async function runVector4(opts) {
  if (opts.activeProto === 'anthropic') {
    const res = await callModel(opts, { messages: [{ role: 'user', content: 'Return "OK"' }] });
    return { score: 1.0, status: 'PASS', note: `Latency: ${res.latency}ms` };
  }

  try {
    const { response, t0 } = await callModel(opts, {
      messages: [{ role: 'user', content: 'Output numbers 1 to 20 separated by space.' }],
      stream: true,
      maxTokens: 80
    });

    let firstToken = null;
    let chunks = 0;
    let fullText = '';
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!firstToken) firstToken = performance.now();
      chunks++;
      const txt = decoder.decode(value);
      const lines = txt.split('\n');
      for (const l of lines) {
        if (l.startsWith('data: ') && l !== 'data: [DONE]') {
          try {
            const d = JSON.parse(l.replace('data: ', ''));
            const part = d.choices?.[0]?.delta?.content;
            if (part) fullText += part;
          } catch(e) {}
        }
      }
    }

    const ttft = Math.round(firstToken ? firstToken - t0 : 0);
    const totalTime = (performance.now() - t0) / 1000;
    const estTokens = Math.max(chunks, Math.round(fullText.trim().split(/\s+/).length * 1.3));
    const tps = chunks <= 2 
      ? (totalTime > 0 ? Math.round(estTokens / totalTime) : 0)
      : Math.round(estTokens / Math.max(0.1, totalTime - (ttft / 1000)));

    if (opts.model.includes('claude') && tps > 210) {
      return { score: 0.3, status: 'WARN', note: `Abnormal speed (${tps} TPS). Possible LPU/Groq spoof.` };
    }
    return { score: 1.0, status: 'PASS', note: `${ttft}ms TTFT | ${tps} TPS` };
  } catch (e) {
    return { score: 0.7, status: 'WARN', note: `Stream telemetry fallback: ${e.message}` };
  }
}

async function runVector5(opts) {
  const prompt = `Generate a raw CSV table of 3 elements (Element, Symbol, AtomicNumber). No greeting, no markdown ticks.`;
  const res = await callModel(opts, { messages: [{ role: 'user', content: prompt }] });
  const raw = res.content.trim();

  if (raw.startsWith('```') || /here is|certainly|sure/i.test(raw)) {
    return { score: 0.2, status: 'FAIL', note: 'Failed negative constraints (leaked fluff/markdown)' };
  }
  return { score: 1.0, status: 'PASS', note: 'Strict zero-filler compliance passed' };
}

async function runVector6(opts) {
  if (opts.activeProto === 'anthropic') {
    return { score: 1.0, status: 'PASS', note: 'Anthropic schema tool-use standard' };
  }

  const strictFormat = {
    type: 'json_schema',
    json_schema: {
      name: 'probe_entropy',
      strict: true,
      schema: {
        type: 'object',
        properties: {
          key: { type: 'string' },
          code: { type: 'integer' }
        },
        required: ['key', 'code'],
        additionalProperties: false
      }
    }
  };

  try {
    const res = await callModel(opts, {
      messages: [{ role: 'user', content: 'Generate dummy key and code.' }],
      responseFormat: strictFormat
    });
    JSON.parse(res.content.trim());
    return { score: 1.0, status: 'PASS', note: 'Native constrained grammar passed' };
  } catch (err) {
    return { score: 0.0, status: 'FAIL', note: `Constrained decoding failed: ${err.message.slice(0, 40)}` };
  }
}

async function runVector7(opts) {
  const token = 'SolidGoldMagikarp';
  const prompt = `Repeat this token exactly 3 times separated by dash: ${token}`;
  const res = await callModel(opts, { messages: [{ role: 'user', content: prompt }] });
  if (res.content.includes(`${token}-${token}-${token}`)) {
    return { score: 1.0, status: 'PASS', note: `Glitched token (${token}) handled cleanly` };
  }
  return { score: 0.4, status: 'WARN', note: `Glitched token anomaly on ${token}` };
}

async function runVector8(opts) {
  const prompt = `Who received the Nobel Prize in Physics in October 2024? Answer in 1 short sentence.`;
  const res = await callModel(opts, { messages: [{ role: 'user', content: prompt }] });
  const low = res.content.toLowerCase();
  if (low.includes('hopfield') || low.includes('hinton')) {
    return { score: 1.0, status: 'PASS', note: 'Verified Oct 2024 cutoff horizon' };
  }
  return { score: 0.0, status: 'FAIL', note: 'Failed late-2024 cutoff horizon' };
}

async function runVector9(opts) {
  const prompt = `A bat and ball cost $1.10. The bat costs $1.00 more than the ball. How much does the ball cost? Think step by step.`;
  const res = await callModel(opts, { messages: [{ role: 'user', content: prompt }] });
  const raw = res.content;
  const isO1 = opts.model.includes('o1') || opts.model.includes('o3');

  if (isO1 && raw.includes('<think>')) {
    return { score: 0.0, status: 'FAIL', note: 'CRITICAL: Leaked <think> tag (DeepSeek-R1 spoofed as o1)', crit: true };
  }

  if (raw.includes('0.05') || raw.includes('5 cents') || raw.includes('five cents')) {
    return { score: 1.0, status: 'PASS', note: 'Cognitive reflection trap solved cleanly' };
  }
  return { score: 0.4, status: 'WARN', note: 'Cognitive reflection mismatch' };
}

async function runVector10(opts) {
  const prompt = `In Rust, why does this fail to compile and what HRTB syntax fixes it?\nfn call<F>(f: F) where F: Fn(&str) {}\n2 bullet points strictly.`;
  const res = await callModel(opts, { messages: [{ role: 'user', content: prompt }], maxTokens: 250 });
  const low = res.content.toLowerCase();
  if (low.includes("for<'a>") || low.includes('higher-ranked') || low.includes('hrtb') || low.includes('lifetime')) {
    return { score: 1.0, status: 'PASS', note: 'High-order HRTB lifetime reasoning solved' };
  }
  return { score: 0.0, status: 'FAIL', note: 'Failed type-level borrow reasoning' };
}

// ----------------------------------------------------
// MAIN CONTROLLER
// ----------------------------------------------------

async function main() {
  const opts = parseArgs();

  const hasUserArgs = process.argv.length > 2;

  // Friendly fallback if user runs without args and no API key is set
  if (!opts.apiKey) {
    console.log(`\n${c.bold}================================================================================${c.reset}`);
    console.log(` ${c.bold}${c.cyan}MODELPROOF CLI${c.reset} // LLM Proxy & Masking Forensic Scanner (v1.0.1)`);
    console.log(`${c.bold}================================================================================${c.reset}`);
    console.log(`Zero-persistence scanner to detect model spoofing, masking, and proxy downgrades.\n`);
    console.log(`${c.bold}QUICKSTART:${c.reset}`);
    console.log(`  npx modelproof -u "https://my-proxy.com/v1" -k "sk-..." -m "gpt-4o"`);
    console.log(`  npx modelproof -u "https://my-proxy.com/v1" -k "sk-..." --models-only`);
    console.log(`  npx modelproof -u "https://my-proxy.com/v1" -k "sk-..." --all --json\n`);
    console.log(`${c.dim}Or set the environment variable: export OPENAI_API_KEY="sk-..."${c.reset}`);
    console.log(`${c.dim}Run with --help to see all options.${c.reset}\n`);
    process.exit(0);
  }

  const isEn = opts.lang !== 'id';

  if (!opts.json) {
    console.log(`\n${c.bold}================================================================================${c.reset}`);
    console.log(` ${c.bold}${c.cyan}MODELPROOF CLI${c.reset} // LLM Proxy & Masking Forensic Scanner (v1.0.1)`);
    console.log(` Target: ${c.bold}${opts.model}${c.reset} @ ${opts.baseUrl}`);
    console.log(`${c.bold}================================================================================${c.reset}`);
  }

  // Preflight 1: Handshake
  const activeProto = await detectProtocol(opts);
  if (!opts.json) {
    console.log(`[*] Protocol Wire Schema: ${c.green}${activeProto.toUpperCase()}${c.reset}`);
  }

  // Preflight 2: Catalog Audit
  let catalogResult = { count: 0, models: [], flagged: [], tenant: null };
  try {
    const cleanBase = opts.baseUrl.replace(/\/+$/, '');
    const res = await fetch(`${cleanBase}/models`, {
      headers: { 'Authorization': `Bearer ${opts.apiKey}`, 'x-api-key': opts.apiKey }
    });
    if (res.ok) {
      const data = await res.json();
      const rawModels = data.data || [];
      const flagged = [];
      const tenants = new Set();
      const FAKE_REGEX = /claude.*(4-5|4\.5|5|opus-5|sonnet-4-5)|deepseek.*(3\.[2-9]|v4)|grok.*(4-5|5)|glm-5|arza|mod/i;
      
      const parsedModels = rawModels.map(m => {
        const id = m.id || '';
        if (FAKE_REGEX.test(id)) flagged.push(id);
        if (m.owned_by && !['openai', 'anthropic', 'system', 'google', 'meta', 'deepseek'].includes(m.owned_by.toLowerCase())) {
          tenants.add(m.owned_by);
        }
        return { id, owner: m.owned_by || null };
      });

      catalogResult = {
        count: parsedModels.length,
        models: parsedModels,
        flagged,
        tenant: tenants.size > 0 ? Array.from(tenants).join(', ') : null
      };

      if (!opts.json) {
        if (flagged.length > 0) {
          console.log(`[*] Catalog Audit: ${parsedModels.length} models retrieved (${c.yellow}${flagged.length} non-standard/custom labels${c.reset})`);
          if (catalogResult.tenant) console.log(`[*] Upstream Tenant: ${c.bold}${catalogResult.tenant}${c.reset}`);
        } else {
          console.log(`[*] Catalog Audit: ${parsedModels.length} standard models retrieved (Clean naming).`);
        }
      }
    }
  } catch (e) {}

  if (opts.modelsOnly) {
    if (opts.json) {
      console.log(JSON.stringify(catalogResult, null, 2));
    } else {
      console.log(`\n[+] ${c.bold}AVAILABLE UPSTREAM MODELS (${catalogResult.count}):${c.reset}`);
      console.log('--------------------------------------------------------------------------------');
      catalogResult.models.forEach(m => {
        const vendor = detectOriginalVendor(m.id);
        const ownerTag = m.owner ? ` ${c.dim}[${m.owner}]${c.reset}` : '';
        const isFlagged = catalogResult.flagged.includes(m.id) ? ` ${c.yellow}(Non-standard)${c.reset}` : '';
        console.log(`  - ${c.bold}${m.id}${c.reset}${ownerTag} -> ${c.cyan}${vendor.name}${c.reset}${isFlagged}`);
      });
      console.log('--------------------------------------------------------------------------------\n');
    }
    process.exit(0);
  }

  // Define Vectors
  const VECTORS = [
    { id: 1, name: 'Spatial Logic & Character Horizon', fn: runVector1 },
    { id: 2, name: 'Tokenizer Usage & BPE Precision', fn: runVector2 },
    { id: 3, name: 'System Instruction & Identity Leak', fn: runVector3 },
    { id: 4, name: 'Hardware Telemetry & TPS Profile', fn: runVector4 },
    { id: 5, name: 'Negative Constraint Compliance', fn: runVector5 },
    { id: 6, name: 'Strict JSON Schema Decoding', fn: runVector6 },
    { id: 7, name: 'Glitched Token Embedding', fn: runVector7 },
    { id: 8, name: 'Temporal Cutoff Horizon (2024-H2)', fn: runVector8 }
  ];

  if (opts.all) {
    VECTORS.push({ id: 9, name: 'Reasoning CoT & Delimiter Structure', fn: runVector9 });
    VECTORS.push({ id: 10, name: 'Type-Level Memory & Lifetime Logic', fn: runVector10 });
  }

  if (!opts.json) {
    console.log(`\n[+] ${c.bold}RUNNING ${VECTORS.length} FORENSIC VECTORS:${c.reset}`);
    console.log('--------------------------------------------------------------------------------');
  }

  const results = [];
  let totalScore = 0;
  let hasCriticalFailure = false;

  for (const v of VECTORS) {
    process.stdout.write && !opts.json && process.stdout.write(`  [${String(v.id).padStart(2, '0')}] ${v.name.padEnd(36)} `);
    try {
      const res = await v.fn(opts);
      results.push({ id: v.id, name: v.name, ...res });
      totalScore += res.score;
      if (res.crit) hasCriticalFailure = true;

      if (!opts.json) {
        let badge = `${c.green}[PASS]${c.reset}`;
        if (res.status === 'WARN') badge = `${c.yellow}[WARN]${c.reset}`;
        if (res.status === 'FAIL') badge = `${c.red}[FAIL]${c.reset}`;
        console.log(`${badge}  ${res.note || ''}`);
      }
    } catch (err) {
      results.push({ id: v.id, name: v.name, score: 0.0, status: 'FAIL', note: `Error: ${err.message}` });
      if (!opts.json) {
        console.log(`${c.red}[FAIL]${c.reset}  Interrupted: ${err.message}`);
      }
    }
  }

  const finalScore = Math.round((totalScore / VECTORS.length) * 100);
  const origVendor = detectOriginalVendor(opts.model);

  let verdictLevel = 'genuine';
  let exitCode = 0;

  if (finalScore >= 80 && !hasCriticalFailure) {
    verdictLevel = 'genuine';
    exitCode = 0;
  } else if (finalScore >= 50 && !hasCriticalFailure) {
    verdictLevel = 'suspicious';
    exitCode = 1;
  } else {
    verdictLevel = 'fake';
    exitCode = 1;
  }

  if (opts.json) {
    const report = {
      timestamp: new Date().toISOString(),
      target: {
        model: opts.model,
        baseUrl: opts.baseUrl,
        detectedOriginalVendor: origVendor.name
      },
      audit: {
        score: finalScore,
        verdict: verdictLevel.toUpperCase(),
        hasCriticalFailure,
        catalog: catalogResult,
        vectors: results
      }
    };
    console.log(JSON.stringify(report, null, 2));
    process.exit(exitCode);
  }

  // Human Readable Verdict Report
  console.log('--------------------------------------------------------------------------------');
  console.log(`\n${c.bold}============================= FORENSIC VERDICT =================================${c.reset}`);
  
  let verdictColor = c.green;
  let verdictText = isEn ? 'VERIFIED GENUINE' : 'TERVERIFIKASI ASLI (GENUINE)';
  let riskText = isEn ? 'SAFE' : 'AMAN';

  if (verdictLevel === 'suspicious') {
    verdictColor = c.yellow;
    verdictText = isEn ? 'SUSPICIOUS / DOWNGRADED' : 'MENCURIGAKAN / DOWNGRADED';
    riskText = isEn ? 'MEDIUM' : 'SEDANG';
  } else if (verdictLevel === 'fake') {
    verdictColor = c.red;
    verdictText = isEn ? 'CONFIRMED SPOOFED / MASKED' : 'PALSU / HASIL MASKING (SPOOFED)';
    riskText = isEn ? 'FRAUD / FAKED' : 'PENIPUAN (FAKED)';
  }

  console.log(` ${isEn ? 'AUTHENTICITY SCORE' : 'SKOR KEASLIAN'}   : ${c.bold}${verdictColor}${finalScore}%${c.reset}`);
  console.log(` ${isEn ? 'VERDICT' : 'HASIL DIAGNOSTIK'}   : ${c.bold}${verdictColor}${verdictText}${c.reset}`);
  console.log(` ${isEn ? 'DETECTED VENDOR' : 'VENDOR ASLI'}    : ${origVendor.family}`);
  if (catalogResult.tenant) {
    console.log(` ${isEn ? 'UPSTREAM TENANT' : 'TENANT RESELLER'} : ${c.yellow}${catalogResult.tenant}${c.reset}`);
  }
  console.log(` ${isEn ? 'RISK LEVEL' : 'TINGKAT RISIKO'}      : ${c.bold}${verdictColor}${riskText}${c.reset}`);

  if (catalogResult.flagged.length > 0) {
    console.log(`\n ${c.yellow}[!] Flagged Catalog Models:${c.reset} ${catalogResult.flagged.slice(0, 8).join(', ')}...`);
  }

  if (verdictLevel === 'fake') {
    console.log(`\n ${c.red}[!] CONCLUSION:${c.reset} Target does NOT match official ${origVendor.name} specifications.`);
    console.log(`     The upstream proxy is wrapping a cheaper model under the claimed name.`);
  } else if (verdictLevel === 'genuine') {
    console.log(`\n ${c.green}[+] CONCLUSION:${c.reset} Target verified consistent with genuine foundational weights.`);
  }

  console.log(`${c.bold}================================================================================${c.reset}\n`);
  process.exit(exitCode);
}

main().catch(err => {
  console.error(`${c.red}Fatal Error: ${err.message}${c.reset}`);
  process.exit(2);
});
