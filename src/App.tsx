import { useState, useEffect, useRef } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Lap {
  id: string
  lapNumber: number
  splitTime: number  // ms from session start to this lap
  lapTime: number    // ms since previous lap (or since start if lap 1)
  timestamp: number  // Date.now() when recorded
  tags: string[]
  note: string
}

interface Session {
  id: string
  startedAt: number
  savedAt: number
  totalTime: number
  laps: Lap[]
}

type View = 'watch' | 'history'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(ms: number): string {
  if (ms < 0) ms = 0
  const tenths = Math.floor((ms % 1000) / 100)
  const totalSec = Math.floor(ms / 1000)
  const sec = totalSec % 60
  const min = Math.floor(totalSec / 60) % 60
  const hr = Math.floor(totalSec / 3600)
  const mm = String(min).padStart(2, '0')
  const ss = String(sec).padStart(2, '0')
  if (hr > 0) return `${String(hr).padStart(2, '0')}:${mm}:${ss}.${tenths}`
  return `${mm}:${ss}.${tenths}`
}

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

const PALETTE = [
  '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b',
  '#ef4444', '#06b6d4', '#f97316', '#ec4899',
  '#84cc16', '#a855f7',
]

function tagColor(tag: string, tags: string[]): string {
  const i = tags.indexOf(tag)
  return PALETTE[i >= 0 ? i % PALETTE.length : 0]
}

