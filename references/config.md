# config.json：每个人自己的设置

`config.json` 放在资料夹（home）里。资料夹按这个顺序找：脚本的 `--home` 参数 → 环境变量 `DAILY_PRACTICE_HOME` → 默认 `~/Documents/每日练习`（可以是指向别处的链接）。那里没有 `config.json` 时，`tools/profile.py` 会在常见位置找已有的资料夹（`config.json` 里 `skill_dir` 指向 daily-practice 的）；资料夹不在默认位置，就在默认位置建一个指向它的链接。skill 本身不写任何个人信息，课程、路径、规则都在这份文件和资料夹里。

写好后跑一遍检查（会用一道假题试编译每门课的骨架、模板和 stub）：

```bash
python3 tools/check_config.py "<资料夹>/config.json"
```

**路径一律写展开后的绝对路径。** 工作流里的 agent 会把路径放进引号里用，`"~/..."` 在引号里不会展开。下面的示例为了不写任何人的用户名用了 `~`，真正的 config.json 里要换成 `/Users/<你>/...` 或 `/home/<你>/...`；`check_config.py` 看到 `~` 开头的路径会提醒。`<iCloud Drive>` 是平板能同步到的文件夹的占位写法：macOS 上的 iCloud Drive 在家目录的 `Library/Mobile Documents/com~apple~CloudDocs`，用别的同步盘就写那个文件夹。

## 完整示例（虚构的两门课）

