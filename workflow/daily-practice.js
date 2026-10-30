export const meta = {
  name: 'daily-practice',
  description: 'Daily exam-style practice papers for the courses in config.json: plan, grade answered papers, write and verify each question, assemble in exam layout, final QA',
  whenToUse: 'Run once a day with args {date: "YYYY-MM-DD", config: <parsed config.json>, mode: "daily" | "grade-only" | "paper-only", requests: "<optional student request>"}; see the daily-practice skill',
  phases: [
    { title: 'Plan', detail: 'choose today\'s questions from the taught scope, retests and the source map' },
    { title: 'Grade', detail: 'mark answered papers, flag mistakes as 重点' },
    { title: 'Draft', detail: 'write each variant, or transcribe an original' },
    { title: 'Blind solve', detail: 'independent solve from the rendered page images only' },
    { title: 'Review', detail: 'reconcile answers, check figure, scope and difficulty; fix loop' },
    { title: 'Assemble', detail: 'build each course paper with build_paper.py, answer keys, question log' },
    { title: 'Final QA', detail: 'independent check of the finished PDFs' },
  ],
}

// ---------------------------------------------------------------- configuration
// Everything about the student and the courses comes from args.config (config.json, see
// references/config.md). Nothing personal is written in this script.
const D = args || {}
if (!D.date || !/^\d{4}-\d{2}-\d{2}$/.test(D.date)) throw new Error('args.date (YYYY-MM-DD) is required')
const CFG = D.config
if (!CFG || typeof CFG !== 'object') throw new Error('args.config (the parsed config.json) is required')
if (!CFG.home) throw new Error('config.home (the data folder) is required')
if (!Array.isArray(CFG.courses) || !CFG.courses.length) throw new Error('config.courses is empty')
const MODE = D.mode || 'daily'
if (['daily', 'grade-only', 'paper-only'].indexOf(MODE) < 0) throw new Error('args.mode must be daily, grade-only or paper-only')
const REQUESTS = typeof D.requests === 'string' ? D.requests.trim() : ''

const trim = p => String(p || '').replace(/\/+$/, '')
const base = p => String(p || '').split('/').pop()
const num = (v, d) => (typeof v === 'number' && isFinite(v) && v > 0 ? v : d)
const cnt = (v, d) => (typeof v === 'number' && isFinite(v) && v >= 0 ? Math.floor(v) : d)  // 0 = paused
const EFFORT = CFG.effort || 'xhigh'
const HOME = trim(CFG.home)
const SKILL = trim(D.skill_dir || CFG.skill_dir)
if (!SKILL) throw new Error('config.skill_dir (the folder of the daily-practice skill) is required')
const TOOLS_DIR = SKILL + '/tools'
const STAGE = HOME + '/staging/' + D.date
const LOGDIR = HOME + '/log'
const PY = CFG.python || 'python3'
const TEX = CFG.tectonic || 'tectonic'
const IS_TECTONIC = /tectonic/i.test(base(TEX))
const RULES = CFG.rules || HOME + '/rules.md'
const SMAP = CFG.source_map || HOME + '/source-map.md'
const PREAMBLE = CFG.feedback_preamble || HOME + '/templates/feedback-preamble.tex'
const DLV = CFG.delivery || {}
const OUTBOX = trim(DLV.dir || HOME + '/out')
const ANSWERED = trim(DLV.answered_dir || OUTBOX + '/已作答')
const GRADED = trim(DLV.graded_dir || ANSWERED + '/已批改')
const FEEDBACK = trim(DLV.feedback_dir || OUTBOX + '/批改')
const fill = (t, o) => Object.keys(o).reduce((s, k) => s.split('{' + k + '}').join(o[k]), t)
const COMBINED = OUTBOX + '/' + fill(DLV.combined_name || '{date} 每日练习.pdf', { date: D.date })
const feedbackPdf = (date, code) => FEEDBACK + '/' + fill(DLV.feedback_name || '{date} {code} 批改.pdf', { date, code })
const LMS = CFG.lms && CFG.lms.name ? CFG.lms : null
const LEVEL = CFG.student_level || 'university student'
const ANSWER_ON = CFG.answer_on || 'a tablet'
const QLANG = (CFG.language && CFG.language.questions) || 'English'
const FB = (CFG.language && CFG.language.feedback) || 'zh'
const FBLANG = FB === 'zh' ? 'Chinese, with the English term in parentheses at first use' : (FB === 'en' ? 'English' : FB)
const RETEST = Array.isArray(CFG.retest_days) && CFG.retest_days.length ? CFG.retest_days : [2, 7]
const LAST_RETEST = RETEST[RETEST.length - 1]
const ORIG_WEEK = typeof CFG.originals_per_week === 'number' ? CFG.originals_per_week : 2
const PYPKG = CFG.python_packages ? ' (' + CFG.python_packages + ')' : ''

const CS = CFG.courses.map(c => {
  if (!c.code || !c.folder) throw new Error('every course needs "code" and "folder"')
  const marks = num(c.marks_per_question, 10)
  const q = cnt(c.questions_per_day, 2)
  const folder = trim(c.folder)
  return {
    raw: c, code: c.code, title: c.title || c.code, folder,
    prefix: c.id_prefix || c.code.charAt(0).toUpperCase(),
    q, light: Math.min(cnt(c.light_questions, 1), q),
    marks, mpm: num(c.minutes_per_mark, 2),
    orig: Array.isArray(c.original_marks) && c.original_marks.length === 2 ? c.original_marks : [Math.round(marks * 0.75), marks],
    solver: c.solver === 'circuit' ? 'circuit' : 'numeric',
    materials: trim(c.materials || folder + '/materials'),
    text_dir: trim(c.text_dir || HOME + '/refs/text/' + c.code),
    png_dir: trim(c.png_dir || HOME + '/refs/png/' + c.code),
    template: c.template || '', usage: c.usage || '',
    stub: c.stub || HOME + '/templates/stub.tex',
    facts: c.facts || '(config.json gives no facts for this course: read its rules, source map and materials)',
    layout: c.layout_notes || '', checks: c.page_checks || '',
    cover: c.cover || {}, lms_id: c.lms_course_id ? String(c.lms_course_id) : '',
    taught: c.taught_notes || '',
    out: date => folder + '/practice/daily/' + date,
    pdf: date => folder + '/practice/daily/' + date + '/' + c.code + '_Daily_' + date + '.pdf',
    key: date => folder + '/practice/.answer-keys/daily/' + date + '.md',
    errlog: folder + '/practice/error-log.md',
  }
})
const BY = {}
CS.forEach(c => { BY[c.code] = c })
const CODES = CS.map(c => c.code)
const ANY_CIRCUIT = CS.some(c => c.solver === 'circuit')
const NORMAL_MIN = CS.reduce((a, c) => a + c.q * c.marks * c.mpm, 0)
const LIGHT_MIN = CS.reduce((a, c) => a + c.light * c.marks * c.mpm, 0)
const DAILY = num(CFG.daily_minutes, Math.round(NORMAL_MIN))
// daily_minutes is the cap; the question counts decide the real workload. When they differ by
// more than 20%, the prompts state the smaller of the two, and the plan trims when counts exceed it.
const GAP = Math.abs(NORMAL_MIN - DAILY) > 0.2 * DAILY
const OVER = GAP && NORMAL_MIN > DAILY
const BUDGET = GAP && NORMAL_MIN < DAILY ? NORMAL_MIN : DAILY
if (GAP) log('Note: the course question counts give about ' + Math.round(NORMAL_MIN) + ' minutes a day, config.daily_minutes is ' + DAILY + (OVER ? '; the plan trims to fit' : '; the paper will be about ' + Math.round(NORMAL_MIN) + ' minutes') + ' (change questions_per_day or marks_per_question in config.json to match)')
const ACTIVE = CS.filter(c => c.q > 0)
const PAUSED = CS.filter(c => c.q === 0)

