# 每日练习卷 · daily-practice

每天给你出一份约 2 小时的练习卷，题目照你自己课程的往年卷、模拟卷、习题和课件例题来出：**默认出变题**（考点和题型不变，换数据、换结构、换问法，难度同款或更难），每周原样放两道左右原题。卷子用 LaTeX 排成你那门课真卷的样子，每小问下面留空白，可以直接在平板上写。写完交回来，它逐小问批改，错的地方标红「重点」，记进错题本，过两天和一周后再出题复练。

A Claude Code / Codex skill that writes a daily, exam-style practice paper (about 2 hours by default) for your own courses. Each question is a variant built on one of your course's originals (past papers, mock papers, examples sheets, lecture examples): same topic and task type, with the numbers, structure or way of asking changed, at the same or higher difficulty. About two originals a week are reproduced as-is and labelled. Papers are typeset in LaTeX to look like your real exam paper, with blank space for answering on a tablet. Every question is checked numerically, solved blind from its rendered page by a second agent and reviewed before you see it. Answered papers are graded part by part; mistakes are flagged (重点), logged and re-tested about 2 days and 1 week later. Nothing about any user is hard-coded: courses, materials and rules come from your own AI memory, host instructions and an optional LMS helper (for example [jiujiastudy](https://github.com/jiujiastudy/jiujiastudy)), and everything personal stays in a per-user data folder.

## 它做什么

- **课程和例题从你那里来。** 第一次用时，它读你的 Claude / Codex 记忆、近期会话和电脑上像课程资料的文件夹，认出要考试的课、考试格式、往年卷和习题在哪、学到哪了。找不到的，它会一件一件问你放在哪。所有设置写进资料夹里的一份 `config.json`，随时可以改。
- **排版照真卷。** 它量一份你那门课的真卷（边距、字体、行距、页眉页脚、分值的写法），从附带的两个起步样式（Word 风格、LaTeX 风格）改出这门课的考卷样式，跟真卷并排比对到对得上。封面写的是自学练习卷，不冒充官方。
- **每天一份卷子。** 先排计划：只用已经教过的内容，复练优先，一周里轮换题型。再一道一道出题：每道都有数值核对（电路题用精确的节点电压求解器），另一个 agent 只看渲染出来的页面盲解一遍，审核不过就改，最多三轮。最后按真卷的样式拼好卷子，再独立检查一遍才交给你。
- **轻松日。** 计分作业截止、实验、测验的前一天和当天，或者你说累了，题量减半。「明天少一点」「停一次」也行。
- **批改和复练。** 写好的卷子放进「已作答」文件夹，它逐小问给分，对的、漏的、错的分开写，错的标红「重点」，告诉你回去看哪一节；过两天和一周后出新变题考同一个地方（原题做错的，一周那次原样再考这道原题）。

## 安装

Claude Code：

```bash
git clone https://github.com/wucurtis91-del/daily-practice ~/.claude/skills/daily-practice
```

Codex：

```bash
git clone https://github.com/wucurtis91-del/daily-practice ~/.codex/skills/daily-practice
```

也可以直接跟 Claude Code 或 Codex 说「帮我从 GitHub 安装 wucurtis91-del/daily-practice」。

需要：

