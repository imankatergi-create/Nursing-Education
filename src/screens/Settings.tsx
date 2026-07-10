import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import { EMAIL_TEMPLATES, REMINDER_RULES } from '../data/constants'
import type { EmailTemplate, ReminderRule } from '../types'

export default function SettingsScreen() {
  const { toast, openModal, closeModal } = useApp()
  const [tab, setTab] = useState<'general'|'email'|'reminders'|'security'>('general')
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [rules, setRules] = useState<ReminderRule[]>([])
  const [settings, setSettings] = useState({ org_name: 'City Hospital', pass_min_len: 8, session_timeout: 30, allow_self_registration: false })

  useEffect(() => {
    ;(async () => {
      const [tmpl, rul, sets] = await Promise.all([
        supabase.from('email_templates').select('*'),
        supabase.from('reminder_rules').select('*'),
        supabase.from('app_settings').select('*'),
      ])
      if (tmpl.data && tmpl.data.length > 0) setTemplates(tmpl.data)
      else setTemplates(EMAIL_TEMPLATES)
      if (rul.data && rul.data.length > 0) setRules(rul.data)
      else setRules(REMINDER_RULES)
      if (sets.data) {
        const map: Record<string, string> = {}
        sets.data.forEach((s: { key: string; value: string }) => map[s.key] = s.value)
        setSettings(prev => ({
          org_name: map.org_name ?? prev.org_name,
          pass_min_len: parseInt(map.pass_min_len ?? '8'),
          session_timeout: parseInt(map.session_timeout ?? '30'),
          allow_self_registration: map.allow_self_registration === 'true',
        }))
      }
    })()
  }, [])

  async function saveGeneral() {
    const entries = Object.entries(settings).map(([key, value]) => ({ key, value: String(value) }))
    for (const e of entries) {
      await supabase.from('app_settings').upsert(e, { onConflict: 'key' })
    }
    toast('Settings saved')
  }

  async function toggleRule(id: string, enabled: boolean) {
    await supabase.from('reminder_rules').update({ enabled }).eq('id', id)
    setRules(rs => rs.map(r => r.id === id ? { ...r, enabled } : r))
    toast(`Reminder ${enabled ? 'enabled' : 'disabled'}`)
  }

  return (
    <div className="screen-container">
      <div className="screen-header">
        <div>
          <h1 className="screen-title">System Settings</h1>
          <p className="screen-subtitle">Configure platform behavior</p>
        </div>
      </div>

      <div className="tab-row">
        {(['general','email','reminders','security'] as const).map(t => (
          <button key={t} className={`tab-btn${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'general' && (
        <div className="card settings-card">
          <h3>General Settings</h3>
          <div className="form-group"><label>Organization Name</label>
            <input value={settings.org_name} onChange={e => setSettings(s => ({...s, org_name: e.target.value}))} />
          </div>
          <div className="form-row">
            <div className="form-group"><label>Min Password Length</label>
              <input type="number" value={settings.pass_min_len} onChange={e => setSettings(s => ({...s, pass_min_len: parseInt(e.target.value)}))} min={6} max={32} />
            </div>
            <div className="form-group"><label>Session Timeout (min)</label>
              <input type="number" value={settings.session_timeout} onChange={e => setSettings(s => ({...s, session_timeout: parseInt(e.target.value)}))} min={5} />
            </div>
          </div>
          <div className="form-group checkbox-group">
            <label><input type="checkbox" checked={settings.allow_self_registration} onChange={e => setSettings(s => ({...s, allow_self_registration: e.target.checked}))} /> Allow self-registration</label>
          </div>
          <button className="btn btn-primary" onClick={saveGeneral}>Save Settings</button>
        </div>
      )}

      {tab === 'email' && (
        <div className="card">
          <div className="card-header"><h3>Email Templates</h3></div>
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Template</th><th>Subject</th><th>Trigger</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {templates.map(t => (
                  <tr key={t.id}>
                    <td>{t.name}</td>
                    <td>{t.subject}</td>
                    <td>{t.trigger_event}</td>
                    <td><span className={`badge ${t.active ? 'badge-green' : 'badge-gray'}`}>{t.active ? 'Active' : 'Inactive'}</span></td>
                    <td>
                      <button className="btn btn-sm" onClick={() => openModal({ title: t.name, wide: true, body:
                        <div className="modal-form">
                          <div className="form-group"><label>Subject</label><input defaultValue={t.subject} /></div>
                          <div className="form-group"><label>Body</label><textarea rows={6} defaultValue={t.body} /></div>
                          <div className="form-group"><label>Dynamic Fields</label><input defaultValue={t.dynamic_fields} /></div>
                          <div className="modal-form-actions"><button className="btn btn-primary" onClick={() => { closeModal(); toast('Template saved') }}>Save</button></div>
                        </div>
                      })}>Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'reminders' && (
        <div className="card">
          <div className="card-header"><h3>Reminder Rules</h3></div>
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Rule Name</th><th>Schedule</th><th>Channels</th><th>Enabled</th></tr></thead>
              <tbody>
                {rules.map(r => (
                  <tr key={r.id}>
                    <td>{r.rule_name}</td>
                    <td>{r.schedule_detail}</td>
                    <td>{r.channels}</td>
                    <td>
                      <label className="toggle-switch">
                        <input type="checkbox" checked={r.enabled} onChange={e => toggleRule(r.id, e.target.checked)} />
                        <span className="toggle-slider" />
                      </label>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'security' && (
        <div className="card settings-card">
          <h3>Security Settings</h3>
          <div className="settings-info-row"><span>Two-Factor Authentication</span><span className="badge badge-amber">Coming Soon</span></div>
          <div className="settings-info-row"><span>Single Sign-On (SSO)</span><span className="badge badge-amber">Coming Soon</span></div>
          <div className="settings-info-row"><span>Audit Log Retention</span><span>90 days</span></div>
          <div className="settings-info-row"><span>Failed Login Lockout</span><span>5 attempts</span></div>
        </div>
      )}
    </div>
  )
}
