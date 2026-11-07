"""Offline command-line validator for controlled before/after exports."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from validation.legacy_compare import compare_files  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Compare legacy before/after JSON exports without printing record values."
    )
    parser.add_argument("before", help="Path to the pre-migration JSON export")
    parser.add_argument("after", help="Path to the post-migration JSON export")
    args = parser.parse_args()
    report = compare_files(args.before, args.after)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["valid"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
