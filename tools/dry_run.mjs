#!/usr/bin/env node
// Dry run of workflow/daily-practice.js without any agents: every agent() call gets a stub
// answer shaped by its schema, so the whole script runs (plan, grading, draft, blind solve,
// a review/fix round, assemble, final QA and a QA fix) and every prompt can be checked.
//
// usage: node dry_run.mjs --config <config.json> [--date YYYY-MM-DD] [--mode daily|grade-only|paper-only]
//                         [--requests "<text>"] [--script <workflow.js>] [--prompts <dir>] [--json]
//
// Checks (exit 1 if any fails): every agent call carries effort = config.effort (default xhigh)
// and a schema whose "required" keys exist; no prompt contains "undefined", "NaN" or
// "[object Object]"; course prompts contain their course's facts, stub/template and folders;
// plan and final QA contain every course's facts; the blind solver is told the student's level;
// every agent that writes a shared log is told to use log_append.py and none is told to rewrite
// it; papers[].issues come from the QA fix when one ran; Date.now(), new Date() and
// Math.random() are never used; every phase used is listed in meta.phases. Node 18+, no packages.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const argv = process.argv.slice(2)
const opt = (name, dflt) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : dflt }
const here = path.dirname(fileURLToPath(import.meta.url))
const scriptPath = opt('--script', path.join(here, '..', 'workflow', 'daily-practice.js'))
const configPath = opt('--config')
if (!configPath) { console.error('usage: node dry_run.mjs --config <config.json> [--date D] [--mode M]'); process.exit(2) }
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
const date = opt('--date', '2026-01-15')
const mode = opt('--mode', 'daily')
const requests = opt('--requests')
const promptDir = opt('--prompts')
const asJson = argv.includes('--json')
const EFFORT = config.effort || 'xhigh'

// ------------------------------------------------------------------ guarded globals
class GuardDate extends Date {
  constructor(...a) { if (!a.length) throw new Error('new Date() without arguments is not allowed in a workflow'); super(...a) }
  static now() { throw new Error('Date.now() is not allowed in a workflow') }
}
const GuardMath = Object.create(Math)
GuardMath.random = () => { throw new Error('Math.random() is not allowed in a workflow') }

// ------------------------------------------------------------------ schema helpers
const problems = []
function checkSchema(s, where) {
  if (!s || s.type !== 'object' || typeof s.properties !== 'object') { problems.push(where + ': schema root must be {type: "object", properties}'); return }
  for (const k of s.required || []) if (!(k in s.properties)) problems.push(where + ': required key "' + k + '" missing from properties')
  for (const [k, v] of Object.entries(s.properties)) {
    if (v.type === 'object') checkSchema(v, where + '.' + k)
    if (v.type === 'array' && v.items && v.items.type === 'object') checkSchema(v.items, where + '.' + k + '[]')
  }
}
function fake(schema) {
  if (!schema) return 'stub text'
  switch (schema.type) {
    case 'object': { const o = {}; for (const [k, v] of Object.entries(schema.properties || {})) o[k] = fake(v); return o }
    case 'array': return schema.items ? [fake(schema.items)] : []
    case 'string': return schema.enum ? schema.enum[0] : 'stub'
    case 'number': return 1
    case 'boolean': return false
    default: return null
  }
}

