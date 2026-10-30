# word-style-exam.sty — usage

`word-style-exam.sty` lays out self-study practice papers like an exam paper that was
made in Word: Arial 12 with 1.5 line spacing, the course code top right, the question
heading top left, parts with a 1 cm hanging indent, bold marks flush right on their own
line, centred figures with "Figure Q1.1" captions, "X of N" in the footer, and a cover
with a suggested time, the course title, the date, a session line and an instruction
block between two thick rules. It also adds "Question N continues over the page." and
"Question N continued." by itself.

It is a starting point. The dimensions in its header were measured on one reference
paper; measure your own paper (text edges, baselines, rule positions) and change the
constants in the `.sty` until a rendered page lies on top of a rendered real page.

## Compiling

1. Copy the `.sty` into the folder that holds your `.tex` (TeX cannot `\input` a path with
   spaces). `build_paper.py` does this for you.
2. `tectonic -X compile paper.tex` (reruns itself), or `xelatex` / `lualatex` **twice** so
   that the footer knows N. pdfLaTeX is refused (the package needs fontspec).
3. Needs the Arial font and the packages amsmath, amssymb, lmodern, fontspec, mathastext,
   circuitikz (with siunitx), enumitem, geometry.

```latex
\documentclass{article}
\usepackage{word-style-exam}
\ExamCourseCode{ENGR1001}             % header text, top right
% \renewcommand\ExamCoverNote{...}    % the line where an official paper has its copyright line
% \ExamShowAnswerSpaces               % draft: draw the answer spaces in grey
\begin{document}
...
\end{document}
```

Use only the macros below for structure; page breaks are automatic.

## `\ExamCover{<suggested time>}{<course title>}{<date>}{<session>}{<instructions>}`

| argument | printed as |
|---|---|
| 1 suggested time | `Suggested time: #1`, bold, underlined, centred |
| (fixed) | `SELF-STUDY PRACTICE PAPER`, bold, centred, where an official paper names the institution |
| 2 course title | bold, centred, one line (type it in capitals) |
| 3 date | bold, centred |
| 4 session | bold, centred |
| 5 instructions | regular, left, between two thick rules; paragraphs separated by a blank line or `\par` |
| (fixed) | `\ExamCoverNote`, bold, centred; a long note wraps onto further centred lines |

The cover never prints an institution's copyright line.

```latex
\ExamCover
  {1 hour 15 minutes}
  {CIRCUITS}
  {15 JANUARY 2026}
  {DAILY PRACTICE}
  {Answer 2 of 2 questions.

   Write your answers in the blank space below each part.}
```

## Questions, parts, marks

```latex
\begin{Question}{1}{20}
\begin{Parts}
\item For the circuit shown in Figure Q1.1, find the voltage $V_A$.
  \Marks{8}
  \ExamFigure{\begin{circuitikz} ... \end{circuitikz}}{Q1.1}
  \AnswerSpace{8}
\item For the same circuit:
  \begin{SubParts}
  \item find the Thevenin equivalent seen by $R_L$;
  \item find $R_L$ for maximum power.
  \end{SubParts}
  \Marks{6, 6}
  \AnswerSpace{12}
\end{Parts}
\end{Question}
```

* `Question` starts a new page with "**Question 1**" and ends with "**Total [20 marks]**".
* `\Marks{9}`, `\Marks{4, 5}`, `\Mark{1}` print bold, flush right, on their own line,
  after the whole part (after `\end{SubParts}` for grouped marks).
* `\ExamFigure{<picture>}{Q1.1}` goes after the part's `\Marks`; picture and caption are
  centred on the part's text block and never split. Two figures in a row get one blank line.
* `\AnswerSpace{<marks>}` leaves 1.6 cm per mark (at least 4 cm, at most 95% of the text
  height) as one unbreakable box after the part's marks and figure. A part that fits on a
  page is kept together with its space; a taller part keeps its text and figure together and
  moves the whole space to the next page.
* `\EndOfPaper{END OF PRACTICE PAPER}` after the last question.

## Maths and units

Letters, digits and `+ = ( )` in maths are upright Arial (mathastext), as Word's equation
objects print them; Greek and other symbols come from Latin Modern. Units with siunitx
print as in Word: `\qty{25}{\watt}` → "25 W", `\qty{1.2}{\celsius\per\watt}` → "1.2 °C/W".
`\vect`, `\mat` and `\T` are defined.

## Skeleton for build_paper.py

See `example-word-skeleton.tex`: it is this layout with the placeholders that
`build_paper.py` fills (cover text, time, date, instructions, `\input{q1.tex}` …).
