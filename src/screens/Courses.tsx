import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import type { Course } from '../types'

interface CourseWithSyllabi extends Course {
  course_syllabuses: { syllabi: { id: string; title: string } | null }[]
}

export default function CoursesScreen() {
  const { navigate, toast, openModal, closeModal } = useApp()
  const [courses, setCourses] = useState<CourseWithSyllabi[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('all')

  useEffect(() => { fetchCourses() }, [])

  async function fetchCourses() {
    setLoading(true)
    const { data } = await supabase
      .from('courses')
      .select('*, course_syllabuses(syllabi(id, title))')
      .order('title')
    setCourses((data ?? []) as CourseWithSyllabi[])
    setLoading(false)
  }

  const cats = ['all', ...Array.from(new Set(courses.map(c => c.category)))]
  const filtered = courses.filter(c => {
    const q = search.toLowerCase()
    return (!q || c.title.toLowerCase().includes(q) || c.code.toLowerCase().includes(q))
      && (catFilter === 'all' || c.category === catFilter)
  })

  const statusColor: Record<string, string> = {
    active: 'badge-green', draft: 'badge-amber', archived: 'badge-gray', inactive: 'badge-red',
  }
  const iconColors = ['#0891b2', '#059669', '#d97706', '#dc2626', '#7c3aed', '#0284c7']

  function openAdd() {
    openModal({
      title: 'Create Course', wide: true,
      body: (
        <CourseForm
          onSave={async (d, syllabusIds) => {
            const { data: created, error } = await supabase
              .from('courses')
              .insert(d)
              .select('id')
              .maybeSingle()
            if (error || !created) { toast('Error creating course: ' + (error?.message ?? '')); return }
            if (syllabusIds.length > 0) {
              await supabase.from('course_syllabuses').insert(
                syllabusIds.map(sid => ({ course_id: created.id, syllabus_id: sid }))
              )
            }
            fetchCourses()
            closeModal()
            toast('Course created')
          }}
        />
      ),
    })
  }

  function openEdit(course: CourseWithSyllabi) {
    openModal({
      title: 'Edit Course', wide: true,
      body: (
        <CourseForm
          initial={course}
          initialSyllabusIds={(course.course_syllabuses ?? [])
            .map(cs => cs.syllabi?.id)
            .filter(Boolean) as string[]}
          onSave={async (d, syllabusIds) => {
            const { error } = await supabase.from('courses').update(d).eq('id', course.id)
            if (error) { toast('Error saving course: ' + error.message); return }
            await supabase.from('course_syllabuses').delete().eq('course_id', course.id)
            if (syllabusIds.length > 0) {
              await supabase.from('course_syllabuses').insert(
                syllabusIds.map(sid => ({ course_id: course.id, syllabus_id: sid }))
              )
            }
            fetchCourses()
            closeModal()
            toast('Course saved')
          }}
        />
      ),
    })
  }

  async function deleteCourse(course: Course) {
    if (!confirm(`Delete course "${course.title}"? This cannot be undone.`)) return
    await supabase.from('courses').delete().eq('id', course.id)
    fetchCourses()
    toast('Course deleted')
  }

  return (
    <div className="screen-container">
      <div className="screen-header">
        <div>
          <h1 className="screen-title">Courses</h1>
          <p className="screen-subtitle">{courses.length} courses in library</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>+ Create Course</button>
      </div>

      <div className="table-toolbar">
        <input
          className="search-input"
          placeholder="Search courses…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="filter-chips">
          {cats.map(c => (
            <button key={c} className={`chip${catFilter === c ? ' active' : ''}`} onClick={() => setCatFilter(c)}>
              {c === 'all' ? 'All' : c}
            </button>
          ))}
        </div>
      </div>

      <div className="courses-grid">
        {loading ? (
          <div className="loading-state">Loading…</div>
        ) : filtered.map((c, i) => (
          <div key={c.id} className="course-card">
            <div className="course-thumb" style={{ background: iconColors[i % iconColors.length] }}>
              <span className="course-thumb-icon">{c.thumbnail_icon || '📚'}</span>
              {c.video_url && <span className="course-video-badge">▶ Video</span>}
            </div>
            <div className="course-card-body">
              <div className="course-card-top">
                <span className="course-code">{c.code}</span>
                <span className={`badge ${statusColor[c.status] ?? 'badge-gray'}`}>{c.status}</span>
              </div>
              <h3 className="course-card-title">{c.title}</h3>
              <div className="course-card-meta">
                <span>⏱ {c.duration}</span>
                <span>📊 {c.level}</span>
                <span>🌐 {c.lang}</span>
              </div>
              {c.mandatory && <span className="tag tag-red" style={{ marginTop: 4 }}>Mandatory</span>}
              {(c.course_syllabuses ?? []).length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                  {(c.course_syllabuses ?? []).map(cs => cs.syllabi && (
                    <span key={cs.syllabi.id} className="badge badge-teal" style={{ fontSize: 10 }}>
                      📋 {cs.syllabi.title}
                    </span>
                  ))}
                </div>
              )}
              <div className="course-card-actions">
                <button className="btn btn-sm" onClick={() => navigate('syllabus', { courseId: c.id })}>Syllabus</button>
                <button className="btn btn-sm btn-outline" onClick={() => openEdit(c)}>Edit</button>
                <button
                  className="btn btn-sm btn-outline"
                  onClick={() => openModal({ title: c.title, wide: true, body: <CourseDetail course={c} /> })}
                >
                  Details
                </button>
                <button className="btn btn-sm btn-danger" onClick={() => deleteCourse(c)}>Delete</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function CourseDetail({ course }: { course: Course }) {
  return (
    <div className="course-detail">
      <div className="detail-row"><strong>Instructor:</strong> {course.instructor}</div>
      <div className="detail-row"><strong>Category:</strong> {course.category}</div>
      <div className="detail-row"><strong>Audience:</strong> {course.audience}</div>
      <div className="detail-row"><strong>Duration:</strong> {course.duration}</div>
      <div className="detail-row"><strong>Pass Rule:</strong> {course.pass_rule}</div>
      <div className="detail-row"><strong>Deadline:</strong> {course.deadline}</div>
      {course.video_url && (
        <div className="detail-row">
          <strong>Video:</strong>{' '}
          <a href={course.video_url} target="_blank" rel="noreferrer" className="link">
            {course.video_filename ?? 'Watch video'}
          </a>
          {course.video_size_mb && <span style={{ color: 'var(--muted)', marginLeft: 8 }}>({course.video_size_mb} MB)</span>}
        </div>
      )}
      {course.objectives?.length > 0 && (
        <div>
          <strong>Objectives:</strong>
          <ul className="detail-list">{course.objectives.map((o, i) => <li key={i}>{o}</li>)}</ul>
        </div>
      )}
    </div>
  )
}

function CourseForm({
  initial,
  initialSyllabusIds = [],
  onSave,
}: {
  initial?: Partial<Course>
  initialSyllabusIds?: string[]
  onSave: (d: Partial<Course>, syllabusIds: string[]) => void
}) {
  const [form, setForm] = useState({
    title: '', code: '', category: 'Clinical', audience: 'All Nurses', duration: '2h', level: 'Beginner',
    lang: 'English', instructor: '', prerequisites: 'None', mandatory: false, status: 'draft',
    pass_rule: '80%', deadline: '',
    video_url: '', video_filename: '', video_size_mb: 0, video_duration_sec: 0,
    ...initial,
  })
  const [objectivesText, setObjectivesText] = useState(
    Array.isArray(initial?.objectives) ? initial.objectives.join('\n') : ''
  )
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadError, setUploadError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const [allSyllabi, setAllSyllabi] = useState<{ id: string; title: string; description: string }[]>([])
  const [selectedSylIds, setSelectedSylIds] = useState<Set<string>>(new Set(initialSyllabusIds))

  useEffect(() => {
    supabase.from('syllabi').select('id, title, description').order('title').then(({ data }) => {
      setAllSyllabi(data ?? [])
    })
  }, [])

  function toggleSyl(id: string) {
    setSelectedSylIds(s => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })
  }

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }))

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setVideoFile(file)
    setUploadError('')
  }

  function removeVideo() {
    setVideoFile(null)
    set('video_url', '')
    set('video_filename', '')
    set('video_size_mb', 0)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function uploadVideo(): Promise<string | null> {
    if (!videoFile) return form.video_url || null
    setUploading(true)
    setUploadProgress(0)
    setUploadError('')
    const safeName = `${Date.now()}-${videoFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const { error } = await supabase.storage
      .from('course-videos')
      .upload(`courses/${safeName}`, videoFile, { upsert: true })
    if (error) { setUploadError(`Upload failed: ${error.message}`); setUploading(false); return null }
    const { data: { publicUrl } } = supabase.storage.from('course-videos').getPublicUrl(`courses/${safeName}`)
    setUploadProgress(100)
    setUploading(false)
    return publicUrl
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    let videoUrl = form.video_url
    let videoFilename = form.video_filename
    let videoSizeMb = form.video_size_mb
    if (videoFile) {
      const url = await uploadVideo()
      if (!url) return
      videoUrl = url
      videoFilename = videoFile.name
      videoSizeMb = parseFloat((videoFile.size / 1024 / 1024).toFixed(2))
    }
    const objectives = objectivesText.split('\n').map(s => s.trim()).filter(Boolean)
    onSave(
      { ...form, video_url: videoUrl, video_filename: videoFilename, video_size_mb: videoSizeMb, objectives },
      Array.from(selectedSylIds)
    )
  }

  const hasExistingVideo = !videoFile && form.video_url

  return (
    <form className="modal-form" onSubmit={handleSubmit}>
      <div className="form-row">
        <div className="form-group"><label>Title</label><input value={form.title} onChange={e => set('title', e.target.value)} required /></div>
        <div className="form-group"><label>Code</label><input value={form.code} onChange={e => set('code', e.target.value)} required /></div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>Category</label>
          <select value={form.category} onChange={e => set('category', e.target.value)}>
            {['Clinical', 'Safety', 'Compliance', 'Technical', 'Leadership'].map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Level</label>
          <select value={form.level} onChange={e => set('level', e.target.value)}>
            <option>Beginner</option><option>Intermediate</option><option>Advanced</option>
          </select>
        </div>
        <div className="form-group">
          <label>Status</label>
          <select value={form.status} onChange={e => set('status', e.target.value)}>
            <option value="draft">Draft</option><option value="active">Active</option>
          </select>
        </div>
      </div>
      <div className="form-row">
        <div className="form-group"><label>Instructor</label><input value={form.instructor} onChange={e => set('instructor', e.target.value)} /></div>
        <div className="form-group"><label>Duration</label><input value={form.duration} onChange={e => set('duration', e.target.value)} /></div>
        <div className="form-group"><label>Pass Rule</label><input value={form.pass_rule} onChange={e => set('pass_rule', e.target.value)} /></div>
      </div>
      <div className="form-group">
        <label>Objectives <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(one per line)</span></label>
        <textarea
          rows={3}
          value={objectivesText}
          onChange={e => setObjectivesText(e.target.value)}
          placeholder="Understand infection control procedures&#10;Apply hand hygiene protocols"
        />
      </div>

      {/* ── Syllabuses ── */}
      <div className="form-section-title" style={{ marginTop: 16 }}>
        Link Syllabuses
        <span style={{ fontWeight: 400, textTransform: 'none', fontSize: 12, marginLeft: 6, color: 'var(--faint)', letterSpacing: 0 }}>— optional</span>
      </div>
      {allSyllabi.length === 0 ? (
        <div style={{ color: 'var(--muted)', fontSize: 13, padding: '4px 0 8px' }}>
          No syllabuses yet. Create one in the Syllabus Builder first.
        </div>
      ) : (
        <div className="mat-picker" style={{ marginBottom: 8 }}>
          {allSyllabi.map(s => {
            const sel = selectedSylIds.has(s.id)
            return (
              <div
                key={s.id}
                className={`mat-card${sel ? ' selected' : ''}`}
                onClick={() => toggleSyl(s.id)}
              >
                <div className="mat-card-row">
                  <svg className="mat-checkbox" width="18" height="18" viewBox="0 0 18 18">
                    <rect x="1" y="1" width="16" height="16" rx="3"
                      fill={sel ? '#0891b2' : '#fff'}
                      stroke={sel ? '#0891b2' : '#cbd5e1'}
                      strokeWidth="2"
                    />
                    {sel && <path d="M4.5 9l3 3 6-6" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />}
                  </svg>
                  <div className="mat-info">
                    <div className="mat-title">📋 {s.title}</div>
                    {s.description && <div className="mat-sub">{s.description}</div>}
                  </div>
                  {sel && <span className="mat-badge-sel">✓ Linked</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Video ── */}
      <div className="form-section-title">Course Video</div>
      <div className="video-upload-area">
        {hasExistingVideo ? (
          <div className="video-upload-existing">
            <span className="video-upload-icon">🎬</span>
            <div className="video-upload-info">
              <span className="video-upload-name">{form.video_filename || 'Uploaded video'}</span>
              {form.video_size_mb ? <span className="video-upload-meta">{form.video_size_mb} MB</span> : null}
            </div>
            <div className="video-upload-actions">
              <a href={form.video_url} target="_blank" rel="noreferrer" className="btn btn-sm btn-outline">Preview</a>
              <button type="button" className="btn btn-sm btn-outline" onClick={removeVideo}>Replace</button>
            </div>
          </div>
        ) : videoFile ? (
          <div className="video-upload-selected">
            <span className="video-upload-icon">🎬</span>
            <div className="video-upload-info">
              <span className="video-upload-name">{videoFile.name}</span>
              <span className="video-upload-meta">{(videoFile.size / 1024 / 1024).toFixed(1)} MB</span>
            </div>
            <button type="button" className="btn btn-sm btn-outline" onClick={removeVideo}>Remove</button>
          </div>
        ) : (
          <label className="video-upload-drop" htmlFor="video-file-input">
            <span className="video-upload-drop-icon">📹</span>
            <span className="video-upload-drop-text">Click to upload a video</span>
            <span className="video-upload-drop-hint">MP4, WebM, MOV — up to 500 MB</span>
            <input
              id="video-file-input"
              ref={fileRef}
              type="file"
              accept="video/mp4,video/webm,video/ogg,video/quicktime,video/x-msvideo"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
          </label>
        )}
        {uploading && (
          <div className="video-upload-progress">
            <div className="bar-track">
              <div className="bar-fill" style={{ width: `${uploadProgress}%`, transition: 'width 0.3s' }} />
            </div>
            <span>Uploading… {uploadProgress}%</span>
          </div>
        )}
        {uploadError && <div className="upload-error">{uploadError}</div>}
      </div>

      <div className="form-row" style={{ marginTop: 8 }}>
        <div className="form-group checkbox-group" style={{ alignSelf: 'flex-end' }}>
          <label><input type="checkbox" checked={!!form.mandatory} onChange={e => set('mandatory', e.target.checked)} /> Mandatory</label>
        </div>
      </div>

      <div className="modal-form-actions">
        {selectedSylIds.size > 0 && (
          <span style={{ color: 'var(--muted)', fontSize: 13, marginRight: 'auto' }}>
            {selectedSylIds.size} syllabus{selectedSylIds.size !== 1 ? 'es' : ''} linked
          </span>
        )}
        <button type="submit" className="btn btn-primary" disabled={uploading}>
          {uploading ? 'Uploading…' : 'Save Course'}
        </button>
      </div>
    </form>
  )
}
