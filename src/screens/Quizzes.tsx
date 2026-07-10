import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import type { Quiz, QuizQuestion } from '../types'

export default function QuizzesScreen() {
  const { toast, openModal, closeModal } = useApp()
  const [quizzes, setQuizzes] = useState<Quiz[]>([])
  const [selected, setSelected] = useState<Quiz | null>(null)
  const [questions, setQuestions] = useState<QuizQuestion[]>([])

  useEffect(() => { fetchQuizzes() }, [])

  async function fetchQuizzes() {
    const { data } = await supabase.from('quizzes').select('*').order('title')
    const list = data ?? []
    setQuizzes(list)
    if (list[0]) loadQuiz(list[0])
    else { setSelected(null); setQuestions([]) }
  }

  async function loadQuiz(quiz: Quiz) {
    setSelected(quiz)
    const { data } = await supabase.from('quiz_questions').select('*').eq('quiz_id', quiz.id).order('order_index')
    setQuestions(data ?? [])
  }

  async function deleteQuiz(quiz: Quiz) {
    if (!confirm(`Delete quiz "${quiz.title}" and all its questions?`)) return
    await supabase.from('quizzes').delete().eq('id', quiz.id)
    toast('Quiz deleted')
    fetchQuizzes()
  }

  async function deleteQuestion(q: QuizQuestion) {
    if (!confirm('Delete this question?')) return
    await supabase.from('quiz_questions').delete().eq('id', q.id)
    if (selected) loadQuiz(selected)
    toast('Question deleted')
  }

  const qTypeColor: Record<string, string> = { mcq: 'badge-blue', tf: 'badge-teal', multi: 'badge-amber', fill: 'badge-green', scenario: 'badge-purple' }

  function openCreateQuiz() {
    openModal({ title: 'Create Quiz', wide: true,
      body: <QuizForm onSave={async d => {
        const { data, error } = await supabase.from('quizzes').insert(d).select().maybeSingle()
        if (error || !data) { toast('Failed to create quiz'); return }
        fetchQuizzes()
        closeModal()
        toast('Quiz created')
      }} />
    })
  }

  function openEditQuiz(quiz: Quiz) {
    openModal({ title: 'Edit Quiz', wide: true,
      body: <QuizForm initial={quiz} onSave={async d => {
        await supabase.from('quizzes').update(d).eq('id', quiz.id)
        fetchQuizzes()
        closeModal()
        toast('Quiz updated')
      }} />
    })
  }

  function openAddQuestion() {
    if (!selected) return
    openModal({ title: 'Add Question', wide: true,
      body: <QuestionForm onSave={async d => {
        await supabase.from('quiz_questions').insert({ ...d, quiz_id: selected.id, order_index: questions.length + 1 })
        loadQuiz(selected); closeModal(); toast('Question added')
      }} />
    })
  }

  function openEditQuestion(q: QuizQuestion) {
    openModal({ title: 'Edit Question', wide: true,
      body: <QuestionForm initial={q} onSave={async d => {
        await supabase.from('quiz_questions').update(d).eq('id', q.id)
        if (selected) loadQuiz(selected); closeModal(); toast('Question updated')
      }} />
    })
  }

  return (
    <div className="screen-container">
      <div className="screen-header">
        <div>
          <h1 className="screen-title">Quiz Manager</h1>
          <p className="screen-subtitle">Manage assessments and question banks</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline" onClick={openAddQuestion} disabled={!selected}>+ Add Question</button>
          <button className="btn btn-primary" onClick={openCreateQuiz}>+ Create Quiz</button>
        </div>
      </div>

      <div className="quiz-layout">
        <div className="quiz-sidebar">
          <h4>Quizzes</h4>
          {quizzes.length === 0 ? (
            <div style={{ padding: '12px 8px', color: 'var(--muted)', fontSize: 13 }}>No quizzes yet.</div>
          ) : quizzes.map(q => (
            <div key={q.id} style={{ position: 'relative' }}>
              <button className={`quiz-list-item${selected?.id === q.id ? ' active' : ''}`} onClick={() => loadQuiz(q)} style={{ width: '100%', paddingRight: 60 }}>
                <div className="quiz-list-title">{q.title}</div>
                <div className="quiz-list-meta">Pass: {q.pass_score}% · {q.time_limit_min}min</div>
              </button>
              <div style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: 3 }}>
                <button className="btn btn-sm btn-outline" style={{ padding: '2px 6px', fontSize: 11 }} onClick={e => { e.stopPropagation(); openEditQuiz(q) }}>Edit</button>
                <button className="btn btn-sm btn-danger" style={{ padding: '2px 6px', fontSize: 11 }} onClick={e => { e.stopPropagation(); deleteQuiz(q) }}>Del</button>
              </div>
            </div>
          ))}
        </div>

        <div className="quiz-content">
          {!selected ? (
            <div className="empty-state">Create a quiz to get started.</div>
          ) : (
            <>
              <div className="quiz-info-bar">
                <div className="quiz-stat"><span className="quiz-stat-label">Pass Score</span><span className="quiz-stat-value">{selected.pass_score}%</span></div>
                <div className="quiz-stat"><span className="quiz-stat-label">Time Limit</span><span className="quiz-stat-value">{selected.time_limit_min} min</span></div>
                <div className="quiz-stat"><span className="quiz-stat-label">Max Attempts</span><span className="quiz-stat-value">{selected.max_attempts}</span></div>
                <div className="quiz-stat"><span className="quiz-stat-label">Questions</span><span className="quiz-stat-value">{questions.length}</span></div>
              </div>

              <div className="questions-list">
                {questions.length === 0 ? (
                  <div className="empty-state">No questions yet. Click "+ Add Question" to add one.</div>
                ) : questions.map((q, i) => (
                  <div key={q.id} className="question-card">
                    <div className="question-header">
                      <span className="question-num">Q{i + 1}</span>
                      <span className={`badge ${qTypeColor[q.type] ?? 'badge-gray'}`}>{q.type.toUpperCase()}</span>
                      <span className="badge badge-gray">{q.difficulty}</span>
                      <span className="question-pts">{q.points} pts</span>
                      <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                        <button className="btn btn-sm btn-outline" onClick={() => openEditQuestion(q)}>Edit</button>
                        <button className="btn btn-sm btn-danger" onClick={() => deleteQuestion(q)}>Delete</button>
                      </div>
                    </div>
                    <p className="question-text">{q.question}</p>
                    {q.options?.length > 0 && (
                      <div className="question-options">
                        {q.options.map((opt, oi) => (
                          <div key={oi} className={`question-option${Array.isArray(q.correct_answer) ? (q.correct_answer as number[]).includes(oi) : q.correct_answer === oi ? ' correct' : ''}`}>
                            <span className="option-letter">{String.fromCharCode(65 + oi)}</span> {opt}
                          </div>
                        ))}
                      </div>
                    )}
                    {q.explanation && <div className="question-explanation"><strong>Explanation:</strong> {q.explanation}</div>}
                  </div>
                ))}
              </div>

              <div className="card" style={{ marginTop: 24 }}>
                <div className="card-header"><h3>Recent Attempts</h3></div>
                <div className="table-wrap">
                  <table className="data-table">
                    <thead><tr><th>Nurse</th><th>Attempt</th><th>Score</th><th>Pass</th><th>Date</th></tr></thead>
                    <tbody>
                      <tr><td colSpan={5} className="table-loading">No attempts recorded yet</td></tr>
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

function QuizForm({ initial, onSave }: { initial?: Partial<Quiz>; onSave: (d: Partial<Quiz>) => void }) {
  const [courses, setCourses] = useState<{ id: string; title: string; code: string }[]>([])
  const [form, setForm] = useState({
    title: initial?.title ?? '',
    course_id: initial?.course_id ?? '',
    description: initial?.description ?? '',
    pass_score: initial?.pass_score ?? 80,
    time_limit_min: initial?.time_limit_min ?? 30,
    max_attempts: initial?.max_attempts ?? 3,
    randomize_questions: initial?.randomize_questions ?? true,
    randomize_answers: initial?.randomize_answers ?? true,
    result_display_mode: initial?.result_display_mode ?? 'Full answer review',
    feedback_timing: initial?.feedback_timing ?? 'After quiz completion',
    certificate_eligible: initial?.certificate_eligible ?? false,
    mandatory: initial?.mandatory ?? true,
  })
  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    supabase.from('courses').select('id, title, code').order('title').then(({ data }) => setCourses(data ?? []))
  }, [])

  return (
    <form className="modal-form" onSubmit={e => { e.preventDefault(); onSave(form) }}>
      <div className="form-group"><label>Quiz Title</label><input value={form.title} onChange={e => set('title', e.target.value)} required /></div>
      <div className="form-group"><label>Link to Course (optional)</label>
        <select value={form.course_id} onChange={e => set('course_id', e.target.value || '')}>
          <option value="">— No course —</option>
          {courses.map(c => <option key={c.id} value={c.id}>{c.title} ({c.code})</option>)}
        </select>
      </div>
      <div className="form-group"><label>Description</label><textarea rows={2} value={form.description} onChange={e => set('description', e.target.value)} /></div>
      <div className="form-row">
        <div className="form-group"><label>Pass Score (%)</label><input type="number" min={0} max={100} value={form.pass_score} onChange={e => set('pass_score', parseInt(e.target.value))} /></div>
        <div className="form-group"><label>Time Limit (min)</label><input type="number" min={1} value={form.time_limit_min} onChange={e => set('time_limit_min', parseInt(e.target.value))} /></div>
        <div className="form-group"><label>Max Attempts</label><input type="number" min={1} value={form.max_attempts} onChange={e => set('max_attempts', parseInt(e.target.value))} /></div>
      </div>
      <div className="form-row">
        <div className="form-group"><label>Result Display</label>
          <select value={form.result_display_mode} onChange={e => set('result_display_mode', e.target.value)}>
            <option>Full answer review</option><option>Score only</option><option>Pass/Fail only</option>
          </select>
        </div>
        <div className="form-group"><label>Feedback Timing</label>
          <select value={form.feedback_timing} onChange={e => set('feedback_timing', e.target.value)}>
            <option>After quiz completion</option><option>After each question</option><option>Never</option>
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
      <div className="modal-form-actions"><button type="submit" className="btn btn-primary">{initial ? 'Save' : 'Create Quiz'}</button></div>
    </form>
  )
}

