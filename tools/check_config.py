#!/usr/bin/env python3
"""每日练习卷：检查 config.json —— 路径在不在、模板能不能编译、题量和时间对不对得上，打印一份小结。

用法：python3 check_config.py [config.json] [--home DIR] [--quick] [--json]

没给 config.json 就用资料夹里的（--home > 环境变量 DAILY_PRACTICE_HOME > ~/Documents/每日练习）。
--quick 不编译，只查路径和数字；默认会在临时文件夹里用一道假题把每门课的骨架 + 模板和 stub 各编译一次
（用 config 里的 TeX 和 Python，跑 build_paper.py；solver 是 circuit 的课，假题里多一张 circuitikz 电路图），
不碰资料夹里的任何文件。题量合计跟 daily_minutes 差 15% 以内 ✓，15–20% ⚠，超过 20% ✗。
每行开头：✓ 没问题；⚠ 建议改，但能跑；✗ 必须改。有 ✗ 时退出码 1。只读，不装任何东西。
"""
import datetime as dt
import glob
import json
import os
import re
import shlex
import shutil
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
EFFORTS = ("low", "medium", "high", "xhigh", "max")
PLACEHOLDERS = {"note", "time", "date_upper", "date_title", "session", "instructions", "inputs",
                "end_text", "code", "title", "title_upper"}
DUMMY = r"""\begin{Question}{1}{10}
Let $f(x) = x^2 + 1$.
\begin{Parts}
\item Evaluate $f(2)$. \Marks{2}
  \AnswerSpace{2}
\item Sketch $f$ on $0 \le x \le 2$.
  \Marks{8}
  \ExamFigure{\begin{tikzpicture}\draw (0,0) -- (2,0) (0,0) -- (0,2); \draw (0,0.5) parabola (1.5,1.6);\end{tikzpicture}}{Q1.1}
  \AnswerSpace{8}
\end{Parts}
\end{Question}
"""
# solver "circuit": the test question also needs circuitikz from the template and the stub
CIRCUIT_PART = r"""\item Find the current in Figure Q1.2. \Marks{1}
  \ExamFigure{\begin{circuitikz}\draw (0,0) to[V, v=$12$ V] (0,2) to[R, l=$4\,\Omega$] (2.5,2) to[R, l=$2\,\Omega$] (2.5,0) -- (0,0);\end{circuitikz}}{Q1.2}
  \AnswerSpace{1}
"""

rows = []


def add(level, text):
    rows.append((level, text))


def ok(t):
    add("ok", t)


def warn(t):
    add("warn", t)


def err(t):
    add("error", t)


def ex(p):
    return os.path.expanduser(p) if isinstance(p, str) else p


def tilde(p):
    home = os.path.expanduser("~")
    return p.replace(home, "~", 1) if isinstance(p, str) and p.startswith(home) else p


def config_path():
    pos = [a for i, a in enumerate(sys.argv[1:], 1) if not a.startswith("--") and sys.argv[i - 1] != "--home"]
    if pos:
        return ex(pos[0])
    home = ex(sys.argv[sys.argv.index("--home") + 1]) if "--home" in sys.argv else ex(
        os.environ.get("DAILY_PRACTICE_HOME") or "~/Documents/每日练习")
    return os.path.join(home, "config.json")


def need_file(label, p, required=True):
    if not p:
        (err if required else warn)(f"{label}：没写")
        return False
    if os.path.exists(ex(p)):
        ok(f"{label}：{tilde(p)}")
        return True
    (err if required else warn)(f"{label}：找不到 {tilde(p)}")
    return False


def tex_cmd(value):
    value = ex(value or "") or shutil.which("tectonic") or shutil.which("xelatex") or ""
    if not value:
        return None
    if os.path.exists(value):
        return [value]
    argv = shlex.split(value)
    return argv if argv and shutil.which(argv[0]) else None