const SK = { sessions: 'sw2_sessions', tags: 'sw2_tags' }
const DEFAULT_TAGS = ['Run', 'Setup', 'Idle', 'Downtime', 'Inspection']

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [view, setView] = useState<View>('watch')

  // ── Timer ──
  const [running, setRunning] = useState(false)
  const [displayMs, setDisplayMs] = useState(0)
  const [laps, setLaps] = useState<Lap[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startRef = useRef<number | null>(null)  // Date.now() when last resumed
  const baseRef = useRef<number>(0)             // accumulated ms from prior runs
  const sessionStartRef = useRef<number | null>(null)

  // ── Tags ──
  const [tags, setTags] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(SK.tags) || 'null') ?? DEFAULT_TAGS }
    catch { return DEFAULT_TAGS }
  })
  const [showTagMgr, setShowTagMgr] = useState(false)
  const [newTag, setNewTag] = useState('')

  // ── History ──
  const [sessions, setSessions] = useState<Session[]>(() => {
    try { return JSON.parse(localStorage.getItem(SK.sessions) || '[]') }
    catch { return [] }
  })
  const [expanded, setExpanded] = useState<string | null>(null)

  // Persist
  useEffect(() => { localStorage.setItem(SK.tags, JSON.stringify(tags)) }, [tags])
  useEffect(() => { localStorage.setItem(SK.sessions, JSON.stringify(sessions)) }, [sessions])

  // ── Handlers ──

  const handleStartStop = () => {
    if (running) {
      // Stop
      baseRef.current += Date.now() - startRef.current!
      startRef.current = null
      clearInterval(intervalRef.current!)
      intervalRef.current = null
      setRunning(false)
    } else {
      // Start / Resume
      if (sessionStartRef.current === null) {
        sessionStartRef.current = Date.now()
      }
      startRef.current = Date.now()
      intervalRef.current = setInterval(() => {
        setDisplayMs(baseRef.current + Date.now() - startRef.current!)
      }, 30)
      setRunning(true)
    }
  }

  const handleLap = () => {
    if (!running && displayMs === 0) return
    const now = Date.now()
    const split = baseRef.current + (running && startRef.current ? now - startRef.current : 0)
    const prev = laps.length > 0 ? laps[laps.length - 1].splitTime : 0
    const lap: Lap = {
      id: `${now}-${Math.random()}`,
      lapNumber: laps.length + 1,
      splitTime: split,
      lapTime: split - prev,
      timestamp: now,
      tags: [],
      note: '',
    }
    setLaps(p => [...p, lap])
    setEditingId(lap.id)
  }

  const handleClear = () => {
    if (laps.length === 0 && displayMs === 0) return
    if (running) {
      baseRef.current += Date.now() - startRef.current!
      startRef.current = null
      clearInterval(intervalRef.current!)
      intervalRef.current = null
      setRunning(false)
    }
    if (laps.length > 0) {
      const session: Session = {
        id: String(Date.now()),
        startedAt: sessionStartRef.current ?? Date.now(),
        savedAt: Date.now(),
        totalTime: baseRef.current,
        laps: [...laps],
      }
      setSessions(p => [session, ...p])
    }
    setLaps([])
    setDisplayMs(0)
    baseRef.current = 0
    sessionStartRef.current = null
    setEditingId(null)
  }

  const toggleLapTag = (lapId: string, tag: string) => {
    setLaps(p => p.map(l => {
      if (l.id !== lapId) return l
      const has = l.tags.includes(tag)
      return { ...l, tags: has ? l.tags.filter(t => t !== tag) : [...l.tags, tag] }
    }))
  }

  const updateLapNote = (lapId: string, note: string) => {
    setLaps(p => p.map(l => l.id === lapId ? { ...l, note } : l))
  }

  const addTag = () => {
    const t = newTag.trim()
    if (!t || tags.includes(t)) return
    setTags(p => [...p, t])
    setNewTag('')
  }

  const removeTag = (tag: string) => {
    setTags(p => p.filter(t => t !== tag))
    setLaps(p => p.map(l => ({ ...l, tags: l.tags.filter(t => t !== tag) })))
  }

  const deleteSession = (id: string) => setSessions(p => p.filter(s => s.id !== id))

  const exportCSV = (s: Session) => {
    const rows = [
      ['Lap', 'Lap Time', 'Split Time', 'Tags', 'Note', 'Recorded At'],
      ...s.laps.map(l => [
        l.lapNumber,
        fmt(l.lapTime),
        fmt(l.splitTime),
        l.tags.join('; '),
        l.note,
        new Date(l.timestamp).toLocaleString(),
      ]),
    ]
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })),
      download: `time-study-${new Date(s.startedAt).toISOString().slice(0, 10)}.csv`,
    })
    a.click()
  }

  // Current running lap display
  const prevSplit = laps.length > 0 ? laps[laps.length - 1].splitTime : 0
  const currentLapMs = displayMs - prevSplit

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={C.root}>

      {/* ── Header ── */}
      <header style={C.header}>
        <span style={C.logo}>⏱ Time Study</span>
        <nav style={C.nav}>
          <button
            style={view === 'watch' ? C.navOn : C.navOff}
            onClick={() => setView('watch')}
          >Stopwatch</button>
          <button
            style={view === 'history' ? C.navOn : C.navOff}
            onClick={() => setView('history')}
          >History{sessions.length > 0 ? ` (${sessions.length})` : ''}</button>
          <button style={C.tagMgrBtn} onClick={() => setShowTagMgr(true)}>⚙ Tags</button>
        </nav>
      </header>

      {/* ── Stopwatch view ── */}
      {view === 'watch' && (
        <div style={C.watchWrap}>

          {/* Big timer */}
          <div style={C.timerBlock}>
            <div style={C.timerText}>{fmt(displayMs)}</div>
            {(running || displayMs > 0) && laps.length > 0 && (
              <div style={C.timerSub}>
                lap {laps.length + 1} &nbsp;·&nbsp; {fmt(currentLapMs)}
              </div>
            )}
          </div>

          {/* Controls */}
          <div style={C.ctrlRow}>
            <button style={running ? C.btnStop : C.btnStart} onClick={handleStartStop}>
              {running ? 'STOP' : displayMs > 0 ? 'RESUME' : 'START'}
            </button>
            <button
              style={running || displayMs > 0 ? C.btnLap : C.btnOff}
              onClick={handleLap}
              disabled={!running && displayMs === 0}
            >LAP</button>
            <button
              style={laps.length > 0 || displayMs > 0 ? C.btnClear : C.btnOff}
              onClick={handleClear}
              disabled={laps.length === 0 && displayMs === 0}
            >CLEAR</button>
          </div>

          {/* Lap table */}
          {laps.length > 0 && (
            <div style={C.lapTable}>
              <div style={C.lapHead}>
                <span>#</span>
                <span>Lap Time</span>
                <span>Split</span>
                <span>Tags / Note</span>
              </div>
              {[...laps].reverse().map(lap => (
                <LapRow
                  key={lap.id}
                  lap={lap}
                  open={editingId === lap.id}
                  latest={lap.lapNumber === laps.length}
                  tags={tags}
                  onClickRow={() => setEditingId(editingId === lap.id ? null : lap.id)}
                  onToggleTag={tag => toggleLapTag(lap.id, tag)}
                  onNote={note => updateLapNote(lap.id, note)}
                  getColor={t => tagColor(t, tags)}
                />
              ))}
            </div>
          )}

          {laps.length === 0 && displayMs === 0 && (
            <p style={C.hint}>Press START, then LAP to record splits.<br />CLEAR saves the session to History.</p>
          )}
        </div>
      )}

      {/* ── History view ── */}
      {view === 'history' && (
        <div style={C.histWrap}>
          {sessions.length === 0
            ? <p style={C.empty}>No sessions yet.<br />Record laps and press CLEAR to save a session.</p>
            : sessions.map(s => (
              <SessionCard
                key={s.id}
                session={s}
                open={expanded === s.id}
                onToggle={() => setExpanded(expanded === s.id ? null : s.id)}
                onDelete={() => deleteSession(s.id)}
                onExport={() => exportCSV(s)}
                getColor={t => tagColor(t, tags)}
              />
            ))
          }
        </div>
      )}

      {/* ── Tag Manager Modal ── */}
      {showTagMgr && (
        <div style={C.overlay} onClick={() => setShowTagMgr(false)}>
          <div style={C.modal} onClick={e => e.stopPropagation()}>
            <div style={C.modalHead}>
              <span style={C.modalTitle}>Manage Tags</span>
              <button style={C.closeBtn} onClick={() => setShowTagMgr(false)}>✕</button>
            </div>
            <div style={C.tagGrid}>
              {tags.length === 0 && (
                <span style={{ color: '#475569', fontSize: 13 }}>No tags yet — add one below.</span>
              )}
              {tags.map(t => (
                <span key={t} style={{ ...C.chip, background: tagColor(t, tags) }}>
                  {t}
                  <button style={C.chipX} onClick={() => removeTag(t)}>×</button>
                </span>
              ))}
            </div>
            <div style={C.addRow}>
              <input
                style={C.tagInput}
                placeholder="New tag name…"
                value={newTag}
                onChange={e => setNewTag(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addTag()}
                autoFocus
              />
              <button style={C.addBtn} onClick={addTag}>Add</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── LapRow ──────────────────────────────────────────────────────────────────

function LapRow({ lap, open, latest, tags, onClickRow, onToggleTag, onNote, getColor }: {
  lap: Lap
  open: boolean
  latest: boolean
  tags: string[]
  onClickRow: () => void
  onToggleTag: (t: string) => void
  onNote: (n: string) => void
  getColor: (t: string) => string
}) {
  return (
    <div style={{ ...C.lapRowWrap, background: latest ? '#0d1526' : 'transparent' }}>
      <div style={C.lapRow} onClick={onClickRow}>
        <span style={C.lapNum}>#{lap.lapNumber}</span>
        <span style={C.lapTime}>{fmt(lap.lapTime)}</span>
        <span style={C.lapSplit}>{fmt(lap.splitTime)}</span>
        <div style={C.lapMeta}>
          {lap.tags.map(t => (
            <span key={t} style={{ ...C.chip, background: getColor(t), fontSize: 11, padding: '1px 7px' }}>{t}</span>
          ))}
          {lap.note && (
            <span style={C.noteSnip}>{lap.note.length > 24 ? lap.note.slice(0, 24) + '…' : lap.note}</span>
          )}
          <span style={C.caret}>{open ? '▲' : '▼'}</span>
        </div>
      </div>

      {open && (
        <div style={C.editor}>
          <div style={C.editorTags}>
            {tags.length === 0 && (
              <span style={{ color: '#475569', fontSize: 12 }}>No tags yet — click ⚙ Tags to add some.</span>
            )}
            {tags.map(t => {
              const active = lap.tags.includes(t)
              return (
                <button key={t} style={{
                  ...C.tagToggle,
                  background: active ? getColor(t) : 'transparent',
                  borderColor: getColor(t),
                  color: active ? '#fff' : getColor(t),
                }} onClick={() => onToggleTag(t)}>{t}</button>
              )
            })}
          </div>
          <textarea
            style={C.noteArea}
            placeholder="Add a note for this lap…"
            value={lap.note}
            onChange={e => onNote(e.target.value)}
            rows={2}
          />
        </div>
      )}
    </div>
  )
}

// ─── SessionCard ─────────────────────────────────────────────────────────────

function SessionCard({ session, open, onToggle, onDelete, onExport, getColor }: {
  session: Session
  open: boolean
  onToggle: () => void
  onDelete: () => void
  onExport: () => void
  getColor: (t: string) => string
}) {
  const avg = session.laps.length
    ? session.laps.reduce((s, l) => s + l.lapTime, 0) / session.laps.length
    : 0

  return (
    <div style={C.sessCard}>
      <div style={C.sessHead} onClick={onToggle}>
        <div>
          <div style={C.sessDate}>{fmtDate(session.startedAt)}</div>
          <div style={C.sessMeta}>
            {session.laps.length} laps &nbsp;·&nbsp; total {fmt(session.totalTime)} &nbsp;·&nbsp; avg {fmt(avg)}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button style={C.sessBtnBlue} onClick={e => { e.stopPropagation(); onExport() }}>CSV</button>
          <button style={C.sessBtnRed} onClick={e => { e.stopPropagation(); onDelete() }}>Delete</button>
          <span style={{ ...C.caret, marginLeft: 4 }}>{open ? '▲' : '▼'}</span>
        </div>
      </div>

      {open && (
        <div style={C.sessBody}>
          <div style={C.lapHead}>
            <span>#</span><span>Lap Time</span><span>Split</span><span>Tags / Note</span>
          </div>
          {session.laps.map(l => (
            <div key={l.id} style={{ ...C.lapRow, cursor: 'default' }}>
              <span style={C.lapNum}>#{l.lapNumber}</span>
              <span style={C.lapTime}>{fmt(l.lapTime)}</span>
              <span style={C.lapSplit}>{fmt(l.splitTime)}</span>
              <div style={C.lapMeta}>
                {l.tags.map(t => (
                  <span key={t} style={{ ...C.chip, background: getColor(t), fontSize: 11, padding: '1px 7px' }}>{t}</span>
                ))}
                {l.note && <span style={C.noteSnip}>{l.note}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const C: Record<string, React.CSSProperties> = {
  root: {
    minHeight: '100vh',
    background: '#0b0f1a',
    color: '#e2e8f0',
    fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
    display: 'flex',
    flexDirection: 'column',
  },

  // Header
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 16px',
    borderBottom: '1px solid #1e293b',
    background: '#0b0f1a',
    position: 'sticky',
    top: 0,
    zIndex: 20,
    flexWrap: 'wrap',
    gap: 8,
  },
  logo: {
    fontSize: 14,
    fontWeight: 700,
    color: '#64748b',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
  },
  nav: { display: 'flex', gap: 6, alignItems: 'center' },
  navOff: {
    background: 'transparent',
    border: '1px solid #1e293b',
    color: '#475569',
    padding: '5px 12px',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 13,
  },
  navOn: {
    background: '#1e293b',
    border: '1px solid #334155',
    color: '#f1f5f9',
    padding: '5px 12px',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
  },
  tagMgrBtn: {
    background: '#1e293b',
    border: '1px solid #334155',
    color: '#64748b',
    padding: '5px 10px',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 13,
  },

  // Stopwatch
  watchWrap: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    padding: '28px 16px 16px',
    maxWidth: 620,
    margin: '0 auto',
    width: '100%',
  },
  timerBlock: { textAlign: 'center', marginBottom: 28 },
  timerText: {
    fontSize: 'clamp(60px, 17vw, 96px)',
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums',
    letterSpacing: '0.02em',
    lineHeight: 1,
    color: '#f8fafc',
  },
  timerSub: {
    fontSize: 14,
    color: '#475569',
    marginTop: 8,
    fontVariantNumeric: 'tabular-nums',
  },

  // Buttons
  ctrlRow: { display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 28 },
  btnStart: {
    background: '#16a34a', border: 'none', color: '#fff',
    padding: '16px 28px', borderRadius: 12, fontSize: 18, fontWeight: 700,
    cursor: 'pointer', minWidth: 110, letterSpacing: '0.04em',
  },
  btnStop: {
    background: '#dc2626', border: 'none', color: '#fff',
    padding: '16px 28px', borderRadius: 12, fontSize: 18, fontWeight: 700,
    cursor: 'pointer', minWidth: 110, letterSpacing: '0.04em',
  },
  btnLap: {
    background: '#1d4ed8', border: 'none', color: '#fff',
    padding: '16px 22px', borderRadius: 12, fontSize: 18, fontWeight: 700,
    cursor: 'pointer', letterSpacing: '0.04em',
  },
  btnClear: {
    background: '#374151', border: 'none', color: '#e2e8f0',
    padding: '16px 22px', borderRadius: 12, fontSize: 18, fontWeight: 700,
    cursor: 'pointer', letterSpacing: '0.04em',
  },
  btnOff: {
    background: '#111827', border: '1px solid #1e293b', color: '#1e293b',
    padding: '16px 22px', borderRadius: 12, fontSize: 18, fontWeight: 700,
    cursor: 'not-allowed', letterSpacing: '0.04em',
  },

  hint: {
    textAlign: 'center',
    color: '#1e293b',
    fontSize: 14,
    lineHeight: 1.8,
    marginTop: 12,
  },

  // Lap table
  lapTable: { flex: 1, overflowY: 'auto' },
  lapHead: {
    display: 'grid',
    gridTemplateColumns: '36px 90px 90px 1fr',
    padding: '6px 12px',
    fontSize: 11,
    color: '#334155',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    borderBottom: '1px solid #1e293b',
  },
  lapRowWrap: { borderBottom: '1px solid #0f172a' },
  lapRow: {
    display: 'grid',
    gridTemplateColumns: '36px 90px 90px 1fr',
    padding: '9px 12px',
    cursor: 'pointer',
    alignItems: 'center',
  },
  lapNum: { fontSize: 12, color: '#334155', fontWeight: 600 },
  lapTime: { fontSize: 14, fontVariantNumeric: 'tabular-nums', color: '#f1f5f9', fontWeight: 600 },
  lapSplit: { fontSize: 12, fontVariantNumeric: 'tabular-nums', color: '#475569' },
  lapMeta: { display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' },
  noteSnip: { fontSize: 12, color: '#475569', fontStyle: 'italic' },
  caret: { fontSize: 10, color: '#1e293b', marginLeft: 'auto' },

  // Lap editor (inline, opens below the lap row)
  editor: { padding: '8px 12px 12px', background: '#080c14', borderTop: '1px solid #1e293b' },
  editorTags: { display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  tagToggle: {
    padding: '4px 12px',
    borderRadius: 20,
    border: '1.5px solid',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
    transition: 'all 0.1s',
  },
  noteArea: {
    width: '100%',
    background: '#111827',
    border: '1px solid #1e293b',
    color: '#f1f5f9',
    borderRadius: 8,
    padding: 8,
    fontSize: 13,
    resize: 'vertical',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  },

  // History
  histWrap: {
    flex: 1,
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    maxWidth: 700,
    margin: '0 auto',
    width: '100%',
  },
  empty: {
    textAlign: 'center',
    color: '#1e293b',
    padding: '48px 24px',
    fontSize: 14,
    lineHeight: 2,
  },
  sessCard: {
    background: '#111827',
    border: '1px solid #1e293b',
    borderRadius: 10,
    overflow: 'hidden',
  },
  sessHead: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 14px',
    cursor: 'pointer',
  },
  sessDate: { fontSize: 14, fontWeight: 600, color: '#f1f5f9' },
  sessMeta: { fontSize: 12, color: '#475569', marginTop: 2 },
  sessBtnBlue: {
    background: '#1d4ed8', border: 'none', color: '#fff',
    padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 12,
  },
  sessBtnRed: {
    background: 'transparent',
    border: '1px solid #450a0a',
    color: '#f87171',
    padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 12,
  },
  sessBody: { borderTop: '1px solid #1e293b' },

  // Tag chip (shared across lap list, history, and tag manager)
  chip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '3px 9px',
    borderRadius: 20,
    color: '#fff',
    fontSize: 12,
    fontWeight: 600,
  },
  chipX: {
    background: 'rgba(255,255,255,0.25)',
    border: 'none',
    color: '#fff',
    width: 16,
    height: 16,
    borderRadius: '50%',
    cursor: 'pointer',
    fontSize: 13,
    lineHeight: 1,
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Tag manager modal
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.75)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  modal: {
    background: '#111827',
    border: '1px solid #1e293b',
    borderRadius: 12,
    padding: 24,
    width: '90%',
    maxWidth: 400,
  },
  modalHead: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: { fontSize: 16, fontWeight: 700, color: '#f1f5f9' },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    color: '#475569',
    fontSize: 20,
    cursor: 'pointer',
    lineHeight: 1,
  },
  tagGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
    minHeight: 40,
  },
  addRow: { display: 'flex', gap: 8 },
  tagInput: {
    flex: 1,
    background: '#0b0f1a',
    border: '1px solid #1e293b',
    color: '#f1f5f9',
    padding: '8px 12px',
    borderRadius: 8,
    fontSize: 14,
  },
  addBtn: {
    background: '#3b82f6',
    border: 'none',
    color: '#fff',
    padding: '8px 16px',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
  },
}
