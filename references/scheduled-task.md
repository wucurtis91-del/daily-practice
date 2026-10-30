# 定时任务

每天在 config 的 `schedule`（默认 16:00）自动出卷、批改、发给用户。

## 在 Claude 桌面 App 里建

用 scheduled-tasks 的 `create_scheduled_task`：

| 参数 | 写什么 |
|---|---|
| `taskId` | `daily-practice-paper` |
| `title` | 每日练习卷 |
| `description` | 一句话：每天几点、出哪几门课的练习卷、约多少时间，批改并发送 |
| `cronExpression` | 本机时间，`schedule` 是 `16:00` 就写 `0 16 * * *` |
| `prompt` | 下面的模板，`<资料夹>` 和 `<skill 文件夹>` 换成展开后的绝对路径 |

- 建之前用一句话跟用户说清：每天几点、做什么、发到哪。用户已经说过时间和题量就不再问。
- 每次运行都是一个全新的会话，什么都不记得，所以提示词要写全，不能写「照上次那样」。
- App 开着才会跑；到点时 App 没开或者电脑在睡眠，等下次打开 App 时补跑。循环任务实际开始的时间会比设定的晚几分钟。把这两点告诉用户。
- 建好后可以用 `run_scheduled_task` 马上试跑一次，或者等第一次到点。

**已经有一个旧的练习卷任务**（比如用户自己以前写的、跑着别的工作流的）：先用 `list_scheduled_tasks` 找到它，读它的 SKILL.md，跟用户确认一次，再用 `update_scheduled_task` 换掉 `prompt`（和 `description`），不要另外再建一个，否则一天会出两份。旧提示词里用户特别交代的限制（只读写哪些文件夹、不碰哪些东西），合并进新提示词。

**改时间**：改 config 的 `schedule`，再用 `update_scheduled_task` 改 `cronExpression`。**暂停几天**：在规则文件的「临时安排」里写「停」，任务照跑，只批改不出卷；要彻底停，用 `update_scheduled_task` 设 `enabled: false`。

其他宿主没有定时任务的话，就请用户每天说一句「出一份练习卷」。

## 提示词模板

```
每天 <HH:MM> 出今天的每日练习卷（约 <N> 分钟的题），批改用户已经写好的卷子，再发给用户。

用每日练习卷 skill（daily-practice）：先完整读 <skill 文件夹>/SKILL.md，按「每天出卷」做。资料夹是 <资料夹>，设置在 <资料夹>/config.json，规则在 config 的 rules 文件里。跟用户说话用中文，专业术语第一次出现时在括号里附英文。日期按本机时间，格式 YYYY-MM-DD，下面记作 DATE。这是定时任务，不要停下来等人回答。

步骤：
1. 读 <资料夹>/config.json（没有就照实报告，不要另建资料夹）。再看规则文件末尾的「临时安排」：DATE 那天写着停，mode 用 "grade-only"；写着别的安排，原话放进 requests。都没有，mode 用 "daily"。
2. 额度：宿主有查用量的工具（比如 get_usage）就查一次，记下 5 小时额度和每周额度的百分比。
3. 用 Workflow 工具运行固定工作流：scriptPath = "<skill 文件夹>/workflow/daily-practice.js"，args = {"date": "DATE", "config": <config.json 的完整内容>, "mode": "<第 1 步定的>", "requests": "<第 1 步的原话，没有就不写>"}。脚本按 config 的 effort（默认超高 xhigh）给每个 agent 定好了努力程度，不要改。工作流在后台运行，完成时会通知你：等通知，不要轮询，也不要自己另外出题。
   - 这个会话里没有 Workflow 工具：按 SKILL.md「没有 Workflow 工具」那一段，按脚本里同样的顺序和同样的提示词依次开子 agent，每个都用 config 的 effort。
4. 工作流返回后：
   a. deliver.merge_command 不为空：照原样运行，得到合成的 PDF（deliver.combined）。
   b. 用 SendUserFile 把 deliver.combined 发给用户（status: proactive，display: render）。caption 写一行：日期、每门课的题目主题、建议用时、哪道是原题或复练题。questions 里 unresolved 为真的题没通过审核、被拿掉了，照实写少了哪道。
   c. grading 不为空：把 deliver.feedback 里的批改 PDF 也用 SendUserFile 发过去，caption 写每门的得分和最重要的一两个「重点」。
   d. plan.skip 为真（今天的卷子早就出过）：查 deliver.sent_log。今天的合成 PDF 还没发过就补发（没有合成文件，就用 deliver.expected_papers 里存在的 PDF 和 <skill 文件夹>/tools/merge.py 合一份），已经发过就不再发，只发批改。
   e. 每发出一个文件，在 deliver.sent_log 追加一行 {"date","file","sent_at"}。
5. 第 2 步查过额度的，再查一次，把前后两次的百分比、DATE、题目数追加到 deliver.usage_log。
6. 最后用两三句话总结：出了哪些题、建议用时、批改结果、这次用了多少额度。papers 里的 issues、plan.notes 里有该让用户知道的（拿不准学到哪了、缺原题、要求没照办），照实带一句。

限制：
- 不发邮件，不往学习平台发帖、发站内信或交作业，不改学习平台助手的设置。
- 只读写 <资料夹>、config 里每门课的 folder 和 delivery 里的文件夹。计划那一步会用学习平台助手把新课件下载到课程的 materials 文件夹，这是允许的；学习平台助手的命令（比如刷新数据）会写它自己的资料夹，这也是允许的。
- 工作流失败或卡住，就照实说卡在哪一步、哪些文件已经生成，不编造结果。
```

`<HH:MM>`、`<N>` 取 config 的 `schedule` 和 `daily_minutes`。用户说话不是中文的，把第二段的语言要求换成用户的语言。