// 72 -> "1 hour 15 minutes", 40 -> "40 minutes" (rounded up to 5 minutes)
function fmtMinutes(m) {
  const t = Math.ceil(m / 5) * 5
  const h = Math.floor(t / 60)
  const r = t % 60
  const hs = h ? h + (h === 1 ? ' hour' : ' hours') : ''
  return hs && r ? hs + ' ' + r + ' minutes' : (hs || r + ' minutes')
}
// 45 -> "Forty-Five Minutes", 75 -> "One Hour Fifteen Minutes" (rounded up to 5 minutes)
function fmtWords(m) {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
    'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty']
  const say = n => (n < 20 ? ones[n] : tens[Math.floor(n / 10)] + (n % 10 ? '-' + ones[n % 10] : ''))
  const t = Math.ceil(m / 5) * 5
  const h = Math.floor(t / 60)
  const r = t % 60
  const hs = h ? say(h) + (h === 1 ? ' Hour' : ' Hours') : ''
  const rs = r ? say(r) + ' Minutes' : ''
  return hs && rs ? hs + ' ' + rs : (hs || rs)
}
const coverTime = (c, minutes) => (c.cover.time_style === 'words' ? fmtWords(minutes) : fmtMinutes(minutes))
const run = (prompt, opts) => agent(prompt, Object.assign({ effort: EFFORT }, opts))

// ---------------------------------------------------------------- shared prompt blocks
const perCourse = (ACTIVE.length
  ? (OVER ? 'at most ' : '') + ACTIVE.map(c => c.q + ' ' + c.code + ' question' + (c.q > 1 ? 's' : '') + ' of ' + c.marks + ' marks each (about ' + Math.round(c.marks * c.mpm) + ' minutes each)').join(' and ')
  : 'no questions (every course is paused)') + (ACTIVE.length && PAUSED.length ? '; ' + PAUSED.map(c => c.code).join(', ') + ' paused (no questions)' : '')
const USER_REQ = String.raw`
## What the student asked for (binding; full rules in ${RULES})
- Every day about ${fmtMinutes(BUDGET)} of questions: ${perCourse}; ${CS.map(c => c.light).join(' + ')} (about ${fmtMinutes(LIGHT_MIN)}) on light days. Exam standard or harder, laid out exactly like the real exam paper, typeset in LaTeX, questions in ${QLANG}.
- Variants by default: built on an original from the course (past paper, mock, examples sheet, lecture example); same topic and task type, but the numbers, structure or way of asking are changed, at the same or higher difficulty. Never a copy or a simple renumbering. About ${ORIG_WEEK} originals a week (at most one a day) may be reproduced as-is, labelled on the cover.
- Blank space under each part for answering on ${ANSWER_ON}; no drawn answer boxes.
- A normal day is about ${fmtMinutes(BUDGET)} of work and never more.
- Only what the course has taught so far${LMS ? ' (the ' + LMS.name + ' week modules)' : ' (the rules file and each course\'s taught notes)'}. Never use diagnostic-test results unless the student's request today asks for them.
- Mistakes are marked prominently (重点) when grading, logged with a ⭐ and re-tested about ${RETEST.join(' and ')} days later with a new variant aimed at the step that went wrong; when the question was an original, the retest about ${LAST_RETEST} days later is that original itself, as-is (it does not count toward the weekly originals).
- The paper never contains answers or hints. The cover never claims to be official and never prints an institution's copyright line.
`

function factsOf(c) {
  return String.raw`
## ${c.code} ${c.title} (static facts)
${c.facts}
- Originals by topic, and which are relevant: ${SMAP}.
`
}
const ALL_FACTS = CS.map(factsOf).join('')

const lmsLines = LMS ? String.raw`
- LMS helper (${LMS.name}), read-only use: status: ${LMS.status || '(not configured)'}; refresh: ${LMS.collect || '(not configured)'}; read an API path: ${LMS.api_get || '(not configured)'}; download a file: ${LMS.download || '(not configured)'}. Replace {path}, {out}, {file_id}, {dir} and {course_id} in these templates. Module snapshots: ${LMS.snapshot_glob || '(not configured)'} (course ids: ${CS.map(c => c.code + ' = ' + (c.lms_id || '?')).join(', ')}).${LMS.mood ? ' The student\'s recorded mood: ' + LMS.mood + '.' : ''} Never post, submit or send anything through it.` : String.raw`
- No LMS helper is configured: the taught scope comes from the rules file and each course's taught notes.`

