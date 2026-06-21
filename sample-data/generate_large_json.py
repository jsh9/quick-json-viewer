from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parent
OUTPUT = ROOT / "large-placeholder.json"
MINIFIED_OUTPUT = ROOT / "large-placeholder-minified.json"
RECORD_COUNT = 250_000

REGIONS = ("us-east", "us-west", "eu-central", "ap-south", "sa-east")
EVENT_TYPES = ("created", "updated", "deleted", "archived", "restored")
STATUSES = ("queued", "running", "ok", "warning", "failed")
TAGS = ("api", "billing", "search", "mobile", "import", "export", "cache")
MESSAGES = (
    "short record",
    "contains spaces and punctuation!",
    "escaped newline: first line\nsecond line",
    "quoted value: \"example\"",
    "unicode sample: café, 東京, 🚀",
    "path sample: C:\\temp\\data\\file.json",
)


def build_record(index: int) -> dict[str, object]:
    status = STATUSES[index % len(STATUSES)]
    tag_count = (index % 4) + 1
    tags = [TAGS[(index + offset) % len(TAGS)] for offset in range(tag_count)]

    return {
        "id": f"evt-{index:07d}",
        "index": index,
        "type": EVENT_TYPES[index % len(EVENT_TYPES)],
        "status": status,
        "active": status not in {"archived", "failed"},
        "region": REGIONS[index % len(REGIONS)],
        "score": round(((index * 37) % 10_000) / 100, 2),
        "tags": tags,
        "owner": None if index % 11 == 0 else f"user-{index % 97:02d}",
        "message": MESSAGES[index % len(MESSAGES)],
        "metrics": {
            "attempts": index % 5,
            "latencyMs": 25 + (index * 13) % 750,
            "bytes": 1_024 + (index * 91) % 2_000_000,
        },
        "flags": {
            "sampled": index % 3 == 0,
            "retryable": status in {"queued", "running", "warning"},
            "containsEscapes": index % len(MESSAGES) in {2, 3, 5},
        },
        "items": [
            {"name": f"item-{index % 17}", "quantity": (index % 9) + 1},
            {"name": f"item-{(index + 5) % 17}", "quantity": (index % 4) + 1},
        ],
    }


def main() -> None:
    with OUTPUT.open("w", encoding="utf-8") as pretty_file:
        with MINIFIED_OUTPUT.open("w", encoding="utf-8") as minified_file:
            pretty_file.write("[\n")
            minified_file.write("[")
            for index in range(RECORD_COUNT):
                suffix = "," if index < RECORD_COUNT - 1 else ""
                record = build_record(index)
                record_json = json.dumps(
                    record,
                    ensure_ascii=False,
                    indent=4,
                    sort_keys=True,
                )
                minified_record_json = json.dumps(
                    record,
                    ensure_ascii=False,
                    separators=(",", ":"),
                    sort_keys=True,
                )
                indented_record_json = "\n".join(
                    f"    {line}" for line in record_json.splitlines()
                )
                pretty_file.write(f"{indented_record_json}{suffix}\n")
                minified_file.write(f"{minified_record_json}{suffix}")
            pretty_file.write("]\n")
            minified_file.write("]")

    print(f"Wrote {OUTPUT}")
    print(f"Wrote {MINIFIED_OUTPUT}")


if __name__ == "__main__":
    main()