```json
{
  "version": 1,
  "home": "~/Documents/每日练习",
  "skill_dir": "~/.claude/skills/daily-practice",
  "effort": "xhigh",
  "daily_minutes": 120,
  "schedule": "16:00",
  "student_level": "first-year engineering undergraduate",
  "answer_on": "a tablet with a stylus",
  "originals_per_week": 2,
  "retest_days": [2, 7],
  "language": {"questions": "English", "feedback": "zh"},
  "delivery": {
    "dir": "<iCloud Drive>/Daily Practice",
    "answered_dir": "<iCloud Drive>/Daily Practice/已作答",
    "graded_dir": "<iCloud Drive>/Daily Practice/已作答/已批改",
    "feedback_dir": "<iCloud Drive>/Daily Practice/批改",
    "combined_name": "{date} 每日练习.pdf",
    "feedback_name": "{date} {code} 批改.pdf"
  },
  "python": "/usr/bin/python3",
  "python_packages": "numpy, pdfplumber, pypdfium2, pypdf; no sympy",
  "tectonic": "~/.local/bin/tectonic",
  "rules": "~/Documents/每日练习/rules.md",
  "source_map": "~/Documents/每日练习/source-map.md",
  "feedback_preamble": "~/Documents/每日练习/templates/feedback-preamble.tex",
  "lms": {
    "name": "jiujiastudy",
    "status": "python3 \"~/.claude/skills/jiujiastudy/tools/coach.py\" status",
    "collect": "python3 \"~/.claude/skills/jiujiastudy/tools/coach.py\" collect --touch",
    "api_get": "python3 \"~/.claude/skills/jiujiastudy/tools/coach.py\" api get {path} {out}",
    "download": "python3 \"~/.claude/skills/jiujiastudy/tools/coach.py\" api download {file_id} {dir}",
    "snapshot_glob": "~/<jiujiastudy 资料夹>/.coach/raw/daily/*/modules_{course_id}.json",
    "mood": "~/<jiujiastudy 资料夹>/.coach/state.json"
  },
  "courses": [
    {
      "code": "ENGR1001",
      "title": "Circuits",
      "id_prefix": "E",
      "folder": "~/Documents/Courses/ENGR1001 Circuits",
      "materials": "~/Documents/Courses/ENGR1001 Circuits/materials",
      "text_dir": "~/Documents/每日练习/refs/text/ENGR1001",
      "png_dir": "~/Documents/每日练习/refs/png/ENGR1001",
      "template": "~/Documents/每日练习/templates/engr1001-exam.sty",
      "usage": "~/Documents/每日练习/templates/engr1001-exam-USAGE.md",
      "stub": "~/Documents/每日练习/templates/stub.tex",
      "skeleton": "~/Documents/每日练习/templates/ENGR1001-skeleton.tex",
      "questions_per_day": 2,
      "marks_per_question": 20,
      "minutes_per_mark": 1.8,
      "light_questions": 1,
      "original_marks": [15, 20],
      "solver": "circuit",
      "facts": "- ENGR1001 Circuits. Final exam: 3 hours, answer all 5 questions, 20 marks each, about 1.8 minutes per mark.\n- Conventions: passive sign convention; node voltages from a reference node; ideal op-amps.\n- Exam wording style: \"Determine the current I_X in Figure Q1.1.\" Figures \"Figure Q<question>.<n>\".\n- Figures: circuitikz, american style, clean orthogonal layout like the real figures.",
      "layout_notes": "\\Marks prints bold, flush right on its own line after the whole part. Put the \\AnswerSpace after the part's \\Marks and figure.",
      "page_checks": "\"Question N continues over the page.\" / \"Question N continued.\" markers",
      "cover": {
        "time_style": "digits",
        "session": "DAILY PRACTICE",
        "note": "Self-study practice paper written from past examination questions.",
        "instructions": [
          "Answer {n} of {n} question{s}.",
          "Calculators without text storage or graphing may be used.",
          "Write your answers in the blank space below each part."
        ],
        "end_text": "END OF PRACTICE PAPER"
      },
      "lms_course_id": "12345"
    },
    {
      "code": "MATH1001",
      "title": "Calculus",
      "id_prefix": "M",
      "folder": "~/Documents/Courses/MATH1001 Calculus",
      "template": "~/Documents/每日练习/templates/math1001-exam.sty",
      "usage": "~/Documents/每日练习/templates/math1001-exam-USAGE.md",
      "stub": "~/Documents/每日练习/templates/stub.tex",
      "skeleton": "~/Documents/每日练习/templates/MATH1001-skeleton.tex",
      "questions_per_day": 2,
      "marks_per_question": 10,
      "minutes_per_mark": 2,
      "light_questions": 1,
      "solver": "numeric",
      "facts": "- MATH1001 Calculus. Final exam: 2 hours, all 6 questions, 10 marks each, formula sheet provided, 2 minutes per mark.\n- Exam map: Q1 limits, Q2 differentiation, Q3 integration, ...\n- Notation as in the notes: Leibniz dy/dx, ln for the natural logarithm, bold vectors.",
      "layout_notes": "\\Marks prints \"[2 marks]\" at the end of the line of each part. Put an \\AnswerSpace after each part or sub-part that carries marks.",
      "page_checks": "\"P.T.O.\" on every page except the last",
      "cover": {
        "time_style": "words",
        "session": "Daily practice",
        "instructions": [
          {"1": "Answer the question.", "2": "Answer \\textbf{BOTH} questions.", "*": "Answer \\textbf{ALL} {n} questions."},
          "Show all your working.",
          "Write your answers in the blank space below each part."
        ],
        "end_text": "End of Practice Paper"
      },
      "lms_course_id": "67890"
    }
  ]
}
```

## 字段

