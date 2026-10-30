#!/usr/bin/env python3
"""Build one course's daily practice paper from reviewed question fragments.

usage: python3 -I build_paper.py <build.json>

build.json:
  {"course": {<one entry of config.json "courses">} | "<CODE>",
   "config": "<path to config.json>",           # needed when "course" is a code; also gives "tectonic"
   "date": "2026-10-31",
   "out_dir": "<course folder>/practice/daily/2026-10-31",
   "questions": ["<abs path>/question.tex", ...],  # in order; the numbers inside must already match
   "cover": {"time": "1 hour 15 minutes",         # printed the way the course template prints it
             "session": "DAILY PRACTICE",         # optional, default: course cover.session
             "note": "...",                       # optional, default: course cover.note
             "source_lines": ["Question 1 is adapted from ...", "..."]},   # LaTeX allowed
   "tectonic": "<tectonic or xelatex>"}          # optional

What the course entry must give:
  "code", "template" (the exam .sty, copied next to the paper), "skeleton" (a .tex with
  placeholders), optional "template_files" (more files to copy) and
  "cover": {"session", "instructions", "end_text", "note"}.

Skeleton placeholders (Python %-format, so write a literal % as %%):
  %(note)s %(time)s %(date_upper)s %(date_title)s %(session)s %(instructions)s %(inputs)s %(end_text)s
  and, if wanted, %(code)s %(title)s %(title_upper)s.
  date_upper is "31 OCTOBER 2026", date_title "31 October 2026".

Instructions: each entry of cover.instructions is either a string, in which {n} is the number of
questions and {s} is "s" when n > 1, or an object {"1": "...", "2": "...", "*": "..."} chosen by n
("*" for any other n). cover.source_lines follow them. Paragraphs are joined by a blank line.

Writes <CODE>_Daily_<date>.tex in out_dir next to a copy of the template and of each fragment
(q1.tex, q2.tex, ...), compiles it (tectonic -X compile --keep-logs; xelatex / lualatex are run
twice), renders every page to <out_dir>/png (prefix p, scale 1.4; needs pypdfium2) and prints a
JSON summary: tex, pdf, ok, pages, errors, overfull boxes, cover_text.
Needs Python 3.9+; rendering needs pypdfium2 (pip install pypdfium2). Nothing is installed here.
"""
import datetime
import json
import os
import re
import shlex
import shutil
import subprocess
import sys

MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August",
          "September", "October", "November", "December"]
DEFAULT_NOTE = "Self-study practice paper written from past examination questions."
PLACEHOLDERS = ("note", "time", "date_upper", "date_title", "session", "instructions", "inputs",
                "end_text", "code", "title", "title_upper")


def fail(msg):
    print(json.dumps({"ok": False, "errors": [msg]}, ensure_ascii=False, indent=1))
    sys.exit(2)


def expand(p):
    return os.path.expanduser(p) if isinstance(p, str) else p


def load_course(cfg):
    course = cfg.get("course")
    tex = cfg.get("tectonic")
    if isinstance(course, str):
        path = expand(cfg.get("config") or "")
        if not path or not os.path.exists(path):
            fail('"course" is a code, so "config" must point at config.json')
        with open(path, encoding="utf-8") as fh:
            full = json.load(fh)
        match = [c for c in full.get("courses", []) if c.get("code") == course]
        if not match:
            fail(f"course {course} is not in {path}")
        course = match[0]
        tex = tex or full.get("tectonic")
    elif not isinstance(course, dict):
        fail('"course" must be a course object or a course code')
    elif cfg.get("config") and not tex:
        try:
            with open(expand(cfg["config"]), encoding="utf-8") as fh:
                tex = json.load(fh).get("tectonic")
        except (OSError, ValueError):
            pass
    return course, tex


def tex_command(value):
    """The TeX engine as an argv prefix: tectonic, xelatex or lualatex."""
    value = value or os.environ.get("DAILY_PRACTICE_TEX") or shutil.which("tectonic") or shutil.which("xelatex")
    if not value:
        fail("no TeX engine: set \"tectonic\" in config.json (tectonic or xelatex)")
    value = expand(value)
    return [value] if os.path.exists(value) else shlex.split(value)


def instruction_lines(items, n):
    out = []
    for item in items or []:
        if isinstance(item, dict):
            item = item.get(str(n), item.get("*", ""))
        if not item:
            continue
        out.append(str(item).replace("{n}", str(n)).replace("{s}", "s" if n > 1 else ""))
    return out


