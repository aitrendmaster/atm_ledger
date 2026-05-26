"""locales/{tgt}/common.json 의 누락 키를 EN 소스에서 Claude Haiku 로 일괄 번역.

전략:
  - KO 는 사람이 쓴 진본 -- 손대지 않음 (TARGETS 에서 제외).
  - EN 은 깨끗한 영문 원본 -- 다른 언어 번역의 source.
  - 기존 7개 로케일 (ja/zh/es/th/vi/ms/hi): mypage.* 새로 추가된 ~125 키만 누락 → 그것만 채움.
  - 신규 8개 로케일 (de/fr/it/nl/pt/ar/sv/id): EN 스켈레톤 복사라 800 키 전부 영어 → 전부 재번역.

식별 로직:
  target_value == en_value → 미번역 placeholder → 번역
  target_value != en_value → 이미 번역됨 → 건드리지 않음

비용 추정: ~7,300 키 × ~100 token = ~750k tokens. Haiku 단가로 약 $1.5.
"""
from __future__ import annotations

import io
import json
import os
import re
import sys
import time
from pathlib import Path

# Windows cp949 console 에서 em-dash 등 유니코드 출력 오류 회피.
if hasattr(sys.stdout, "buffer"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "buffer"):
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parent.parent
LOCALES_DIR = ROOT / "frontend" / "src" / "locales"

# KO 는 진본 → 절대 손대지 않음. EN 도 사람이 검수한 상태 → 손대지 않음.
SOURCE = "en"
# 환경변수 I18N_TRANSLATE_TARGETS 로 일부 로케일만 재실행 가능 (콤마 구분).
_TARGETS_ENV = os.environ.get("I18N_TRANSLATE_TARGETS", "").strip()
if _TARGETS_ENV:
    TARGETS = [t.strip() for t in _TARGETS_ENV.split(",") if t.strip()]
else:
    TARGETS = [
        "ja", "zh", "es", "th", "vi", "ms", "hi",  # 기존 7개 -- 누락 키만 채움
        "de", "fr", "it", "nl", "pt", "ar", "sv", "id",  # 신규 8개 -- 전체 번역
    ]

LANG_NAMES = {
    "ja": "Japanese",
    "zh": "Simplified Chinese",
    "es": "Spanish",
    "th": "Thai",
    "vi": "Vietnamese",
    "ms": "Bahasa Melayu",
    "hi": "Hindi",
    "de": "German",
    "fr": "French",
    "it": "Italian",
    "nl": "Dutch",
    "pt": "Brazilian Portuguese",
    "ar": "Modern Standard Arabic",
    "sv": "Swedish",
    "id": "Bahasa Indonesia",
}

MODEL = "claude-haiku-4-5-20251001"
# BATCH_SIZE env override 가능 — JSON 파싱 실패시 작은 batch 로 재시도하기 위함.
BATCH_SIZE = int(os.environ.get("I18N_BATCH_SIZE", "50"))


def load_api_key() -> str:
    if os.environ.get("ANTHROPIC_API_KEY"):
        return os.environ["ANTHROPIC_API_KEY"]
    env_path = ROOT / "backend" / ".env"
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line.startswith("ANTHROPIC_API_KEY"):
                val = line.split("=", 1)[1].strip().strip('"').strip("'")
                if val:
                    return val
    raise RuntimeError("ANTHROPIC_API_KEY not found (env or backend/.env)")


import anthropic  # noqa: E402  (after API key loader)

client = anthropic.Anthropic(api_key=load_api_key())


def flatten(d, prefix: str = "") -> dict[str, str]:
    """dict + list 를 점 표기 경로로 평탄화. list 항목은 숫자 인덱스로 표현.
    예: {"items": [{"q": "Hi"}]} -> {"items.0.q": "Hi"}
    """
    out: dict[str, str] = {}
    if isinstance(d, dict):
        for k, v in d.items():
            path = f"{prefix}.{k}" if prefix else k
            out.update(flatten(v, path))
    elif isinstance(d, list):
        for i, v in enumerate(d):
            path = f"{prefix}.{i}" if prefix else str(i)
            out.update(flatten(v, path))
    else:
        if prefix:
            out[prefix] = d
    return out


def unflatten(flat: dict[str, str]):
    """flatten 의 역. 숫자 키가 연속(0,1,2,...) 이면 list 로 복원."""
    def _set(node, parts, value):
        head = parts[0]
        rest = parts[1:]
        if not rest:
            node[head] = value
            return
        if head not in node:
            node[head] = {}
        _set(node[head], rest, value)

    out: dict = {}
    for path, value in flat.items():
        parts = path.split(".")
        _set(out, parts, value)

    def _to_lists(node):
        if not isinstance(node, dict):
            return node
        # 자식 먼저 재귀
        for k in list(node.keys()):
            node[k] = _to_lists(node[k])
        # 모든 키가 0..N-1 의 숫자면 list 로 변환
        keys = list(node.keys())
        if keys and all(k.isdigit() for k in keys):
            idxs = sorted(int(k) for k in keys)
            if idxs == list(range(len(idxs))):
                return [node[str(i)] for i in idxs]
        return node

    return _to_lists(out)


