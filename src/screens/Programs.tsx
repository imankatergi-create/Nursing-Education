import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import { PROGRAMS } from '../data/constants'
import type { Program, Course, Profile } from '../types'

interface ProgramEnrollment {
  id: string
  profile_id: string
  program_id: string
  enrolled_at: string
  due_date?: string
  status: string
  completion_pct: number
  profile?: { full_name: string; email: string; dept_id?: string; job_title?: string }
}

export default function ProgramsScreen() {
  const { toast, openModal, closeModal } = useApp()
  const [programs, setPrograms] = useState<Program[]>([])
  const [allCourses, setAllCourses] = useState<Course[]>([])
  const [programCourseMap, setProgramCourseMap] = useState<Record<string, Course[]>>({})
  const [enrolledCountMap, setEnrolledCountMap] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'all' | 'active' | 'draft'>('all')

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: progs }, { data: courses }, { data: pcLinks }, { data: enrollments }] = await Promise.all([
      supabase.from('programs').select('*').order('title'),
      supabase.from('courses').select('id,title,code,category,duration,level,mandatory,status').order('title'),
      supabase.from('program_courses').select('program_id,course_id,order_index').order('order_index'),
      supabase.from('program_enrollments').select('program_id,profile_id'),
    ])

    const progList = (progs && progs.length > 0) ? progs as Program[] : PROGRAMS
    const courseList = (courses ?? []) as Course[]
    setPrograms(progList)
    setAllCourses(courseList)

    const map: Record<string, Course[]> = {}
    for (const link of pcLinks ?? []) {
      const course = courseList.find(c => c.id === link.course_id)
      if (course) {
        if (!map[link.program_id]) map[link.program_id] = []
        map[link.program_id].push(course)
      }
    }
    setProgramCourseMap(map)

    const countMap: Record<string, number> = {}
    for (const e of enrollments ?? []) {
      countMap[e.program_id] = (countMap[e.program_id] ?? 0) + 1
    }
    setEnrolledCountMap(countMap)
    setLoading(false)
  }

  const filtered = programs.filter(p => tab === 'all' || p.status?.toLowerCase() === tab)
  const statusColor: Record<string, string> = { active: 'badge-green', Active: 'badge-green', draft: 'badge-amber', Draft: 'badge-amber', archived: 'badge-gray', Archived: 'badge-gray' }

  function openAdd() {
    openModal({
      title: 'Create Program', wide: true,
      body: <ProgramForm onSave={async d => { await supabase.from('programs').insert(d); fetchAll(); closeModal(); toast('Program created') }} />,
    })
  }

  function openEdit(p: Program) {
    openModal({
      title: 'Edit Program', wide: true,
      body: <ProgramForm initial={p} onSave={async d => { await supabase.from('programs').update(d).eq('id', p.id); fetchAll(); closeModal(); toast('Program updated') }} />,
    })
  }

  function openManageCourses(p: Program) {
    const currentIds = (programCourseMap[p.id] ?? []).map(c => c.id)
    openModal({
      title: `Courses in "${p.title}"`, wide: true,
      body: (
        <CoursePicker
          allCourses={allCourses}
          selectedIds={currentIds}
          onSave={async newIds => {
            await supabase.from('program_courses').delete().eq('program_id', p.id)
            if (newIds.length > 0) {
              await supabase.from('program_courses').insert(
                newIds.map((courseId, i) => ({ program_id: p.id, course_id: courseId, order_index: i + 1 }))
              )
            }
            fetchAll(); closeModal()
            toast(`${newIds.length} course${newIds.length !== 1 ? 's' : ''} assigned to program`)
          }}
        />
      ),
    })
  }

  function openAssignStaff(p: Program) {
    const courses = programCourseMap[p.id] ?? []
    openModal({
      title: `Assign Staff to "${p.title}"`, wide: true,
      body: (
        <StaffAssignForm
          program={p}
          programCourses={courses}
          onSave={async ({ profileIds, dueDate }) => {
            let enrolled = 0
            for (const profileId of profileIds) {
              // Enroll in program
              const { error: peErr } = await supabase.from('program_enrollments').upsert(
                { profile_id: profileId, program_id: p.id, status: 'not_started', due_date: dueDate || null },
                { onConflict: 'profile_id,program_id' }
              )
              if (peErr) continue

              // Enroll in each course in the program
              for (const course of courses) {
                await supabase.from('nurse_enrollments').upsert(
                  { profile_id: profileId, course_id: course.id, status: 'not_started', due_date: dueDate || null, mandatory: p.mandatory ?? false },
                  { onConflict: 'profile_id,course_id' }
                )
              }
              enrolled++
            }
            fetchAll(); closeModal()
            toast(`${enrolled} staff member${enrolled !== 1 ? 's' : ''} enrolled in program`)
          }}
        />
      ),
    })
  }

  function openViewStaff(p: Program) {
    openModal({
      title: `Enrolled Staff — ${p.title}`, wide: true,
      body: <EnrolledStaffView program={p} programCourses={programCourseMap[p.id] ?? []} onRefresh={fetchAll} onClose={closeModal} />,
    })
  }

  async function deleteProgram(p: Program) {
    if (!confirm(`Delete program "${p.title}"? This cannot be undone.`)) return
    await supabase.from('programs').delete().eq('id', p.id)
    fetchAll()
    toast('Program deleted')
  }

  return (
    <div className="screen-container">
      <div className="screen-header">
        <div>
          <h1 className="screen-title">Programs</h1>
          <p className="screen-subtitle">{programs.length} training programs</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>+ Create Program</button>
      </div>

      <div className="tab-row">
        {(['all', 'active', 'draft'] as const).map(t => (
          <button key={t} className={`tab-btn${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
            <span className="tab-count">{t === 'all' ? programs.length : programs.filter(p => p.status?.toLowerCase() === t).length}</span>
          </button>
        ))}
      </div>

      <div className="programs-grid">
        {loading ? <div className="loading-state">Loading…</div> : filtered.map(p => {
          const linkedCourses = programCourseMap[p.id] ?? []
          const enrolledCount = enrolledCountMap[p.id] ?? 0
          return (
            <div key={p.id} className="program-card">
              <div className="program-card-header">
                <div>
                  <div className="program-code">{p.code}</div>
                  <h3 className="program-title">{p.title}</h3>
                </div>
                <span className={`badge ${statusColor[p.status] ?? 'badge-gray'}`}>{p.status}</span>
              </div>
              <div className="program-meta">
                <span>📅 {p.start_date} – {p.end_date}</span>
                <span>⏱ {p.duration}</span>
                <span>🎯 {p.audience}</span>
              </div>
              <p className="program-objectives">{p.objectives}</p>
              <div className="program-tags">
                <span className="tag">{p.category}</span>
                {p.mandatory && <span className="tag tag-red">Mandatory</span>}
                {p.certificate_enabled && <span className="tag tag-blue">Certificate</span>}
              </div>

              {/* Enrollment summary */}
              <div className="program-enrollment-summary">
                <div className="program-enroll-stat">
                  <span className="program-enroll-val">{enrolledCount}</span>
                  <span className="program-enroll-lbl">enrolled</span>
                </div>
                <div className="program-enroll-stat">
                  <span className="program-enroll-val">{linkedCourses.length}</span>
                  <span className="program-enroll-lbl">courses</span>
                </div>
              </div>

              {/* Linked courses preview */}
              {linkedCourses.length > 0 && (
                <div className="program-courses-list" style={{ marginTop: 8 }}>
                  {linkedCourses.slice(0, 2).map(c => (
                    <div key={c.id} className="program-course-row">
                      <span>{c.title}</span>
                      <span className="program-course-row-code">{c.code}</span>
                    </div>
                  ))}
                  {linkedCourses.length > 2 && (
                    <div style={{ fontSize: 11, color: 'var(--muted)', padding: '4px 10px' }}>+{linkedCourses.length - 2} more courses</div>
                  )}
                </div>
              )}

              <div className="program-actions">
                <button className="btn btn-sm btn-primary" onClick={() => openAssignStaff(p)}>
                  👥 Assign Staff
                </button>
                {enrolledCount > 0 && (
                  <button className="btn btn-sm btn-outline" onClick={() => openViewStaff(p)}>
                    📊 View Staff ({enrolledCount})
                  </button>
                )}
                <button className="btn btn-sm" onClick={() => openManageCourses(p)}>📚 Courses</button>
                <button className="btn btn-sm btn-outline" onClick={() => openEdit(p)}>Edit</button>
                <button className="btn btn-sm btn-danger" onClick={() => deleteProgram(p)}>Delete</button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── StaffAssignForm ───────────────────────────────────────────────────────────

function StaffAssignForm({
  program,
  programCourses,
  onSave,
}: {
  program: Program
  programCourses: Course[]
  onSave: (d: { profileIds: string[]; dueDate: string }) => void
}) {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [existing, setExisting] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('profiles').select('id,full_name,email,role,dept_id,job_title').order('full_name'),
      supabase.from('program_enrollments').select('profile_id').eq('program_id', program.id),
    ]).then(([{ data: profs }, { data: enrolled }]) => {
      setProfiles((profs ?? []) as Profile[])
      const existingIds = new Set((enrolled ?? []).map(e => e.profile_id as string))
      setExisting(existingIds)
      setLoading(false)
    })
  }, [])

  function toggle(id: string) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  function selectAll() {
    const visibleIds = filtered.filter(p => !existing.has(p.id)).map(p => p.id)
    setSelected(new Set(visibleIds))
  }

  const filtered = profiles.filter(p => {
    const q = search.toLowerCase()
    return !q || p.full_name?.toLowerCase().includes(q) || p.email?.toLowerCase().includes(q) || p.job_title?.toLowerCase().includes(q)
  })

  const newSelections = [...selected].filter(id => !existing.has(id))

  return (
    <div className="modal-form">
      {programCourses.length === 0 && (
        <div className="alert-box alert-amber" style={{ marginBottom: 12 }}>
          This program has no linked courses yet. Staff will be enrolled in the program but no course enrollments will be created. Add courses first via "Manage Courses".
        </div>
      )}

      <div className="form-row" style={{ marginBottom: 12 }}>
        <div className="form-group" style={{ flex: 2 }}>
          <label>Search staff</label>
          <input className="search-input" placeholder="Search by name, email, role…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="form-group">
          <label>Due Date (optional)</label>
          <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>
          {selected.size} selected · {existing.size} already enrolled
        </span>
        <button type="button" className="btn btn-sm btn-outline" onClick={selectAll}>Select All Visible</button>
      </div>

      {loading ? (
        <div className="loading-state">Loading staff…</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 380, overflowY: 'auto', marginBottom: 14 }}>
          {filtered.map(p => {
            const isEnrolled = existing.has(p.id)
            const isChecked = selected.has(p.id)
            return (
              <label
                key={p.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 12px',
                  border: `1.5px solid ${isChecked ? 'var(--teal)' : 'var(--border)'}`,
                  borderRadius: 8,
                  background: isEnrolled ? 'var(--bg)' : isChecked ? 'var(--teal-t)' : 'var(--panel)',
                  cursor: isEnrolled ? 'default' : 'pointer',
                  opacity: isEnrolled ? 0.65 : 1,
                  transition: 'border-color .15s, background .15s',
                }}
              >
                <input
                  type="checkbox"
                  checked={isChecked || isEnrolled}
                  disabled={isEnrolled}
                  onChange={() => !isEnrolled && toggle(p.id)}
                  style={{ accentColor: 'var(--teal)', width: 16, height: 16 }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{p.full_name}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>{p.email} · {p.job_title || p.role}</div>
                </div>
                {isEnrolled ? (
                  <span className="badge badge-green">Enrolled</span>
                ) : (
                  <span className={`badge ${p.role === 'nurse' ? 'badge-teal' : 'badge-blue'}`}>{p.role}</span>
                )}
              </label>
            )
          })}
          {filtered.length === 0 && <div className="empty-state">No staff found.</div>}
        </div>
      )}

      {programCourses.length > 0 && (
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10, padding: '8px 12px', background: 'var(--bg)', borderRadius: 6, border: '1px solid var(--border)' }}>
          Enrolling staff will also enroll them in {programCourses.length} course{programCourses.length !== 1 ? 's' : ''}: {programCourses.map(c => c.title).join(', ')}
        </div>
      )}

      <div className="modal-form-actions">
        <button
          type="button"
          className="btn btn-primary"
          disabled={newSelections.length === 0}
          onClick={() => onSave({ profileIds: newSelections, dueDate })}
        >
          Enroll {newSelections.length > 0 ? `${newSelections.length} Staff` : 'Staff'}
        </button>
      </div>
    </div>
  )
}

// ── EnrolledStaffView ─────────────────────────────────────────────────────────

function EnrolledStaffView({
  program,
  programCourses,
  onRefresh,
  onClose,
}: {
  program: Program
  programCourses: Course[]
  onRefresh: () => void
  onClose: () => void
}) {
  const { toast } = useApp()
  const [enrollments, setEnrollments] = useState<ProgramEnrollment[]>([])
  const [courseProgress, setCourseProgress] = useState<Record<string, Record<string, string>>>({})
  const [loading, setLoading] = useState(true)
  const [issuingId, setIssuingId] = useState<string | null>(null)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const { data: enr } = await supabase
      .from('program_enrollments')
      .select('*, profile:profiles(full_name, email, job_title, dept_id)')
      .eq('program_id', program.id)
      .order('enrolled_at', { ascending: false })

    setEnrollments((enr ?? []) as ProgramEnrollment[])

    if ((enr ?? []).length > 0 && programCourses.length > 0) {
      const profileIds = (enr ?? []).map(e => e.profile_id)
      const courseIds = programCourses.map(c => c.id)

      const { data: nerEnr } = await supabase
        .from('nurse_enrollments')
        .select('profile_id, course_id, status, completion_pct')
        .in('profile_id', profileIds)
        .in('course_id', courseIds)

      // Map: profileId → courseId → status
      const progress: Record<string, Record<string, string>> = {}
      for (const ne of nerEnr ?? []) {
        if (!progress[ne.profile_id]) progress[ne.profile_id] = {}
        progress[ne.profile_id][ne.course_id] = ne.status
      }
      setCourseProgress(progress)

      // Update program enrollment completion % based on course completions
      for (const e of enr ?? []) {
        const profileProgress = progress[e.profile_id] ?? {}
        const completed = programCourses.filter(c => profileProgress[c.id] === 'completed').length
        const pct = programCourses.length > 0 ? Math.round((completed / programCourses.length) * 100) : 0
        const status = pct === 100 ? 'completed' : pct > 0 ? 'in_progress' : 'not_started'
        if (pct !== e.completion_pct || status !== e.status) {
          await supabase.from('program_enrollments').update({ completion_pct: pct, status }).eq('id', e.id)
        }
      }
    }
    setLoading(false)
  }

  async function issueProgramCert(enrollment: ProgramEnrollment) {
    setIssuingId(enrollment.profile_id)
    const nurseName = (enrollment.profile as { full_name: string } | null)?.full_name ?? 'Staff'

    // Check if cert already exists
    const { data: existing } = await supabase
      .from('certificates')
      .select('id')
      .eq('profile_id', enrollment.profile_id)
      .eq('program_id', program.id)
      .maybeSingle()

    if (existing) {
      toast('Certificate already issued for this staff member')
      setIssuingId(null)
      return
    }

    const certNo = `CERT-${Date.now().toString(36).toUpperCase()}`
    const expiryDate = new Date()
    expiryDate.setFullYear(expiryDate.getFullYear() + 2)

    await supabase.from('certificates').insert({
      cert_no: certNo,
      profile_id: enrollment.profile_id,
      program_id: program.id,
      program_name: program.title,
      course_name: program.title,
      issued_at: new Date().toISOString().split('T')[0],
      score_pct: `${enrollment.completion_pct}%`,
      expiry_date: expiryDate.toISOString().split('T')[0],
      status: 'Valid',
      verify_code: Math.random().toString(36).substring(2, 10).toUpperCase(),
      issued_by: 'Admin',
    })

    await supabase.from('program_enrollments').update({ status: 'completed', completion_pct: 100 }).eq('id', enrollment.id)

    toast(`Certificate issued to ${nurseName}`)
    loadData()
    onRefresh()
    setIssuingId(null)
  }

  async function unenroll(enrollment: ProgramEnrollment) {
    const name = (enrollment.profile as { full_name: string } | null)?.full_name ?? 'this staff member'
    if (!confirm(`Remove ${name} from this program?`)) return
    await supabase.from('program_enrollments').delete().eq('id', enrollment.id)
    loadData()
    onRefresh()
    toast('Staff member removed from program')
  }

  const statusBadge: Record<string, string> = { completed: 'badge-green', in_progress: 'badge-blue', not_started: 'badge-gray' }
  const courseStatusIcon: Record<string, string> = { completed: '✅', in_progress: '🔄', not_started: '⭕' }

  return (
    <div>
      {loading ? (
        <div className="loading-state">Loading…</div>
      ) : enrollments.length === 0 ? (
        <div className="empty-state">No staff enrolled in this program yet. Use "Assign Staff" to enroll them.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {enrollments.map(e => {
            const profile = e.profile as { full_name: string; email: string; job_title?: string } | null
            const profileProgress = courseProgress[e.profile_id] ?? {}
            const completedCount = programCourses.filter(c => profileProgress[c.id] === 'completed').length
            const allDone = programCourses.length > 0 && completedCount === programCourses.length
            const pct = programCourses.length > 0 ? Math.round((completedCount / programCourses.length) * 100) : 0

            return (
              <div key={e.id} className="enrolled-staff-card">
                <div className="enrolled-staff-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div className="enrolled-staff-avatar">
                      {profile?.full_name?.charAt(0).toUpperCase() ?? '?'}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{profile?.full_name ?? '—'}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{profile?.email} · {profile?.job_title ?? '—'}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className={`badge ${statusBadge[e.status] ?? 'badge-gray'}`}>{e.status.replace('_', ' ')}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: allDone ? 'var(--green)' : 'var(--teal)' }}>{pct}%</span>
                  </div>
                </div>

                {/* Progress bar */}
                <div style={{ margin: '8px 0 6px' }}>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: `${pct}%`, background: allDone ? 'var(--green)' : undefined }} />
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>
                    {completedCount} of {programCourses.length} courses completed
                  </div>
                </div>

                {/* Per-course status */}
                {programCourses.length > 0 && (
                  <div className="enrolled-course-statuses">
                    {programCourses.map(c => (
                      <div key={c.id} className="enrolled-course-chip" title={c.title}>
                        <span>{courseStatusIcon[profileProgress[c.id] ?? 'not_started']}</span>
                        <span style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11 }}>{c.title}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                  {program.certificate_enabled && allDone && (
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => issueProgramCert(e)}
                      disabled={issuingId === e.profile_id}
                    >
                      🏆 {issuingId === e.profile_id ? 'Issuing…' : 'Issue Certificate'}
                    </button>
                  )}
                  {program.certificate_enabled && !allDone && (
                    <button className="btn btn-sm btn-primary" disabled title="Staff must complete all courses first">
                      🏆 Issue Certificate
                    </button>
                  )}
                  {e.due_date && (
                    <span style={{ fontSize: 11, color: 'var(--muted)', alignSelf: 'center' }}>
                      Due: {new Date(e.due_date).toLocaleDateString()}
                    </span>
                  )}
                  <button className="btn btn-sm btn-danger" style={{ marginLeft: 'auto' }} onClick={() => unenroll(e)}>Remove</button>
                </div>
              </div>
            )
          })}
        </div>
      )}
      <div className="modal-form-actions">
        <button type="button" className="btn btn-outline" onClick={onClose}>Close</button>
      </div>
    </div>
  )
}

// ── CoursePicker ──────────────────────────────────────────────────────────────

function CoursePicker({ allCourses, selectedIds, onSave }: { allCourses: Course[]; selectedIds: string[]; onSave: (ids: string[]) => void }) {
  const [checked, setChecked] = useState<Set<string>>(new Set(selectedIds))
  const [search, setSearch] = useState('')

  function toggle(id: string) {
    setChecked(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  const filtered = allCourses.filter(c => !search || c.title.toLowerCase().includes(search.toLowerCase()) || c.code.toLowerCase().includes(search.toLowerCase()))

  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 10px' }}>
        Select the courses that belong to this program.
      </p>
      <input className="search-input" placeholder="Search courses…" value={search} onChange={e => setSearch(e.target.value)} style={{ marginBottom: 10 }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 360, overflowY: 'auto', marginBottom: 14 }}>
        {filtered.map(c => (
          <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', border: `1.5px solid ${checked.has(c.id) ? 'var(--teal)' : 'var(--border)'}`, borderRadius: 8, background: checked.has(c.id) ? 'var(--teal-t)' : 'var(--panel)', cursor: 'pointer', transition: 'border-color .15s, background .15s' }}>
            <input type="checkbox" checked={checked.has(c.id)} onChange={() => toggle(c.id)} style={{ accentColor: 'var(--teal)', width: 16, height: 16 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{c.title}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>{c.code} · {c.category} · {c.level}</div>
            </div>
            {c.mandatory && <span className="tag tag-red" style={{ fontSize: 10 }}>Mandatory</span>}
            <span className={`badge ${c.status === 'active' ? 'badge-green' : 'badge-amber'}`}>{c.status}</span>
          </label>
        ))}
        {filtered.length === 0 && <div className="empty-state">No courses found.</div>}
      </div>
      <div style={{ fontSize: 12, color: 'var(--teal)', marginBottom: 10 }}>{checked.size} course{checked.size !== 1 ? 's' : ''} selected</div>
      <div className="modal-form-actions">
        <button className="btn btn-primary" onClick={() => onSave(Array.from(checked))}>Save ({checked.size} courses)</button>
      </div>
    </div>
  )
}

// ── ProgramForm ───────────────────────────────────────────────────────────────

function ProgramForm({ initial, onSave }: { initial?: Partial<Program>; onSave: (d: Partial<Program>) => void }) {
  const [form, setForm] = useState({
    title: '', code: '', category: 'Clinical', objectives: '', outcomes: '', audience: 'All Nurses',
    mandatory: false, start_date: '', end_date: '', duration: '', pass_requirements: '',
    certificate_enabled: false, status: 'draft', ...initial,
  })
  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }))
  return (
    <form className="modal-form" onSubmit={e => { e.preventDefault(); onSave(form) }}>
      <div className="form-row">
        <div className="form-group"><label>Title</label><input value={form.title} onChange={e => set('title', e.target.value)} required /></div>
        <div className="form-group"><label>Code</label><input value={form.code} onChange={e => set('code', e.target.value)} required /></div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>Category</label>
          <select value={form.category} onChange={e => set('category', e.target.value)}>
            {['Clinical', 'Safety', 'Compliance', 'Leadership', 'Technical'].map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="form-group"><label>Audience</label><input value={form.audience} onChange={e => set('audience', e.target.value)} /></div>
      </div>
      <div className="form-group"><label>Objectives</label><textarea rows={2} value={form.objectives} onChange={e => set('objectives', e.target.value)} /></div>
      <div className="form-row">
        <div className="form-group"><label>Start Date</label><input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} /></div>
        <div className="form-group"><label>End Date</label><input type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} /></div>
        <div className="form-group"><label>Duration</label><input value={form.duration} onChange={e => set('duration', e.target.value)} /></div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>Status</label>
          <select value={form.status} onChange={e => set('status', e.target.value)}>
            <option value="draft">Draft</option><option value="active">Active</option><option value="archived">Archived</option>
          </select>
        </div>
        <div className="form-group checkbox-group" style={{ alignSelf: 'flex-end' }}>
          <label><input type="checkbox" checked={!!form.mandatory} onChange={e => set('mandatory', e.target.checked)} /> Mandatory</label>
          <label><input type="checkbox" checked={!!form.certificate_enabled} onChange={e => set('certificate_enabled', e.target.checked)} /> Certificate Enabled</label>
        </div>
      </div>
      <div className="modal-form-actions"><button type="submit" className="btn btn-primary">Save</button></div>
    </form>
  )
}
