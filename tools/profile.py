#!/usr/bin/env python3
"""每日练习卷：读当前用户自己的 AI 记忆、近期会话和磁盘上的文件夹，打印一份「学习线索」，
用来第一次建档（config.json、source-map.md），或者找不到例题时帮你定位。

用法：python3 profile.py [--days 30] [--max 60] [--home DIR] [--no-scan]

只打印，不写文件。有就读，没有就跳过：
- 资料夹：--home > 环境变量 DAILY_PRACTICE_HOME > 默认 ~/Documents/每日练习（可以是指向别处的链接）。
  那里没有 config.json（又没给 --home）时，在 ~/Documents、~/Desktop、iCloud Drive 和家目录的前几层
  找已有的资料夹：config.json 里 skill_dir 指向 daily-practice 的。--no-scan 不影响这一步
- Claude Code 记忆：~/.claude/projects/*/memory/*.md；Codex 记忆：~/.codex/memories/*.md
- Claude Code / Codex 近 N 天会话的标题和第一句话
- 磁盘上像课程资料的文件夹（往年试卷、模拟卷、习题、课件、讲义），只看 ~/Documents、~/Desktop、
  ~/Downloads 和 iCloud Drive 的前几层，只列文件夹和 PDF 个数，不读文件内容
- 已安装的学习平台助手 skill（例如 jiujiastudy）、Python 库和 TeX
宿主自动加载的说明（~/.claude/CLAUDE.md、~/.codex/AGENTS.md）不在这里重复，直接用上下文里已有的。
只列和学习有关的条目。看起来涉及健康、财务、证件、住址、联系方式、感情、家人朋友的记录整条跳过，
只报跳过了几条；剩下的文字里，邮箱、电话、邮编和「X 老师 / Dr X」这类称呼替换成 [已隐去]。
"""
import datetime as dt
import glob
import importlib.util
import json
import os
import re
import shutil
import subprocess
import sys
from collections import Counter

HOME = os.path.expanduser("~")
DEFAULT_HOME = "~/Documents/每日练习"
ICLOUD = f"{HOME}/Library/Mobile Documents/com~apple~CloudDocs"
SENSITIVE = re.compile(
    r"health|medical|doctor|clinic|symptom|diagnos|therap|dental|teeth|allerg|injur|illness|\bsick\b|\bpain\b|"
    r"anxiety|depress|insomnia|\bNHS\b|\bGP\b|finance|bank|salary|"
    r"tuition|visa|passport|password|api key|access token|address|postcode|phone number|birthday|\bDOB\b|"
    r"relationship|dating|romance|breakup|girlfriend|boyfriend|roommate|flatmate|my name|full name|"
    r"健康|医|病|药|症状|治疗|体检|疼|痛|过敏|炎|伤口|受伤|身体|牙齿|牙医|视力|失眠|抑郁|焦虑|"
    r"财务|银行|转账|学费|签证|护照|身份证|密码|"
    r"住址|地址|邮编|电话|手机号|生日|出生|姓名|英文名|中文名|称呼|恋爱|暧昧|分手|复合|约会|感情|情感|婚|前任|"
    r"室友|家人|父母|朋友|男朋友|女朋友|军师|聊天记录分析|wechat|微信|texting|"
    r"\bauthor\b|\bnames?\b|署名|落款|签名|名叫",
    re.I)
STUDY = re.compile(
    r"course|module|exam|past.?paper|mock|example.?sheet|examples|tutorial|lecture|slides|homework|"
    r"assignment|coursework|syllabus|revision|quiz|textbook|formula|semester|practice paper|"
    r"canvas|moodle|blackboard|brightspace|\blms\b|jiujiastudy|"
    r"课程|课件|考试|真题|往年|试卷|模拟卷|习题|例题|讲义|作业|复习|测验|教材|学期|练习卷|学习|上课|教授",
    re.I)
CODE = re.compile(r"\b[A-Z]{2,5} ?\d{3,5}[A-Z]?\b")
MATERIAL_DIR = re.compile(
    r"past.?papers?|exams?\b|mock|examples?|tutorials?|lectures?|slides|notes|materials|revision|"
    r"problem.?sets?|worksheets?|课件|真题|试卷|往年|习题|讲义|作业|复习|资料", re.I)
