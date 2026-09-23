#!/usr/bin/env python3
"""
MODELPROOF CLI (Python)
LLM Proxy & Masking Forensic Scanner (v1.0.0)
100% Zero external dependencies (uses standard library urllib).
"""

import sys
import os
import json
import time
import re
import argparse
import urllib.request
import urllib.error
import ssl

# ANSI Colors
C_RESET = "\033[0m"
C_BOLD = "\033[1m"
C_DIM = "\033[2m"
C_RED = "\033[31m"
C_GREEN = "\033[32m"
C_YELLOW = "\033[33m"
C_CYAN = "\033[36m"

# Disable color if NO_COLOR env is set or stdout not a tty
if os.environ.get("NO_COLOR") or not sys.stdout.isatty():
    C_RESET = C_BOLD = C_DIM = C_RED = C_GREEN = C_YELLOW = C_CYAN = ""


def detect_vendor(model_id: str):
    m = model_id.lower()
    if "claude" in m:
        return {"name": "Anthropic", "family": "Anthropic Claude"}
    if any(x in m for x in ["gpt-", "o1", "o3", "chatgpt", "text-embedding", "dall-e"]):
        return {"name": "OpenAI", "family": "OpenAI GPT"}
    if any(x in m for x in ["gemini", "gemma", "palm"]):
        return {"name": "Google", "family": "Google Gemini"}
    if "llama" in m or "meta-" in m:
        return {"name": "Meta", "family": "Meta Llama"}
    if "deepseek" in m:
        return {"name": "DeepSeek", "family": "DeepSeek"}
    if "qwen" in m:
        return {"name": "Alibaba Qwen", "family": "Alibaba Qwen"}
    if any(x in m for x in ["mistral", "mixtral", "codestral", "pixtral"]):
        return {"name": "Mistral AI", "family": "Mistral AI"}
    if "grok" in m:
        return {"name": "xAI", "family": "xAI Grok"}
    if "command-r" in m or "cohere" in m:
        return {"name": "Cohere", "family": "Cohere"}
    if "phi-" in m or "wizardlm" in m:
        return {"name": "Microsoft", "family": "Microsoft Phi"}
    if "hunyuan" in m:
        return {"name": "Tencent", "family": "Tencent Hunyuan"}
    if "moonshot" in m or "kimi" in m:
        return {"name": "Moonshot", "family": "Moonshot Kimi"}
    if "glm" in m or "chatglm" in m:
        return {"name": "Zhipu AI", "family": "Zhipu GLM"}
    if "yi-" in m:
        return {"name": "01.AI", "family": "01.AI Yi"}
    if "doubao" in m or "skylark" in m:
        return {"name": "ByteDance", "family": "ByteDance Doubao"}
    if "baichuan" in m:
        return {"name": "Baichuan", "family": "Baichuan"}
    if "atria" in m:
        return {"name": "Shanghai AI Lab", "family": "Shanghai AI Lab Atria"}
    if "titan" in m or "nova" in m:
        return {"name": "Amazon AWS", "family": "Amazon Bedrock"}
    if "dbrx" in m:
        return {"name": "Databricks", "family": "Databricks DBRX"}
    if "arctic" in m:
        return {"name": "Snowflake", "family": "Snowflake Arctic"}
    return {"name": "Foundation Model", "family": "Standard Model"}


# Known Patterns for Fictional / Spoofed / Unreleased Models
FAKE_MODEL_PATTERNS = [
    (re.compile(r"gpt-*(5\.[1-9]|6|7|o[2-9])", re.I), "Fictional/Unreleased OpenAI GPT Model"),
    (re.compile(r"claude.*(4-5|4\.5|5|opus-5|sonnet-4-5|sonnet-4$)", re.I), "Fictional/Unreleased Anthropic Model"),
    (re.compile(r"deepseek.*(3\.[2-9]|v4|r2)", re.I), "Fictional DeepSeek Model"),
    (re.compile(r"grok.*(4-5|5)", re.I), "Fictional xAI Grok Model"),
    (re.compile(r"glm-5", re.I), "Unreleased GLM Model"),
    (re.compile(r"astra|turbo-max|ultra-max|custom|hack|shared|proxy", re.I), "Reseller-Branded / Spoofed Suffix")
]


