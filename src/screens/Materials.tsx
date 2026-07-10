import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import { MATERIALS } from '../data/constants'
import type { Material } from '../types'

export default function MaterialsScreen() {
  const { toast, openModal, closeModal } = useApp()
  const [materials, setMaterials] = useState<Material[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')

  useEffect(() => { fetchMaterials() }, [])

  async function fetchMaterials() {
    setLoading(true)
    const { data } = await supabase.from('materials').select('*').order('title')
    if (data && data.length > 0) setMaterials(data)
    else setMaterials(MATERIALS)
    setLoading(false)
  }

  const types = ['all', ...Array.from(new Set(materials.map(m => m.type)))]
  const filtered = materials.filter(m => {
    const q = search.toLowerCase()
    return (!q || m.title.toLowerCase().includes(q)) && (typeFilter === 'all' || m.type === typeFilter)
  })

  const typeIcon: Record<string, string> = { PDF: '📄', Video: '🎬', PPT: '📊', Checklist: '✅', Protocol: '📋', 'Link/URL': '🔗', Image: '🖼️', Audio: '🎵' }
  const typeColor: Record<string, string> = { PDF: 'badge-red', Video: 'badge-blue', PPT: 'badge-amber', Checklist: 'badge-green', Protocol: 'badge-teal', 'Link/URL': 'badge-gray', Image: 'badge-purple', Audio: 'badge-blue' }

  function openAdd() {
    openModal({ title: 'Upload Material', wide: true,
      body: <MaterialForm onSave={async d => { await supabase.from('materials').insert(d); fetchMaterials(); closeModal(); toast('Material uploaded') }} />
    })
  }

  async function deleteMaterial(m: Material) {
    if (!confirm(`Delete material "${m.title}"? This cannot be undone.`)) return
    if ((m as Material & { file_url?: string }).file_url) {
      const url = (m as Material & { file_url?: string }).file_url!
      const path = url.split('/course-materials/')[1]
      if (path) await supabase.storage.from('course-materials').remove([path])
    }
    await supabase.from('materials').delete().eq('id', m.id)
    fetchMaterials()
    toast('Material deleted')
  }

  return (
    <div className="screen-container">
      <div className="screen-header">
        <div>
          <h1 className="screen-title">Materials Library</h1>
          <p className="screen-subtitle">{materials.length} materials available</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>+ Upload Material</button>
      </div>

      <div className="table-toolbar">
        <input className="search-input" placeholder="Search materials…" value={search} onChange={e => setSearch(e.target.value)} />
        <div className="filter-chips">
          {types.map(t => <button key={t} className={`chip${typeFilter === t ? ' active' : ''}`} onClick={() => setTypeFilter(t)}>{t === 'all' ? 'All Types' : t}</button>)}
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>Material</th><th>Type</th><th>Course</th><th>Version</th><th>Uploaded By</th><th>Views</th><th>Completion</th><th>Mandatory</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="table-loading">Loading…</td></tr>
              ) : filtered.map(m => (
                <tr key={m.id}>
                  <td>
                    <div className="material-cell">
                      <span className="material-icon">{typeIcon[m.type] ?? '📎'}</span>
                      <div>
                        <div className="material-title">{m.title}</div>
                        <div className="material-size">{m.size_text}</div>
                      </div>
                    </div>
                  </td>
                  <td><span className={`badge ${typeColor[m.type] ?? 'badge-gray'}`}>{m.type}</span></td>
                  <td>{m.course_id}</td>
                  <td>{m.latest_version}</td>
                  <td>{m.uploaded_by}</td>
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
                      {(m as Material & { file_url?: string }).file_url ? (
                        <a href={(m as Material & { file_url?: string }).file_url} target="_blank" rel="noreferrer" className="btn btn-sm">Preview</a>
                      ) : (
                        <button className="btn btn-sm" disabled>Preview</button>
                      )}
                      <button className="btn btn-sm btn-outline" onClick={() => openModal({ title: m.title, wide: true, body: <MaterialVersions material={m} /> })}>Versions</button>
                      <button className="btn btn-sm btn-danger" onClick={() => deleteMaterial(m)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function MaterialVersions({ material }: { material: Material }) {
  return (
    <div>
      <div className="detail-row"><strong>Current Version:</strong> {material.latest_version}</div>
      <div className="detail-row"><strong>Total Views:</strong> {material.views}</div>
      <div className="detail-row"><strong>Tracking:</strong> {material.tracking_rule}</div>
      <div className="detail-row"><strong>Downloadable:</strong> {material.downloadable ? 'Yes' : 'No'}</div>
    </div>
  )
}

function MaterialForm({ onSave }: { onSave: (d: Partial<Material> & { file_url?: string }) => void }) {
  const [form, setForm] = useState({ title: '', type: 'PDF', latest_version: 'v1.0', uploaded_by: '', mandatory: false, downloadable: true, tracking_rule: 'View only', completion_pct: 0, views: 0 })
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }))

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) { setFile(f); setUploadError('') }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    let file_url: string | undefined
    let size_text: string | undefined

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
      <div className="form-group"><label>Title</label><input value={form.title} onChange={e => set('title', e.target.value)} required /></div>
      <div className="form-row">
        <div className="form-group"><label>Type</label>
          <select value={form.type} onChange={e => set('type', e.target.value)}>
            {['PDF','Video','PPT','Checklist','Protocol','Link/URL','Image','Audio'].map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div className="form-group"><label>Tracking Rule</label>
          <select value={form.tracking_rule} onChange={e => set('tracking_rule', e.target.value)}>
            <option>View only</option><option>Acknowledge read</option><option>Download required</option>
          </select>
        </div>
      </div>

      <div className="form-section-title">File Upload</div>
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
        ) : (
          <label className="video-upload-drop" htmlFor="material-file-input">
            <span className="video-upload-drop-icon">📁</span>
            <span className="video-upload-drop-text">Click to upload a file</span>
            <span className="video-upload-drop-hint">PDF, Video, PPT, Audio, Image — up to 100 MB</span>
            <input id="material-file-input" ref={fileRef} type="file" onChange={handleFile} style={{ display: 'none' }} />
          </label>
        )}
        {uploadError && <div className="upload-error">{uploadError}</div>}
      </div>

      <div className="form-row">
        <div className="form-group checkbox-group" style={{ alignSelf:'flex-end' }}>
          <label><input type="checkbox" checked={form.mandatory} onChange={e => set('mandatory', e.target.checked)} /> Mandatory</label>
          <label><input type="checkbox" checked={form.downloadable} onChange={e => set('downloadable', e.target.checked)} /> Downloadable</label>
        </div>
      </div>
      <div className="modal-form-actions">
        <button type="submit" className="btn btn-primary" disabled={uploading}>
          {uploading ? 'Uploading…' : 'Upload'}
        </button>
      </div>
    </form>
  )
}