const TOOLS = String.raw`
## Environment and tools
- Paths may contain spaces: always quote them. Write only inside the folders named in your task. Never modify anything in a course materials folder (except adding newly downloaded course files) or under ${HOME}/refs/ (except adding new text extracts or page renders).
- Python: "${PY}" -I <script>${PYPKG}. Do not install anything.
- LaTeX: ${IS_TECTONIC ? '"' + TEX + '" -X compile <file>.tex' : '"' + TEX + '" -interaction=nonstopmode <file>.tex, run twice'}, inside the folder that holds the .tex; copy every .sty/.tex you \input or \usepackage into that folder first (TeX cannot \input paths with spaces). Fix every error; treat Overfull \hbox warnings in your own content as errors.
- Render PDF pages: "${PY}" -I "${TOOLS_DIR}/render.py" <pdf> <outdir> all 1.4 <prefix>. View a PNG with the Read tool.${ANY_CIRCUIT ? '\n- Exact DC circuit solver: "' + PY + '" -I "' + TOOLS_DIR + '/mna.py" <netlist.json> [--thevenin A B] (format and sign conventions in its header).' : ''}
- Extract PDF text: "${PY}" -I "${TOOLS_DIR}/extract.py" <outdir> <pdf>...
- Shared logs (${LOGDIR}/questions.jsonl and each course's practice/error-log.md) are append-only, and other agents may be writing them at the same time: never edit, rewrite or delete their lines. Write your new lines to a file in your working folder, then append it: "${PY}" -I "${TOOLS_DIR}/log_append.py" <log> [--header "<text>"] <lines file>. In questions.jsonl every line is a full record and the last line for a given date, course and id is that question's current state.${lmsLines}
${CS.map(c => '- ' + c.code + ': course text, page-marked: "' + c.text_dir + '/"; original PDFs: "' + c.materials + '"; real exam pages rendered at scale 1.4: "' + c.png_dir + '/".').join('\n')}
`

function macrosOf(c) {
  return String.raw`
## LaTeX macro interface (the stub and the real template both implement exactly this; use nothing else for structure)
- \begin{Question}{<number>}{<total marks>} ... \end{Question}: new page, heading and closing line.
- \begin{Parts} \item ... \end{Parts}: parts (a), (b), (c). \begin{SubParts} \item ... \end{SubParts}: sub-parts (i), (ii).
- \Marks{9}, \Marks{4, 5}, \Mark{1}: the marks of a part or sub-part, printed in the course's style.
- \ExamFigure{<circuitikz or tikz picture>}{Q1.1}: centred figure with caption "Figure Q1.1".
- \AnswerSpace{<marks>}: unbreakable blank writing space (1.6 cm per mark, at least 4 cm); one after every part that carries marks. Use a single number.
- Notation macros: \vect{a} (bold vector), \mat{A} (sans-serif matrix), \T (transpose).${c.layout ? '\n- ' + c.code + ' layout: ' + c.layout : ''}
- Stub for checking a fragment: "${c.stub}". Real template${c.usage ? ' and its usage notes' : ''}: "${c.template}"${c.usage ? ', "' + c.usage + '"' : ''}.
`
}

// ---------------------------------------------------------------- schemas
const SPEC_SCHEMA = { type: 'object', properties: {
  id: { type: 'string' }, course: { type: 'string', enum: CODES }, number: { type: 'number' },
  marks: { type: 'number' }, minutes: { type: 'number' }, kind: { type: 'string', enum: ['variant', 'original'] },
  topic: { type: 'string' }, primary: { type: 'string' }, secondary: { type: 'string' },
  retest_of: { type: 'string' }, scope: { type: 'string' }, request: { type: 'string' },
}, required: ['id', 'course', 'number', 'marks', 'minutes', 'kind', 'topic', 'primary', 'secondary', 'scope'] }

const PLAN_SCHEMA = { type: 'object', properties: {
  skip: { type: 'boolean' }, reason: { type: 'string' },
  light_day: { type: 'boolean' }, light_reason: { type: 'string' },
  specs: { type: 'array', items: SPEC_SCHEMA },
  answered: { type: 'array', items: { type: 'object', properties: {
    pdf: { type: 'string' }, course: { type: 'string' }, date: { type: 'string' }, key: { type: 'string' }, paper: { type: 'string' },
  }, required: ['pdf', 'course', 'date', 'key'] } },
  notes: { type: 'string' },
}, required: ['skip', 'specs', 'answered'] }

const DRAFT_SCHEMA = { type: 'object', properties: {
  id: { type: 'string' }, marks_total: { type: 'number' }, suggested_minutes: { type: 'number' },
  parts: { type: 'array', items: { type: 'object', properties: { label: { type: 'string' }, marks: { type: 'number' }, final_answer: { type: 'string' } }, required: ['label', 'marks', 'final_answer'] } },
  sources: { type: 'array', items: { type: 'object', properties: { paper: { type: 'string' }, question: { type: 'string' }, how_used: { type: 'string' } }, required: ['paper', 'question'] } },
  harder_because: { type: 'string' }, summary: { type: 'string' }, problems: { type: 'array', items: { type: 'string' } },
}, required: ['id', 'marks_total', 'parts', 'sources', 'summary'] }

const BLIND_SCHEMA = { type: 'object', properties: {
  parts: { type: 'array', items: { type: 'object', properties: { label: { type: 'string' }, final_answer: { type: 'string' } }, required: ['label', 'final_answer'] } },
  ambiguities: { type: 'array', items: { type: 'string' } }, estimated_minutes: { type: 'number' },
}, required: ['parts', 'ambiguities', 'estimated_minutes'] }

const REVIEW_SCHEMA = { type: 'object', properties: {
  verdict: { type: 'string', enum: ['pass', 'fix'] }, must_fix: { type: 'array', items: { type: 'string' } },
  nice_to_have: { type: 'array', items: { type: 'string' } }, answers_agree: { type: 'boolean' },
  difficulty_vs_original: { type: 'string' }, notes: { type: 'string' },
}, required: ['verdict', 'must_fix', 'answers_agree', 'difficulty_vs_original'] }

const GRADE_SCHEMA = { type: 'object', properties: {
  course: { type: 'string' }, date: { type: 'string' }, total: { type: 'string' },
  parts: { type: 'array', items: { type: 'object', properties: { label: { type: 'string' }, score: { type: 'string' }, zhongdian: { type: 'boolean' }, note: { type: 'string' } }, required: ['label', 'score', 'zhongdian'] } },
  key_mistakes: { type: 'array', items: { type: 'string' } }, feedback_pdf: { type: 'string' },
}, required: ['course', 'date', 'total', 'parts', 'key_mistakes'] }