def check_python(py):
    if not py:
        warn("python：没写，默认用 python3")
        py = shutil.which("python3") or sys.executable
    p = ex(py)
    if not (os.path.exists(p) or shutil.which(p)):
        err(f"python：找不到 {tilde(py)}")
        return None
    code = ("import importlib.util as u, sys, json; print(json.dumps({'v': sys.version.split()[0], "
            "'m': {m: bool(u.find_spec(m)) for m in ['pdfplumber', 'pypdfium2', 'pypdf', 'numpy']}}))")
    try:
        r = subprocess.run([p, "-I", "-c", code], capture_output=True, text=True, timeout=60)
        info = json.loads(r.stdout)
    except (OSError, ValueError, subprocess.SubprocessError) as exc:
        err(f"python：{tilde(py)} 跑不起来（{exc}）")
        return None
    major, minor = (int(x) for x in info["v"].split(".")[:2])
    (ok if (major, minor) >= (3, 9) else err)(f"python：{tilde(py)}（{info['v']}，要 3.9+）")
    missing = [m for m in ("pdfplumber", "pypdfium2", "pypdf") if not info["m"][m]]
    if missing:
        err("python 缺库：" + ", ".join(missing) + "（pip install " + " ".join(missing) + "；本脚本不会替你装）")
    if not info["m"]["numpy"]:
        warn("python 没有 numpy：数值核对会难一些（pip install numpy）")
    return p


def check_skeleton(label, path):
    try:
        text = open(ex(path), encoding="utf-8").read()
    except OSError:
        return
    keys = set(re.findall(r"%\((\w+)\)s", text.replace("%%", "")))
    unknown = keys - PLACEHOLDERS
    if unknown:
        err(f"{label} 骨架有不认识的占位符：{', '.join(sorted(unknown))}")
    for k in ("inputs", "instructions", "time"):
        if k not in keys:
            warn(f"{label} 骨架里没有 %({k})s")
    try:
        text % {k: "x" for k in PLACEHOLDERS}
    except (ValueError, TypeError, KeyError) as exc:
        err(f"{label} 骨架的 % 写法不对（{exc}）：普通的 % 要写成 %%")


def instructions_ok(label, items, n):
    out = []
    for it in items or []:
        if isinstance(it, dict):
            it = it.get(str(n), it.get("*"))
            if it is None:
                err(f"{label} 封面说明：{n} 道题时没有对应的写法（加一个 \"*\"）")
                continue
        out.append(str(it).replace("{n}", str(n)).replace("{s}", "s" if n > 1 else ""))
    return out


