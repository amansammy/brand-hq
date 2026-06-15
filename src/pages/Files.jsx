import { useEffect, useState, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase, logActivity, purgeEntity } from '../lib/supabase.js'
import { useAuth } from '../lib/auth.jsx'
import { Avatar, EmptyState, Spinner, PageHeader, Modal } from '../components/ui.jsx'
import { Comments } from '../components/Discussion.jsx'
import { LinkedTasks } from '../components/Links.jsx'
import { Icon } from '../lib/icons.jsx'
import { timeAgo, fileSize } from '../lib/util.js'

export default function Files() {
  const { user, profiles, can } = useAuth()
  const canUpload = can('files', 'upload')
  const canEdit = can('files', 'edit')
  const canDelete = can('files', 'delete')
  const [files, setFiles] = useState([])
  const [versions, setVersions] = useState([])
  const [commentCounts, setCommentCounts] = useState({})
  const [linkCounts, setLinkCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(null) // file id
  const [creating, setCreating] = useState(false)
  const [params, setParams] = useSearchParams()

  const load = useCallback(async () => {
    const [f, v, cm, lk] = await Promise.all([
      supabase.from('files').select('*').order('created_at', { ascending: false }),
      supabase.from('file_versions').select('*').order('version_no', { ascending: false }),
      supabase.from('comments').select('entity_id').eq('entity_type', 'file'),
      supabase.from('links').select('to_id').eq('to_type', 'file'),
    ])
    setFiles(f.data || [])
    setVersions(v.data || [])
    const cc = {}; (cm.data || []).forEach((r) => { cc[r.entity_id] = (cc[r.entity_id] || 0) + 1 })
    const lc = {}; (lk.data || []).forEach((r) => { lc[r.to_id] = (lc[r.to_id] || 0) + 1 })
    setCommentCounts(cc); setLinkCounts(lc)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const ch = supabase.channel('files')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'files' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'file_versions' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'links' }, load)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [load])

  // Deep-link: /files?open=<id>
  useEffect(() => {
    const id = params.get('open')
    if (id && files.some((f) => f.id === id)) setOpen(id)
  }, [params, files])

  function closeDetail() { setOpen(null); if (params.get('open')) setParams({}, { replace: true }) }

  const versionsFor = (fid) => versions.filter((v) => v.file_id === fid)
  if (loading) return <Spinner />

  return (
    <div>
      <PageHeader title="File vault" subtitle="Upload, version, and lock the final — PDFs, logos, anything."
        action={canUpload && <button className="btn btn-primary" onClick={() => setCreating(true)}><Icon name="upload" size={16} /> New file</button>} />

      {files.length === 0 ? (
        <EmptyState icon="files" title="No files yet"
          subtitle="Upload your manifesto draft, a logo, a moodboard PDF — every new version is kept so you can compare and pick the final."
          action={canUpload && <button className="btn btn-primary" onClick={() => setCreating(true)}><Icon name="upload" size={16} /> Upload a file</button>} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {files.map((f) => {
            const vs = versionsFor(f.id)
            const final = vs.find((v) => v.is_final)
            const latest = vs[0]
            return (
              <button key={f.id} onClick={() => setOpen(f.id)}
                className="card p-4 text-left hover:border-line-strong transition-colors">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-xl bg-accent-soft text-accent grid place-items-center shrink-0">
                    <Icon name="files" size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{f.name}</p>
                      {final && <span className="chip bg-accent-soft text-accent">✓ Final</span>}
                    </div>
                    {(final || latest) && (
                      <p className="text-xs text-muted mt-0.5 truncate flex items-center gap-1">
                        <Icon name="files" size={11} className="text-faint shrink-0" /> {(final || latest).file_name || 'file'}
                      </p>
                    )}
                    {f.description && <p className="text-sm text-muted mt-1 line-clamp-1">{f.description}</p>}
                    <div className="flex items-center gap-3 text-xs text-faint mt-2">
                      <span>{vs.length} version{vs.length !== 1 ? 's' : ''}</span>
                      {(commentCounts[f.id] > 0) && <span className="flex items-center gap-1"><Icon name="comment" size={11} /> {commentCounts[f.id]}</span>}
                      {(linkCounts[f.id] > 0) && <span className="flex items-center gap-1 text-accent"><Icon name="link" size={11} /> {linkCounts[f.id]}</span>}
                      {latest && <span>· {timeAgo(latest.created_at)}</span>}
                    </div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {creating && <NewFileModal user={user} onClose={() => setCreating(false)} onDone={(id) => { setCreating(false); load().then(() => setOpen(id)) }} />}
      {open && <FileDetail fileId={open} file={files.find((f) => f.id === open)} versions={versionsFor(open)}
        profiles={profiles} user={user} canUpload={canUpload} canEdit={canEdit} canDelete={canDelete}
        onClose={closeDetail} onChange={load} />}
    </div>
  )
}

async function uploadVersion({ fileId, fileObj, versionNo, note, userId }) {
  const safe = fileObj.name.replace(/[^\w.\-]+/g, '_')
  const path = `${fileId}/v${versionNo}-${safe}`
  const { error } = await supabase.storage.from('files').upload(path, fileObj, { upsert: true })
  if (error) throw error
  const { error: e2 } = await supabase.from('file_versions').insert({
    file_id: fileId, storage_path: path, file_name: fileObj.name, size_bytes: fileObj.size,
    note: note || null, version_no: versionNo, uploaded_by: userId,
  })
  if (e2) throw e2
}

function NewFileModal({ user, onClose, onDone }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [fileObj, setFileObj] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const inputRef = useRef()

  async function create() {
    if (!name.trim() || !fileObj) return
    setBusy(true); setErr('')
    try {
      const { data: f, error } = await supabase.from('files')
        .insert({ name: name.trim(), description: description.trim() || null, created_by: user.id }).select().single()
      if (error) throw error
      await uploadVersion({ fileId: f.id, fileObj, versionNo: 1, note: null, userId: user.id })
      logActivity({ verb: 'uploaded', entity_type: 'file', entity_id: f.id, summary: `added a file: ${f.name}`, meta: { title: f.name } })
      onDone(f.id)
    } catch (e) { setErr(e.message); setBusy(false) }
  }

  return (
    <Modal open onClose={onClose} title="New file"
      footer={<>
        <button onClick={onClose} className="btn btn-soft">Cancel</button>
        <button onClick={create} className="btn btn-primary" disabled={!name.trim() || !fileObj || busy}>{busy ? 'Uploading…' : 'Create'}</button>
      </>}>
      <div className="space-y-4">
        <div>
          <label className="label">Name</label>
          <input className="input" autoFocus placeholder="e.g. Brand manifesto" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label">Description (optional)</label>
          <input className="input" placeholder="What is this?" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div>
          <label className="label">First version</label>
          <button type="button" onClick={() => inputRef.current?.click()}
            className="w-full border border-dashed border-line-strong rounded-xl py-6 flex flex-col items-center gap-2 text-muted hover:border-accent hover:text-accent transition-colors">
            <Icon name="upload" size={22} />
            <span className="text-sm">{fileObj ? fileObj.name : 'Click to choose a file'}</span>
            {fileObj && <span className="text-xs text-faint">{fileSize(fileObj.size)}</span>}
          </button>
          <input ref={inputRef} type="file" className="hidden" onChange={(e) => setFileObj(e.target.files?.[0] || null)} />
        </div>
        {err && <p className="text-sm text-accent">{err}</p>}
      </div>
    </Modal>
  )
}

function FileDetail({ fileId, file, versions, profiles, user, canUpload, canEdit, canDelete, onClose, onChange }) {
  const byId = (id) => profiles.find((p) => p.id === id) || { id, display_name: 'Someone' }
  const [note, setNote] = useState('')
  const [fileObj, setFileObj] = useState(null)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef()
  const nextVersion = (versions[0]?.version_no || 0) + 1

  async function download(v) {
    const { data } = await supabase.storage.from('files').createSignedUrl(v.storage_path, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }
  async function markFinal(v) {
    await supabase.from('file_versions').update({ is_final: false }).eq('file_id', fileId)
    await supabase.from('file_versions').update({ is_final: true }).eq('id', v.id)
    logActivity({ verb: 'updated', entity_type: 'file', entity_id: fileId, summary: `marked v${v.version_no} of "${file?.name}" as final` })
    onChange()
  }
  async function addVersion() {
    if (!fileObj) return
    setBusy(true)
    try {
      await uploadVersion({ fileId, fileObj, versionNo: nextVersion, note, userId: user.id })
      logActivity({ verb: 'uploaded', entity_type: 'file', entity_id: fileId, summary: `uploaded v${nextVersion} of "${file?.name}"` })
      setFileObj(null); setNote(''); onChange()
    } finally { setBusy(false) }
  }
  async function removeFile() {
    if (!confirm('Delete this file and all its versions?')) return
    await supabase.from('files').delete().eq('id', fileId)
    await purgeEntity('file', fileId)
    onClose(); onChange()
  }

  return (
    <Modal open onClose={onClose} title={file?.name || 'File'} maxWidth="max-w-2xl"
      footer={canDelete && <button onClick={removeFile} className="btn btn-ghost text-accent border-accent-soft mr-auto"><Icon name="trash" size={15} /> Delete file</button>}>
      {file?.description && <p className="text-sm text-muted mb-4">{file.description}</p>}

      {/* Add new version */}
      {canUpload && (
      <div className="card bg-canvas p-3 mb-5">
        <div className="flex items-center gap-2 mb-2">
          <button type="button" onClick={() => inputRef.current?.click()} className="btn btn-soft">
            <Icon name="upload" size={15} /> {fileObj ? 'Change file' : `Upload v${nextVersion}`}
          </button>
          {fileObj && <span className="text-sm text-muted truncate">{fileObj.name} · {fileSize(fileObj.size)}</span>}
          <input ref={inputRef} type="file" className="hidden" onChange={(e) => setFileObj(e.target.files?.[0] || null)} />
        </div>
        {fileObj && (
          <div className="flex gap-2 animate-in">
            <input className="input h-9 text-sm" placeholder="What changed? (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
            <button onClick={addVersion} className="btn btn-primary h-9 shrink-0" disabled={busy}>{busy ? 'Uploading…' : 'Add version'}</button>
          </div>
        )}
      </div>
      )}

      {/* Version history */}
      <h3 className="text-sm font-semibold text-muted mb-2">Version history</h3>
      <div className="space-y-2 mb-6">
        {versions.map((v) => (
          <div key={v.id} className={`flex items-center gap-3 p-3 rounded-xl border ${v.is_final ? 'border-accent bg-accent-soft/40' : 'border-line'}`}>
            <div className="h-8 w-8 rounded-lg bg-surface border border-line grid place-items-center text-xs font-semibold shrink-0">v{v.version_no}</div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium truncate">{v.file_name || 'file'}</p>
                {v.is_final && <span className="chip bg-accent text-white">Final</span>}
              </div>
              <p className="text-xs text-faint">
                {fileSize(v.size_bytes)} · {byId(v.uploaded_by).display_name} · {timeAgo(v.created_at)}
                {v.note && <span className="text-muted"> — {v.note}</span>}
              </p>
            </div>
            <button onClick={() => download(v)} className="btn btn-soft h-8 px-2.5 shrink-0"><Icon name="download" size={15} /></button>
            {canEdit && !v.is_final && <button onClick={() => markFinal(v)} className="btn btn-soft h-8 px-2.5 shrink-0 text-accent"><Icon name="star" size={15} /></button>}
          </div>
        ))}
      </div>

      {/* Linked tasks */}
      <h3 className="text-sm font-semibold text-muted mb-2">Linked tasks</h3>
      <div className="mb-6"><LinkedTasks toType="file" toId={fileId} /></div>

      {/* Discussion */}
      <h3 className="text-sm font-semibold text-muted mb-2">Discussion</h3>
      <Comments entityType="file" entityId={fileId} compact />
    </Modal>
  )
}