EXAM_PDF = re.compile(r"past|exam|mock|paper|solution|answer|example|tutorial|sheet|试卷|真题|答案|习题", re.I)
REMINDER = re.compile(r"<system-reminder>.*?</system-reminder>", re.S)
TAGGED = re.compile(r"<(pasted_content|command-[a-z]+|local-command-[a-z]+)[^>]*>.*?</\1>", re.S)
FILE_REF = re.compile(r'@"[^"]*"|@/\S+')
SCRUB = [
    (re.compile(r"https?://([\w.-]+)[^\s)\]>，。]*"), r"[链接 \1]"),
    (re.compile(r"[\w.+-]+@[\w-]+(\.[\w-]+)+"), "[邮箱已隐去]"),
    (re.compile(r"(?<![\w.])@[A-Za-z][\w-]{2,}"), "@[账号已隐去]"),
    (re.compile(r"\b(fork|forked from|github\.com/) *[\w.-]+/", re.I), r"\1 [账号已隐去]/"),
    (re.compile(r"\+\d{1,3}[\d ]{8,14}\d|\b0\d{9,10}\b|\b0\d{3,4} \d{6,7}\b"), "[号码已隐去]"),
    (re.compile(r"\b[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}\b"), "[已隐去]"),
    (re.compile(r"\b(Prof(?:essor)?|Dr|Mr|Mrs|Ms|Miss)\.? +[A-Z][\w'-]+(?: +[A-Z][\w'-]+)?"), r"\1 [名字已隐去]"),
    (re.compile(r"[一-鿿]{1,3}(老师|教授|导师|同学)"), r"[名字已隐去]\1"),
    (re.compile(r"\b[A-Z][a-z]+(?: [A-Z][a-z]+)? ?(老师|教授|导师|同学)"), r"[名字已隐去]\1"),
]
SKIP_DIRS = {"node_modules", ".git", "__pycache__", "Library", "Applications", "venv", ".venv", "site-packages"}


def arg(name, default):
    return type(default)(sys.argv[sys.argv.index(name) + 1]) if name in sys.argv else default


def tilde(p):
    return p.replace(HOME, "~", 1) if p.startswith(HOME) else p


def one_line(text, n=140):
    text = re.sub(r"\s+", " ", text).strip()
    return text if len(text) <= n else text[: n - 1] + "…"


def own_names():
    """本机账户的全名和 git 里登记的名字、邮箱：文字里出现就隐去。"""
    names = set()
    try:
        import pwd
        names.add(pwd.getpwuid(os.getuid()).pw_gecos.split(",")[0].strip())
    except (ImportError, KeyError):
        pass
    for key in ("user.name", "user.email"):
        try:
            r = subprocess.run(["git", "config", "--global", key], capture_output=True, text=True, timeout=5)
            names.add(r.stdout.strip())
        except (OSError, subprocess.SubprocessError):
            pass
    return [n for n in names if len(n) >= 4 and n.lower() != os.path.basename(HOME).lower()]


OWN = [re.compile(re.escape(n), re.I) for n in own_names()]


def scrub(text):
    for rx in OWN:
        text = rx.sub("[名字已隐去]", text)
    for rx, rep in SCRUB:
        text = rx.sub(rep, text)
    return text


def show(path):
    """打印用的路径：家目录写成 ~，名字、邮箱这类照样隐去。"""
    return scrub(tilde(path))


def data_home():
    """(资料夹, 怎么定的)：--home > 环境变量 DAILY_PRACTICE_HOME > 默认 ~/Documents/每日练习。"""
    if "--home" in sys.argv:
        return os.path.expanduser(sys.argv[sys.argv.index("--home") + 1]), "--home"
    if os.environ.get("DAILY_PRACTICE_HOME"):
        return os.path.expanduser(os.environ["DAILY_PRACTICE_HOME"]), "环境变量 DAILY_PRACTICE_HOME"
    return os.path.expanduser(DEFAULT_HOME), "默认位置"


def is_dp_config(path):
    """这份 config.json 是不是 daily-practice 的：skill_dir 以 daily-practice 结尾，或者有 version、home、courses。"""
    try:
        if os.path.getsize(path) > 2_000_000:
            return False
        with open(path, encoding="utf-8") as fh:
            d = json.load(fh)
    except (OSError, ValueError):
        return False
    if not isinstance(d, dict):
        return False
    skill = str(d.get("skill_dir") or "").rstrip("/")
    return skill.endswith("daily-practice") or (
        d.get("version") == 1 and bool(d.get("home")) and isinstance(d.get("courses"), list))


