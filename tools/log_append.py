#!/usr/bin/env python3
"""Append lines to a shared log under a file lock, so agents that run at the same time never
lose each other's lines. It never rewrites or reorders what is already in the file.

usage: python3 -I log_append.py <log file> [--header "<text>"] [<lines file>]

  The new lines come from <lines file>, or from stdin when it is left out. Blank lines are
  skipped. For a .jsonl log every line must be one JSON object; if one is not, nothing is
  written and the exit code is 1. --header is written first when the log does not exist yet
  or is empty (for example "# ENGR1001 error log"). Missing folders are created. Prints how
  many lines were appended.

The daily-practice logs are append-only: questions.jsonl gets a full record per question
when a paper is assembled, and another full record when it is graded or corrected. The last
line for a given date, course and id is that question's current state.
Standard library only; the lock uses fcntl where it exists (macOS, Linux).
"""
import json
import os
import sys

try:
    import fcntl
except ImportError:  # Windows: no lock, plain append
    fcntl = None


def main():
    argv = sys.argv[1:]
    header = None
    if "--header" in argv:
        i = argv.index("--header")
        if i + 1 >= len(argv):
            sys.exit(__doc__.strip())
        header = argv[i + 1]
        del argv[i:i + 2]
    if not argv or len(argv) > 2 or argv[0].startswith("--"):
        sys.exit(__doc__.strip())
    target = os.path.abspath(os.path.expanduser(argv[0]))
    if len(argv) == 2:
        with open(argv[1], encoding="utf-8") as fh:
            text = fh.read()
    else:
        text = sys.stdin.read()
    lines = [l.rstrip("\r") for l in text.splitlines() if l.strip()]
    if target.endswith(".jsonl"):
        for n, line in enumerate(lines, 1):
            try:
                ok = isinstance(json.loads(line), dict)
            except ValueError:
                ok = False
            if not ok:
                print(f"line {n} is not one JSON object; nothing was written: {line[:120]}")
                return 1
            lines[n - 1] = json.dumps(json.loads(line), ensure_ascii=False)
    if not lines:
        print(f"0 lines appended to {target}")
        return 0
    os.makedirs(os.path.dirname(target), exist_ok=True)
    with open(target, "ab+") as fh:
        if fcntl:
            fcntl.flock(fh.fileno(), fcntl.LOCK_EX)
        try:
            fh.seek(0, os.SEEK_END)
            size = fh.tell()
            out = ""
            if size == 0 and header:
                out += header.rstrip("\n") + "\n\n"
            elif size:
                fh.seek(size - 1)
                if fh.read(1) != b"\n":
                    out += "\n"
            out += "\n".join(lines) + "\n"
            fh.seek(0, os.SEEK_END)
            fh.write(out.encode("utf-8"))
            fh.flush()
            os.fsync(fh.fileno())
        finally:
            if fcntl:
                fcntl.flock(fh.fileno(), fcntl.LOCK_UN)
    print(f"{len(lines)} line(s) appended to {target}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