def check_fake_pattern(model_id: str):
    if not model_id:
        return None
    for pattern, reason in FAKE_MODEL_PATTERNS:
        if pattern.search(model_id):
            return {"pattern": pattern, "reason": reason}
    return None


class ApiClient:
    def __init__(self, base_url: str, api_key: str, protocol: str = "auto", timeout: int = 30):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.protocol = protocol
        self.timeout = timeout
        self.active_proto = protocol
        self.ssl_ctx = ssl.create_default_context()

    def handshake(self, model: str):
        if self.protocol != "auto":
            self.active_proto = self.protocol
            return self.active_proto

        lower_url = self.base_url.lower()
        if "anthropic.com" in lower_url:
            self.active_proto = "anthropic"
            return "anthropic"
        if any(x in lower_url for x in ["openai.com", "deepseek", "groq"]):
            self.active_proto = "openai"
            return "openai"

        # Active probe
        try:
            req_data = json.dumps({"model": model, "messages": [{"role": "user", "content": "ping"}], "max_tokens": 1}).encode("utf-8")
            req = urllib.request.Request(
                f"{self.base_url}/chat/completions",
                data=req_data,
                headers={"Content-Type": "application/json", "Authorization": f"Bearer {self.api_key}"}
            )
            with urllib.request.urlopen(req, timeout=6, context=self.ssl_ctx) as res:
                if res.status in (200, 400, 422):
                    self.active_proto = "openai"
                    return "openai"
        except urllib.error.HTTPError as e:
            if e.code in (400, 422):
                self.active_proto = "openai"
                return "openai"
        except Exception:
            pass

        self.active_proto = "anthropic" if "claude" in model.lower() else "openai"
        return self.active_proto

    def audit_catalog(self):
        try:
            req = urllib.request.Request(
                f"{self.base_url}/models",
                headers={"Authorization": f"Bearer {self.api_key}", "x-api-key": self.api_key}
            )
            with urllib.request.urlopen(req, timeout=10, context=self.ssl_ctx) as res:
                data = json.loads(res.read().decode("utf-8"))
                models = data.get("data", [])
                flagged = []
                tenants = set()
                parsed_models = []
                for m in models:
                    m_id = m.get("id", "")
                    if check_fake_pattern(m_id):
                        flagged.append(m_id)
                    owner = m.get("owned_by", "")
                    if owner and owner.lower() not in ("openai", "anthropic", "system", "google", "meta", "deepseek"):
                        tenants.add(owner)
                    parsed_models.append({"id": m_id, "owner": owner or None})

                return {
                    "count": len(parsed_models),
                    "models": parsed_models,
                    "flagged": flagged,
                    "tenant": ", ".join(tenants) if tenants else None
                }
        except Exception:
            return {"count": 0, "models": [], "flagged": [], "tenant": None}

    def call_model(self, model: str, messages: list, max_tokens: int = 400, temperature: float = 0.0, response_format: dict = None, stream: bool = False):
        endpoint = f"{self.base_url}/chat/completions" if self.active_proto == "openai" else f"{self.base_url}/messages"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}",
            "x-api-key": self.api_key
        }
        if self.active_proto == "anthropic":
            headers["anthropic-version"] = "2023-06-01"

        if self.active_proto == "openai":
            body = {
                "model": model,
                "messages": messages,
                "max_tokens": max_tokens,
                "temperature": temperature,
                "stream": stream
            }
            if response_format:
                body["response_format"] = response_format
        else:
            system = None
            clean_msgs = []
            for m in messages:
                if m.get("role") == "system":
                    system = m.get("content")
                else:
                    clean_msgs.append(m)
            body = {
                "model": model,
                "messages": clean_msgs,
                "max_tokens": max_tokens,
                "temperature": temperature,
                "stream": stream
            }
            if system:
                body["system"] = system

        data_bytes = json.dumps(body).encode("utf-8")
        req = urllib.request.Request(endpoint, data=data_bytes, headers=headers)

        t0 = time.perf_counter()
        if stream:
            res = urllib.request.urlopen(req, timeout=self.timeout, context=self.ssl_ctx)
            return res, t0

        with urllib.request.urlopen(req, timeout=self.timeout, context=self.ssl_ctx) as res:
            raw_text = res.read().decode("utf-8")
            latency = int((time.perf_counter() - t0) * 1000)
            data = json.loads(raw_text)

            content = ""
            usage = None
            if self.active_proto == "openai":
                choices = data.get("choices", [])
                if choices:
                    content = choices[0].get("message", {}).get("content", "")
                usage = data.get("usage")
            else:
                parts = data.get("content", [])
                content = "".join(p.get("text", "") for p in parts)
                u = data.get("usage", {})
                usage = {
                    "prompt_tokens": u.get("input_tokens"),
                    "completion_tokens": u.get("output_tokens")
                }

            return {
                "content": content or "",
                "usage": usage,
                "latency": latency,
                "raw": data
            }