def existing_homes(budget=30000, depth=5):
    """已有的资料夹：在常见位置的前几层找 daily-practice 的 config.json，返回它们所在的文件夹。"""
    roots = [(f"{HOME}/Documents", depth), (f"{HOME}/Desktop", depth), (ICLOUD, depth), (HOME, 1)]
    stack = [(r, 0, d) for r, d in reversed(roots) if os.path.isdir(r)]
    found, seen, n = [], set(), 0
    while stack and n < budget:
        path, d, limit = stack.pop()
        real = os.path.realpath(path)
        if real in seen:
            continue
        seen.add(real)
        n += 1
        try:
            entries = list(os.scandir(path))
        except OSError:
            continue
        if any(e.name == "config.json" and e.is_file() for e in entries) and is_dp_config(os.path.join(path, "config.json")):
            found.append(path)
        if d < limit:
            for e in entries:
                if e.is_dir(follow_symlinks=False) and not e.name.startswith(".") and e.name not in SKIP_DIRS:
                    stack.append((e.path, d + 1, limit))
    return found


def frontmatter(path):
    meta, body = {}, ""
    try:
        text = open(path, encoding="utf-8").read()
    except OSError:
        return meta, body
    m = re.match(r"---\n(.*?)\n---\n?(.*)", text, re.S)
    if not m:
        return meta, text
    for line in m.group(1).splitlines():
        kv = re.match(r"\s*(\w+):\s*(.*)", line)
        if kv:
            meta.setdefault(kv.group(1), kv.group(2).strip().strip('"'))
    return meta, m.group(2)


def memories():
    """学习相关的记忆条目；同名的只留最新一份。返回 (条目, 跳过的隐私条数, 不相关条数, 用来找课程代码的文字)。"""
    paths = glob.glob(f"{HOME}/.claude/projects/*/memory/*.md") + glob.glob(f"{HOME}/.codex/memories/*.md")
    best = {}
    for p in paths:
        if os.path.basename(p) == "MEMORY.md":
            continue
        meta, body = frontmatter(p)
        name = meta.get("name") or os.path.basename(p)[:-3]
        mtime = os.path.getmtime(p)
        if name not in best or mtime > best[name][0]:
            best[name] = (mtime, meta.get("type", ""), meta.get("description") or one_line(body, 160), body)
    kept, sensitive, unrelated, texts = [], 0, 0, []
    for name, (mtime, typ, desc, body) in sorted(best.items(), key=lambda kv: -kv[1][0]):
        head = f"{name} {desc}"
        if SENSITIVE.search(head):
            sensitive += 1
            continue
        if not STUDY.search(head + " " + body[:2000]):
            unrelated += 1
            continue
        # 正文里的学习句子也给一两行（同样过滤）
        lines = [l.strip(" -*#\t") for l in body.splitlines()]
        extra = [l for l in lines if l and STUDY.search(l) and not SENSITIVE.search(l)][:3]
        texts.append(head + " " + " ".join(extra))
        kept.append((dt.date.fromtimestamp(mtime).isoformat(), typ, scrub(name), scrub(desc), [scrub(one_line(e, 160)) for e in extra]))
    return kept, sensitive, unrelated, texts


def first_user_text_claude(path):
    title, first = None, None
    with open(path, encoding="utf-8", errors="replace") as f:
        for line in f:
            if '"custom-title"' in line:
                try:
                    title = json.loads(line).get("customTitle") or title
                except ValueError:
                    pass
                continue
            if first or '"type":"user"' not in line:
                continue
            try:
                d = json.loads(line)
            except ValueError:
                continue
            if d.get("isMeta") or d.get("isSidechain"):
                continue
            content = d.get("message", {}).get("content")
            texts = [content] if isinstance(content, str) else [
                c.get("text", "") for c in content or [] if isinstance(c, dict) and c.get("type") == "text"]
            for t in texts:
                t = FILE_REF.sub("", TAGGED.sub("", REMINDER.sub("", t))).strip()
                if t and not t.startswith(("<", "Caveat:", "[auto-continue]", "[Workflow harness")):
                    first = t
                    break
    return title, first


