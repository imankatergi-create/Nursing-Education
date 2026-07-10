import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import { MATERIALS } from '../data/constants'
import type { Material, Quiz } from '../types'

// Fields shown per material type
const VIDEO_TYPES = ['Video', 'Audio']
const DOC_TYPES = ['PDF', 'PPT', 'Checklist', 'Protocol', 'Image']
const LINK_TYPES = ['Link/URL']

const TYPE_ICON: Record<string, string> = {
  PDF: '📄', Video: '🎬', PPT: '📊', Checklist: '✅', Protocol: '📋',
  'Link/URL': '🔗', Image: '🖼️', Audio: '🎵', Evaluation: '📝',
}
const TYPE_COLOR: Record<string, string> = {
  PDF: 'badge-red', Video: 'badge-blue', PPT: 'badge-amber', Checklist: 'badge-green',
  Protocol: 'badge-teal', 'Link/URL': 'badge-gray', Image: 'badge-purple',
  Audio: 'badge-blue', Evaluation: 'badge-purple',
}

export default function MaterialsScreen() {
  const { toast, openModal, closeModal } = useApp()
  const [materials, setMaterials] = useState<Material[]>([])
  const [quizzes, setQuizzes] = useState<Quiz[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [tab, setTab] = useState<'materials' | 'quizzes'>('materials')

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: mats }, { data: qzs }] = await Promise.all([
      supabase.from('materials').select('*').order('title'),
      supabase.from('quizzes').select('*').order('title'),
    ])
    setMaterials(mats && mats.length > 0 ? mats : MATERIALS)
    setQuizzes((qzs ?? []) as Quiz[])
    setLoading(false)
  }

  const types = ['all', ...Array.from(new Set(materials.map(m => m.type)))]
  const filteredMats = materials.filter(m => {
    const q = search.toLowerCase()
    return (!q || m.title.toLowerCase().includes(q)) && (typeFilter === 'all' || m.type === typeFilter)
  })
  const filteredQuizzes = quizzes.filter(q =>
    !search || q.title.toLowerCase().includes(search.toLowerCase())
  )

  function openAdd() {
    openModal({
      title: 'Upload Material', wide: true,
      body: <MaterialForm onSave={async d => { await supabase.from('materials').insert(d); fetchAll(); closeModal(); toast('Material uploaded') }} />,
    })
  }

  function openEdit(m: Material) {
    openModal({
      title: 'Edit Material', wide: true,
      body: <MaterialForm initial={m} onSave={async d => { await supabase.from('materials').update(d).eq('id', m.id); fetchAll(); closeModal(); toast('Material updated') }} />,
    })
  }

  async function deleteMaterial(m: Material) {
    if (!confirm(`Delete material "${m.title}"?`)) return
    if (m.file_url) {
      const path = m.file_url.split('/course-materials/')[1]
      if (path) await supabase.storage.from('course-materials').remove([path])
    }
    await supabase.from('materials').delete().eq('id', m.id)
    fetchAll()
    toast('Material deleted')
  }

  return (
    <div className="screen-container">
      <div className="screen-header">
        <div>
          <h1 className="screen-title">Materials Library</h1>
          <p className="screen-subtitle">{materials.length} materials · {quizzes.length} quizzes</p>
        </div>
        {tab === 'materials' && (
          <button className="btn btn-primary" onClick={openAdd}>+ Upload Material</button>
        )}
      </div>

      {/* Tab bar */}
      <div className="tab-row">
        <button className={`tab-btn${tab === 'materials' ? ' active' : ''}`} onClick={() => setTab('materials')}>
          Materials <span className="tab-count">{materials.length}</span>
        </button>
        <button className={`tab-btn${tab === 'quizzes' ? ' active' : ''}`} onClick={() => setTab('quizzes')}>
          Quizzes <span className="tab-count">{quizzes.length}</span>
        </button>
      </div>

      <div className="table-toolbar">
        <input
          className="search-input"
          placeholder={tab === 'materials' ? 'Search materials…' : 'Search quizzes…'}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {tab === 'materials' && (
          <div className="filter-chips">
            {types.map(t => (
              <button key={t} className={`chip${typeFilter === t ? ' active' : ''}`} onClick={() => setTypeFilter(t)}>
                {t === 'all' ? 'All Types' : t}
              </button>
            ))}
          </div>
        )}
      </div>

      {tab === 'materials' ? (
        <div className="card">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Material</th><th>Type</th><th>Duration</th><th>Completion Rule</th>
                  <th>Version</th><th>Views</th><th>Completion</th><th>Mandatory</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={9} className="table-loading">Loading…</td></tr>
                ) : filteredMats.length === 0 ? (
                  <tr><td colSpan={9} className="table-loading">No materials found</td></tr>
                ) : filteredMats.map(m => (
                  <tr key={m.id}>
                    <td>
                      <div className="material-cell">
                        <span className="material-icon">{TYPE_ICON[m.type] ?? '📎'}</span>
                        <div>
                          <div className="material-title">{m.title}</div>
                          <div className="material-size">{m.size_text}</div>
                          {m.description && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{m.description}</div>}
                        </div>
                      </div>
                    </td>
                    <td><span className={`badge ${TYPE_COLOR[m.type] ?? 'badge-gray'}`}>{m.type}</span></td>
                    <td>{m.duration_text || <span style={{ color: 'var(--muted)' }}>—</span>}</td>
                    <td>
                      {VIDEO_TYPES.includes(m.type) && m.watch_pct_required != null
                        ? <span className="badge badge-blue">Watch {m.watch_pct_required}%</span>
                        : m.requires_acknowledgment
                          ? <span className="badge badge-teal">Acknowledge</span>
                          : <span style={{ color: 'var(--muted)', fontSize: 12 }}>{m.tracking_rule || '—'}</span>
                      }
                    </td>
                    <td>{m.latest_version}</td>
                    <td>{m.views}</td>
                    <td>
                      <div className="progress-cell">
                        <div className="bar-track sm"><div className="bar-fill" style={{ width: `${m.completion_pct}%` }} /></div>
                        <span>{m.completion_pct}%</span>
                      </div>
                    </td>
                    <td>{m.mandatory ? <span className="badge badge-red">Yes</span> : <span className="badge badge-gray">No</span>}</td>
                    <td>
                      <div className="action-btns">
                        {m.file_url
                          ? <a href={m.file_url} target="_blank" rel="noreferrer" className="btn btn-sm">Preview</a>
                          : <button className="btn btn-sm" disabled>Preview</button>}
                        <button className="btn btn-sm btn-outline" onClick={() => openEdit(m)}>Edit</button>
                        <button className="btn btn-sm btn-danger" onClick={() => deleteMaterial(m)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Quizzes tab */
        <div className="card">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Quiz Title</th><th>Description</th><th>Pass Score</th>
                  <th>Time Limit</th><th>Max Attempts</th><th>Certificate</th><th>Mandatory</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="table-loading">Loading…</td></tr>
                ) : filteredQuizzes.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="table-loading">
                      {search ? 'No quizzes found.' : 'No quizzes yet — create one in the Quiz Manager.'}
                    </td>
                  </tr>
                ) : filteredQuizzes.map(q => (
                  <tr key={q.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 18 }}>❓</span>
                        <div>
                          <div style={{ fontWeight: 500, fontSize: 13 }}>{q.title}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, color: 'var(--muted)' }}>
                      {q.description || '—'}
                    </td>
                    <td><span className="badge badge-amber">{q.pass_score}%</span></td>
                    <td>{q.time_limit_min} min</td>
                    <td>{q.max_attempts}</td>
                    <td>{q.certificate_eligible ? <span className="badge badge-green">Yes</span> : <span className="badge badge-gray">No</span>}</td>
                    <td>{q.mandatory ? <span className="badge badge-red">Yes</span> : <span className="badge badge-gray">No</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ── MaterialForm ──────────────────────────────────────────────────────────────

function MaterialForm({
  initial,
  onSave,
}: {
  initial?: Partial<Material>
  onSave: (d: Partial<Material>) => void
}) {
  const [form, setForm] = useState<Partial<Material>>({
    title: '',
    type: 'PDF',
    latest_version: 'v1.0',
    uploaded_by: '',
    mandatory: false,
    downloadable: true,
    tracking_rule: 'View only',
    completion_pct: 0,
    views: 0,
    description: '',
    duration_text: '',
    watch_pct_required: 90,
    requires_acknowledgment: false,
    ...initial,
  })
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const set = (k: keyof Material, v: unknown) => setForm(f => ({ ...f, [k]: v }))

  const isVideo = VIDEO_TYPES.includes(form.type ?? '')
  const isDoc = DOC_TYPES.includes(form.type ?? '')
  const isLink = LINK_TYPES.includes(form.type ?? '')

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) { setFile(f); setUploadError('') }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    let file_url: string | undefined = initial?.file_url
    let size_text: string | undefined = initial?.size_text

    if (file) {
      setUploading(true)
      const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
      const { error } = await supabase.storage.from('course-materials').upload(`materials/${safeName}`, file, { upsert: true })
      if (error) { setUploadError(`Upload failed: ${error.message}`); setUploading(false); return }
      const { data: { publicUrl } } = supabase.storage.from('course-materials').getPublicUrl(`materials/${safeName}`)
      file_url = publicUrl
      const mb = file.size / 1024 / 1024
      size_text = mb < 1 ? `${Math.round(file.size / 1024)} KB` : `${mb.toFixed(1)} MB`
      setUploading(false)
    }

    onSave({ ...form, file_url, size_text })
  }

  return (
    <form className="modal-form" onSubmit={handleSubmit}>
      {/* Base fields */}
      <div className="form-group">
        <label>Title</label>
        <input value={form.title} onChange={e => set('title', e.target.value)} required />
      </div>
      <div className="form-group">
        <label>Description (optional)</label>
        <textarea rows={2} value={form.description ?? ''} onChange={e => set('description', e.target.value)} placeholder="Brief description of this material" />
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>Type</label>
          <select value={form.type} onChange={e => set('type', e.target.value)}>
            {['PDF', 'Video', 'PPT', 'Checklist', 'Protocol', 'Link/URL', 'Image', 'Audio', 'Evaluation'].map(t => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>Version</label>
          <input value={form.latest_version ?? ''} onChange={e => set('latest_version', e.target.value)} placeholder="v1.0" />
        </div>
        <div className="form-group">
          <label>Uploaded By</label>
          <input value={form.uploaded_by ?? ''} onChange={e => set('uploaded_by', e.target.value)} placeholder="Your name" />
        </div>
      </div>

      {/* ── Type-specific fields ── */}
      <div className="form-section-title">Completion Settings</div>

      {isVideo && (
        <div className="material-type-fields">
          <div className="material-type-badge">🎬 Video / Audio Settings</div>
          <div className="form-row">
            <div className="form-group">
              <label>Duration</label>
              <input value={form.duration_text ?? ''} onChange={e => set('duration_text', e.target.value)} placeholder="e.g. 15 min" />
              <span className="form-hint">Shown to learners as estimated watch time</span>
            </div>
            <div className="form-group">
              <label>Watch % Required to Complete</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="number"
                  value={form.watch_pct_required ?? 90}
                  onChange={e => set('watch_pct_required', parseInt(e.target.value))}
                  min={1} max={100}
                  style={{ width: 80 }}
                />
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>%</span>
              </div>
              <span className="form-hint">Learner must watch at least this percentage to mark as complete</span>
            </div>
          </div>
        </div>
      )}

      {isDoc && (
        <div className="material-type-fields">
          <div className="material-type-badge">📄 Document Settings</div>
          <div className="form-row">
            <div className="form-group">
              <label>Estimated Read Time</label>
              <input value={form.duration_text ?? ''} onChange={e => set('duration_text', e.target.value)} placeholder="e.g. 10 min read" />
              <span className="form-hint">Shown to learners as reading time</span>
            </div>
            <div className="form-group" style={{ justifyContent: 'flex-end', paddingTop: 28 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={form.requires_acknowledgment ?? false}
                  onChange={e => set('requires_acknowledgment', e.target.checked)}
                  style={{ accentColor: 'var(--teal)', width: 16, height: 16 }}
                />
                Requires Acknowledgment
              </label>
              <span className="form-hint">Learner must click "I acknowledge" to complete</span>
            </div>
          </div>
        </div>
      )}

      {isLink && (
        <div className="material-type-fields">
          <div className="material-type-badge">🔗 Link Settings</div>
          <div className="form-row">
            <div className="form-group">
              <label>Estimated View Time</label>
              <input value={form.duration_text ?? ''} onChange={e => set('duration_text', e.target.value)} placeholder="e.g. 5 min" />
            </div>
            <div className="form-group" style={{ justifyContent: 'flex-end', paddingTop: 28 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={form.requires_acknowledgment ?? false}
                  onChange={e => set('requires_acknowledgment', e.target.checked)}
                  style={{ accentColor: 'var(--teal)', width: 16, height: 16 }}
                />
                Requires Acknowledgment
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Tracking rule (all types) */}
      <div className="form-row">
        <div className="form-group">
          <label>Tracking Rule</label>
          <select value={form.tracking_rule ?? 'View only'} onChange={e => set('tracking_rule', e.target.value)}>
            <option>View only</option>
            <option>Acknowledge read</option>
            <option>Download required</option>
          </select>
        </div>
        <div className="form-group checkbox-group" style={{ alignSelf: 'flex-end' }}>
          <label><input type="checkbox" checked={!!form.mandatory} onChange={e => set('mandatory', e.target.checked)} /> Mandatory</label>
          <label><input type="checkbox" checked={!!form.downloadable} onChange={e => set('downloadable', e.target.checked)} /> Downloadable</label>
        </div>
      </div>

      {/* File upload */}
      {!isLink && (
        <>
          <div className="form-section-title">File</div>
          <div className="video-upload-area">
            {file ? (
              <div className="video-upload-selected">
                <span className="video-upload-icon">📎</span>
                <div className="video-upload-info">
                  <span className="video-upload-name">{file.name}</span>
                  <span className="video-upload-meta">{(file.size / 1024 / 1024).toFixed(1)} MB</span>
                </div>
                <button type="button" className="btn btn-sm btn-outline" onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = '' }}>Remove</button>
              </div>
            ) : initial?.file_url ? (
              <div className="video-upload-existing">
                <span className="video-upload-icon">📎</span>
                <div className="video-upload-info">
                  <span className="video-upload-name">{initial.title}</span>
                  <span className="video-upload-meta">Current file</span>
                </div>
                <div className="video-upload-actions">
                  <a href={initial.file_url} target="_blank" rel="noreferrer" className="btn btn-sm btn-outline">Preview</a>
                  <label className="btn btn-sm btn-outline" style={{ cursor: 'pointer' }}>
                    Replace
                    <input type="file" ref={fileRef} onChange={handleFile} style={{ display: 'none' }} />
                  </label>
                </div>
              </div>
            ) : (
              <label className="video-upload-drop" htmlFor="mat-file-input">
                <span className="video-upload-drop-icon">📁</span>
                <span className="video-upload-drop-text">Click to upload a file</span>
                <span className="video-upload-drop-hint">PDF, Video, PPT, Audio, Image — up to 100 MB</span>
                <input id="mat-file-input" ref={fileRef} type="file" onChange={handleFile} style={{ display: 'none' }} />
              </label>
            )}
            {uploadError && <div className="upload-error">{uploadError}</div>}
          </div>
        </>
      )}

      {isLink && (
        <>
          <div className="form-section-title">URL</div>
          <div className="form-group">
            <label>Link URL</label>
            <input
              type="url"
              value={(form as Partial<Material> & { file_url?: string }).file_url ?? ''}
              onChange={e => setForm(f => ({ ...f, file_url: e.target.value }))}
              placeholder="https://…"
            />
          </div>
        </>
      )}

      <div className="modal-form-actions">
        <button type="submit" className="btn btn-primary" disabled={uploading}>
          {uploading ? 'Uploading…' : initial ? 'Save Changes' : 'Upload'}
        </button>
      </div>
    </form>
  )
}