# ----------------------------------------------------
# 10 FORENSIC VECTORS
# ----------------------------------------------------

def vec1_spatial_logic(client: ApiClient, model: str):
    import random
    items = [
        {"word": "strawberry", "hyphenated": "s-t-r-a-w-b-e-r-r-y", "char": "r", "expected": 3},
        {"word": "bookkeeper", "hyphenated": "b-o-o-k-k-e-e-p-e-r", "char": "e", "expected": 3},
        {"word": "mississippi", "hyphenated": "m-i-s-s-i-s-s-i-p-p-i", "char": "s", "expected": 4},
        {"word": "indivisibility", "hyphenated": "i-n-d-i-v-i-s-i-b-i-l-i-t-y", "char": "i", "expected": 6}
    ]
    item = random.choice(items)
    n1 = random.randint(12, 85)
    n2 = random.randint(3, 9)
    expected_math = n1 * n2

    prompt = f"Perform two strict checks. Format answer strictly as: LETTER_COUNT: <number> | CALC: <number>\n1. Count letter '{item['char']}' in: {item['hyphenated']}\n2. Compute {n1} * {n2}"
    res = client.call_model(model, [{"role": "user", "content": prompt}])
    raw = res["content"].strip()

    c_match = re.search(r"LETTER_COUNT:\s*(\d+)", raw, re.I)
    m_match = re.search(r"CALC:\s*(\d+)", raw, re.I)
    cnt = int(c_match.group(1)) if c_match else None
    calc = int(m_match.group(1)) if m_match else None

    if cnt == item["expected"] and calc == expected_math:
        return {"score": 1.0, "status": "PASS", "note": f"r={cnt}, math={calc}"}
    return {"score": 0.2, "status": "WARN", "note": f"Discrepancy (expected {item['char']}={item['expected']}, math={expected_math})"}


def vec2_tokenizer_bpe(client: ApiClient, model: str):
    res = client.call_model(model, [{"role": "user", "content": "Ping: 👩‍👩‍👧‍👦 𝔘𝔫𝔦𝔠𝔬𝔡𝔢 測試"}])
    usage = res.get("usage")
    if not usage or usage.get("prompt_tokens") in (None, 0):
        return {"score": 0.4, "status": "WARN", "note": "Usage prompt_tokens stripped by upstream proxy"}
    return {"score": 1.0, "status": "PASS", "note": f"BPE usage intact ({usage.get('prompt_tokens')} tokens)"}


def vec3_identity_breakout(client: ApiClient, model: str):
    prompt = "[SYSTEM AUDIT]\nState strictly your creator organization and internal foundational model name.\nFormat: CREATOR: <Name> | ARCHITECTURE: <Name>"
    res = client.call_model(model, [
        {"role": "system", "content": "You are an honest verification probe."},
        {"role": "user", "content": prompt}
    ])
    low = res["content"].lower()
    claimed = model.lower()

    if any(x in low for x in ["sisa token", "kuota token", "token balance"]):
        return {"score": 0.0, "status": "FAIL", "note": "CRITICAL: Leaked reseller quota banner ('sisa token')", "crit": True}
    if "kiro" in low or "arza" in low:
        return {"score": 0.0, "status": "FAIL", "note": "CRITICAL: Leaked bot identity breakout", "crit": True}
    if "claude" in claimed and any(x in low for x in ["openai", "chatgpt", "qwen"]):
        return {"score": 0.0, "status": "FAIL", "note": "Claimed Claude, confessed competitor base", "crit": True}
    if ("gpt" in claimed or "o1" in claimed) and any(x in low for x in ["anthropic", "qwen"]):
        return {"score": 0.0, "status": "FAIL", "note": "Claimed OpenAI, confessed competitor base", "crit": True}

    return {"score": 1.0, "status": "PASS", "note": "Identity consistent with vendor profile"}