def first_user_text_codex(path):
    skip = ("# AGENTS.md", "<environment_context>", "<user_instructions>", "<")
    with open(path, encoding="utf-8", errors="replace") as f:
        for line in f:
            if '"role":"user"' not in line:
                continue
            try:
                payload = json.loads(line).get("payload", {})
            except ValueError:
                continue
            for c in payload.get("content") or []:
                t = (c.get("text") or "").strip()
                if t and not t.startswith(skip):
                    return t
    return None


def sessions(days, limit):
    cutoff = dt.datetime.now().timestamp() - days * 86400
    rows, sensitive, texts = [], 0, []
    files = [(p, "Claude Code") for p in glob.glob(f"{HOME}/.claude/projects/*/*.jsonl")]
    files += [(p, "Codex") for p in glob.glob(f"{HOME}/.codex/sessions/**/*.jsonl", recursive=True)]
    for p, host in files:
        try:
            mtime = os.path.getmtime(p)
        except OSError:
            continue
        if mtime < cutoff:
            continue
        title, first = (None, first_user_text_codex(p)) if host == "Codex" else first_user_text_claude(p)
        text = f"{title or ''} {first or ''}"
        if not text.strip() or not STUDY.search(text):
            continue
        if SENSITIVE.search(text):
            sensitive += 1
            continue
        texts.append(text)
        rows.append((mtime, host, title, first))
    rows.sort(key=lambda r: -r[0])
    names = Counter(r[2] for r in rows if r[2])
    out, shown = [], set()
    for mtime, host, title, first in rows:
        if title and names[title] > 1:
            if title in shown:
                continue
            shown.add(title)
            out.append(f"- {scrub(title)} ×{names[title]}（{host}，同名会话，多半是定时任务）")
            continue
        head = f"{scrub(title)}：" if title else ""
        out.append(f"- {dt.date.fromtimestamp(mtime).isoformat()} {head}{scrub(one_line(first or '', 120))}（{host}）")
    return out[:limit], sensitive, len(rows), texts


def course_codes(texts):
    c = Counter()
    for t in texts:
        for m in CODE.findall(t):
            c[m.replace(" ", "")] += 1
    return c


def scan_folders(codes, budget=40000, depth=6):
    """像课程资料的文件夹：名字像「往年试卷 / 课件 / 习题」或带课程代码；数一下里面（含子文件夹）的 PDF。"""
    roots = [f"{HOME}/Documents", f"{HOME}/Desktop", f"{HOME}/Downloads", ICLOUD]
    code_rx = re.compile("|".join(re.escape(c) for c in codes)) if codes else None
    found, seen = [], 0
    stack = [(r, 0) for r in roots if os.path.isdir(r)]
    while stack and seen < budget:
        path, d = stack.pop()
        seen += 1
        try:
            entries = list(os.scandir(path))
        except OSError:
            continue
        pdfs = sum(1 for e in entries if e.is_file() and e.name.lower().endswith(".pdf"))
        exam_pdfs = sum(1 for e in entries if e.is_file() and e.name.lower().endswith(".pdf") and EXAM_PDF.search(e.name))
        name = os.path.basename(path)
        coded = bool(code_rx and code_rx.search(name))
        hit = (MATERIAL_DIR.search(name) and pdfs) or coded
        if (hit or exam_pdfs >= 2) and not SENSITIVE.search(path.replace(HOME, "")):
            found.append((path, pdfs, exam_pdfs))
        if d < depth:
            for e in entries:
                if e.is_dir(follow_symlinks=False) and not e.name.startswith(".") and e.name not in SKIP_DIRS:
                    stack.append((e.path, d + 1))
    found.sort(key=lambda r: (-r[2], -r[1], r[0]))
    return found, seen, bool(stack)


def lms_helpers():
    out = []
    for root in (f"{HOME}/.claude/skills", f"{HOME}/.codex/skills"):
        for p in sorted(glob.glob(f"{root}/*/SKILL.md")):
            name = os.path.basename(os.path.dirname(p))
            if re.search(r"jiujiastudy|canvas|moodle|blackboard|brightspace|\blms\b", name, re.I):
                d = os.path.dirname(os.path.realpath(p))
                extra = "，命令行在 tools/coach.py" if os.path.exists(os.path.join(d, "tools", "coach.py")) else ""
                out.append(f"- {name}：{show(p)}{extra}")
    return out


