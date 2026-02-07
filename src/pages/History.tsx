import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { db } from '../db';

const formatDate = (timestamp: number): string => {
  return new Date(timestamp).toLocaleString();
};

export default function History() {
  const navigate = useNavigate();
  const sessions = useLiveQuery(() => db.sessions.orderBy('createdAt').reverse().toArray());

  const handleDeleteSession = async (sessionId: number) => {
    const confirmed = window.confirm('Are you sure you want to delete this session? This cannot be undone.');
    if (confirmed) {
      await db.laps.where('sessionId').equals(sessionId).delete();
      await db.sessions.delete(sessionId);
    }
  };

  const handleViewSession = (sessionId: number) => {
    navigate(`/session/${sessionId}`);
  };

  if (!sessions || sessions.length === 0) {
    return (
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
          <h1 style={{ color: '#1976d2', margin: 0 }}>Session History</h1>
          <button onClick={() => navigate('/')} style={{ ...btnStyle, background: '#666' }}>
            ← Back to Stopwatch
          </button>
        </div>
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#666' }}>
          <p>No saved sessions yet. Complete a time study and save it to see it here.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', flexWrap: 'wrap', gap: '15px' }}>
        <h1 style={{ color: '#1976d2', margin: 0 }}>Session History</h1>
        <button onClick={() => navigate('/')} style={{ ...btnStyle, background: '#666' }}>
          ← Back to Stopwatch
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        {sessions.map((session) => (
          <div key={session.id} style={{
            background: 'white',
            border: '2px solid #e0e0e0',
            borderRadius: '12px',
            padding: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '15px'
          }}>
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: '0 0 10px 0', color: '#333' }}>{session.name}</h3>
              <div style={{ display: 'flex', gap: '20px', color: '#666', fontSize: '0.95rem', flexWrap: 'wrap' }}>
                <span>📅 {formatDate(session.startTime)}</span>
                <span>⏱️ {session.totalLaps} laps</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', flexShrink: 0 }}>
              <button onClick={() => handleViewSession(session.id!)} style={{ ...btnStyle, background: '#1976d2' }}>
                View Details
              </button>
              <button onClick={() => handleDeleteSession(session.id!)} style={{ ...btnStyle, background: '#f44336' }}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  padding: '10px 20px',
  border: 'none',
  borderRadius: '8px',
  cursor: 'pointer',
  fontWeight: 600,
  color: 'white',
  fontSize: '1rem'
};