| 字段 | 必填 | 说明 |
|---|---|---|
| `version` | 是 | 固定 1 |
| `home` | 是 | 资料夹：config.json、规则、模板、refs、staging、log 都在这里 |
| `skill_dir` | 是 | 这份 skill 的文件夹（工作流要找 `tools/`） |
| `effort` | 否 | 每个 agent 的努力程度，默认 `xhigh`；可选 low / medium / high / xhigh / max |
| `daily_minutes` | 建议 | 一天的题量上限（分钟），也是提示词和封面上说的时间。建档时写 120（约 2 小时）；不写的话，按各门课「题数 × 分值 × 每分钟数」的合计算。实际出几道题由每门课的 `questions_per_day` 等决定，所以两边要对上：差 15% 以上 `check_config.py` 提醒，差 20% 以上报 ✗；工作流遇到差 20% 以上的，按两者里小的那个说时间，题数超了就在计划时删题 |
| `schedule` | 否 | 定时任务几点跑，`HH:MM`，默认 16:00（只给定时任务看） |
| `student_level` | 否 | 写进出题提示词的身份，默认 `university student`，比如 `first-year engineering undergraduate`；不要写名字和学校 |
| `answer_on` | 否 | 在什么上作答，默认 `a tablet` |
| `originals_per_week` | 否 | 每周原样放几道原题，默认 2（一天最多 1 道） |
| `retest_days` | 否 | 做错后第几天复练，默认 `[2, 7]` |
| `language.questions` | 否 | 题目语言，默认 English |
| `language.feedback` | 否 | 批改和答案解析的语言：`zh` = 中文、术语第一次出现附英文；`en` 或别的语言名 |
| `delivery.dir` | 否 | 合成 PDF 放哪（平板同步的文件夹，比如 iCloud Drive 里的一个文件夹），默认 `<home>/out` |
| `delivery.answered_dir` | 否 | 学生把写好的卷子导出到哪，默认 `<dir>/已作答` |
| `delivery.graded_dir` | 否 | 批改完挪到哪，默认 `<answered_dir>/已批改` |
| `delivery.feedback_dir` | 否 | 批改 PDF 放哪，默认 `<dir>/批改` |
| `delivery.combined_name` | 否 | 合成 PDF 的文件名，要含 `{date}`，默认 `{date} 每日练习.pdf` |
| `delivery.feedback_name` | 否 | 批改 PDF 文件名，`{date}`、`{code}`，默认 `{date} {code} 批改.pdf` |
| `python` | 否 | 跑工具的 Python（3.9+，有 pdfplumber、pypdfium2、pypdf，最好有 numpy），默认 `python3` |
| `python_packages` | 否 | 给 agent 看的一句话：这个 Python 里有哪些库 |
| `tectonic` | 否 | TeX：tectonic 或 xelatex / lualatex 的路径，默认 `tectonic` |
| `rules` | 否 | 用户自己的规则文件，默认 `<home>/rules.md` |
| `source_map` | 否 | 原题地图：每种考题对应哪些往年卷、模拟卷、习题、课件例题，默认 `<home>/source-map.md` |
| `feedback_preamble` | 否 | 批改 PDF 的导言，默认 `<home>/templates/feedback-preamble.tex` |
| `lms` | 否 | 学习平台助手（比如 jiujiastudy）。没有就整个不写，已学范围改看 `taught_notes` |
| `lms.name` | 有 lms 时必填 | 助手的名字；没有 `name`，工作流当作没配 lms |
| `lms.status` / `collect` | | 看现状、刷新数据的命令 |
| `lms.api_get` / `download` | | 命令模板：`{path}` `{out}` / `{file_id}` `{dir}` 由 agent 替换 |
| `lms.snapshot_glob` | | 每门课周模块快照的路径通配，`{course_id}` 换成 `lms_course_id` |
| `lms.mood` | | 学生记录的状态（累 / 来不及）在哪，用来判断轻松日 |
| `courses` | 是 | 一门课一项，顺序就是合成 PDF 里的顺序 |

每门课：