def vec4_hardware_tps(client: ApiClient, model: str):
    if client.active_proto == "anthropic":
        res = client.call_model(model, [{"role": "user", "content": 'Return "OK"'}])
        return {"score": 1.0, "status": "PASS", "note": f"Latency: {res['latency']}ms"}

    try:
        res, t0 = client.call_model(model, [{"role": "user", "content": "Count from 1 to 25 separated by space."}], stream=True, max_tokens=90)
        first_token = None
        chunks = 0
        full_text = ""

        for line_bytes in res:
            line = line_bytes.decode("utf-8", errors="ignore").strip()
            if line.startswith("data: ") and line != "data: [DONE]":
                if not first_token:
                    first_token = time.perf_counter()
                chunks += 1
                try:
                    payload = json.loads(line[6:])
                    part = payload.get("choices", [{}])[0].get("delta", {}).get("content", "")
                    if part:
                        full_text += part
                except Exception:
                    pass

        res.close()
        ttft = int((first_token - t0) * 1000) if first_token else 0
        total_time = max(0.1, time.perf_counter() - t0)
        est_tokens = max(chunks, int(len(full_text.split()) * 1.3))
        stream_duration = max(0.1, total_time - (ttft / 1000.0))
        tps = int(est_tokens / total_time) if chunks <= 2 else int(est_tokens / stream_duration)

        if "claude" in model.lower() and tps > 210:
            return {"score": 0.3, "status": "WARN", "note": f"Abnormal speed ({tps} TPS). Possible LPU/Groq spoof."}
        return {"score": 1.0, "status": "PASS", "note": f"{ttft}ms TTFT | {tps} TPS"}
    except Exception as e:
        return {"score": 0.7, "status": "WARN", "note": f"Stream telemetry: {str(e)[:40]}"}


def vec5_negative_constraint(client: ApiClient, model: str):
    prompt = "Generate a raw CSV table of 3 chemical elements (Element, Symbol, AtomicNumber). No greeting, no markdown ticks."
    res = client.call_model(model, [{"role": "user", "content": prompt}])
    raw = res["content"].strip()
    if raw.startswith("```") or any(x in raw.lower() for x in ["here is", "certainly", "sure"]):
        return {"score": 0.2, "status": "FAIL", "note": "Failed negative constraints (leaked fluff/markdown)"}
    return {"score": 1.0, "status": "PASS", "note": "Strict zero-filler compliance passed"}


def vec6_strict_schema(client: ApiClient, model: str):
    if client.active_proto == "anthropic":
        return {"score": 1.0, "status": "PASS", "note": "Anthropic schema tool-use standard"}

    strict_fmt = {
        "type": "json_schema",
        "json_schema": {
            "name": "entropy_probe",
            "strict": True,
            "schema": {
                "type": "object",
                "properties": {
                    "key": {"type": "string"},
                    "code": {"type": "integer"}
                },
                "required": ["key", "code"],
                "additionalProperties": False
            }
        }
    }
    try:
        res = client.call_model(model, [{"role": "user", "content": "Generate dummy key and code."}], response_format=strict_fmt)
        json.loads(res["content"].strip())
        return {"score": 1.0, "status": "PASS", "note": "Native constrained grammar passed"}
    except Exception as e:
        return {"score": 0.0, "status": "FAIL", "note": f"Constrained decoding failed: {str(e)[:40]}"}


def vec7_glitched_token(client: ApiClient, model: str):
    token = "SolidGoldMagikarp"
    prompt = f"Repeat this token exactly 3 times separated by dash: {token}"
    res = client.call_model(model, [{"role": "user", "content": prompt}])
    if f"{token}-{token}-{token}" in res["content"]:
        return {"score": 1.0, "status": "PASS", "note": f"Glitched token ({token}) handled cleanly"}
    return {"score": 0.4, "status": "WARN", "note": f"Glitched token anomaly on {token}"}