const ASSEMBLE_SCHEMA = { type: 'object', properties: {
  pdf_path: { type: 'string' }, tex_path: { type: 'string' }, pages: { type: 'number' }, answer_key_path: { type: 'string' },
  cover_minutes: { type: 'string' }, checks_done: { type: 'array', items: { type: 'string' } }, issues_remaining: { type: 'array', items: { type: 'string' } },
}, required: ['pdf_path', 'tex_path', 'pages', 'answer_key_path', 'checks_done'] }

const QA_SCHEMA = { type: 'object', properties: {
  verdict: { type: 'string', enum: ['pass', 'fix'] },
  must_fix: { type: 'array', items: { type: 'object', properties: { course: { type: 'string' }, issue: { type: 'string' } }, required: ['course', 'issue'] } },
  nice_to_have: { type: 'array', items: { type: 'string' } }, notes: { type: 'string' },
}, required: ['verdict', 'must_fix'] }

// ---------------------------------------------------------------- prompts
function planPrompt() {
  const folders = CS.map(c => c.code + ' = "' + c.folder + '"').join(', ')
  const papers = CS.map(c => '"' + c.pdf(D.date) + '"').join(' and ')
  const ids = ACTIVE.length ? ACTIVE.map(c => Array.from({ length: c.q }, (_, i) => c.prefix + (i + 1)).join(', ') + ' for ' + c.code).join(' and ') : '(none: every course is paused)'
  const marks = CS.map(c => c.code + ' questions are ' + c.marks + ' marks each (an original keeps its own marks, ' + c.orig[0] + '-' + c.orig[1] + '), minutes = ' + c.mpm + ' per mark').join('; ')
  const counts = CS.map(c => c.q + ' for ' + c.code).join(', ') + ', or on a light day ' + CS.map(c => c.light + ' for ' + c.code).join(', ')
  const taught = LMS
    ? 'from the latest module snapshot of each course (' + (LMS.snapshot_glob || 'see the LMS helper') + ') and its lecture pages (read them with the API command), list what has been taught by ' + D.date + ' (lectures already given). Download any slides or notes for taught weeks that are not yet in the course materials folder (download command, into "<materials folder>/Week N") and extract their text into the course text folder.'
    : 'from the rules file and each course\'s taught notes below, list what has been taught by ' + D.date + '. Never guess beyond them; if they do not say, use only what they clearly date before ' + D.date + ' and say so in notes.' + CS.filter(c => c.taught).map(c => '\n   ' + c.code + ' taught notes: ' + c.taught).join('')
  const fresh = LMS
    ? 'Refresh the LMS data: ' + (LMS.collect || '(no refresh command)') + ', then ' + (LMS.status || '(no status command)') + '. Note graded deadlines, labs and tests on ' + D.date + ' and the next day' + (LMS.mood ? ', and the student\'s recorded mood (' + LMS.mood + ')' : '') + '.'
    : 'Note any graded deadlines, labs and tests on ' + D.date + ' and the next day that the rules file lists.'
  const modeNote = MODE === 'grade-only'
    ? '\nMODE grade-only: do step 1 only, then return skip = true and no specs.'
    : (MODE === 'paper-only' ? '\nMODE paper-only: skip step 1 (return answered = []); do not grade anything.' : '')
  const req = REQUESTS
    ? '\n## The student\'s request for today\n' + REQUESTS + '\nFollow it where it fits the rules (taught content only, the day\'s time budget, retests first). Put the request a spec answers in its "request" field, and say in notes what you did with it.\n'
    : ''
  return String.raw`You plan the daily practice paper for ${D.date}. Read ${RULES} and ${SMAP} first and follow them.${modeNote}
${USER_REQ}${req}
${ALL_FACTS}
${TOOLS}
Course folders: ${folders}.
Steps:
1. Answered papers: list every PDF directly inside "${ANSWERED}/" (not in a subfolder such as "${base(GRADED)}"). For each, work out which paper it is (date and course) from its file name or by rendering its first page, and give the matching answer key path "<course folder>/practice/.answer-keys/daily/<date>.md" and paper PDF "<course folder>/practice/daily/<date>/<CODE>_Daily_<date>.pdf".
2. If ${papers} all already exist, return skip = true with no specs (still return the answered list).
3. ${fresh} Decide whether today is a light day: the day before or the day of a graded deadline, lab or test, or when the student's recorded mood or today's request says tired, ill or short of time, plus any further rule in ${RULES}.
4. Taught scope per course: ${taught}
   If a new topic appears that the source map lists as later, treat it as taught only when its lecture has happened.
5. Read ${LOGDIR}/questions.jsonl (may not exist yet; the last line for a date, course and id is that question's current state) and the error logs ${CS.map(c => '"' + c.errlog + '"').join(', ')} (may not exist). Find retests due on or before ${D.date}: a retest date of a ⭐ mistake is done once a question with retest_of pointing at that question is dated on or after it. Count new originals (kind "original" without retest_of) used in the last 7 days; list originals used as bases in the last 7 days.
6. Choose the specs (${counts}), per the rules: retests first; normally one question on the most recent taught week and one older topic per course; rotate exam question types over the week; ${marks}, rounded; the day's total must stay at about ${fmtMinutes(BUDGET)} (about ${fmtMinutes(LIGHT_MIN)} on a light day).${OVER ? ' The configured counts give about ' + fmtMinutes(NORMAL_MIN) + ', more than that: leave out questions (older topics first, never a due retest) until the day fits, and say so in notes.' : ''}${PAUSED.length ? ' No specs for ' + PAUSED.map(c => c.code).join(', ') + ' (paused).' : ''}
   Retests: a due retest is a new variant aimed at exactly the step that went wrong (kind "variant", retest_of set). The exception is a question that was an original: its retest about ${LAST_RETEST} days later is the original itself, as-is (kind "original", retest_of set)${RETEST.length > 1 ? ', while its earlier retests are new variants like any other' : ''}.
   New originals: kind "original" without retest_of only if fewer than ${ORIG_WEEK} new originals in the last 7 days and none yet today, preferring originals with official answers. As-is retests of a wrong original do not count toward either limit. Do not reuse an original as a variant base within 7 days unless it is a retest. ids: ${ids}; number = position within its course paper.
   For each spec give: a precise topic; the primary original (paper, question, marks, page image path in the course's rendered pages or the PDF and page); secondary material (other originals, notes sections, slides, examiners' feedback); retest_of ("<date>/<id>" or empty); scope = one paragraph listing exactly what has been taught in that course so far (weeks and topics) and what is NOT yet taught.
Return the structured plan.`
}