def compile_course(c, cfg, py, tmp):
    """用一道假题跑一遍 build_paper.py（骨架 + 模板）和 stub 单独编译。"""
    code = c.get("code", "X")
    d = os.path.join(tmp, re.sub(r"\W", "_", code))
    os.makedirs(d)
    frag = os.path.join(d, "question.tex")
    dummy = DUMMY
    if c.get("solver") == "circuit":
        dummy = DUMMY.replace("\\end{Parts}", CIRCUIT_PART + "\\end{Parts}").replace("\\Marks{8}", "\\Marks{7}").replace(
            "\\AnswerSpace{8}", "\\AnswerSpace{7}")
    open(frag, "w").write(dummy)
    build = {"course": c, "date": dt.date.today().isoformat(), "out_dir": os.path.join(d, "paper"),
             "questions": [frag], "cover": {"time": "20 minutes", "source_lines": ["Question 1 is a test."]},
             "tectonic": cfg.get("tectonic")}
    bj = os.path.join(d, "build.json")
    json.dump(build, open(bj, "w"))
    try:
        r = subprocess.run([py, "-I", os.path.join(HERE, "build_paper.py"), bj], capture_output=True, text=True, timeout=600)
        res = json.loads(r.stdout)
    except (OSError, ValueError, subprocess.SubprocessError) as exc:
        err(f"{code} 试编译：build_paper.py 没跑通（{exc}）")
        return
    if res.get("ok"):
        extra = f"，{res['pages']} 页" if res.get("pages") else ""
        over = f"，{len(res['overfull'])} 处 overfull" if res.get("overfull") else ""
        (warn if over else ok)(f"{code} 试编译（骨架 + 模板）：通过{extra}{over}")
    else:
        err(f"{code} 试编译（骨架 + 模板）：失败 " + "; ".join(res.get("errors", [])[:3]))
    home = cfg.get("home")
    stub = ex(c.get("stub") or (home and os.path.join(home, "templates", "stub.tex")) or "")
    tex = tex_cmd(cfg.get("tectonic"))
    if not (stub and os.path.exists(stub) and tex):
        return
    sd = os.path.join(d, "stub")
    os.makedirs(sd)
    shutil.copy(stub, sd)
    shutil.copy(frag, sd)
    open(os.path.join(sd, "standalone.tex"), "w").write(
        "\\documentclass[11pt,a4paper]{article}\n\\input{%s}\n\\begin{document}\n\\input{question.tex}\n\\end{document}\n"
        % os.path.basename(stub))
    argv = tex + (["-X", "compile", "standalone.tex"] if "tectonic" in os.path.basename(tex[0]) else
                  ["-interaction=nonstopmode", "-halt-on-error", "standalone.tex"])
    r = subprocess.run(argv, cwd=sd, capture_output=True, text=True)
    good = r.returncode == 0 and os.path.exists(os.path.join(sd, "standalone.pdf"))
    errs = [l for l in (r.stdout + r.stderr).splitlines() if l.startswith(("error", "!"))]
    (ok if good else err)(f"{code} 试编译（stub）：" + ("通过" if good else "失败 " + "; ".join(errs[:2])))


