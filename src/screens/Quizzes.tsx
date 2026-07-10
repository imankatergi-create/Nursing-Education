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

  useEffect(() => {
    ;(async () => {
      const { data } = await supabase.from('quizzes').select('*').order('title')
      const list = (data && data.length > 0) ? data : [{ id: QUIZ.id, title: QUIZ.title, course_id: QUIZ.course_id, description: QUIZ.description, pass_score: QUIZ.pass_score, time_limit_min: QUIZ.time_limit_min, max_attempts: QUIZ.max_attempts, randomize_questions: QUIZ.randomize_questions, randomize_answers: QUIZ.randomize_answers, result_display_mode: QUIZ.result_display_mode, feedback_timing: QUIZ.feedback_timing, certificate_eligible: QUIZ.certificate_eligible, mandatory: QUIZ.mandatory }] as Quiz[]
      setQuizzes(list)
      loadQuiz(list[0])
    })()
  }, [])

  async function loadQuiz(quiz: Quiz) {
    setSelected(quiz)
    const { data } = await supabase.from('quiz_questions').select('*').eq('quiz_id', quiz.id).order('order_index')
    if (data && data.length > 0) setQuestions(data)
    else setQuestions(QUIZ.questions ?? [])
  }

  const qTypeColor: Record<string, string> = { mcq: 'badge-blue', tf: 'badge-teal', multi: 'badge-amber', fill: 'badge-green', scenario: 'badge-purple' }

  function openAddQuestion() {
    if (!selected) return
    openModal({ title: 'Add Question', wide: true,
      body: <QuestionForm onSave={async d => {
        await supabase.from('quiz_questions').insert({ ...d, quiz_id: selected.id, order_index: questions.length + 1 })
        loadQuiz(selected); closeModal(); toast('Question added')
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
        <button className="btn btn-primary" onClick={openAddQuestion} disabled={!selected}>+ Add Question</button>
      </div>

      <div className="quiz-layout">
        <div className="quiz-sidebar">
          <h4>Quizzes</h4>
          {quizzes.map(q => (
            <button key={q.id} className={`quiz-list-item${selected?.id === q.id ? ' active' : ''}`} onClick={() => loadQuiz(q)}>
              <div className="quiz-list-title">{q.title}</div>
              <div className="quiz-list-meta">Pass: {q.pass_score}% · {q.time_limit_min}min</div>
            </button>
          ))}
        </div>

        <div className="quiz-content">
          {selected && (
            <>
              <div className="quiz-info-bar">
                <div className="quiz-stat"><span className="quiz-stat-label">Pass Score</span><span className="quiz-stat-value">{selected.pass_score}%</span></div>
                <div className="quiz-stat"><span className="quiz-stat-label">Time Limit</span><span className="quiz-stat-value">{selected.time_limit_min} min</span></div>
                <div className="quiz-stat"><span className="quiz-stat-label">Max Attempts</span><span className="quiz-stat-value">{selected.max_attempts}</span></div>
                <div className="quiz-stat"><span className="quiz-stat-label">Questions</span><span className="quiz-stat-value">{questions.length}</span></div>
              </div>

              <div className="questions-list">
                {questions.map((q, i) => (
                  <div key={q.id} className="question-card">
                    <div className="question-header">
                      <span className="question-num">Q{i + 1}</span>
                      <span className={`badge ${qTypeColor[q.type] ?? 'badge-gray'}`}>{q.type.toUpperCase()}</span>
                      <span className="badge badge-gray">{q.difficulty}</span>
                      <span className="question-pts">{q.points} pts</span>
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
                    <thead><tr><th>Nurse</th><th>Attempt</th><th>Score</th><th>Pass</th><th>Time</th><th>Date</th></tr></thead>
                    <tbody>
                      {ATTEMPTS.slice(0,5).map((a, i) => (
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

function QuestionForm({ onSave }: { onSave: (d: Partial<QuizQuestion>) => void }) {
  const [form, setForm] = useState({ type: 'mcq', question: '', options: ['','','',''], correct_answer: 0, explanation: '', points: 1, difficulty: 'Medium' })
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
      <div className="modal-form-actions"><button type="submit" className="btn btn-primary">Add Question</button></div>
    </form>
  )
}
