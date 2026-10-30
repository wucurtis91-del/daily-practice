# 照真卷做考卷模板

目标：练习卷看起来跟这门课的真卷一模一样（纸张、字体、边距、行距、页眉页脚、题号和分值的写法、图和图注、封面），但封面写的是自学练习卷，不冒充官方。做出来的样式文件放在资料夹的 `templates/` 里，**不放进 skill**：它是照某一门真课量出来的。

下面的 `<py>` 是 config 里的 Python，`<skill>` 是本 skill 的文件夹，`<home>` 是资料夹，`<code>` 是课程代码（文件名用小写）。

## 0. 准备

- 选一份这门课最新的官方往年卷 PDF。要文字版（能选中文字的），不要扫描件；只有扫描件就照图估尺寸，精度低一些，告诉用户。
- 渲染成页面图：`"<py>" -I "<skill>/tools/render.py" <真卷.pdf> "<home>/refs/png/<CODE>" all 1.4 <前缀>`。后面比对一律用同一个 scale（1.4）。
- 读一遍 `<skill>/templates/stub.tex`：它是同一套宏接口最朴素的实现。工作流里所有 agent 只用这套宏写题目。

## 1. 认出真卷是怎么排的

```bash
"<py>" -I -c "import pdfplumber,sys; p=pdfplumber.open(sys.argv[1]); print(p.metadata); print(sorted({c['fontname'].split('+')[-1] for c in p.pages[1].chars}))" <真卷.pdf>
```

- Producer / Creator 里有 Microsoft Word，字体是 Arial、Times New Roman、Calibri 这类：从 `templates/examples/word-style-exam.sty` 起步。
- Producer 是 pdfTeX、XeTeX、LuaTeX，或者 xdvipdfmx（XeLaTeX、Tectonic 出的 PDF），字体是 CMR、CMSS、LM（Latin Modern）这类：从 `templates/examples/latex-style-exam.sty` 起步。
- 都不像就挑接近的一个改。

把起步的样式拷成 `<home>/templates/<code>-exam.sty`，改掉 `\ProvidesPackage` 里的名字；对应的 `example-*-skeleton.tex` 拷成 `<home>/templates/<CODE>-skeleton.tex`，`\usepackage{…}` 改成新名字；examples 里对应的 `*-USAGE.md` 拷成 `<home>/templates/<code>-exam-USAGE.md`。

## 2. 量真卷

pdfplumber 给的坐标单位是 PDF 点（bp，1/72 英寸），从页面左上角算起。TeX 里要写成 `bp`，不要写 `pt`（1 pt = 1/72.27 英寸，差 0.4%，一页下来差好几个 bp）。

下面这段把每一行的基线（距页顶）、左右边、字体、字号和文字列出来，再列出横线和方框。存成资料夹里的一个临时脚本（比如 `<home>/staging/measure.py`）来跑：

```python
import sys
import pdfplumber

pdf = pdfplumber.open(sys.argv[1])
pages = [int(p) for p in sys.argv[2].split(",")] if len(sys.argv) > 2 else [1, 2]
print("Producer:", pdf.metadata.get("Producer"), "| Creator:", pdf.metadata.get("Creator"))
for n in pages:
    page = pdf.pages[n - 1]
    H = page.height
    print(f"--- page {n}: {page.width:.2f} x {H:.2f} bp")
    rows = {}
    for c in page.chars:
        rows.setdefault(round(H - c["matrix"][5], 2), []).append(c)  # 基线，距页顶 bp
    for base in sorted(rows):
        cs = sorted(rows[base], key=lambda c: c["x0"])
        fonts = sorted({f'{c["fontname"].split("+")[-1]} {c["size"]:.2f}' for c in cs})
        text = ""
        for a, b in zip([None] + cs[:-1], cs):
            if a is not None and b["x0"] - a["x1"] > 0.2 * b["size"]:
                text += " "
            text += b["text"]
        print(f'{base:8.2f}  x {cs[0]["x0"]:7.2f}-{cs[-1]["x1"]:7.2f}  {"; ".join(fonts)}  {text[:70]}')
    for r in page.lines + page.rects:
        print(f'rule    top {r["top"]:.2f}  x {r["x0"]:.2f}-{r["x1"]:.2f}  h {r["height"]:.2f}')
```

