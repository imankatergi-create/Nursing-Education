import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import { QUIZ, ATTEMPTS } from '../data/constants'
import type { Quiz, QuizQuestion } from '../types'

export default function QuizzesScreen() {
  const { toast, openModal, closeModal } = useApp()
  const [quizzes, setQuizzes] = useState<Quiz[]>([])
  const [selected, setSelected] = useState<Quiz | null>(null)
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [listLoading, setListLoading] = useState(true)

  useEffect(() => { fetchQuizzes() }, [])

  async function fetchQuizzes() {
    setListLoading(true)
    const { data } = await supabase.from('quizzes').select('*').order('title')
    const list = (data && data.length > 0)
      ? data as Quiz[]
      : [{ id: QUIZ.id, title: QUIZ.title, course_id: QUIZ.course_id, description: QUIZ.description, pass_score: QUIZ.pass_score, time_limit_min: QUIZ.time_limit_min, max_attempts: QUIZ.max_attempts, randomize_questions: QUIZ.randomize_questions, randomize_answers: QUIZ.randomize_answers, result_display_mode: QUIZ.result_display_mode, feedback_timing: QUIZ.feedback_timing, certificate_eligible: QUIZ.certificate_eligible, mandatory: QUIZ.mandatory }] as Quiz[]
    setQuizzes(list)
    setListLoading(false)
    if (!selected) loadQuiz(list[0])
  }

  async function loadQuiz(quiz: Quiz) {
    setSelected(quiz)
    const { data } = await supabase.from('quiz_questions').select('*').eq('quiz_id', quiz.id).order('order_index')
    if (data && data.length > 0) setQuestions(data)
    else setQuestions(QUIZ.questions ?? [])
  }

  function openCreateQuiz() {
    openModal({
      title: 'Create Quiz', wide: true,
      body: (
        <QuizForm
          onSave={async d => {
            const { data, error } = await supabase.from('quizzes').insert(d).select().single()
            if (error || !data) { toast('Failed to create quiz'); return }
            await fetchQuizzes()
            loadQuiz(data as Quiz)
            closeModal()
            toast('Quiz created — now add questions')
          }}
        />
      ),
    })
  }

  function openEditQuiz(quiz: Quiz) {
    openModal({
      title: 'Edit Quiz', wide: true,
      body: (
        <QuizForm
          initial={quiz}
          onSave={async d => {
            await supabase.from('quizzes').update(d).eq('id', quiz.id)
            setSelected(q => q?.id === quiz.id ? { ...q, ...d } : q)
            setQuizzes(list => list.map(q => q.id === quiz.id ? { ...q, ...d } : q))
            closeModal()
            toast('Quiz updated')
          }}
        />
      ),
    })
  }

  async function deleteQuiz(quiz: Quiz) {
    if (!confirm(`Delete quiz "${quiz.title}" and all its questions?`)) return
    await supabase.from('quiz_questions').delete().eq('quiz_id', quiz.id)
    await supabase.from('quizzes').delete().eq('id', quiz.id)
    const remaining = quizzes.filter(q => q.id !== quiz.id)
    setQuizzes(remaining)
    if (remaining.length > 0) loadQuiz(remaining[0])
    else { setSelected(null); setQuestions([]) }
    toast('Quiz deleted')
  }

  function openAddQuestion() {
    if (!selected) return
    openModal({
      title: 'Add Question', wide: true,
      body: (
        <QuestionForm
          onSave={async d => {
            await supabase.from('quiz_questions').insert({ ...d, quiz_id: selected.id, order_index: questions.length + 1 })
            loadQuiz(selected); closeModal(); toast('Question added')
          }}
        />
      ),
    })
  }

  function openEditQuestion(q: QuizQuestion) {
    if (!selected) return
    openModal({
      title: 'Edit Question', wide: true,
      body: (
        <QuestionForm
          initial={q}
          onSave={async d => {
            await supabase.from('quiz_questions').update(d).eq('id', q.id)
            loadQuiz(selected); closeModal(); toast('Question updated')
          }}
        />
      ),
    })
  }

  async function deleteQuestion(q: QuizQuestion) {
    if (!selected) return
    if (!confirm('Delete this question?')) return
    await supabase.from('quiz_questions').delete().eq('id', q.id)
    loadQuiz(selected)
    toast('Question deleted')
  }

  const qTypeColor: Record<string, string> = { mcq: 'badge-blue', tf: 'badge-teal', multi: 'badge-amber', fill: 'badge-green', scenario: 'badge-purple' }

  return (
    <div className="screen-container">
      <div className="screen-header">
        <div>
          <h1 className="screen-title">Quiz Manager</h1>
          <p className="screen-subtitle">Manage assessments and question banks</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {selected && (
            <button className="btn btn-outline" onClick={openAddQuestion}>+ Add Question</button>
          )}
          <button className="btn btn-primary" onClick={openCreateQuiz}>+ Create Quiz</button>
        </div>
      </div>

      <div className="quiz-layout">
        {/* ── Sidebar: quiz list ── */}
        <div className="quiz-sidebar">
          <div className="quiz-sidebar-header">
            <h4>Quizzes</h4>
            <span className="tab-count" style={{ fontSize: 11 }}>{quizzes.length}</span>
          </div>
          {listLoading ? (
            <div className="loading-state" style={{ padding: 12 }}>Loading…</div>
          ) : quizzes.length === 0 ? (
            <div className="empty-state" style={{ padding: 12, fontSize: 13 }}>
              No quizzes yet.<br />Click <strong>+ Create Quiz</strong> to start.
            </div>
          ) : quizzes.map(q => (
            <button
              key={q.id}
              className={`quiz-list-item${selected?.id === q.id ? ' active' : ''}`}
              onClick={() => loadQuiz(q)}
            >
              <div className="quiz-list-title">{q.title}</div>
              <div className="quiz-list-meta">Pass: {q.pass_score}% · {q.time_limit_min} min</div>
            </button>
          ))}
        </div>

        {/* ── Main content ── */}
        <div className="quiz-content">
          {!selected ? (
            <div className="empty-state" style={{ marginTop: 60 }}>
              Select a quiz from the list or create a new one.
            </div>
          ) : (
            <>
              <div className="quiz-title-row">
                <div>
                  <h2 style={{ margin: 0, fontSize: 18 }}>{selected.title}</h2>
                  {selected.description && <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--muted)' }}>{selected.description}</p>}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-sm btn-outline" onClick={() => openEditQuiz(selected)}>Edit Quiz</button>
                  <button className="btn btn-sm btn-danger" onClick={() => deleteQuiz(selected)}>Delete</button>
                  <button className="btn btn-sm btn-primary" onClick={openAddQuestion}>+ Question</button>
                </div>
              </div>

              <div className="quiz-info-bar">
                <div className="quiz-stat"><span className="quiz-stat-label">Pass Score</span><span className="quiz-stat-value">{selected.pass_score}%</span></div>
                <div className="quiz-stat"><span className="quiz-stat-label">Time Limit</span><span className="quiz-stat-value">{selected.time_limit_min} min</span></div>
                <div className="quiz-stat"><span className="quiz-stat-label">Max Attempts</span><span className="quiz-stat-value">{selected.max_attempts}</span></div>
                <div className="quiz-stat"><span className="quiz-stat-label">Questions</span><span className="quiz-stat-value">{questions.length}</span></div>
                {selected.randomize_questions && <div className="quiz-stat"><span className="quiz-stat-label">Shuffle</span><span className="quiz-stat-value badge badge-teal">On</span></div>}
                {selected.certificate_eligible && <div className="quiz-stat"><span className="quiz-stat-label">Certificate</span><span className="quiz-stat-value badge badge-green">Yes</span></div>}
              </div>

              {questions.length === 0 ? (
                <div className="empty-state" style={{ margin: '20px 0' }}>
                  No questions yet. Click <strong>+ Question</strong> to add your first question.
                </div>
              ) : (
                <div className="questions-list">
                  {questions.map((q, i) => (
                    <div key={q.id} className="question-card">
                      <div className="question-header">
                        <span className="question-num">Q{i + 1}</span>
                        <span className={`badge ${qTypeColor[q.type] ?? 'badge-gray'}`}>{q.type.toUpperCase()}</span>
                        <span className="badge badge-gray">{q.difficulty}</span>
                        <span className="question-pts">{q.points} pt{q.points !== 1 ? 's' : ''}</span>
                        <div className="question-actions">
                          <button className="btn btn-sm btn-outline" onClick={() => openEditQuestion(q)}>Edit</button>
                          <button className="btn btn-sm btn-danger" onClick={() => deleteQuestion(q)}>Delete</button>
                        </div>
                      </div>
                      <p className="question-text">{q.question}</p>
                      {q.options?.length > 0 && (
                        <div className="question-options">
                          {q.options.map((opt, oi) => (
                            <div
                              key={oi}
                              className={`question-option${Array.isArray(q.correct_answer) ? (q.correct_answer as number[]).includes(oi) ? ' correct' : '' : q.correct_answer === oi ? ' correct' : ''}`}
                            >
                              <span className="option-letter">{String.fromCharCode(65 + oi)}</span> {opt}
                            </div>
                          ))}
                        </div>
                      )}
                      {q.explanation && <div className="question-explanation"><strong>Explanation:</strong> {q.explanation}</div>}
                    </div>
                  ))}
                </div>
              )}

              <div className="card" style={{ marginTop: 24 }}>
                <div className="card-header"><h3>Recent Attempts</h3></div>
                <div className="table-wrap">
                  <table className="data-table">
                    <thead><tr><th>Nurse</th><th>Attempt</th><th>Score</th><th>Pass</th><th>Time</th><th>Date</th></tr></thead>
                    <tbody>
                      {ATTEMPTS.slice(0, 5).map((a, i) => (
                        <tr key={i}>
                          <td>{a.nurse}</td><td>#{a.att}</td>
                          <td><span className={a.pass ? 'text-green' : 'text-red'}>{a.pct}%</span></td>
                          <td>{a.pass ? <span className="badge badge-green">Pass</span> : <span className="badge badge-red">Fail</span>}</td>
                          <td>{a.time}</td><td>{a.start}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── QuizForm ─────────────────────────────────────────────────────────────────

function QuizForm({ initial, onSave }: { initial?: Partial<Quiz>; onSave: (d: Partial<Quiz>) => void }) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    pass_score: 80,
    time_limit_min: 15,
    max_attempts: 3,
    randomize_questions: false,
    randomize_answers: false,
    result_display_mode: 'After submission',
    feedback_timing: 'After submission',
    certificate_eligible: false,
    mandatory: false,
    ...initial,
  })
  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }))

  return (
    <form className="modal-form" onSubmit={e => { e.preventDefault(); onSave(form) }}>
      <div className="form-group">
        <label>Quiz Title</label>
        <input value={form.title} onChange={e => set('title', e.target.value)} required placeholder="e.g. Infection Control Assessment" />
      </div>
      <div className="form-group">
        <label>Description (optional)</label>
        <textarea rows={2} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Brief description of the quiz" />
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>Pass Score (%)</label>
          <input type="number" value={form.pass_score} onChange={e => set('pass_score', parseInt(e.target.value))} min={1} max={100} required />
          <span className="form-hint">Minimum score to pass</span>
        </div>
        <div className="form-group">
          <label>Time Limit (min)</label>
          <input type="number" value={form.time_limit_min} onChange={e => set('time_limit_min', parseInt(e.target.value))} min={1} required />
        </div>
        <div className="form-group">
          <label>Max Attempts</label>
          <input type="number" value={form.max_attempts} onChange={e => set('max_attempts', parseInt(e.target.value))} min={1} max={99} />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>Result Display</label>
          <select value={form.result_display_mode} onChange={e => set('result_display_mode', e.target.value)}>
            <option>After submission</option>
            <option>Immediately</option>
            <option>After deadline</option>
          </select>
        </div>
        <div className="form-group">
          <label>Feedback Timing</label>
          <select value={form.feedback_timing} onChange={e => set('feedback_timing', e.target.value)}>
            <option>After submission</option>
            <option>Immediately</option>
            <option>Never</option>
          </select>
        </div>
      </div>
      <div className="form-row">
        <div className="form-group checkbox-group" style={{ alignSelf: 'flex-end' }}>
          <label><input type="checkbox" checked={form.randomize_questions} onChange={e => set('randomize_questions', e.target.checked)} /> Randomize Questions</label>
          <label><input type="checkbox" checked={form.randomize_answers} onChange={e => set('randomize_answers', e.target.checked)} /> Randomize Answers</label>
          <label><input type="checkbox" checked={form.certificate_eligible} onChange={e => set('certificate_eligible', e.target.checked)} /> Certificate Eligible</label>
          <label><input type="checkbox" checked={form.mandatory} onChange={e => set('mandatory', e.target.checked)} /> Mandatory</label>
        </div>
      </div>
      <div className="modal-form-actions">
        <button type="submit" className="btn btn-primary">{initial ? 'Save Changes' : 'Create Quiz'}</button>
      </div>
    </form>
  )
}

// ── QuestionForm ──────────────────────────────────────────────────────────────

function QuestionForm({ initial, onSave }: { initial?: Partial<QuizQuestion>; onSave: (d: Partial<QuizQuestion>) => void }) {
  const [form, setForm] = useState(() => {
    const base = { type: 'mcq', question: '', options: ['', '', '', ''] as string[], correct_answer: 0 as number | number[] | string, explanation: '', points: 1, difficulty: 'Medium' }
    if (!initial) return base
    return { ...base, ...initial, options: initial.options?.length ? [...initial.options] : base.options }
  })
  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }))

  return (
    <form className="modal-form" onSubmit={e => { e.preventDefault(); onSave({ ...form, accept_values: [] }) }}>
      <div className="form-row">
        <div className="form-group">
          <label>Type</label>
          <select value={form.type} onChange={e => set('type', e.target.value)}>
            <option value="mcq">Multiple Choice</option>
            <option value="tf">True / False</option>
            <option value="multi">Multi-Select</option>
            <option value="fill">Fill in Blank</option>
          </select>
        </div>
        <div className="form-group">
          <label>Difficulty</label>
          <select value={form.difficulty} onChange={e => set('difficulty', e.target.value)}>
            <option>Easy</option><option>Medium</option><option>Hard</option>
          </select>
        </div>
        <div className="form-group">
          <label>Points</label>
          <input type="number" value={form.points} onChange={e => set('points', parseInt(e.target.value))} min={1} />
        </div>
      </div>
      <div className="form-group">
        <label>Question</label>
        <textarea rows={3} value={form.question} onChange={e => set('question', e.target.value)} required placeholder="Enter the question text…" />
      </div>
      {form.type !== 'fill' && (
        <div className="form-group">
          <label>Options — click the radio button to mark the correct answer</label>
          {form.options.map((opt, i) => (
            <div key={i} className="option-input-row">
              <input
                type="radio"
                name="correct"
                checked={form.correct_answer === i}
                onChange={() => set('correct_answer', i)}
              />
              <span className="option-letter">{String.fromCharCode(65 + i)}</span>
              <input
                value={opt}
                onChange={e => { const opts = [...form.options]; opts[i] = e.target.value; set('options', opts) }}
                placeholder={`Option ${String.fromCharCode(65 + i)}`}
              />
            </div>
          ))}
        </div>
      )}
      {form.type === 'fill' && (
        <div className="form-group">
          <label>Correct Answer</label>
          <input value={form.correct_answer as string} onChange={e => set('correct_answer', e.target.value)} placeholder="Expected answer text" />
        </div>
      )}
      <div className="form-group">
        <label>Explanation (shown after submission)</label>
        <textarea rows={2} value={form.explanation} onChange={e => set('explanation', e.target.value)} placeholder="Why is this the correct answer?" />
      </div>
      <div className="modal-form-actions">
        <button type="submit" className="btn btn-primary">{initial ? 'Save Changes' : 'Add Question'}</button>
      </div>
    </form>
  )
}