def tools():
    out = [f"- Python：{show(sys.executable)}（{sys.version.split()[0]}）"]
    for mod, why in (("pdfplumber", "提取 PDF 文字"), ("pypdfium2", "渲染页面"), ("pypdf", "合并 PDF"), ("numpy", "数值核对")):
        ok = importlib.util.find_spec(mod) is not None
        out.append(f"  - {mod}：{'有' if ok else '没有'}（{why}）")
    for exe in ("tectonic", "xelatex", "lualatex", "node"):
        p = shutil.which(exe) or (os.path.exists(f"{HOME}/.local/bin/{exe}") and f"{HOME}/.local/bin/{exe}")
        out.append(f"- {exe}：{show(p) if p else '没找到'}")
    return out


def main():
    days, limit = arg("--days", 30), arg("--max", 60)
    home, how = data_home()
    print(f"# 学习线索（{dt.date.today().isoformat()}）\n")
    if os.path.exists(os.path.join(home, "config.json")):
        print(f"资料夹：{show(home)}（{how}，已有 config.json）\n")
    elif how == "--home":
        print(f"资料夹：{show(home)}（--home 指定的，里面还没有 config.json）\n")
    else:
        print(f"资料夹：{show(home)}（{how}，还没有 config.json）")
        found = existing_homes()
        if found:
            print("- 找到已有的资料夹（里面的 config.json 是 daily-practice 的）：用它，不要另建。")
            for p in found:
                print(f"  - {show(p)}")
            print(f"- 以后不用再找：在默认位置建一个指向它的链接（ln -s \"<已有的资料夹>\" {DEFAULT_HOME}），"
                  "或者设环境变量 DAILY_PRACTICE_HOME。\n")
        else:
            print("- 常见位置也没找到已有的 config.json。记忆和宿主说明里也没提到别的位置，才算第一次用、要建档。\n")

    mem, mem_sens, mem_other, mem_texts = memories()
    print(f"## AI 记忆里和学习有关的：{len(mem)} 条（跳过疑似隐私 {mem_sens} 条，和学习无关 {mem_other} 条）")
    for day, typ, name, desc, extra in mem:
        print(f"- [{typ or '?'}] {name}：{one_line(desc, 160)}（{day}）")
        for e in extra:
            print(f"    · {e}")

    ses, ses_sens, ses_total, ses_texts = sessions(days, limit)
    print(f"\n## 近 {days} 天和学习有关的会话：{ses_total} 个（跳过疑似隐私 {ses_sens} 个，最多列 {limit} 行）")
    print("\n".join(ses) if ses else "（没有找到）")

    codes = course_codes(mem_texts + ses_texts)
    print("\n## 记忆和会话里出现的课程代码（可能有误，自己核对）")
    print("、".join(f"{c} ×{n}" for c, n in codes.most_common(20)) if codes else "（没有找到像课程代码的词）")

    if "--no-scan" not in sys.argv:
        found, seen, cut = scan_folders([c for c, _ in codes.most_common(20)])
        print(f"\n## 磁盘上像课程资料的文件夹（看了 {seen} 个文件夹{'，没看完' if cut else ''}；PDF 数 / 其中像试卷、习题、答案的）")
        for path, pdfs, exam in found[:40]:
            print(f"- {show(path)}：{pdfs} 个 PDF / {exam} 个像试卷或习题")
        if not found:
            print("（没有找到；请用户告诉你往年试卷、模拟卷、习题和课件放在哪）")

    helpers = lms_helpers()
    print("\n## 学习平台助手（可选，用来看课程进度和下载课件）")
    print("\n".join(helpers) if helpers else "（没有装；没有的话，已学范围写在每门课的 taught_notes 里）")

    print("\n## 工具")
    print("\n".join(tools()))

    print("\n## 宿主已加载的说明")
    for p in (f"{HOME}/.claude/CLAUDE.md", f"{HOME}/.codex/AGENTS.md"):
        if os.path.exists(p):
            print(f"- {show(p)} 存在，内容以你上下文里已加载的为准（同样只取学习相关的，隐私不写进档案）")


if __name__ == "__main__":
    main()