| 字段 | 必填 | 说明 |
|---|---|---|
| `code`, `title` | 是 | 课程代码和名称；题号前缀、文件名都用 code |
| `id_prefix` | 否 | 题目编号前缀（E1、E2），默认 code 的第一个字母；各门课不能重复 |
| `folder` | 是 | 课程文件夹。卷子写到 `<folder>/practice/daily/<date>/<CODE>_Daily_<date>.pdf`，答案 `<folder>/practice/.answer-keys/daily/<date>.md`，错题本 `<folder>/practice/error-log.md` |
| `materials` | 否 | 原始课件、往年卷所在文件夹，默认 `<folder>/materials` |
| `text_dir`, `png_dir` | 否 | 课件文字（`extract.py`）和真卷页面图（`render.py`，scale 1.4），默认 `<home>/refs/text/<code>`、`<home>/refs/png/<code>` |
| `template` | 是 | 这门课的考卷样式 `.sty`（从 `templates/examples/` 改出来的） |
| `template_files` | 否 | 编译时还要一起拷过去的文件 |
| `usage` | 否 | 样式的使用说明 |
| `stub` | 否 | 单独编译一道题用的简化版，默认 `<home>/templates/stub.tex` |
| `skeleton` | 是 | 整份卷子的骨架，`build_paper.py` 往里填占位符（见下） |
| `questions_per_day` | 否 | 平常每天几道，默认 2；写 0 = 这门课暂停出题（交回来的卷子照样批改） |
| `marks_per_question` | 否 | 每道几分，默认 10 |
| `minutes_per_mark` | 否 | 每分几分钟（真卷总时长 ÷ 总分），默认 2 |
| `light_questions` | 否 | 轻松日几道，默认 1，不超过 `questions_per_day`；可以写 0 |
| `original_marks` | 否 | 原样放原题时允许的分值范围，默认 `[0.75 × 分值, 分值]` |
| `solver` | 否 | `circuit`：电路题用 `mna.py` 精确求解核对；`numeric`：用 Python / numpy 核对。默认 numeric |
| `facts` | 建议 | 考试格式、记号和约定、真卷的问法举例、画图风格。每个出题、审题 agent 都会看到 |
| `layout_notes` | 否 | 这门课的 `\Marks`、`\AnswerSpace` 放哪、用什么记号宏 |
| `page_checks` | 否 | 排版检查时要特别看的东西，比如续页标记、P.T.O. |
| `cover.time_style` | 否 | `digits`（`1 hour 15 minutes`）或 `words`（`Forty-Five Minutes`） |
| `cover.session` | 否 | 封面上的场次那一行，比如 `DAILY PRACTICE`，默认 `Daily practice` |
| `cover.note` | 否 | 封面底部那句说明，默认 `Self-study practice paper written from past examination questions.`（不要写成官方试卷，也不要印学校版权行） |
| `cover.instructions` | 否 | 封面说明，一项一段。字符串里 `{n}` = 题数，`{s}` = 题数大于 1 时的 s；也可以写成 `{"1": "...", "2": "...", "*": "..."}` 按题数选 |
| `cover.end_text` | 否 | 最后一页的结束语，默认 `End of Practice Paper` |
| `lms_course_id` | 否 | 这门课在学习平台上的 id |
| `taught_notes` | 否 | 没有学习平台助手时，手写「上到哪了」：每周讲了什么、哪天讲 |

## 骨架（skeleton）

骨架是一整份 `.tex`，`build_paper.py` 用 Python 的 `%` 格式化填进去，所以文件里普通的 `%` 要写成 `%%`。占位符：

| 占位符 | 填什么 |
|---|---|
| `%(note)s` | `cover.note` |
| `%(time)s` | 建议用时（按 `time_style` 算好） |
| `%(date_upper)s` / `%(date_title)s` | `31 OCTOBER 2026` / `31 October 2026` |
| `%(session)s` | `cover.session` |
| `%(instructions)s` | 封面说明加上每道题的出处（「Question 1 is adapted from …」） |
| `%(inputs)s` | `\input{q1.tex}` … |
| `%(end_text)s` | `cover.end_text` |
| `%(code)s` / `%(title)s` / `%(title_upper)s` | 课程代码、名称、大写名称（可选） |