def translate_batch(target_lang_name: str, items: list[tuple[str, str]]) -> dict[str, str]:
    payload = {path: val for path, val in items}
    json_input = json.dumps(payload, ensure_ascii=False, indent=2)
    prompt = f"""Translate the following English UI strings into {target_lang_name} for a personal finance SaaS called Moa365.

Rules:
1. Output ONLY a JSON object -- same keys as input, values translated. No markdown, no explanation.
2. Preserve interpolation placeholders EXACTLY: {{{{n}}}}, {{{{price}}}} etc. -- never translate the inside or remove curly braces.
3. Keep brand and proper nouns: Moa, Moa365, Lemon Squeezy, Toss Payments, Claude, Premium, GDPR, JSON, AI, MoR.
4. Preserve emojis (🎉 ✓ ✅ 💡 ○ 🪟 etc.), currency symbols (₩ $), and code identifiers (LEMONSQUEEZY_API_KEY).
5. UI tone: friendly but professional. Match {target_lang_name} idiomatic SaaS conventions.
6. Keep concise -- UI buttons should not become wordier than English.
7. If a value is identical to its source meaning in {target_lang_name} (e.g., "OK", "JSON"), keep it as-is.

Input (English JSON):
{json_input}

Output (only the JSON object):"""
    response = client.messages.create(
        model=MODEL,
        max_tokens=8192,
        messages=[{"role": "user", "content": prompt}],
    )
    text = response.content[0].text.strip()
    # Strip code fences if present
    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z]*\n", "", text)
        text = re.sub(r"\n```\s*$", "", text)
    return json.loads(text)


def process_locale(tgt: str, source_flat: dict[str, str]) -> tuple[int, int]:
    """Returns (translated_count, total_target_keys)."""
    tgt_path = LOCALES_DIR / tgt / "common.json"
    existing = json.loads(tgt_path.read_text(encoding="utf-8")) if tgt_path.exists() else {}
    existing_flat = flatten(existing)

    to_translate: list[tuple[str, str]] = []
    for path, en_val in source_flat.items():
        if not isinstance(en_val, str):
            continue
        tgt_val = existing_flat.get(path)
        if tgt_val is None or tgt_val == en_val:
            to_translate.append((path, en_val))

    if not to_translate:
        return (0, len(existing_flat))

    print(f"[{tgt}] translating {len(to_translate)} / {len(source_flat)} keys "
          f"({LANG_NAMES[tgt]})…", flush=True)

    translated_flat = dict(existing_flat)
    failed_batches = 0
    for i in range(0, len(to_translate), BATCH_SIZE):
        batch = to_translate[i:i + BATCH_SIZE]
        try:
            result = translate_batch(LANG_NAMES[tgt], batch)
            for path, _ in batch:
                if path in result and isinstance(result[path], str):
                    translated_flat[path] = result[path]
            print(f"  [{tgt}] batch {i // BATCH_SIZE + 1}/{(len(to_translate) + BATCH_SIZE - 1) // BATCH_SIZE}: "
                  f"{len(result)} translated", flush=True)
        except Exception as e:
            failed_batches += 1
            print(f"  [{tgt}] batch {i // BATCH_SIZE + 1} FAILED: {e}", flush=True)
        time.sleep(0.4)

    # Save with KO source structure (use source as schema to maintain key ordering of keys
    # that exist in source; existing-only keys go after).
    new_data = unflatten(translated_flat)
    tgt_path.write_text(
        json.dumps(new_data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return (len(to_translate) - failed_batches * BATCH_SIZE, len(translated_flat))


def main() -> int:
    source_path = LOCALES_DIR / SOURCE / "common.json"
    source_flat = flatten(json.loads(source_path.read_text(encoding="utf-8")))
    print(f"Source ({SOURCE}): {len(source_flat)} keys")
    print(f"Targets: {', '.join(TARGETS)}")
    print()

    total_translated = 0
    for tgt in TARGETS:
        translated, total = process_locale(tgt, source_flat)
        total_translated += translated
        print(f"[{tgt}] done -- {translated} translated, {total} total keys")
        print()

    print(f"\nDONE -- total {total_translated} keys translated across {len(TARGETS)} locales")
    return 0


if __name__ == "__main__":
    sys.exit(main())