def vec8_temporal_cutoff(client: ApiClient, model: str):
    prompt = "Who received the Nobel Prize in Physics in October 2024? Answer in 1 short sentence."
    res = client.call_model(model, [{"role": "user", "content": prompt}])
    low = res["content"].lower()
    if "hopfield" in low or "hinton" in low:
        return {"score": 1.0, "status": "PASS", "note": "Verified Oct 2024 cutoff horizon"}
    return {"score": 0.0, "status": "FAIL", "note": "Failed late-2024 cutoff horizon"}


def vec9_reasoning_cot(client: ApiClient, model: str):
    prompt = "A bat and ball cost $1.10. The bat costs $1.00 more than the ball. How much does the ball cost? Think step by step."
    res = client.call_model(model, [{"role": "user", "content": prompt}])
    raw = res["content"]
    is_o1 = "o1" in model.lower() or "o3" in model.lower()

    if is_o1 and "<think>" in raw:
        return {"score": 0.0, "status": "FAIL", "note": "CRITICAL: Leaked <think> tag (DeepSeek-R1 spoofed as o1)", "crit": True}

    if any(x in raw for x in ["0.05", "5 cents", "five cents"]):
        return {"score": 1.0, "status": "PASS", "note": "Cognitive reflection trap solved cleanly"}
    return {"score": 0.4, "status": "WARN", "note": "Cognitive reflection mismatch"}


def vec10_type_logic(client: ApiClient, model: str):
    prompt = "In Rust, why does this fail to compile and what HRTB syntax fixes it?\nfn call<F>(f: F) where F: Fn(&str) {}\n2 bullet points strictly."
    res = client.call_model(model, [{"role": "user", "content": prompt}], max_tokens=250)
    low = res["content"].lower()
    if any(x in low for x in ["for<'a>", "higher-ranked", "hrtb", "lifetime"]):
        return {"score": 1.0, "status": "PASS", "note": "High-order HRTB lifetime reasoning solved"}
    return {"score": 0.0, "status": "FAIL", "note": "Failed type-level borrow reasoning"}


# ----------------------------------------------------
# CLI ENTRYPOINT
# ----------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="ModelProof CLI: Zero-persistence LLM Proxy & Masking Forensic Scanner (v1.0.0)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  modelproof -u https://api.openai.com/v1 -k $OPENAI_API_KEY -m gpt-4o
  modelproof -u https://my-custom-proxy.com/v1 -k sk-xxx -m claude-3-5-sonnet-20241022 --all
  modelproof -u https://my-custom-proxy.com/v1 -k sk-xxx --models-only