function gradePrompt(a) {
  const C = BY[a.course]
  if (!C) {
    return String.raw`An answered practice paper "${a.pdf}" (paper date ${a.date}) names course "${a.course}", which is not in config.json (${CODES.join(', ')}). Do not grade it and do not move it. Return the structured result with total "not graded", no parts, and key_mistakes = ["unknown course ${a.course}"].`
  }
  const out = C.out(a.date)
  const gdir = STAGE + '/grading/' + a.course + '-' + a.date
  return String.raw`Grade the student's answered practice paper. Answered PDF: "${a.pdf}". Course ${a.course} (${C.title}), paper date ${a.date}. Answer key: "${a.key}". Paper: "${a.paper || C.pdf(a.date)}". Follow the grading rules in ${RULES}.
${TOOLS}
Steps:
1. Render every page of the answered PDF into "${gdir}/" and read the handwriting page by page. Read the answer key.
2. For each part: score with the key's marking points ("got/available"); credit any correct alternative method fully; list what is right, missing and wrong. Wrong or missing work is 重点: name the exact wrong step and what to reread (notes section or slide). Be strict but fair; unreadable work is said to be unreadable, not guessed.
3. Write "${out}/批改.md". Then write "${out}/批改.tex": \documentclass[11pt,a4paper]{article}, \input{feedback-preamble.tex} (copy "${PREAMBLE}" next to it), a title, the total, then each question and part with \score{got}{available}, \ok{...} for right points and \zhongdian{...} for every mistake; written in ${FBLANG}; formulas in LaTeX. Compile it and copy the PDF to "${feedbackPdf(a.date, a.course)}" (create the folder).
4. Error log: write one ⭐ line per mistake to "${gdir}/errlog.txt": "- ⭐ ${a.date} Q<n>(<part>) <topic>: <error>. Retest: ${RETEST.map(d => '<date + ' + d + ' days>').join(', ')}". For a question that was an original, end the line with "(original: retest as-is on <date + ${LAST_RETEST} days>)". Append it: "${PY}" -I "${TOOLS_DIR}/log_append.py" "${C.errlog}" --header "# ${a.course} error log" "${gdir}/errlog.txt".
5. Question log: for every question of this paper, take its latest line in ${LOGDIR}/questions.jsonl (date ${a.date}, course ${a.course}; if there is none, build the record from the answer key), set status "graded" and fill score, mistakes and retest_due. Write these full records to "${gdir}/log.jsonl" and append them: "${PY}" -I "${TOOLS_DIR}/log_append.py" "${LOGDIR}/questions.jsonl" "${gdir}/log.jsonl". Do not edit the existing lines.
6. Move the answered PDF into "${GRADED}/" (create it).
Return the structured result, with feedback_pdf = the copied PDF path.`
}

function draftPrompt(s) {
  const C = BY[s.course]
  const dir = STAGE + '/' + s.id
  const verify = C.solver === 'circuit'
    ? 'Write the circuit as a netlist "' + dir + '/circuit.json" and solve it with mna.py. Choose values that give clean answers. Check the power balance; substitute any design value back and solve again. Save the solver output to "' + dir + '/verify.txt". Draw the figure with circuitikz in the style of the real figures (see the facts above); label every element value and every node or quantity the question refers to, with its reference direction or polarity.'
    : 'Verify every answer numerically with Python and numpy (complex arithmetic, matrix products, determinants, inverses, eigen-decompositions, substitution checks, numerical integration or differentiation where relevant) and save the script and its output in "' + dir + '/verify.txt".'
  const retest = s.retest_of ? '\n- This is a RETEST of ' + s.retest_of + ': read that question and the student\'s mistakes in "' + C.errlog + '", and make the new variant test exactly the step that went wrong.' : ''
  const req = s.request ? '\n- The student asked for: ' + s.request : ''
  return String.raw`You are writing ONE question for a self-study practice paper for a ${LEVEL}. Course ${s.course} (${C.title}). It is Question ${s.number} of the paper, worth ${s.marks} marks (about ${s.minutes} minutes).
${USER_REQ}
${factsOf(C)}
## Taught so far (only this may be used)
${s.scope}
${TOOLS}
${macrosOf(C)}
## This question
- Topic: ${s.topic}
- Primary original (build the variant on this one): ${s.primary}
- Also study: ${s.secondary}${retest}${req}
- Working folder: "${dir}" (create it). Write only there.
## Steps
1. Study the originals (page images, text, official solutions) and the notes or slides for the topic, so notation and vocabulary match the course and everything needed has been taught.
2. Design a NEW variant: the same task type and wording style, different numbers and a changed structure, at the same or higher difficulty (one more element, a reversed or design requirement, or two taught ideas combined). Never a copy or a simple renumbering. Split the ${s.marks} marks across parts as the real paper does.
3. ${verify}
4. Write "${dir}/question.tex": exactly one \begin{Question}{${s.number}}{${s.marks}} ... \end{Question} block using ONLY the macro interface. ${QLANG} only. No answers, hints or source notes.
5. Compile check: copy "${C.stub}" into your folder; write "${dir}/standalone.tex" (\documentclass[11pt,a4paper]{article} \input{${base(C.stub)}} \begin{document} \input{question.tex} \end{document}); compile; fix all errors and overfull boxes; render every page into "${dir}/png" (prefix q); view every page and confirm text and figure are correct and readable.
6. Write "${dir}/solution.md", the hidden marking key: for each part the full working, final answers with units, and marking points adding up to the part's marks; explanations in ${FBLANG}; end with "Common mistakes this question targets".
7. Write "${dir}/meta.json": {"id","course","number","kind":"variant","retest_of","marks_total","suggested_minutes","topic","sources":[{"paper","question","marks","how_used"}],"harder_because","parts":[{"label","marks","final_answer"}]}.
Return the structured result.`
}