function QuestionForm({ initial, onSave }: { initial?: Partial<QuizQuestion>; onSave: (d: Partial<QuizQuestion>) => void }) {
  const [form, setForm] = useState({
    type: initial?.type ?? 'mcq',
    question: initial?.question ?? '',
    options: (initial?.options as string[]) ?? ['','','',''],
    correct_answer: initial?.correct_answer ?? 0,
    explanation: initial?.explanation ?? '',
    points: initial?.points ?? 1,
    difficulty: initial?.difficulty ?? 'Medium',
  })
  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }))
  return (
    <form className="modal-form" onSubmit={e => { e.preventDefault(); onSave({ ...form, accept_values: [] }) }}>
      <div className="form-row">
        <div className="form-group"><label>Type</label>
          <select value={form.type} onChange={e => set('type', e.target.value)}>
            <option value="mcq">Multiple Choice</option><option value="tf">True/False</option>
            <option value="multi">Multi-Select</option><option value="fill">Fill in Blank</option>
          </select>
        </div>
        <div className="form-group"><label>Difficulty</label>
          <select value={form.difficulty} onChange={e => set('difficulty', e.target.value)}>
            <option>Easy</option><option>Medium</option><option>Hard</option>
          </select>
        </div>
        <div className="form-group"><label>Points</label><input type="number" value={form.points} onChange={e => set('points', parseInt(e.target.value))} min={1} /></div>
      </div>
      <div className="form-group"><label>Question</label><textarea rows={3} value={form.question} onChange={e => set('question', e.target.value)} required /></div>
      {form.type !== 'fill' && (
        <div className="form-group">
          <label>Options (select correct answer)</label>
          {form.options.map((opt, i) => (
            <div key={i} className="option-input-row">
              <input type="radio" name="correct" checked={form.correct_answer === i} onChange={() => set('correct_answer', i)} />
              <input value={opt} onChange={e => { const opts = [...form.options]; opts[i] = e.target.value; set('options', opts) }} placeholder={`Option ${String.fromCharCode(65+i)}`} />
            </div>
          ))}
        </div>
      )}
      <div className="form-group"><label>Explanation</label><textarea rows={2} value={form.explanation} onChange={e => set('explanation', e.target.value)} /></div>
      <div className="modal-form-actions"><button type="submit" className="btn btn-primary">{initial ? 'Save' : 'Add Question'}</button></div>
    </form>
  )
}
