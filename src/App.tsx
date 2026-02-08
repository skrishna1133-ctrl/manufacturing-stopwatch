import { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Lap {
  lapNumber: number;
  lapTime: number;
  cumulativeTime: number;
  note: string;
}

interface SavedSession {
  id: string;
  name: string;
  date: string;
  totalTime: number;
  laps: Lap[];
}

function App() {
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [laps, setLaps] = useState<Lap[]>([]);
  const [sessionName, setSessionName] = useState('');
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [currentLapIndex, setCurrentLapIndex] = useState<number | null>(null);
  const [savedSessions, setSavedSessions] = useState<SavedSession[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const intervalRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const lastLapTimeRef = useRef<number>(0);

  const formatTime = (ms: number): string => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const milliseconds = ms % 1000;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
  };

  // Load saved sessions from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('stopwatch-sessions');
    if (stored) {
      try {
        setSavedSessions(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to load sessions', e);
      }
    }
  }, []);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = window.setInterval(() => {
        setElapsedTime(Date.now() - startTimeRef.current);
      }, 10);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning]);

  const handleStart = () => {
    const now = Date.now();
    startTimeRef.current = now - elapsedTime;
    setIsRunning(true);
  };

  const handlePause = () => setIsRunning(false);

  const handleLap = () => {
    // Immediately capture lap time
    const currentTime = elapsedTime;
    const lapTime = currentTime - lastLapTimeRef.current;
    const newLap = {
      lapNumber: laps.length + 1,
      lapTime,
      cumulativeTime: currentTime,
      note: ''
    };
    setLaps([...laps, newLap]);
    lastLapTimeRef.current = currentTime;

    // Show note input for this lap
    setCurrentLapIndex(laps.length);
    setNoteText('');
    setShowNoteInput(true);
  };

  const handleSaveNote = () => {
    if (currentLapIndex !== null) {
      const updatedLaps = [...laps];
      updatedLaps[currentLapIndex].note = noteText;
      setLaps(updatedLaps);
    }
    setShowNoteInput(false);
    setNoteText('');
    setCurrentLapIndex(null);
  };

  const handleCancelNote = () => {
    setShowNoteInput(false);
    setNoteText('');
    setCurrentLapIndex(null);
  };

  const handleReset = () => {
    if (laps.length > 0 && !window.confirm('Clear all data?')) return;
    setIsRunning(false);
    setElapsedTime(0);
    setLaps([]);
    setSessionName('');
    startTimeRef.current = 0;
    lastLapTimeRef.current = 0;
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  const handleSaveSession = () => {
    if (laps.length === 0) {
      alert('No data to save!');
      return;
    }

    const session: SavedSession = {
      id: Date.now().toString(),
      name: sessionName || `Session ${new Date().toLocaleString()}`,
      date: new Date().toISOString(),
      totalTime: elapsedTime,
      laps: laps
    };

    const updated = [...savedSessions, session];
    setSavedSessions(updated);
    localStorage.setItem('stopwatch-sessions', JSON.stringify(updated));

    alert('Session saved successfully!');

    // Reset for new session
    setIsRunning(false);
    setElapsedTime(0);
    setLaps([]);
    setSessionName('');
    startTimeRef.current = 0;
    lastLapTimeRef.current = 0;
  };

  const exportToCSV = (sessions: SavedSession[] = savedSessions) => {
    let csv = 'Session Name,Date,Lap #,Lap Time,Cumulative Time,Note\n';

    sessions.forEach(session => {
      session.laps.forEach(lap => {
        csv += `"${session.name}","${new Date(session.date).toLocaleString()}",${lap.lapNumber},${formatTime(lap.lapTime)},${formatTime(lap.cumulativeTime)},"${lap.note}"\n`;
      });
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `time-study-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const exportToExcel = (sessions: SavedSession[] = savedSessions) => {
    const data: any[] = [];

    sessions.forEach(session => {
      session.laps.forEach(lap => {
        data.push({
          'Session Name': session.name,
          'Date': new Date(session.date).toLocaleString(),
          'Lap #': lap.lapNumber,
          'Lap Time': formatTime(lap.lapTime),
          'Cumulative Time': formatTime(lap.cumulativeTime),
          'Note': lap.note
        });
      });
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Time Study');
    XLSX.writeFile(wb, `time-study-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const exportToPDF = (sessions: SavedSession[] = savedSessions) => {
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text('Manufacturing Time Study Report', 14, 20);
    doc.setFontSize(11);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);

    const tableData: any[] = [];
    sessions.forEach(session => {
      session.laps.forEach(lap => {
        tableData.push([
          session.name,
          new Date(session.date).toLocaleString(),
          lap.lapNumber,
          formatTime(lap.lapTime),
          formatTime(lap.cumulativeTime),
          lap.note
        ]);
      });
    });

    autoTable(doc, {
      head: [['Session', 'Date', 'Lap #', 'Lap Time', 'Cumulative', 'Note']],
      body: tableData,
      startY: 35,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [25, 118, 210] }
    });

    doc.save(`time-study-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const clearHistory = () => {
    if (!window.confirm('Delete all saved sessions? This cannot be undone.')) return;
    setSavedSessions([]);
    localStorage.removeItem('stopwatch-sessions');
    alert('History cleared!');
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)', padding: '20px' }}>
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        <h1 style={{ color: '#1976d2', textAlign: 'center', marginBottom: '20px' }}>Time Study Stopwatch</h1>

        <input
          type="text"
          placeholder="Session Name"
          value={sessionName}
          onChange={(e) => setSessionName(e.target.value)}
          style={{ width: '100%', padding: '12px', fontSize: '1rem', border: '2px solid #e0e0e0', borderRadius: '8px', marginBottom: '20px', boxSizing: 'border-box' }}
        />

        <div style={{ fontSize: '4rem', fontWeight: 'bold', textAlign: 'center', fontFamily: 'monospace', margin: '30px 0', padding: '20px', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', borderRadius: '15px' }}>
          {formatTime(elapsedTime)}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
          {!isRunning ? (
            <button onClick={handleStart} style={{ ...btnStyle, background: '#4caf50' }}>
              {elapsedTime === 0 ? 'Start' : 'Resume'}
            </button>
          ) : (
            <button onClick={handlePause} style={{ ...btnStyle, background: '#ff9800' }}>Pause</button>
          )}
          <button onClick={handleLap} disabled={!isRunning} style={{ ...btnStyle, background: '#2196f3', opacity: !isRunning ? 0.5 : 1 }}>Lap</button>
          <button onClick={handleReset} disabled={isRunning} style={{ ...btnStyle, background: '#f44336', opacity: isRunning ? 0.5 : 1 }}>Reset</button>
          <button onClick={handleSaveSession} disabled={isRunning || laps.length === 0} style={{ ...btnStyle, background: '#9c27b0', gridColumn: '1 / -1', opacity: (isRunning || laps.length === 0) ? 0.5 : 1 }}>Save Session</button>
        </div>

        {/* Export Buttons */}
        {(laps.length > 0 || savedSessions.length > 0) && (
          <div style={{ marginBottom: '20px', padding: '15px', background: 'white', borderRadius: '10px', border: '2px solid #e0e0e0' }}>
            <h3 style={{ marginBottom: '10px', fontSize: '1rem' }}>Export Current/All Data</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
              <button onClick={() => exportToCSV(laps.length > 0 ? [{ id: 'current', name: sessionName || 'Current', date: new Date().toISOString(), totalTime: elapsedTime, laps }] : savedSessions)} style={{ ...btnStyle, background: '#00897b', padding: '10px', fontSize: '0.9rem' }}>CSV</button>
              <button onClick={() => exportToExcel(laps.length > 0 ? [{ id: 'current', name: sessionName || 'Current', date: new Date().toISOString(), totalTime: elapsedTime, laps }] : savedSessions)} style={{ ...btnStyle, background: '#1e88e5', padding: '10px', fontSize: '0.9rem' }}>Excel</button>
              <button onClick={() => exportToPDF(laps.length > 0 ? [{ id: 'current', name: sessionName || 'Current', date: new Date().toISOString(), totalTime: elapsedTime, laps }] : savedSessions)} style={{ ...btnStyle, background: '#e53935', padding: '10px', fontSize: '0.9rem' }}>PDF</button>
            </div>
          </div>
        )}

        {/* History Toggle */}
        {savedSessions.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <button onClick={() => setShowHistory(!showHistory)} style={{ ...btnStyle, background: '#607d8b', width: '100%' }}>
              {showHistory ? 'Hide' : 'Show'} History ({savedSessions.length} sessions)
            </button>
          </div>
        )}

        {showNoteInput && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
            <div style={{ background: 'white', borderRadius: '12px', padding: '25px', maxWidth: '500px', width: '100%' }}>
              <h3>Add Note for This Lap</h3>
              <textarea
                placeholder="Type note (e.g., 'Bolt tightening')"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                rows={4}
                style={{ width: '100%', padding: '12px', fontSize: '1rem', border: '2px solid #e0e0e0', borderRadius: '8px', marginBottom: '15px', boxSizing: 'border-box' }}
                autoFocus
              />
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={handleSaveNote} style={{ ...btnStyle, background: '#1976d2', flex: 1 }}>Save Note</button>
                <button onClick={handleCancelNote} style={{ ...btnStyle, background: '#e0e0e0', flex: 1, color: '#333' }}>Skip</button>
              </div>
            </div>
          </div>
        )}

        {/* History View */}
        {showHistory && savedSessions.length > 0 && (
          <div style={{ marginBottom: '30px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h2>Session History</h2>
              <button onClick={clearHistory} style={{ ...btnStyle, background: '#f44336', padding: '8px 15px', fontSize: '0.85rem' }}>Clear History</button>
            </div>
            {[...savedSessions].reverse().map((session) => (
              <div key={session.id} style={{ background: 'white', border: '2px solid #9c27b0', borderRadius: '10px', padding: '15px', marginBottom: '15px' }}>
                <div style={{ marginBottom: '10px', paddingBottom: '10px', borderBottom: '2px solid #f0f0f0' }}>
                  <h3 style={{ color: '#9c27b0', marginBottom: '5px' }}>{session.name}</h3>
                  <div style={{ fontSize: '0.9rem', color: '#666' }}>
                    <div>Date: {new Date(session.date).toLocaleString()}</div>
                    <div>Total Time: {formatTime(session.totalTime)}</div>
                    <div>Laps: {session.laps.length}</div>
                  </div>
                </div>
                {session.laps.map((lap) => (
                  <div key={lap.lapNumber} style={{ background: '#f5f5f5', borderRadius: '8px', padding: '12px', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                      <span style={{ fontWeight: 'bold', color: '#9c27b0' }}>Lap #{lap.lapNumber}</span>
                      <span style={{ fontSize: '1.1rem', fontWeight: 'bold', fontFamily: 'monospace' }}>{formatTime(lap.lapTime)}</span>
                    </div>
                    <div style={{ fontSize: '0.85rem' }}>
                      <div><span style={{ fontWeight: 600, color: '#666' }}>Cumulative: </span><span style={{ fontFamily: 'monospace' }}>{formatTime(lap.cumulativeTime)}</span></div>
                      {lap.note && <div><span style={{ fontWeight: 600, color: '#666' }}>Note: </span><span>{lap.note}</span></div>}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Current Laps */}
        {laps.length > 0 && (
          <div>
            <h2>Current Laps ({laps.length})</h2>
            {[...laps].reverse().map((lap) => (
              <div key={lap.lapNumber} style={{ background: 'white', border: '2px solid #e0e0e0', borderRadius: '10px', padding: '15px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span style={{ fontWeight: 'bold', color: '#1976d2' }}>Lap #{lap.lapNumber}</span>
                  <span style={{ fontSize: '1.3rem', fontWeight: 'bold', fontFamily: 'monospace' }}>{formatTime(lap.lapTime)}</span>
                </div>
                <div style={{ paddingTop: '10px', borderTop: '1px solid #f0f0f0' }}>
                  <div><span style={{ fontWeight: 600, color: '#666' }}>Cumulative: </span><span style={{ fontFamily: 'monospace' }}>{formatTime(lap.cumulativeTime)}</span></div>
                  {lap.note && <div><span style={{ fontWeight: 600, color: '#666' }}>Note: </span><span>{lap.note}</span></div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  padding: '15px 20px',
  fontSize: '1rem',
  fontWeight: 600,
  border: 'none',
  borderRadius: '8px',
  cursor: 'pointer',
  color: 'white'
};

export default App;