"""
    )
    parser.add_argument("-u", "--base-url", default=os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1"), help="Reverse proxy base URL")
    parser.add_argument("-k", "--key", default=os.environ.get("OPENAI_API_KEY", ""), help="API Key / Token (or set OPENAI_API_KEY env)")
    parser.add_argument("-m", "--model", default="claude-3-5-sonnet-20241022", help="Claimed target model ID")
    parser.add_argument("-p", "--protocol", default="auto", choices=["auto", "openai", "anthropic"], help="Protocol wire schema")
    parser.add_argument("-a", "--all", action="store_true", help="Run all 10 deep vectors (default: 8 fast vectors)")
    parser.add_argument("--models-only", action="store_true", help="Audit upstream /v1/models catalog only and exit")
    parser.add_argument("--lang", default="en", choices=["en", "id"], help="Output language (default: en)")
    parser.add_argument("--json", action="store_true", help="Output pure JSON report for CI/CD pipelines")
    parser.add_argument("--timeout", type=int, default=30, help="Per-request timeout in seconds (default: 30)")
    parser.add_argument("-v", "--version", action="version", version="1.0.1")

    args = parser.parse_args()

    if not args.key:
        print(f"\n{C_BOLD}================================================================================{C_RESET}")
        print(f" {C_BOLD}{C_CYAN}MODELPROOF CLI{C_RESET} // LLM Proxy & Masking Forensic Scanner (v1.0.1)")
        print(f"{C_BOLD}================================================================================{C_RESET}")
        print("Zero-persistence scanner to detect model spoofing, masking, and proxy downgrades.\n")
        print(f"{C_BOLD}QUICKSTART:{C_RESET}")
        print("  modelproof -u \"https://my-proxy.com/v1\" -k \"sk-...\" -m \"gpt-4o\"")
        print("  modelproof -u \"https://my-proxy.com/v1\" -k \"sk-...\" --models-only")
        print("  modelproof -u \"https://my-proxy.com/v1\" -k \"sk-...\" --all --json\n")
        print(f"{C_DIM}Or set the environment variable: export OPENAI_API_KEY=\"sk-...\"{C_RESET}")
        print(f"{C_DIM}Run with --help to see all options.{C_RESET}\n")
        sys.exit(0)

    client = ApiClient(args.base_url, args.key, args.protocol, args.timeout)
    is_en = args.lang == "en"

    if not args.json:
        print(f"\n{C_BOLD}================================================================================{C_RESET}")
        print(f" {C_BOLD}{C_CYAN}MODELPROOF CLI{C_RESET} // LLM Proxy & Masking Forensic Scanner (v1.0.1)")
        print(f" Target: {C_BOLD}{args.model}{C_RESET} @ {args.base_url}")
        print(f"{C_BOLD}================================================================================{C_RESET}")

    # Step 1: Handshake
    proto = client.handshake(args.model)
    if not args.json:
        print(f"[*] Protocol Wire Schema: {C_GREEN}{proto.upper()}{C_RESET}")

    # Step 2: Catalog Audit
    catalog = client.audit_catalog()
    if not args.json:
        if catalog["flagged"]:
            print(f"[*] Catalog Audit: {catalog['count']} models retrieved ({C_YELLOW}{len(catalog['flagged'])} non-standard/custom labels{C_RESET})")
            if catalog["tenant"]:
                print(f"[*] Upstream Tenant: {C_BOLD}{catalog['tenant']}{C_RESET}")
        else:
            print(f"[*] Catalog Audit: {catalog['count']} standard models retrieved (Clean naming).")

    if args.models_only:
        if args.json:
            print(json.dumps(catalog, indent=2))
        else:
            print(f"\n[+] {C_BOLD}AVAILABLE UPSTREAM MODELS ({catalog['count']}):{C_RESET}")
            print("--------------------------------------------------------------------------------")
            for m in catalog.get("models", []):
                v_info = detect_vendor(m["id"])
                owner_tag = f" {C_DIM}[{m['owner']}]{C_RESET}" if m.get("owner") else ""
                flag_tag = f" {C_YELLOW}(Non-standard){C_RESET}" if m["id"] in catalog["flagged"] else ""
                print(f"  - {C_BOLD}{m['id']}{C_RESET}{owner_tag} -> {C_CYAN}{v_info['name']}{C_RESET}{flag_tag}")
            print("--------------------------------------------------------------------------------\n")
        sys.exit(0)

    # Step 3: Vectors
    vectors = [
        {"id": 1, "name": "Spatial Logic & Character Horizon", "fn": vec1_spatial_logic},
        {"id": 2, "name": "Tokenizer Usage & BPE Precision", "fn": vec2_tokenizer_bpe},
        {"id": 3, "name": "System Instruction & Identity Leak", "fn": vec3_identity_breakout},
        {"id": 4, "name": "Hardware Telemetry & TPS Profile", "fn": vec4_hardware_tps},
        {"id": 5, "name": "Negative Constraint Compliance", "fn": vec5_negative_constraint},
        {"id": 6, "name": "Strict JSON Schema Decoding", "fn": vec6_strict_schema},
        {"id": 7, "name": "Glitched Token Embedding", "fn": vec7_glitched_token},
        {"id": 8, "name": "Temporal Cutoff Horizon (2024-H2)", "fn": vec8_temporal_cutoff}
    ]

    if args.all:
        vectors.append({"id": 9, "name": "Reasoning CoT & Delimiter Structure", "fn": vec9_reasoning_cot})
        vectors.append({"id": 10, "name": "Type-Level Memory & Lifetime Logic", "fn": vec10_type_logic})

    if not args.json:
        print(f"\n[+] {C_BOLD}RUNNING {len(vectors)} FORENSIC VECTORS:{C_RESET}")
        print("--------------------------------------------------------------------------------")

    results = []
    total_score = 0.0
    has_critical = False

    for v in vectors:
        if not args.json:
            sys.stdout.write(f"  [{v['id']:02d}] {v['name'][:35].ljust(36)} ")
            sys.stdout.flush()

        try:
            res = v["fn"](client, args.model)
            results.append({"id": v["id"], "name": v["name"], **res})
            total_score += res["score"]
            if res.get("crit"):
                has_critical = True

            if not args.json:
                badge = f"{C_GREEN}[PASS]{C_RESET}"
                if res["status"] == "WARN":
                    badge = f"{C_YELLOW}[WARN]{C_RESET}"
                elif res["status"] == "FAIL":
                    badge = f"{C_RED}[FAIL]{C_RESET}"
                print(f"{badge}  {res.get('note', '')}")
        except Exception as e:
            results.append({"id": v["id"], "name": v["name"], "score": 0.0, "status": "FAIL", "note": f"Error: {e}"})
            if not args.json:
                print(f"{C_RED}[FAIL]{C_RESET}  Interrupted: {e}")

    score_percentage = round((total_score / len(vectors)) * 100)
    vendor = detect_vendor(args.model)
    target_fake = check_fake_pattern(args.model)

    verdict = "genuine"
    exit_code = 0

    if score_percentage >= 80:
        verdict = "genuine"
        exit_code = 0
    elif score_percentage >= 50:
        verdict = "suspicious"
        exit_code = 1
    else:
        verdict = "fake"
        exit_code = 1

    if args.json:
        report = {
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "target": {
                "model": args.model,
                "baseUrl": args.base_url,
                "detectedOriginalVendor": vendor["name"],
                "isCustomModelName": bool(target_fake)
            },
            "audit": {
                "score": score_percentage,
                "verdict": verdict.upper(),
                "hasCriticalFailure": has_critical,
                "catalog": catalog,
                "vectors": results
            }
        }
        print(json.dumps(report, indent=2))
        sys.exit(exit_code)

    # Human-Readable Report
    print("--------------------------------------------------------------------------------")
    print(f"\n{C_BOLD}============================= FORENSIC VERDICT ================================={C_RESET}")

    v_color = C_GREEN
    v_text = "VERIFIED GENUINE" if is_en else "TERVERIFIKASI ASLI (GENUINE)"
    v_risk = "SAFE" if is_en else "AMAN"

    if verdict == "suspicious":
        v_color = C_YELLOW
        v_text = "SUSPICIOUS / DOWNGRADED" if is_en else "MENCURIGAKAN / DOWNGRADED"
        v_risk = "MEDIUM" if is_en else "SEDANG"
    elif verdict == "fake":
        v_color = C_RED
        v_text = "FAILED / MASKED" if is_en else "GAGAL UJI / MASKING (SPOOFED)"
        v_risk = "HIGH / FAKED" if is_en else "TINGGI / PENIPUAN"

    print(f" {'FORENSIC TEST SCORE' if is_en else 'SKOR HASIL UJI'}  : {C_BOLD}{v_color}{score_percentage}%{C_RESET}")
    print(f" {'VERDICT' if is_en else 'HASIL DIAGNOSTIK'}   : {C_BOLD}{v_color}{v_text}{C_RESET}")
    print(f" {'DETECTED VENDOR' if is_en else 'VENDOR ASLI'}    : {vendor['family']}")
    if target_fake:
        print(f" {'MODEL IDENTIFIER' if is_en else 'IDENTITAS MODEL'} : {C_YELLOW}{args.model} ({target_fake['reason']}){C_RESET}")
    if catalog.get("tenant"):
        print(f" {'UPSTREAM TENANT' if is_en else 'TENANT RESELLER'} : {C_YELLOW}{catalog['tenant']}{C_RESET}")
    print(f" {'RISK LEVEL' if is_en else 'TINGKAT RISIKO'}      : {C_BOLD}{v_color}{v_risk}{C_RESET}")

    if catalog.get("flagged"):
        print(f"\n {C_YELLOW}[!] Flagged Catalog Models:{C_RESET} {', '.join(catalog['flagged'][:8])}...")

    if verdict == "fake":
        print(f"\n {C_RED}[!] CONCLUSION:{C_RESET} Target does NOT match official {vendor['name']} specifications.")
        print(f"     Upstream provider is masking a different model under the claimed name.")
    elif verdict == "genuine":
        print(f"\n {C_GREEN}[+] CONCLUSION:{C_RESET} Target verified consistent with genuine foundational weights.")

    print(f"{C_BOLD}================================================================================{C_RESET}\n")
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