// ------------------------------------------------------------------ stub agent
const courses = config.courses || []
const prev = (() => { const d = new Date(date + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10) })()
const calls = []
const phasesUsed = new Set()
let reviewSeen = false
function answer(label, schema) {
  const base = fake(schema)
  if (label === 'plan') {
    const specs = []
    courses.forEach((c, ci) => {
      const n = c.questions_per_day ?? 2
      for (let i = 1; i <= n; i++) {
        const marks = c.marks_per_question || 10
        specs.push({ id: (c.id_prefix || c.code[0]) + i, course: c.code, number: i, marks, minutes: Math.round(marks * (c.minutes_per_mark || 2)),
          kind: ci === 0 && i === n ? 'original' : 'variant', topic: 'dry-run topic ' + i, primary: 'dry-run primary original', secondary: 'dry-run secondary',
          retest_of: ci === 0 && i === 1 ? prev + '/' + (c.id_prefix || 'X') + '1' : '', scope: 'dry-run taught scope',
          request: i === 1 && requests ? requests : '' })
      }
    })
    const c0 = courses[0]
    const answered = [{ pdf: ((config.delivery || {}).answered_dir || '<answered>') + '/' + prev + ' answered.pdf', course: c0.code, date: prev,
      key: c0.folder + '/practice/.answer-keys/daily/' + prev + '.md', paper: c0.folder + '/practice/daily/' + prev + '/' + c0.code + '_Daily_' + prev + '.pdf' }]
    return { skip: mode === 'grade-only', reason: '', light_day: false, light_reason: '', specs: mode === 'grade-only' ? [] : specs, answered, notes: 'dry run' }
  }
  if (label.startsWith('review:')) {
    const first = !reviewSeen
    reviewSeen = true
    return Object.assign(base, first ? { verdict: 'fix', must_fix: ['dry-run must-fix item'] } : { verdict: 'pass', must_fix: [] })
  }
  if (label === 'final-qa') return Object.assign(base, { verdict: 'fix', must_fix: [{ course: courses[0].code, issue: 'dry-run layout issue' }] })
  if (label.startsWith('assemble:') || label.startsWith('qa-fix:')) {
    const code = label.split(':')[1]
    const c = courses.find(x => x.code === code)
    return Object.assign(base, { pdf_path: c.folder + '/practice/daily/' + date + '/' + code + '_Daily_' + date + '.pdf', tex_path: 'stub.tex', pages: 5,
      answer_key_path: c.folder + '/practice/.answer-keys/daily/' + date + '.md', checks_done: ['dry run'],
      issues_remaining: label.startsWith('assemble:') ? ['dry-run assembly issue'] : [] })
  }
  if (label.startsWith('grade:')) return Object.assign(base, { feedback_pdf: '<feedback>.pdf' })
  return base
}
async function agent(prompt, opts = {}) {
  const label = opts.label || '(no label)'
  calls.push({ label, phase: opts.phase || null, effort: opts.effort, prompt, hasSchema: !!opts.schema })
  if (opts.phase) phasesUsed.add(opts.phase)
  if (opts.schema) checkSchema(opts.schema, label)
  return answer(label, opts.schema)
}
async function parallel(thunks) { return Promise.all(thunks.map(t => Promise.resolve().then(t).catch(e => { problems.push('parallel thunk threw: ' + e.message); return null }))) }
async function pipeline(items, ...stages) {
  return Promise.all(items.map(async (item, i) => {
    let r = item
    try { for (const st of stages) r = await st(r, item, i); return r } catch (e) { problems.push('pipeline stage threw: ' + e.message); return null }
  }))
}
const logs = []
const log = m => logs.push(String(m))
const phase = t => phasesUsed.add(t)

// ------------------------------------------------------------------ run the script
const src = fs.readFileSync(scriptPath, 'utf8')
if (!/^export const meta\s*=/m.test(src)) problems.push('script does not start with export const meta')
const body = src.replace(/^export const meta\s*=/m, 'const meta =') + '\n'
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
const metaFn = new Function(src.slice(0, src.indexOf('\n}\n') + 3).replace(/^export const meta\s*=/m, 'return '))
const meta = metaFn()
const fn = new AsyncFunction('agent', 'parallel', 'pipeline', 'phase', 'log', 'args', 'budget', 'workflow', 'Date', 'Math', body)
const args = { date, config, mode }
if (requests) args.requests = requests
let result = null
try {
  result = await fn(agent, parallel, pipeline, phase, log, args, { total: null, spent: () => 0, remaining: () => Infinity }, async () => null, GuardDate, GuardMath)
} catch (e) {
  problems.push('script threw: ' + e.message)
}

