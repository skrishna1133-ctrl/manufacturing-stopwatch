import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, Session, LapRecord } from '../db';

const formatTime = (ms: number): string => {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const milliseconds = ms % 1000;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
};

const formatDate = (timestamp: number): string => {
  return new Date(timestamp).toLocaleString();
};

export default function SessionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [laps, setLaps] = useState<LapRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSession = async () => {
      if (!id) return;

      const sessionId = parseInt(id);
      const sessionData = await db.sessions.get(sessionId);
      const lapsData = await db.laps.where('sessionId').equals(sessionId).sortBy('lapNumber');

      setSession(sessionData || null);
      setLaps(lapsData);
      setLoading(false);
    };

    loadSession();
  }, [id]);

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '60px 20px', fontSize: '1.2rem', color: '#666' }}>Loading session...</div>;
  }

  if (!session) {
    return (
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '20px' }}>
        <h2>Session not found</h2>
        <button onClick={() => navigate('/history')} style={{ ...btnStyle, background: '#666' }}>
          Back to History
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '20px' }}>
      <div style={{ marginBottom: '30px' }}>
        <button onClick={() => navigate('/history')} style={{ ...btnStyle, background: '#666' }}>
          ← Back to History
        </button>
        <h1 style={{ color: '#1976d2', margin: '15px 0' }}>{session.name}</h1>
      </div>

      <div style={{
        background: 'white',
        border: '2px solid #e0e0e0',
        borderRadius: '12px',
        padding: '20px',
        marginBottom: '30px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '15px'
      }}>
        <div>
          <div style={{ fontWeight: 600, color: '#666', fontSize: '0.9rem', marginBottom: '5px' }}>Started:</div>
          <div style={{ fontSize: '1.1rem', color: '#333' }}>{formatDate(session.startTime)}</div>
        </div>
        <div>
          <div style={{ fontWeight: 600, color: '#666', fontSize: '0.9rem', marginBottom: '5px' }}>Total Laps:</div>
          <div style={{ fontSize: '1.1rem', color: '#333' }}>{session.totalLaps}</div>
        </div>
        {session.endTime && (
          <div>
            <div style={{ fontWeight: 600, color: '#666', fontSize: '0.9rem', marginBottom: '5px' }}>Ended:</div>
            <div style={{ fontSize: '1.1rem', color: '#333' }}>{formatDate(session.endTime)}</div>
          </div>
        )}
      </div>

      <div style={{ marginTop: '30px' }}>
        <h3 style={{ color: '#333', marginBottom: '15px' }}>Lap Details</h3>
        <div style={{ background: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#1976d2', color: 'white' }}>
                <th style={{ padding: '15px', textAlign: 'left', fontWeight: 600 }}>Lap #</th>
                <th style={{ padding: '15px', textAlign: 'left', fontWeight: 600 }}>Lap Time</th>
                <th style={{ padding: '15px', textAlign: 'left', fontWeight: 600 }}>Cumulative</th>
                <th style={{ padding: '15px', textAlign: 'left', fontWeight: 600 }}>Note/Event</th>
                <th style={{ padding: '15px', textAlign: 'left', fontWeight: 600 }}>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {laps.map((lap) => (
                <tr key={lap.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '12px 15px' }}>{lap.lapNumber}</td>
                  <td style={{ padding: '12px 15px' }}>{formatTime(lap.lapTime)}</td>
                  <td style={{ padding: '12px 15px' }}>{formatTime(lap.cumulativeTime)}</td>
                  <td style={{ padding: '12px 15px' }}>{lap.note || '-'}</td>
                  <td style={{ padding: '12px 15px' }}>{formatDate(lap.timestamp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
