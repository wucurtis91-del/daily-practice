# latex-style-exam.sty — usage

`latex-style-exam.sty` lays out self-study practice papers like an exam paper typeset with
LaTeX (12pt article, Computer Modern Sans, 1.25 line stretch, ragged right): the course
code top right on every page, "Page X of N" and "P.T.O." in the footer, bold "1." question
numbers, "[2 marks]" at the end of the line of each part, "[End of Question 1; 10 marks
total]", and a cover with a suggested time, "Self-Study Practice Paper", the course title,
the date, a session line, **Instructions for candidates** and **Additional permitted
materials**.

It is a starting point. The values in its header were measured on one reference paper;
measure your own (text block, baselines, indents) and change them until a rendered page
lies on top of a rendered real page.

## Compiling

1. Copy the `.sty` next to your `.tex` (`build_paper.py` does this).
2. Start the document exactly like this (any other point size stops with an error):
   ```latex
   \documentclass[12pt,a4paper]{article}
   \usepackage{latex-style-exam}        % [answerframes] outlines the answer spaces
   \ExamCourseCode{MATH1001}            % header text
   ```
3. `tectonic -X compile paper.tex`, or pdflatex / xelatex **twice** ("Page X of N" comes from
   the .aux file). Packages: geometry, amsmath, amssymb, tikz,
   circuitikz (with siunitx), setspace, ragged2e.

## `\ExamCover{<time>}{<title>}{<date>}{<session>}{<instructions>}{<materials>}`

| arg | printed as | notes |
|---|---|---|
| 1 time | `\large` bold, centred | keep it short so it stays clear of the course code |
| 2 title | `\LARGE` bold, centred | does not wrap |
| 3 date | bold, centred | `{}` omits the line |
| 4 session | bold, centred | `{}` omits the line |
| 5 instructions | paragraphs under **Instructions for candidates** | separate by blank lines or `\par` |
| 6 materials | `\item` list under **Additional permitted materials** | `{}` omits the block |

`\ExamCoverNote{<text>}` (preamble) replaces the default foot note "Self-study practice
paper – not an official examination"; a long note wraps upwards, `\\` breaks it. No
institution copyright line is printed.

```latex
\ExamCover{Forty-Five Minutes}{Calculus}{15 January 2026}{Daily practice}%
  {Answer \textbf{BOTH} questions.\par
   Show all your working.}%
  {\item A formula sheet may be used.}
```

## Questions, parts, marks

```latex
\begin{Question}{1}{10}
Let $f(x) = x e^{-x}$.
\begin{Parts}
\item Find $f'(x)$ and the stationary point of $f$. \Marks{3}
  \AnswerSpace{3}
\item
  \begin{SubParts}
  \item Evaluate $\int_0^1 f(x)\,dx$. \Marks{4}
    \AnswerSpace{4}
  \item Hence find the mean value of $f$ on $[0, 1]$. \Marks{3}
    \AnswerSpace{3}
  \end{SubParts}
\end{Parts}
\end{Question}
```

* `Question` starts a new page; `\begin{Question}[continue]{2}{10}` sets it on the same page
  (layout tests only).
* `\Marks{n}` / `\Mark{1}` go at the end of the part's text: flush right on its last line,
  or on a line of their own when that line is full. `\Marks{4, 5}` prints "[4, 5 marks]".
* `\AnswerSpace{<marks>}` after every part or sub-part that carries marks: 1.6 cm per mark,
  at least 4 cm, one unbreakable box followed by `<marks>fill` glue, so the blank left at the
  foot of a page is shared out among that page's answer spaces.
* `\ExamFigure[<caption text>]{<picture>}{Q1.1}`: centred picture, caption
  "Figure Q1.1[: caption text]".
* `\EndOfPaper{End of Practice Paper}`: bold, centred under the text block of the last page
  (that page has no P.T.O.).
* Notation: `\vect{a}` bold vector, `\mat{A}` sans-serif matrix, `\T` sans-serif transpose.

| length / option | default | effect |
|---|---|---|
| option `answerframes` | off | grey outlines of the answer spaces |
| `\ExamContinueSkip` | 18.125pt | gap before a `[continue]` question |
| `\ExamEndLineInset` | 3.91pt | gap between the end line and the right margin |

## Skeleton for build_paper.py

See `example-latex-skeleton.tex`.