`"<py>" -I "<home>/staging/measure.py" <真卷.pdf> 1,2,3` 量封面和前两页。要量的东西：

| 项目 | 看什么 |
|---|---|
| 纸张 | A4（595.28 × 841.89 bp）还是 Letter |
| 正文区 | 左边（最小的 x0）、右边（最长的行的 x1）、第一行基线、最后一行能到多低 |
| 页眉 | 印什么（课程代码、页码），哪几页有，字体，基线 |
| 页脚 | 格式（「3 of 7」「Page 3 of 7」「P.T.O.」），对齐，基线；最后一页有什么不同 |
| 正文 | 字体、字号，行距（相邻两行基线之差），段落之间多出来的距离 |
| 题号 | 写法（「Question 1」「1.」），粗细，位置，跟正文第一行的距离 |
| 小问 | (a)、(i) 标签的位置，正文缩进多少，小问之间的距离 |
| 分值 | 写法（「[9 marks]」「(9)」「[4, 5 marks]」），粗细，位置：行尾、单独一行，还是整个小问后面汇总 |
| 题目结尾 | 有没有总分行（比如「Total [20 marks]」），写法和位置 |
| 图 | 图跟上一行、图注跟图的距离，图注写法（「Figure Q1.1」），居中在哪 |
| 续页标记 | 一道题跨页时页底、页顶印什么（比如「Question 1 continues over the page.」「Question 1 continued.」），每页底的「P.T.O.」 |
| 封面 | 每一行的内容、字体、字号、粗细、对齐和基线；横线的位置和粗细 |
| 数学 | Word 卷子的公式常是 Cambria Math，或者 MathType（字母用正文字体、直立）；LaTeX 卷子是 CM 数学字体。下标的大小和下沉量 |

把量到的数写成一张表，放进 `.sty` 开头的注释里（examples 里两个样式都是这么写的），以后改起来知道每个数从哪来。

## 3. 改样式

- 按量到的数改常量：`geometry` 的边距和正文区、`\normalsize` 的字号和行距、`\parskip`、小问缩进、页眉页脚的基线、图和图注的间距、封面每一行的位置。
- **宏接口必须一个不少**，名字和参数都跟 `stub.tex` 一样，因为每个出题 agent 只会用这些：

  | 宏 | 作用 |
  |---|---|
  | `\begin{Question}{<题号>}{<总分>} … \end{Question}` | 另起一页，题号，题目结尾那一行 |
  | `\begin{Parts} \item … \end{Parts}` | 小问 (a)、(b) |
  | `\begin{SubParts} \item … \end{SubParts}` | 小小问 (i)、(ii) |
  | `\Marks{9}`、`\Marks{4, 5}`、`\Mark{1}` | 分值，按这门课的样子印 |
  | `\ExamFigure{<tikz 或 circuitikz 图>}{Q1.1}` | 居中的图，图注「Figure Q1.1」 |
  | `\AnswerSpace{<分值>}` | 不跨页的空白作答区 |
  | `\EndOfPaper{<文字>}` | 最后一题后面的结束语 |
  | `\ExamCover{…}` | 封面，参数个数照真卷定（word 风格 5 个、latex 风格 6 个），改了就同步改骨架 |
  | `\ExamCourseCode{<代码>}`、`\ExamCoverNote` | 页眉的课程代码；封面底部那句说明 |
  | `\vect{a}`、`\mat{A}`、`\T` | 粗体向量、无衬线矩阵、转置 |

  可以多加（`\begin{Question}[continue]` 排在同一页、图注文字、草稿时把空白画成灰框的开关），不能少，也不能改参数。
- **封面用练习卷的说法**：
  - 真卷印学校名的那一行，印「SELF-STUDY PRACTICE PAPER」（或者按真卷的大小写写「Self-Study Practice Paper」）；
  - 真卷印版权行的位置，印 `\ExamCoverNote`：说明这是自学练习卷、不是官方考试；
  - 不放校徽、学校名和版权行，不抄只对正式考试成立的考场须知（交回试卷、用什么颜色的笔之类）；
  - 考试时长那一行换成建议用时，写法照真卷（「1 hour 15 minutes」或「Forty-Five Minutes」，对应 config 的 `cover.time_style`）；
  - 封面说明写在 config 的 `cover.instructions` 里，用自己的话写，不照抄真卷的原文。