function transcribePrompt(s) {
  const C = BY[s.course]
  const dir = STAGE + '/' + s.id
  return String.raw`You are reproducing ONE original question as-is for a self-study practice paper. Course ${s.course} (${C.title}); it becomes Question ${s.number} of the paper (${s.marks} marks, about ${s.minutes} minutes).
${USER_REQ}
${factsOf(C)}
## Taught so far
${s.scope}
${TOOLS}
${macrosOf(C)}
## The original
- ${s.primary}
- Also: ${s.secondary}${s.retest_of ? '\n- This is a RETEST of ' + s.retest_of + ' (the student got it wrong before).' : ''}
- Working folder: "${dir}" (create it).
## Steps
1. View the original page images and read its text. Reproduce it exactly: same wording, numbers, part structure and marks. Only renumber it as Question ${s.number} and its figures as Q${s.number}.1, Q${s.number}.2, ... If it refers to another part of the original paper that is not included, make the minimal wording change needed and say so in meta.json.
2. Redraw every figure faithfully with circuitikz or tikz; check every element, value, label, direction and polarity against the page image.
3. Write "${dir}/question.tex" with the macro interface and an \AnswerSpace after every part that carries marks. Compile check with the stub (copy "${C.stub}", standalone.tex as usual), render into "${dir}/png" (prefix q), view every page.
4. Write "${dir}/solution.md": take the official solution if one exists (cite file and page) and verify it numerically${C.solver === 'circuit' ? ' (mna.py with circuit.json)' : ''}; if none exists, solve and verify it yourself. Marking points per part, explanations in ${FBLANG}. Save checks in verify.txt.
5. Write "${dir}/meta.json" with "kind":"original" and the source.
Return the structured result (harder_because: "original question").`
}

function blindPrompt(s, round) {
  const C = BY[s.course]
  const dir = STAGE + '/' + s.id
  const out = dir + '/blind-r' + round
  return String.raw`You are an independent expert solver checking a practice exam question for course ${s.course} (${C.title}) before a student sees it.
STRICT RULE: the only files you may open in "${dir}" are the page images in "${dir}/png/". Do NOT open question.tex, standalone.tex, solution.md, circuit.json, verify.txt, meta.json, any blind-r* folder or anything else there. You may read this course's material in "${C.text_dir}/" and "${C.png_dir}/" (and ${HOME}/refs/) to check conventions.
${factsOf(C)}
${TOOLS}
Tasks:
1. View every page image in "${dir}/png/" and transcribe the question exactly (every value, label, direction and polarity).
2. Solve every part completely, with the method an examiner expects. Check your arithmetic with Python${C.solver === 'circuit' ? ' and with mna.py on your OWN netlist transcribed from the figure' : ''}. Work in "${out}" (create it); write your full solution to "${out}/blind.md".
3. Report anything a student could misread or find ambiguous, and anything that needs content not taught yet (taught so far: ${s.scope}).
4. Estimate the minutes a well-prepared ${LEVEL} needs.
Return the structured result.`
}

function reviewPrompt(s, draft, blind, round) {
  const C = BY[s.course]
  const dir = STAGE + '/' + s.id
  const isC = C.solver === 'circuit'
  const isOrig = s.kind === 'original'
  const fig = isC
    ? '2. Figure: compare the rendered figure with circuit.json (if any) and with the question text element by element: values, connections, source polarities and arrow directions, labelled quantities and their reference directions. Any mismatch is must-fix.'
    : '2. Notation as in the course (see the facts above). Any figure must match the question text exactly.'
  const kindCheck = isOrig
    ? '4. Faithful reproduction: compare the page images with the original page image line by line (wording, numbers, marks, figure). Any difference that changes the question is must-fix. The key must agree with the official solution where one exists.'
    : '4. Difficulty: same as or higher than the primary original (look at it), explained concretely; easier is must-fix. It must be a real variant, not a copy or simple renumbering.'
  return String.raw`You are the reviewer for practice question ${s.id} (course ${s.course}, Question ${s.number}, ${s.marks} marks, about ${s.minutes} minutes, kind ${s.kind}${s.retest_of ? ', retest of ' + s.retest_of : ''}), review round ${round}. Be strict: a wrong or ambiguous question wastes the student's evening.
${USER_REQ}
${factsOf(C)}
## Taught so far
${s.scope}
${TOOLS}
${macrosOf(C)}
Files: "${dir}/question.tex", page images "${dir}/png/", "${dir}/solution.md", "${dir}/verify.txt", "${dir}/meta.json"${isC ? ', "' + dir + '/circuit.json" (if present)' : ''}, blind solution "${dir}/blind-r${round}/blind.md". Primary original: ${s.primary}
Author's final answers: ${JSON.stringify(draft.parts)}
Blind solver's final answers: ${JSON.stringify(blind ? blind.parts : null)}
Blind solver's concerns: ${JSON.stringify(blind ? blind.ambiguities : null)}
Check, recomputing anything you doubt with Python${isC ? ' and mna.py' : ''}:
1. Answers: compare author and blind answers part by part; settle every disagreement by your own calculation and name the cause. Any error in the key or genuine ambiguity is must-fix.
${fig}
3. Scope: only taught content, in the course's notation and conventions.
${kindCheck}
5. Exam style: wording and marks like the real paper, unambiguous, all data given, units, marks add up to ${s.marks}, an \AnswerSpace after every part that carries marks, nothing on the page gives away an answer.
6. The marking scheme in solution.md is complete and correct (alternative correct methods credited) and adds up per part.
7. Timing fits about ${s.minutes} minutes (plus or minus 30%).
Return verdict "pass" only when there is no must-fix issue. Write every must-fix item precisely enough for another agent to apply it.`
}

function fixPrompt(s, review) {
  const C = BY[s.course]
  const dir = STAGE + '/' + s.id
  return String.raw`Apply the reviewer's must-fix list to practice question ${s.id} (course ${s.course}, Question ${s.number}, ${s.marks} marks, kind ${s.kind}) in "${dir}". Keep everything that is already fine.
${USER_REQ}
${factsOf(C)}
## Taught so far
${s.scope}
${TOOLS}
${macrosOf(C)}
Must-fix items: ${JSON.stringify(review.must_fix)}
Reviewer notes: ${JSON.stringify(review.notes || '')}
Update question.tex, circuit.json (if any), solution.md, verify.txt and meta.json so they stay consistent; re-run the numeric verification; recompile standalone.tex; delete the old images in png/ and render every page again (prefix q); view them. Do not touch blind-r* folders. Return the structured result with the updated final answers.`
}

function buildConfig(C, qs) {
  const minutes = qs.reduce((a, q) => a + q.spec.minutes, 0)
  const r = C.raw
  return {
    course: { code: C.code, title: C.title, template: r.template, template_files: r.template_files || [], skeleton: r.skeleton, cover: C.cover },
    date: D.date,
    out_dir: C.out(D.date),
    questions: qs.map(q => STAGE + '/' + q.spec.id + '/question.tex'),
    cover: { time: coverTime(C, minutes), session: C.cover.session || '', source_lines: [] },
    tectonic: TEX,
  }
}