def main():
    path = config_path()
    try:
        cfg = json.load(open(path, encoding="utf-8"))
    except OSError:
        err(f"config.json：找不到 {tilde(path)}（资料夹在别处的话，直接给 config.json 的路径或者用 --home；"
            "profile.py 会在常见位置找已有的资料夹）")
        return report(path, None)
    except ValueError as exc:
        err(f"config.json：不是合法的 JSON（{exc}）")
        return report(path, None)
    (ok if cfg.get("version") == 1 else warn)(f"version：{cfg.get('version')}（应为 1）")
    tildes = []

    def walk(v, where):
        if isinstance(v, dict):
            for k, x in v.items():
                walk(x, f"{where}.{k}" if where else k)
        elif isinstance(v, list):
            for i, x in enumerate(v):
                walk(x, f"{where}[{i}]")
        elif isinstance(v, str) and (v.startswith("~") or '"~/' in v):
            tildes.append(where)
    walk(cfg, "")
    if tildes:
        warn("这些路径用 ~ 开头，agent 把路径放进引号里时 ~ 不会展开，请写成绝对路径：" + ", ".join(tildes[:12])
             + (" …" if len(tildes) > 12 else ""))
    home = cfg.get("home")
    if need_file("home（资料夹）", home):
        for sub in ("templates", "refs", "staging", "log"):
            if not os.path.isdir(os.path.join(ex(home), sub)):
                warn(f"资料夹里还没有 {sub}/（第一次跑时会建，templates/ 和 refs/ 要先放好）")
    skill = cfg.get("skill_dir") or os.path.dirname(HERE)
    if not cfg.get("skill_dir"):
        warn(f"skill_dir：没写，工作流需要它；这份 skill 在 {tilde(os.path.dirname(HERE))}")
    for f in ("workflow/daily-practice.js", "tools/build_paper.py", "tools/render.py", "tools/merge.py"):
        if not os.path.exists(os.path.join(ex(skill), f)):
            err(f"skill_dir：{tilde(skill)} 里没有 {f}")
    eff = cfg.get("effort", "xhigh")
    (ok if eff in EFFORTS else err)(f"effort：{eff}（可选 {', '.join(EFFORTS)}）")
    daily = cfg.get("daily_minutes", 120)
    (ok if isinstance(daily, (int, float)) and daily > 0 else err)(f"daily_minutes：{daily}")
    sched = cfg.get("schedule", "")
    (ok if re.fullmatch(r"([01]\d|2[0-3]):[0-5]\d", str(sched)) else warn)(f"schedule：{sched or '没写'}（HH:MM）")
    lang = cfg.get("language", {})
    ok(f"language：题目 {lang.get('questions', 'English')}，批改 {lang.get('feedback', 'zh')}")

    dl = cfg.get("delivery", {})
    if dl.get("dir"):
        (ok if os.path.isdir(ex(dl["dir"])) else warn)(f"delivery.dir：{tilde(dl['dir'])}{'' if os.path.isdir(ex(dl['dir'])) else '（还不存在）'}")
    else:
        warn("delivery.dir：没写，卷子只放在课程文件夹里，合成的 PDF 会放到 <home>/out")
    for k in ("answered_dir", "feedback_dir"):
        if dl.get(k) and not os.path.isdir(ex(dl[k])):
            warn(f"delivery.{k}：{tilde(dl[k])} 还不存在（批改时会建）")
    if "{date}" not in dl.get("combined_name", "{date}"):
        err("delivery.combined_name 里要有 {date}")

    py = check_python(cfg.get("python"))
    tex = tex_cmd(cfg.get("tectonic"))
    (ok if tex else err)(f"tectonic：{tilde(' '.join(tex)) if tex else '找不到 tectonic / xelatex'}")
    need_file("rules", cfg.get("rules") or (home and os.path.join(home, "rules.md")))
    need_file("source_map", cfg.get("source_map") or (home and os.path.join(home, "source-map.md")))
    need_file("feedback_preamble", cfg.get("feedback_preamble") or (home and os.path.join(home, "templates", "feedback-preamble.tex")), False)

    lms = cfg.get("lms")
    courses = cfg.get("courses") or []
    if lms:
        for k in ("status", "collect", "api_get", "download", "snapshot_glob"):
            if not lms.get(k):
                warn(f"lms.{k}：没写")
        for k in ("status", "collect", "api_get", "download"):
            for tok in shlex.split(lms.get(k, "")):
                if tok.endswith(".py") and not os.path.exists(ex(tok)):
                    err(f"lms.{k}：找不到 {tilde(tok)}")
        if lms.get("snapshot_glob"):
            for c in courses:
                if c.get("lms_course_id"):
                    n = len(glob.glob(ex(lms["snapshot_glob"].replace("{course_id}", str(c["lms_course_id"])))))
                    (ok if n else warn)(f"lms 快照 {c.get('code')}：{n} 份")
                else:
                    warn(f"{c.get('code')}：有 lms 但没写 lms_course_id")
        ok(f"lms：{lms.get('name', '?')}")
    else:
        ok("lms：没配（已学范围按 rules 和每门课的 taught_notes）")
        for c in courses:
            if not c.get("taught_notes"):
                warn(f"{c.get('code')}：没有 lms，也没有 taught_notes，计划时不知道学到哪了")

    if not courses:
        err("courses：一门课都没有")
    codes = [c.get("code") for c in courses]
    prefixes = [c.get("id_prefix") or (c.get("code") or "?")[0] for c in courses]
    if len(set(codes)) != len(codes):
        err("courses：code 有重复")
    if len(set(prefixes)) != len(prefixes):
        err("courses：id_prefix 有重复（题号 E1、M1 会撞）")
    total = light = 0.0
    for c in courses:
        code = c.get("code") or "?"
        for k in ("code", "title", "folder", "template", "skeleton", "facts"):
            if not c.get(k):
                (warn if k in ("title", "facts") else err)(f"{code}：没写 {k}")
        need_file(f"{code} folder", c.get("folder"))
        need_file(f"{code} materials", c.get("materials") or (c.get("folder") and os.path.join(c["folder"], "materials")), False)
        need_file(f"{code} text_dir", c.get("text_dir") or (home and os.path.join(home, "refs", "text", code)), False)
        need_file(f"{code} png_dir", c.get("png_dir") or (home and os.path.join(home, "refs", "png", code)), False)
        need_file(f"{code} template", c.get("template"))
        need_file(f"{code} stub", c.get("stub") or (home and os.path.join(home, "templates", "stub.tex")))
        if need_file(f"{code} skeleton", c.get("skeleton")):
            check_skeleton(code, c["skeleton"])
        need_file(f"{code} usage", c.get("usage"), False)
        if c.get("solver", "numeric") not in ("circuit", "numeric"):
            err(f"{code} solver：{c.get('solver')}（circuit 或 numeric）")
        q, m, mpm, lq = (c.get("questions_per_day", 2), c.get("marks_per_question", 10),
                         c.get("minutes_per_mark", 2), c.get("light_questions", 1))
        if not all(isinstance(v, (int, float)) and v > 0 for v in (m, mpm)):
            err(f"{code}：marks_per_question / minutes_per_mark 要是正数")
            continue
        if not all(isinstance(v, int) and not isinstance(v, bool) and v >= 0 for v in (q, lq)):
            err(f"{code}：questions_per_day / light_questions 要是 0 或正整数（0 = 这门课暂停出题）")
            continue
        if q == 0:
            warn(f"{code}：questions_per_day 是 0，这门课暂停出题（交回来的卷子还会批改）")
            lq = 0
        elif lq > q:
            warn(f"{code}：light_questions（{lq}）比 questions_per_day（{q}）还多，轻松日按 {q} 道算")
            lq = q
        total += q * m * mpm
        light += lq * m * mpm
        cover = c.get("cover", {})
        if cover.get("time_style", "digits") not in ("digits", "words"):
            err(f"{code} cover.time_style：{cover.get('time_style')}（digits 或 words）")
        for n in sorted({int(q), int(lq)} - {0}):
            lines = instructions_ok(code, cover.get("instructions"), n)
            if lines:
                ok(f"{code} 封面（{n} 道题）：" + " / ".join(lines[:2]) + (" …" if len(lines) > 2 else ""))
        ok(f"{code}：每天 {q} 道 × {m} 分 × {mpm} 分钟/分 = 约 {q * m * mpm:.0f} 分钟（轻松日 {lq} 道）")
    if courses and isinstance(daily, (int, float)) and daily > 0:
        dev = abs(total - daily) / daily
        level = ok if dev <= 0.15 else (warn if dev <= 0.2 else err)
        fix = "" if dev <= 0.15 else "：题量由每门课的 questions_per_day × marks_per_question × minutes_per_mark 决定，改它们（或者 daily_minutes）让两边对上"
        level(f"题量合计：约 {total:.0f} 分钟，daily_minutes = {daily}（差 {dev:.0%}）；轻松日约 {light:.0f} 分钟{fix}")

    if "--quick" not in sys.argv and py and tex and not any(l == "error" for l, _ in rows):
        tmp = tempfile.mkdtemp(prefix="daily-practice-check-")
        try:
            for c in courses:
                compile_course(c, cfg, py, tmp)
        finally:
            shutil.rmtree(tmp, ignore_errors=True)
    elif "--quick" not in sys.argv:
        warn("试编译：前面有 ✗，先改好再试编译")
    return report(path, cfg)


def report(path, cfg):
    errors = sum(1 for l, _ in rows if l == "error")
    warns = sum(1 for l, _ in rows if l == "warn")
    if "--json" in sys.argv:
        print(json.dumps({"config": path, "errors": errors, "warnings": warns,
                          "rows": [{"level": l, "text": t} for l, t in rows]}, ensure_ascii=False, indent=1))
    else:
        mark = {"ok": "✓", "warn": "⚠", "error": "✗"}
        print(f"# 检查 {tilde(path)}\n")
        for l, t in rows:
            print(f"{mark[l]} {t}")
        print(f"\n小结：{errors} 个必须改（✗），{warns} 个建议改（⚠）。" + ("可以跑了。" if not errors else ""))
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