- **续页标记**：真卷有就做成自动的。用 TeX 的 `\mark` 记下「现在开着哪道题」，页眉页脚用 `\topmark`、`\firstmark`、`\botmark` 判断这一页印不印「continued」「continues over the page」（`word-style-exam.sty` 里有现成的写法）。「X of N」「Page X of N」要编译两遍才知道 N（tectonic 自己会重跑；xelatex、lualatex 跑两遍）。最后一页不印「P.T.O.」。
- **答题空白**：`\AnswerSpace{<分值>}` 每分留 1.6 cm，至少 4 cm，最多 0.95 倍正文高度，是一整块，不跨页；`\Marks{4, 5}` 这种写法要能加起来。不画框。小问的题干和图跟它的空白不拆开；一页放不下，就把整块空白挪到下一页。
- **字体**：Word 风格要用真卷的字体（Arial 之类），本机得装着，引擎用 XeLaTeX 或 LuaLaTeX（fontspec）；`latex-style-exam.sty` 用 Latin Modern，pdfLaTeX 也能编译。

## 4. 演示页和并排比对

1. 写 `<home>/templates/<CODE>-demo.tex`（只放在资料夹里）：
   - 封面；
   - 原样照排真卷的第 1 题，只用来跟真卷逐行比对，不发给学生，也不放进 skill；
   - 一道假题，把每个宏都用一遍：Parts、SubParts、`\Marks{9}`、`\Marks{4, 5}`、`\Mark{1}`、两张图、一个长到跨页的小问、`\EndOfPaper`。
2. 编译，渲染到 `<home>/templates/demo-png-<CODE>/`（scale 1.4）。
3. 每一轮比对：
   - **并排看**：真卷第 n 页和演示第 n 页，用 Read 工具一张一张看。
   - **叠图**：两张图叠在一起，偏了多少一眼能看出来：
     ```bash
     "<py>" -I -c "import sys; from PIL import Image; a=Image.open(sys.argv[1]).convert('L'); b=Image.open(sys.argv[2]).convert('L').resize(a.size); Image.merge('RGB',(a,b,b)).save(sys.argv[3])" <真卷页.png> <演示页.png> <叠图.png>
     ```
     重合的地方是黑色；只有真卷有的是青色，只有演示有的是红色。
   - **量数**：用第 2 步的脚本量演示的 PDF，跟真卷逐行比基线和左右边，把差值列成表。
   - 改常量，重新编译，再比。
4. 什么时候算对上：封面和第 1 题每一行的基线、左边和右边都差不到 0.5 bp；字体、粗细、分值和图注的样子跟真卷一样；续页标记、页码出现在该出现的页上。
5. 再用假题试几种情况：长题跨好几页、只有一小问、大图、没有图、最后一页。

## 5. 收尾

- `<code>-exam-USAGE.md`：照 examples 里的 USAGE 改，写编译方法、封面参数、每个宏印出来的样子、这门课特别的写法。
- 骨架 `<CODE>-skeleton.tex`：占位符见 `references/config.md` 的「骨架」一节。`build_paper.py` 用 Python 的 `%` 格式化填它，文件里普通的 `%` 要写成 `%%`。
- 把 `<skill>/templates/stub.tex` 拷到 `<home>/templates/`。题目片段先用 stub 单独编译检查，拼卷时才用真模板，所以两边的宏要一模一样。
- config 里这门课写上 `template`、`usage`、`stub`、`skeleton`、`layout_notes`（`\Marks` 和 `\AnswerSpace` 放在哪、要用的记号宏）、`page_checks`（拼卷时要特别看的，比如续页标记、P.T.O.）和 `cover`。
- 跑 `check_config.py`：它会用一道假题把骨架 + 模板和 stub 各编译一遍。
- 样卷出来以后，再拿它的页面跟真卷并排看一次。
