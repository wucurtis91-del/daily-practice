# 批改

什么时候做：用户说「我写完了」「批改」；或者每天出卷（`mode` = `daily`）时，计划那一步在 `delivery.answered_dir` 里发现了新卷子。只批改不出卷就跑工作流，`mode` 用 `"grade-only"`。

## 卷子从哪来

- 学生在平板上写完，把卷子导出成 PDF（比如手写笔记 App 的「导出 PDF」），放进 `delivery.answered_dir`。文件名里带上日期最好，比如 `2026-01-15 ENGR1001.pdf`。
- 用户在聊天里直接发来照片或 PDF：先存进 `answered_dir`，文件名写上卷子的日期和课程代码，照片按页序合成一个 PDF（`tools/merge.py` 只合 PDF；照片先用 Pillow 存成 PDF），再批改。
- 只看 `answered_dir` 这一层，子文件夹（比如批改完的 `已批改/`）不看。
- 认卷子：按文件名里的日期和课程代码，认不出就渲染第一页看封面。对应的答案是 `<课程文件夹>/practice/.answer-keys/daily/<日期>.md`，卷子是 `<课程文件夹>/practice/daily/<日期>/<CODE>_Daily_<日期>.pdf`。课程不在 config 里的，不批改也不挪动，照实告诉用户。
- 用户说写完了，但 `answered_dir` 里没有新卷子：告诉用户要放到哪个文件夹，不要猜着去别处找。

## 怎么批

1. 把写好的卷子每一页都渲染出来（`render.py`，scale 1.4），一页一页读手写；再读答案里的评分要点。
2. 每个小问：
   - 按评分要点给分，写成「得分/满分」；
   - 用了别的方法但对的，照样给满分；
   - 分开写对的、漏的、错的；
   - 错的、漏的标「重点」：写清错在哪一步（哪个式子、哪个符号、哪个方向），以及回去看讲义的哪一节或课件的哪一页；
   - 严格但公平。看不清的字照实写「看不清」，不猜着给分，也不猜着扣分。
3. 批改用 config 的 `language.feedback` 写：`zh` 就是中文，专业术语第一次出现时在括号里附英文；公式用 LaTeX。

## 写哪些文件

| 文件 | 内容 |
|---|---|
| `<课程文件夹>/practice/daily/<日期>/批改.md` | 批改全文 |
| 同一文件夹的 `批改.tex` / `批改.pdf` | `\documentclass[11pt,a4paper]{article}`，`\input{feedback-preamble.tex}`（从 config 的 `feedback_preamble` 拷过来），标题、总分，每题每小问用 `\score{得分}{满分}`，对的用 `\ok{…}`，每处错误用 `\zhongdian{…}`（红色「重点：」） |
| `delivery.feedback_dir/<日期> <CODE> 批改.pdf` | 上面那份 PDF 的副本，发给用户的就是它（文件名见 `delivery.feedback_name`） |
| `<课程文件夹>/practice/error-log.md` | 每处错误追加一行 ⭐（`tools/log_append.py` 加 `--header`，没有这个文件时会先写一个短标题） |
| `<资料夹>/log/questions.jsonl` | 这份卷子的每道题追加一行完整记录：拿它最新的那一行，改成 `"status": "graded"`，填上 `score`、`mistakes`、`retest_due`（用 `tools/log_append.py`）。已有的行一律不改 |

错题本和题目记录可能有别的 agent 同时在写（另一份卷子的批改、今天的拼卷），所以只追加、不改写：先把新行写进自己的工作文件夹里的一个文件，再用 `"<py>" -I "<skill>/tools/log_append.py" <日志> [--header "<标题>"] <那个文件>` 加锁追加。

写好的卷子批完挪进 `delivery.graded_dir`（没有就建）。

错题本的一行：

```
- ⭐ 2026-01-15 Q1(b) Thevenin equivalent：开路电压的参考方向画反了，V_th 符号错。Retest: 2026-01-17, 2026-01-22
```

原题做错的，后面加「(original: retest as-is on <日期 + 7 天>)」。日期 = 卷子的日期加上 `retest_days` 里的天数（默认 2 天和 7 天）。

## 复练怎么接上

- 计划那一步每天读错题本和题目记录，把到了 Retest 日期的排在最前面：出一道新变题，专门考上次错的那一步。原题做错的，前面几次（默认 2 天那次）也出新变题，最后一次（默认 7 天那次）原样再考这道原题，不占每周的原题名额。
- 复练题在题目记录里带 `retest_of`（「<日期>/<题号>」），封面上那道题的出处后面写「(retest)」。
- 复练又做错，批改时照样记一行新的 ⭐，从新的日期重新算。

## 回复和发送

- 有 SendUserFile 就把批改 PDF 发给用户（status: proactive，display: render），说明写每门的得分和最重要的一两个「重点」；没有就告诉用户文件在哪。
- 每发一个文件，在 `<资料夹>/log/sent.jsonl` 追加一行 `{"date","file","sent_at"}`。
- 回复里只给总分和最要紧的错误，不把整份批改贴出来。说一句哪天会复练。
- 分数和错误只照批改的结果说，没批的题不说成批过了。