def compile_tex(cmd, name, out):
    engine = os.path.basename(cmd[0]).lower()
    if "tectonic" in engine:
        runs = [cmd + ["-X", "compile", "--keep-logs", name + ".tex"]]
    else:  # xelatex / lualatex: two passes so "page X of N" is right
        one = cmd + ["-interaction=nonstopmode", "-halt-on-error", "-file-line-error", name + ".tex"]
        runs = [one, one]
    text, code = "", 0
    for argv in runs:
        try:
            r = subprocess.run(argv, cwd=out, capture_output=True, text=True)
        except OSError as exc:
            return False, [f"cannot run {argv[0]}: {exc}"]
        text += r.stdout + r.stderr
        code = r.returncode
        if code:
            break
    errors = [l for l in text.splitlines() if l.startswith(("error", "!")) or re.search(r"\.tex:\d+: ", l)]
    return code == 0, errors[:20]


def render(pdf_path, png_dir):
    try:
        import pypdfium2 as pdfium
    except ImportError:
        return None, "", "pypdfium2 is not installed: pages not rendered"
    shutil.rmtree(png_dir, ignore_errors=True)
    os.makedirs(png_dir)
    pdf = pdfium.PdfDocument(pdf_path)
    for i in range(len(pdf)):
        pdf[i].render(scale=1.4).to_pil().save(os.path.join(png_dir, f"p_p{i + 1}.png"))
    try:
        cover = pdf[0].get_textpage().get_text_range()
    except Exception:  # text extraction is a convenience only
        cover = ""
    return len(pdf), cover, None


def build(cfg):
    course, tex = load_course(cfg)
    code, date = course["code"], cfg["date"]
    d = datetime.date.fromisoformat(date)
    out = expand(cfg["out_dir"])
    os.makedirs(out, exist_ok=True)
    cc = course.get("cover", {})
    cover = cfg.get("cover", {})
    questions = [expand(q) for q in cfg["questions"]]
    n = len(questions)
    lines = instruction_lines(cc.get("instructions"), n) + list(cover.get("source_lines", []))

    skeleton_path = expand(course.get("skeleton") or "")
    if not os.path.exists(skeleton_path):
        fail(f"skeleton not found: {skeleton_path}")
    with open(skeleton_path, encoding="utf-8") as fh:
        skeleton = fh.read()
    for f in [course.get("template")] + list(course.get("template_files", [])):
        if f:
            f = expand(f)
            if not os.path.exists(f):
                fail(f"template file not found: {f}")
            shutil.copy(f, out)
    inputs = []
    for i, q in enumerate(questions, 1):
        shutil.copy(q, os.path.join(out, f"q{i}.tex"))
        inputs.append(rf"\input{{q{i}.tex}}")
    title = course.get("title", "")
    values = {
        "note": cover.get("note") or cc.get("note") or DEFAULT_NOTE,
        "time": cover.get("time", ""),
        "date_upper": f"{d.day} {MONTHS[d.month - 1]} {d.year}".upper(),
        "date_title": f"{d.day} {MONTHS[d.month - 1]} {d.year}",
        "session": cover.get("session") or cc.get("session", "Daily practice"),
        "instructions": "\n\n   ".join(lines),
        "inputs": "\n\n".join(inputs),
        "end_text": cc.get("end_text", "End of Practice Paper"),
        "code": code, "title": title, "title_upper": title.upper(),
    }
    try:
        text = skeleton % values
    except KeyError as exc:
        fail(f"unknown placeholder {exc} in {skeleton_path}; allowed: {', '.join(PLACEHOLDERS)}")
    except (ValueError, TypeError) as exc:
        fail(f"bad %-format in {skeleton_path} ({exc}); write a literal % as %%")
    name = f"{code}_Daily_{date}"
    with open(os.path.join(out, name + ".tex"), "w", encoding="utf-8") as fh:
        fh.write(text)
    ok, errors = compile_tex(tex_command(tex), name, out)
    pdf_path = os.path.join(out, name + ".pdf")
    log_path = os.path.join(out, name + ".log")
    log = open(log_path, encoding="utf-8", errors="replace").read() if os.path.exists(log_path) else ""
    summary = {"tex": os.path.join(out, name + ".tex"), "pdf": pdf_path,
               "ok": ok and os.path.exists(pdf_path), "errors": errors,
               "overfull": re.findall(r"Overfull \\[hv]box[^\n]*", log)[:20]}
    if summary["ok"]:
        png = os.path.join(out, "png")
        pages, cover_text, warn = render(pdf_path, png)
        if warn:
            summary["warning"] = warn
        else:
            summary.update(pages=pages, png_dir=png, cover_text=cover_text)
    print(json.dumps(summary, ensure_ascii=False, indent=1))
    return summary


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(2)
    with open(sys.argv[1], encoding="utf-8") as fh:
        sys.exit(0 if build(json.load(fh))["ok"] else 1)