- Python 3.9+，以及 `pip install pdfplumber pypdfium2 pypdf numpy`（pdfplumber 会顺带装上 Pillow，渲染页面要用）。`profile.py` 和 `check_config.py` 只用标准库。
- 一个 XeTeX 类的 TeX 引擎：推荐 [Tectonic](https://tectonic-typesetting.github.io/)，XeLaTeX / LuaLaTeX 也行。Word 风格的样式要本机装着真卷用的字体（比如 Arial）。
- Claude Code 的 Workflow 工具：每天的流程是一个多 agent 工作流。没有的话（比如 Codex），按 SKILL.md 里的顺序一步一步开子 agent，会慢很多。
- 可选：一个学习平台助手（比如 jiujiastudy），用来看课程进度、截止日期和下载课件。没有的话，在规则里写上每周教到哪。
- 可选：平板。卷子发到一个平板能打开的同步文件夹（比如 iCloud Drive），在手写 App 里写完导出 PDF 放回来；不用平板，打印出来写、拍照发回来也可以。
- `tools/dry_run.mjs` 要 Node 18+（只在检查工作流时用）。

## 用法

装好后直接说：

- 「设置练习卷」（第一次）
- 「出一份练习卷」「今天的题」
- 「我写完了」「批改一下」
- 「有哪些要复练」
- 「明天少一点」「周五停一次」「加点积分的题」
- 「以后每天少一点」「effort 改成 high」「换成晚上 7 点发」

**每天自动跑**：你要的话，建档的最后一步会在 Claude 桌面 App 里建一个定时任务，默认每天 16:00，提示词模板在 `references/scheduled-task.md`。到点时 App 没开或者电脑在睡眠，会等下次打开 App 时补跑。

## 一天怎么过

1. 16:00，定时任务读你的设置和规则，看今天是不是轻松日、有没有你提前交代的安排。
2. 计划：今天每门课出几道、考什么、以哪道原题为基础，到期的复练排在最前面；「已作答」里有新卷子就同时批改。
3. 出题：每道题出好、核对、单独编译看一遍；另一个 agent 盲解；审核，不过就改，最多三轮。
4. 拼卷：每门课一份，排成真卷的样子；答案单独放好，不在卷子里。
5. 最终检查：独立看一遍整份卷子，有问题就改。
6. 合成一个 PDF 发给你：一行说明写日期、每门课的主题、建议用时、哪道是原题或复练题。有批改的，批改 PDF 一起发。

## 文件放在哪

资料夹默认是 `~/Documents/每日练习`，可以用环境变量 `DAILY_PRACTICE_HOME` 改到别处；放在别处时，建档会在默认位置建一个指向它的链接，以后不用再找：

```
每日练习/
├── config.json      你的课程、路径、题量和送达位置（字段见 references/config.md）
├── rules.md         你自己的规则：学期日历、计分作业、出题偏好、临时安排
├── source-map.md    原题地图：考题类型 → 往年卷 / 模拟卷 / 习题 / 课件例题
├── templates/       你的考卷样式、骨架、stub、批改用的导言
├── refs/            课件文字和真卷页面图
├── staging/         每道题的工作文件夹
└── log/             题目记录、发送记录、用量记录
```

卷子放在每门课自己的文件夹里（`practice/daily/<日期>/`），答案单独放在 `practice/.answer-keys/`，错题本是 `practice/error-log.md`；合成的 PDF 和批改放到你设的送达文件夹。

skill 自己的文件：

```
daily-practice/
├── SKILL.md                    流程和规则（给 AI 看）
├── workflow/daily-practice.js  每天的多 agent 工作流
├── references/
│   ├── rules.md                默认规则和 rules.md 模板
│   ├── setup.md                第一次建档的步骤
│   ├── template-builder.md     照真卷做考卷样式
│   ├── grading.md              批改和复练
│   ├── scheduled-task.md       定时任务的提示词模板
│   └── config.md               config.json 的字段、完整示例、工作流的参数和返回值
├── templates/
│   ├── stub.tex                单独编译一道题用的简化模板
│   ├── feedback-preamble.tex   批改 PDF 的导言（「重点」红字）
│   └── examples/               两个起步考卷样式、骨架和用法
└── tools/
    ├── profile.py              读记忆，打印学习线索
    ├── check_config.py         检查设置，试编译
    ├── build_paper.py          拼卷子、编译、渲染
    ├── render.py / extract.py / merge.py   PDF 工具
    ├── log_append.py           加锁追加日志，几个 agent 同时写不丢行
    ├── mna.py                  直流电路精确求解
    └── dry_run.mjs             不开 agent 把工作流跑一遍，检查提示词
```

## 隐私

- 读记忆时，看起来涉及健康、财务、证件、住址、联系方式、感情、家人朋友的条目整条跳过；剩下的文字里，邮箱、电话、账号和人名称呼会被隐去。
- config、规则、卷子、日志和回复里不写任何人的名字，封面也不写学生名字。
- 记忆、会话和课件只在你自己电脑上读，课件和真卷的文字、页面图只放在你的资料夹里。工作流不发邮件、不发消息，也不往学习平台交任何东西。
- skill 本身不含任何人的课程、路径或资料。

## 诚实

- 卷子是自学练习卷：封面不冒充官方试卷，不印学校的版权行，每道题写明改编自哪里，原题照实标出来。
- 题目、分数和批改结果都来自实际跑出来的结果，不编造。审核三轮还没通过的题会拿掉，并告诉你少了哪道；哪一步失败了也照实说。
- 只考已经教过的内容，拿不准就按保守的范围出。

## 花费

这个 skill 很费额度。每天一次运行要开很多个 agent，而且默认都是超高（xhigh）努力程度：两门课各两道题的一天，常见 16–25 次 agent 调用，返工多时到四十次以上，跑得也比较久。想省一点，可以把 `effort` 改成 high、少出几道，或者多用轻松日。每次的用量记在 `log/usage.jsonl`。

## 许可证

[MIT](LICENSE)