示例见 `templates/examples/example-word-skeleton.tex` 和 `example-latex-skeleton.tex`。课程名里有 `&` 这类字符时要写成 LaTeX（`\&`）。

## 资料夹里放什么

```
<home>/
├── config.json         这份设置
├── rules.md            你自己的规则（照 references/rules.md 最后的模板写，末尾有「出题偏好」「临时安排」）
├── source-map.md       原题地图：考题类型 → 往年卷 / 模拟卷 / 习题 / 课件例题，标明哪些已经教过
├── templates/          考卷样式 .sty、使用说明、骨架、stub.tex、feedback-preamble.tex
├── refs/text/<课>/      课件和往年卷的文字（extract.py，带页码）
├── refs/png/<课>/       真卷页面图（render.py，scale 1.4），排版对照用
├── staging/<date>/     每道题的工作文件夹（题目、解答、核对、盲解）
└── log/                questions.jsonl（只追加，同一题以最后一行为准）、usage.jsonl、sent.jsonl
```

## 工作流的参数和返回值

用 Workflow 工具运行 `workflow/daily-practice.js`，`args`：

| 参数 | 必填 | 说明 |
|---|---|---|
| `date` | 是 | `YYYY-MM-DD`，本机日期 |
| `config` | 是 | config.json 解析后的完整内容（对象，不是路径） |
| `mode` | 否 | `daily`（默认：批改 + 出卷）、`grade-only`（只批改）、`paper-only`（只出卷） |
| `requests` | 否 | 学生今天的要求，原话；计划那一步在规则允许的范围里照办 |
| `skill_dir` | 否 | 覆盖 config 的 `skill_dir` |

脚本里不用当前时间也不用随机数，同样的 `args` 得到同样的提示词。每次 agent 调用的 effort 都是 `config.effort`（默认 `xhigh`）。

返回值：

| 字段 | 内容 |
|---|---|
| `date`, `mode` | 原样返回 |
| `plan` | `skip`（这天的卷子早就有了）、`reason`、`light_day`、`light_reason`、`notes` |
| `questions[]` | 每道题：`id`、`course`、`kind`（variant / original）、`retest_of`、`topic`、`minutes`、`rounds`（审核了几轮）、`unresolved`（3 轮还没通过，已经拿掉）、`sources` |
| `papers[]` | 每门课的卷子：`course`、`pdf`、`key`（答案）、`pages`、`issues`（还留着的问题：最终检查改过的，用改完后的结果；最终检查找到但没改成的，也列在这里） |
| `qa` | 最终检查：`verdict`、`must_fix`、`notes`；`qaFixes[]` 是按课程改过的结果 |
| `grading[]` | 每份批改：`course`、`date`、`total`、`parts`、`key_mistakes`、`feedback_pdf` |
| `deliver.combined` | 合成 PDF 的路径；今天没有卷子时是 `null` |
| `deliver.inputs` | 要合成的各门课 PDF，按 config 的课程顺序 |
| `deliver.merge_command` | 合成用的完整命令，照原样运行；没有卷子时是 `null` |
| `deliver.combined_path` | 合成 PDF 应该在的路径（`plan.skip` 时补发用） |
| `deliver.expected_papers` | 这天每门课卷子应该在的路径 |
| `deliver.feedback` | 这次生成的批改 PDF |
| `deliver.sent_log`, `deliver.usage_log` | `<home>/log/sent.jsonl`、`<home>/log/usage.jsonl` |

不开 agent 检查提示词：`node tools/dry_run.mjs --config <config.json> [--date YYYY-MM-DD] [--mode daily|grade-only|paper-only] [--requests "<原话>"] [--prompts <文件夹>] [--json]`。它给每次调用一个按 schema 造的假结果，把整个脚本跑一遍，检查 effort、schema、提示词里有没有 `undefined`、每门课的要点和路径在不在；`--prompts` 把每一步的提示词写成文件。