function assemblePrompt(code, qs) {
  const C = BY[code]
  const key = C.key(D.date)
  const build = buildConfig(C, qs)
  const list = qs.map(q => ({ number: q.spec.number, id: q.spec.id, kind: q.spec.kind, retest_of: q.spec.retest_of || null,
    fragment: STAGE + '/' + q.spec.id + '/question.tex', solution: STAGE + '/' + q.spec.id + '/solution.md', sources: q.draft.sources, topic: q.spec.topic, marks: q.spec.marks }))
  return String.raw`Assemble the finished ${code} daily practice paper for ${D.date}.
${USER_REQ}
${TOOLS}
${macrosOf(C)}
Reviewed questions (do not change their content; layout-only fixes are allowed): ${JSON.stringify(list)}
Steps:
1. Write "${STAGE}/build-${code}.json" with exactly this content, except that cover.source_lines gets one line per question in order: "Question n is adapted from <paper, question>." for a variant, "Question n is reproduced from <paper, question>." for an original, adding " (retest)" for a retest (LaTeX-escape & % _ #):
${JSON.stringify(build)}
   Then run: "${PY}" -I "${TOOLS_DIR}/build_paper.py" "${STAGE}/build-${code}.json" (it prints a JSON summary; fix every error it reports).
2. View every rendered page in "${build.out_dir}/png" next to the real reference pages in "${C.png_dir}/". Check: header and footer, cover, question headings, marks style, figures and captions,${C.checks ? ' ' + C.checks + ',' : ''} every question on a new page, generous blank space after every part, no part statement or figure split across pages, nothing overfull. If a layout fix belongs in the template, fix "${C.template}" and rebuild; never change question content.
3. Write the hidden answer key "${key}" (create the folders): header (paper file, date, total marks, suggested time), then per question its kind, sources and retest_of, a table of final answers per part with marks, and the full content of its solution.md.
4. Question log: write one JSON line per question to "${STAGE}/log-${code}.jsonl": {"date":"${D.date}","course":"${code}","number","id","kind","retest_of","topic","sources","marks","paper":"<pdf path>","key":"${key}","status":"set","score":null,"mistakes":[],"retest_due":[]}. Append it: "${PY}" -I "${TOOLS_DIR}/log_append.py" "${LOGDIR}/questions.jsonl" "${STAGE}/log-${code}.jsonl".
Return the structured result.`
}

function qaPrompt(assembled, qsAll, light) {
  const list = assembled.map(a => a.course + ': PDF "' + a.res.pdf_path + '", answer key "' + a.res.answer_key_path + '"').join('; ')
  const checks = CS.filter(c => c.checks).map(c => c.code + ' ' + c.checks).join('; ')
  return String.raw`Independent final QA of today's finished daily practice papers (${D.date}) before the student sees them.
${USER_REQ}
${ALL_FACTS}
${TOOLS}
Papers: ${list}.
Questions: ${JSON.stringify(qsAll.map(q => ({ id: q.spec.id, course: q.spec.course, kind: q.spec.kind, retest_of: q.spec.retest_of || null, sources: q.draft.sources, scope: q.spec.scope })))}
Render every page of each PDF into "${STAGE}/qa/<course>/" and view every page. Check and report:
1. Layout matches the real paper of that course (compare with its rendered reference pages: ${CS.map(c => c.code + ' "' + c.png_dir + '/"').join(', ')}).
2. Every question starts on a new page; generous blank space after every part; page numbers correct${checks ? '; ' + checks + ' correct' : ''}.
3. ${QLANG} only; no answers or hints; the cover says self-study practice, has no institution copyright line, and names the source of each question (adapted / reproduced / retest); suggested times add up to about ${light ? fmtMinutes(LIGHT_MIN) + ' (light day)' : fmtMinutes(BUDGET)}.
4. Variants are real variants, at least as hard as their originals; originals are faithful; only taught content.
5. Each answer key exists and matches its paper; spot-check one part of every question by re-solving it (Python${ANY_CIRCUIT ? ' / mna.py' : ''}).
Return verdict "pass" only if nothing must be fixed; each must-fix item names the course (one of ${CODES.join(', ')}) and the problem precisely.`
}

function qaFixPrompt(code, a, findings) {
  const C = BY[code]
  return String.raw`Fix these final-QA findings in the finished ${code} daily practice paper "${a.res.tex_path}" (answer key "${a.res.answer_key_path}"). Rebuild with "${PY}" -I "${TOOLS_DIR}/build_paper.py" "${STAGE}/build-${code}.json" and view every page to confirm.
${USER_REQ}
${TOOLS}
${macrosOf(C)}
Findings: ${JSON.stringify(findings)}
If a finding is about a question's content, update the staging files in "${STAGE}" and the answer key consistently and re-verify numerically; then append a corrected full record for that question (same date, course and id) to ${LOGDIR}/questions.jsonl with log_append.py. Never edit existing log lines. Return the structured result.`
}

// ---------------------------------------------------------------- run
log('daily-practice ' + D.date + ' (' + MODE + '): ' + CS.map(c => c.code).join(' + ') + ', effort ' + EFFORT + (REQUESTS ? '; request: ' + REQUESTS : ''))
phase('Plan')
const plan = await run(planPrompt(), { label: 'plan', phase: 'Plan', schema: PLAN_SCHEMA })
if (!plan) throw new Error('planning failed')
const answered = MODE === 'paper-only' ? [] : (plan.answered || [])
let specs = MODE === 'grade-only' || plan.skip ? [] : (plan.specs || [])
CS.forEach(c => {
  const n = specs.filter(s => s.course === c.code).length
  const cap = plan.light_day ? c.light : c.q
  if (n > cap) log('Note: the plan has ' + n + ' ' + c.code + ' question(s), more than the ' + cap + ' allowed; kept as planned')
})
log((MODE === 'grade-only' ? 'Grade only; ' : (plan.skip ? 'Paper already exists; ' : 'Specs: ' + specs.map(s => s.id + ' ' + s.kind).join(', ') + '; ')) +
  answered.length + ' answered paper(s) to grade' + (plan.light_day ? '; light day: ' + (plan.light_reason || '') : ''))

