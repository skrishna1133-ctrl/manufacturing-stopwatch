import { useState, useRef, useEffect } from 'react';

function App() {
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [laps, setLaps] = useState<Array<{lapNumber: number, lapTime: number, cumulativeTime: number, note: string}>>([]);
  const [sessionName, setSessionName] = useState('');
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [currentLapIndex, setCurrentLapIndex] = useState<number | null>(null);

  const intervalRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const lastLapTimeRef = useRef<number>(0);

  const formatTime = (ms: number): string => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const milliseconds = ms % 1000;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
  };

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

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '30px' }}>
          {!isRunning ? (
            <button onClick={handleStart} style={{ ...btnStyle, background: '#4caf50' }}>
              {elapsedTime === 0 ? 'Start' : 'Resume'}
            </button>
          ) : (
            <button onClick={handlePause} style={{ ...btnStyle, background: '#ff9800' }}>Pause</button>
          )}
          <button onClick={handleLap} disabled={!isRunning} style={{ ...btnStyle, background: '#2196f3', opacity: !isRunning ? 0.5 : 1 }}>Lap</button>
          <button onClick={handleReset} disabled={isRunning} style={{ ...btnStyle, background: '#f44336', opacity: isRunning ? 0.5 : 1 }}>Reset</button>
        </div>

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

        {laps.length > 0 && (
          <div>
            <h2>Laps ({laps.length})</h2>
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
