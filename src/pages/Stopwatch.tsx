import { useState, useRef, useEffect } from 'react';
import { db } from '../db';

// Utility functions
const formatTime = (ms: number): string => {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const milliseconds = ms % 1000;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
};

interface Lap {
  lapNumber: number;
  lapTime: number;
  cumulativeTime: number;
  note: string;
  timestamp: number;
}

export default function Stopwatch() {
  // Stopwatch state
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [laps, setLaps] = useState<Lap[]>([]);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [sessionName, setSessionName] = useState('');
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);

  // Lap note input state
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [isListening, setIsListening] = useState(false);

  const intervalRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const lastLapTimeRef = useRef<number>(0);
  const recognitionRef = useRef<any>(null);

  // Voice recognition setup
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setNoteText(transcript);
        setIsListening(false);
      };

      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) recognitionRef.current.stop();
    };
  }, []);

  // Timer effect
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
    if (!isRunning) {
      const now = Date.now();
      if (sessionStartTime === null) {
        setSessionStartTime(now);
      }
      startTimeRef.current = now - elapsedTime;
      setIsRunning(true);
    }
  };

  const handlePause = () => {
    setIsRunning(false);
  };

  const handleLap = () => {
    setShowNoteInput(true);
  };

  const handleVoiceInput = () => {
    if (recognitionRef.current && !isListening) {
      setNoteText('');
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const handleAddLapWithNote = async () => {
    const currentTime = elapsedTime;
    const lapTime = currentTime - lastLapTimeRef.current;
    const newLap: Lap = {
      lapNumber: laps.length + 1,
      lapTime,
      cumulativeTime: currentTime,
      note: noteText,
      timestamp: Date.now()
    };

    setLaps([...laps, newLap]);
    lastLapTimeRef.current = currentTime;

    // Save to database if session exists
    if (currentSessionId) {
      await db.laps.add({
        sessionId: currentSessionId,
        lapNumber: newLap.lapNumber,
        lapTime: newLap.lapTime,
        cumulativeTime: newLap.cumulativeTime,
        note: newLap.note,
        timestamp: newLap.timestamp
      });
      await db.sessions.update(currentSessionId, { totalLaps: laps.length + 1 });
    }

    setShowNoteInput(false);
    setNoteText('');
    setIsListening(false);
  };

  const handleSaveSession = async () => {
    if (!sessionName.trim()) {
      alert('Please enter a session name');
      return;
    }

    if (currentSessionId) {
      await db.sessions.update(currentSessionId, {
        name: sessionName,
        endTime: Date.now(),
        totalLaps: laps.length
      });
    } else {
      const sessionId = await db.sessions.add({
        name: sessionName,
        startTime: sessionStartTime || Date.now(),
        endTime: Date.now(),
        totalLaps: laps.length,
        createdAt: Date.now()
      });

      for (const lap of laps) {
        await db.laps.add({
          sessionId: sessionId as number,
          lapNumber: lap.lapNumber,
          lapTime: lap.lapTime,
          cumulativeTime: lap.cumulativeTime,
          note: lap.note,
          timestamp: lap.timestamp
        });
      }

      setCurrentSessionId(sessionId as number);
    }

    alert('Session saved successfully!');
  };

  const handleReset = () => {
    if (laps.length > 0) {
      const confirmReset = window.confirm('This will clear the current session. Data will be lost unless you save first. Continue?');
      if (!confirmReset) return;
    }

    setIsRunning(false);
    setElapsedTime(0);
    setLaps([]);
    setSessionStartTime(null);
    setSessionName('');
    setCurrentSessionId(null);
    setShowNoteInput(false);
    startTimeRef.current = 0;
    lastLapTimeRef.current = 0;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
        <h1 style={{ color: '#1976d2', marginBottom: '15px' }}>Time Study Stopwatch</h1>
        <input
          type="text"
          placeholder="Session Name (e.g., Assembly Line A)"
          value={sessionName}
          onChange={(e) => setSessionName(e.target.value)}
          style={{
            width: '100%',
            padding: '12px',
            fontSize: '1rem',
            border: '2px solid #e0e0e0',
            borderRadius: '8px',
            boxSizing: 'border-box'
          }}
        />
      </div>

      <div style={{
        fontSize: '4rem',
        fontWeight: 'bold',
        textAlign: 'center',
        fontFamily: 'monospace',
        margin: '30px 0',
        padding: '20px',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        borderRadius: '15px',
        boxShadow: '0 4px 15px rgba(0,0,0,0.2)'
      }}>
        {formatTime(elapsedTime)}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '30px' }}>
        {!isRunning ? (
          <button onClick={handleStart} style={{ ...btnStyle, background: '#4caf50' }}>
            {elapsedTime === 0 ? 'Start' : 'Resume'}
          </button>
        ) : (
          <button onClick={handlePause} style={{ ...btnStyle, background: '#ff9800' }}>
            Pause
          </button>
        )}

        <button onClick={handleLap} disabled={!isRunning} style={{ ...btnStyle, background: '#2196f3', opacity: !isRunning ? 0.5 : 1 }}>
          Lap
        </button>

        <button onClick={handleReset} disabled={isRunning} style={{ ...btnStyle, background: '#f44336', opacity: isRunning ? 0.5 : 1 }}>
          Reset
        </button>

        <button onClick={handleSaveSession} disabled={laps.length === 0} style={{ ...btnStyle, background: '#9c27b0', gridColumn: '1 / -1', opacity: laps.length === 0 ? 0.5 : 1 }}>
          Save Session
        </button>
      </div>

      {showNoteInput && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{ background: 'white', borderRadius: '12px', padding: '25px', maxWidth: '500px', width: '100%' }}>
            <h3>Add Note/Event for This Lap</h3>
            <textarea
              placeholder="Type note or action (e.g., 'Bolt tightening', 'Quality check')"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              rows={4}
              style={{ width: '100%', padding: '12px', fontSize: '1rem', border: '2px solid #e0e0e0', borderRadius: '8px', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: '15px' }}
              autoFocus
            />
            {recognitionRef.current && (
              <div style={{ marginBottom: '20px' }}>
                <button onClick={handleVoiceInput} style={{ ...btnStyle, background: isListening ? '#f44336' : '#4caf50' }}>
                  {isListening ? '🎤 Listening...' : '🎤 Voice Input'}
                </button>
                {isListening && <span style={{ marginLeft: '10px', color: '#f44336', fontWeight: 600 }}>Speak now...</span>}
              </div>
            )}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={handleAddLapWithNote} style={{ ...btnStyle, background: '#1976d2', flex: 1 }}>
                Add Lap
              </button>
              <button onClick={() => { setShowNoteInput(false); setNoteText(''); setIsListening(false); }} style={{ ...btnStyle, background: '#e0e0e0', flex: 1, color: '#333' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {laps.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#666' }}>
          <p>No laps recorded yet. Press "Lap" to record a lap time.</p>
        </div>
      ) : (
        <div>
          <h2>Laps ({laps.length})</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[...laps].reverse().map((lap) => (
              <div key={lap.lapNumber} style={{ background: 'white', border: '2px solid #e0e0e0', borderRadius: '10px', padding: '15px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontWeight: 'bold', color: '#1976d2', fontSize: '1.1rem' }}>Lap #{lap.lapNumber}</span>
                  <span style={{ fontSize: '1.3rem', fontWeight: 'bold', fontFamily: 'monospace' }}>{formatTime(lap.lapTime)}</span>
                </div>
                <div style={{ paddingTop: '10px', borderTop: '1px solid #f0f0f0' }}>
                  <div style={{ marginBottom: '8px' }}>
                    <span style={{ fontWeight: 600, color: '#666' }}>Cumulative: </span>
                    <span style={{ fontFamily: 'monospace', color: '#666' }}>{formatTime(lap.cumulativeTime)}</span>
                  </div>
                  {lap.note && (
                    <div>
                      <span style={{ fontWeight: 600, color: '#666' }}>Note: </span>
                      <span>{lap.note}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
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
  color: 'white',
  boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
};