const gradingPromise = parallel(answered.map(a => () =>
  run(gradePrompt(a), { label: 'grade:' + a.course + ' ' + a.date, phase: 'Grade', schema: GRADE_SCHEMA })))

let qs = []
if (specs.length) {
  const questions = await pipeline(
    specs,
    s => run(s.kind === 'original' ? transcribePrompt(s) : draftPrompt(s), { label: 'draft:' + s.id, phase: 'Draft', schema: DRAFT_SCHEMA }),
    (draft, s) => {
      if (!draft) throw new Error('draft failed for ' + s.id)
      return run(blindPrompt(s, 1), { label: 'blind:' + s.id, phase: 'Blind solve', schema: BLIND_SCHEMA }).then(b => ({ draft, blind: b }))
    },
    async (prev, s) => {
      let draft = prev.draft
      let blind = prev.blind
      for (let round = 1; round <= 3; round++) {
        const rev = await run(reviewPrompt(s, draft, blind, round), { label: 'review:' + s.id + '#' + round, phase: 'Review', schema: REVIEW_SCHEMA })
        if (rev && rev.verdict === 'pass') return { spec: s, draft, review: rev, rounds: round }
        if (!rev || round === 3) return { spec: s, draft, review: rev, rounds: round, unresolved: true }
        log(s.id + ': review round ' + round + ' asked for ' + rev.must_fix.length + ' fix(es)')
        const fixed = await run(fixPrompt(s, rev), { label: 'fix:' + s.id + '#' + round, phase: 'Review', schema: DRAFT_SCHEMA })
        if (fixed) draft = fixed
        blind = await run(blindPrompt(s, round + 1), { label: 'blind:' + s.id + '#' + (round + 1), phase: 'Review', schema: BLIND_SCHEMA })
      }
    },
  )
  qs = questions.filter(Boolean)
  const lost = specs.filter(s => !qs.some(q => q.spec.id === s.id)).map(s => s.id)
  if (lost.length) log('Failed before review (draft or blind solve died): ' + lost.join(', '))
}
const dropped = qs.filter(q => q.unresolved).map(q => q.spec.id)
if (dropped.length) log('Left out (still failing review after 3 rounds): ' + dropped.join(', '))
const good = qs.filter(q => !q.unresolved)

let assembled = []
let qa = null
const qaFixes = []
if (good.length) {
  phase('Assemble')
  assembled = (await parallel(CS.map(c => () => {
    const mine = good.filter(q => q.spec.course === c.code).sort((a, b) => a.spec.number - b.spec.number)
    if (!mine.length) return Promise.resolve(null)
    return run(assemblePrompt(c.code, mine), { label: 'assemble:' + c.code, phase: 'Assemble', schema: ASSEMBLE_SCHEMA }).then(r => ({ course: c.code, res: r }))
  }))).filter(a => a && a.res)
  if (assembled.length) {
    phase('Final QA')
    qa = await run(qaPrompt(assembled, good, !!plan.light_day), { label: 'final-qa', phase: 'Final QA', schema: QA_SCHEMA })
    if (qa && qa.verdict === 'fix' && qa.must_fix.length) {
      const byCourse = {}
      qa.must_fix.forEach(m => { (byCourse[m.course] = byCourse[m.course] || []).push(m.issue) })
      const fixes = await parallel(Object.keys(byCourse).map(c => () => {
        const a = assembled.find(x => x.course === c)
        if (!a) return Promise.resolve(null)
        return run(qaFixPrompt(c, a, byCourse[c]), { label: 'qa-fix:' + c, phase: 'Final QA', schema: ASSEMBLE_SCHEMA }).then(r => ({ course: c, res: r }))
      }))
      qaFixes.push(...fixes.filter(Boolean))
      const unknown = Object.keys(byCourse).filter(c => !assembled.some(x => x.course === c))
      if (unknown.length) log('QA findings for courses without a paper were not applied: ' + unknown.join(', '))
    }
  }
}

const grading = (await gradingPromise).filter(Boolean)
const qaFixOf = a => qaFixes.find(x => x.course === a.course && x.res)
const finalPdf = a => {
  const f = qaFixOf(a)
  return f && f.res.pdf_path ? f.res.pdf_path : a.res.pdf_path
}
// what is still wrong with a paper: the QA fix's report when one ran, else assembly's plus any
// final-QA finding for that course that no fix applied
const finalIssues = a => {
  const f = qaFixOf(a)
  if (f) return f.res.issues_remaining || []
  const open = qa && qa.verdict === 'fix' ? (qa.must_fix || []).filter(m => m.course === a.course).map(m => 'final QA, not fixed: ' + m.issue) : []
  return (a.res.issues_remaining || []).concat(open)
}
const inputs = assembled.map(finalPdf)
const quote = p => '"' + p + '"'
return {
  date: D.date,
  mode: MODE,
  plan: { skip: !!plan.skip, reason: plan.reason || '', light_day: !!plan.light_day, light_reason: plan.light_reason || '', notes: plan.notes || '' },
  questions: qs.map(x => ({ id: x.spec.id, course: x.spec.course, kind: x.spec.kind, retest_of: x.spec.retest_of || null, topic: x.spec.topic, minutes: x.spec.minutes, rounds: x.rounds, unresolved: !!x.unresolved, sources: x.draft.sources })),
  papers: assembled.map(a => { const f = qaFixOf(a); return { course: a.course, pdf: finalPdf(a), key: a.res.answer_key_path, pages: (f && f.res.pages) || a.res.pages, issues: finalIssues(a) } }),
  qa: qa ? { verdict: qa.verdict, must_fix: qa.must_fix, notes: qa.notes || '' } : null,
  qaFixes: qaFixes.map(f => ({ course: f.course, pdf: f.res && f.res.pdf_path, issues: (f.res && f.res.issues_remaining) || [] })),
  grading,
  deliver: {
    combined: inputs.length ? COMBINED : null,
    inputs,
    merge_command: inputs.length ? [quote(PY), '-I', quote(TOOLS_DIR + '/merge.py'), quote(COMBINED)].concat(inputs.map(quote)).join(' ') : null,
    combined_path: COMBINED,
    expected_papers: CS.map(c => c.pdf(D.date)),
    feedback: grading.map(g => g.feedback_pdf).filter(Boolean),
    sent_log: LOGDIR + '/sent.jsonl',
    usage_log: LOGDIR + '/usage.jsonl',
  },
}