// ------------------------------------------------------------------ checks
const metaPhases = new Set((meta.phases || []).map(p => p.title))
for (const p of phasesUsed) if (!metaPhases.has(p)) problems.push('phase "' + p + '" is not in meta.phases')
const courseOf = label => {
  const tail = label.split(':')[1] || ''
  const code = courses.find(c => tail.startsWith(c.code))
  if (code) return code
  const id = tail.split('#')[0]
  return courses.find(c => id.startsWith(c.id_prefix || c.code[0]))
}
const LEVEL = config.student_level || 'university student'
for (const c of calls) {
  if (c.effort !== EFFORT) problems.push(c.label + ': effort ' + c.effort + ', expected ' + EFFORT)
  if (/rewrite the file/i.test(c.prompt)) problems.push(c.label + ': tells the agent to rewrite a shared log')
  const head = c.label.split(':')[0]
  const unknownGrade = head === 'grade' && !courses.some(k => c.label.slice(6).startsWith(k.code + ' '))
  if (['grade', 'assemble', 'qa-fix'].includes(head) && !unknownGrade && !c.prompt.includes('log_append.py')) problems.push(c.label + ': writes a shared log without log_append.py')
  if (c.label.startsWith('blind:') && !c.prompt.includes('well-prepared ' + LEVEL)) problems.push(c.label + ': student level missing')
  if (!c.hasSchema) problems.push(c.label + ': no schema')
  for (const bad of ['undefined', 'NaN', '[object Object]']) if (c.prompt.includes(bad)) problems.push(c.label + ': prompt contains "' + bad + '"')
  if (/\\'/.test(c.prompt)) problems.push(c.label + ': prompt contains a stray \\\' (escaped quote inside String.raw)')
  const kind = c.label.split(':')[0]
  if (kind === 'plan' || kind === 'final-qa') {
    for (const k of courses) if (k.facts && !c.prompt.includes(k.facts)) problems.push(c.label + ': facts of ' + k.code + ' missing')
    if (kind === 'plan' && config.rules && !c.prompt.includes(config.rules)) problems.push('plan: rules path missing')
    continue
  }
  const k = courseOf(c.label)
  if (!k) { problems.push(c.label + ': cannot tell the course'); continue }
  if (!c.prompt.includes(k.code)) problems.push(c.label + ': course code missing')
  if (['draft', 'blind', 'review', 'fix'].includes(kind) && k.facts && !c.prompt.includes(k.facts)) problems.push(c.label + ': course facts missing')
  if (['draft', 'review', 'fix', 'assemble', 'qa-fix'].includes(kind) && k.stub && !c.prompt.includes(k.stub)) problems.push(c.label + ': stub path missing')
  if (['assemble', 'qa-fix'].includes(kind) && k.template && !c.prompt.includes(k.template)) problems.push(c.label + ': template path missing')
  if (['assemble', 'grade'].includes(kind) && !c.prompt.includes(k.folder)) problems.push(c.label + ': course folder missing')
  for (const other of courses) if (other !== k && other.facts && c.prompt.includes(other.facts)) problems.push(c.label + ': contains the facts of ' + other.code)
  if (k.solver === 'circuit' && ['draft', 'blind'].includes(kind) && !c.prompt.includes('mna.py')) problems.push(c.label + ': circuit course without mna.py')
  if (k.solver !== 'circuit' && kind === 'draft' && c.prompt.includes('mna.py <netlist')) problems.push(c.label + ': numeric course told to use mna.py')
}
if (result) {
  for (const p of result.papers || []) {
    const f = (result.qaFixes || []).find(x => x.course === p.course && x.pdf)
    const want = f ? f.issues : null
    if (want && JSON.stringify(p.issues) !== JSON.stringify(want)) problems.push('papers[' + p.course + '].issues ignore the QA fix')
    if (!f && !(p.issues || []).includes('dry-run assembly issue')) problems.push('papers[' + p.course + '].issues lost the assembly issues')
  }
}
if (promptDir) {
  fs.mkdirSync(promptDir, { recursive: true })
  calls.forEach((c, i) => fs.writeFileSync(path.join(promptDir, String(i + 1).padStart(2, '0') + '-' + c.label.replace(/[^A-Za-z0-9#._-]+/g, '_') + '.txt'), c.prompt))
}
const byPhase = {}
calls.forEach(c => { byPhase[c.phase || '-'] = (byPhase[c.phase || '-'] || 0) + 1 })
const summary = { script: scriptPath, mode, date, agent_calls: calls.length, by_phase: byPhase, efforts: [...new Set(calls.map(c => c.effort))],
  labels: calls.map(c => c.label), logs, problems, result }
if (asJson) console.log(JSON.stringify(summary, null, 1))
else {
  console.log(`dry run ${mode} ${date}: ${calls.length} agent calls, efforts ${summary.efforts.join(', ')}`)
  console.log('by phase: ' + Object.entries(byPhase).map(([k, v]) => k + ' ' + v).join(', '))
  console.log('labels: ' + summary.labels.join(', '))
  logs.forEach(l => console.log('log: ' + l))
  console.log(problems.length ? 'PROBLEMS:\n- ' + problems.join('\n- ') : 'all checks passed')
  if (result) console.log('result keys: ' + Object.keys(result).join(', ') + '; papers ' + (result.papers || []).length + '; grading ' + (result.grading || []).length)
}
process.exit(problems.length ? 1 : 0)
