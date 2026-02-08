import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Cycle {
  cycleNumber: number;
  startTime: string;
  endTime: string;
  duration: number;
}

interface Break {
  breakNumber: number;
  startTime: string;
  endTime: string;
  duration: number;
}

interface ShiftData {
  workerName: string;
  shiftStartTime: string;
  shiftEndTime: string | null;
  totalShiftDuration: number;
  cycles: Cycle[];
  breaks: Break[];
  currentCycleStart: string | null;
  currentBreakStart: string | null;
  cycleElapsedBeforeBreak: number | null;
}

interface CompletedShift {
  id: string;
  workerName: string;
  shiftStartTime: string;
  shiftEndTime: string;
  totalShiftDuration: number;
  cycles: Cycle[];
  breaks: Break[];
}

const STORAGE_KEY = 'active-shift-data';
const COMPLETED_SHIFTS_KEY = 'completed-shifts';
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'admin123';

function App() {
  // Worker state
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [shiftActive, setShiftActive] = useState(false);
  const [cycleActive, setCycleActive] = useState(false);
  const [breakActive, setBreakActive] = useState(false);
  const [showNameInput, setShowNameInput] = useState(false);
  const [workerName, setWorkerName] = useState('');
  const [shiftData, setShiftData] = useState<ShiftData | null>(null);

  // Admin state
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [completedShifts, setCompletedShifts] = useState<CompletedShift[]>([]);

  const formatTime = (ms: number): string => {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatDateTime = (isoString: string): string => {
    return new Date(isoString).toLocaleString();
  };

  // Load data on mount
  useEffect(() => {
    // Load active shift
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setShiftData(data);
        setShiftActive(true);
        if (data.currentCycleStart) setCycleActive(true);
        if (data.currentBreakStart) setBreakActive(true);
      } catch (e) {
        console.error('Failed to load shift data', e);
      }
    }

    // Load completed shifts
    const completedData = localStorage.getItem(COMPLETED_SHIFTS_KEY);
    if (completedData) {
      try {
        setCompletedShifts(JSON.parse(completedData));
      } catch (e) {
        console.error('Failed to load completed shifts', e);
      }
    }
  }, []);

  // Auto-save shift data
  useEffect(() => {
    if (shiftData) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(shiftData));
    }
  }, [shiftData]);

  const handleShiftStart = () => {
    setShowNameInput(true);
  };

  const startShift = () => {
    if (!workerName.trim()) {
      alert('Please enter your name');
      return;
    }

    const newShiftData: ShiftData = {
      workerName: workerName.trim(),
      shiftStartTime: new Date().toISOString(),
      shiftEndTime: null,
      totalShiftDuration: 0,
      cycles: [],
      breaks: [],
      currentCycleStart: null,
      currentBreakStart: null,
      cycleElapsedBeforeBreak: null
    };

    setShiftData(newShiftData);
    setShiftActive(true);
    setShowNameInput(false);
    setWorkerName('');
  };

  const handleCycleStart = () => {
    if (!shiftData || cycleActive) return;

    setShiftData({
      ...shiftData,
      currentCycleStart: new Date().toISOString()
    });
    setCycleActive(true);
  };

  const handleCycleEnd = () => {
    if (!shiftData || !shiftData.currentCycleStart) return;

    const endTime = new Date().toISOString();
    const startTime = new Date(shiftData.currentCycleStart);
    const duration = new Date(endTime).getTime() - startTime.getTime();

    const newCycle: Cycle = {
      cycleNumber: shiftData.cycles.length + 1,
      startTime: shiftData.currentCycleStart,
      endTime,
      duration
    };

    setShiftData({
      ...shiftData,
      cycles: [...shiftData.cycles, newCycle],
      currentCycleStart: null
    });
    setCycleActive(false);
  };

  const handleBreakToggle = () => {
    if (!shiftData) return;

    if (breakActive) {
      const endTime = new Date().toISOString();
      const startTime = new Date(shiftData.currentBreakStart!);
      const duration = new Date(endTime).getTime() - startTime.getTime();

      const newBreak: Break = {
        breakNumber: shiftData.breaks.length + 1,
        startTime: shiftData.currentBreakStart!,
        endTime,
        duration
      };

      const updatedShiftData: ShiftData = {
        ...shiftData,
        breaks: [...shiftData.breaks, newBreak],
        currentBreakStart: null
      };

      if (shiftData.cycleElapsedBeforeBreak !== null) {
        const now = Date.now();
        updatedShiftData.currentCycleStart = new Date(now - shiftData.cycleElapsedBeforeBreak).toISOString();
        updatedShiftData.cycleElapsedBeforeBreak = null;
      }

      setShiftData(updatedShiftData);
      setBreakActive(false);
    } else {
      if (cycleActive) {
        if (!window.confirm('Take a break? This will pause the current cycle.')) {
          return;
        }

        const cycleElapsed = Date.now() - new Date(shiftData.currentCycleStart!).getTime();

        setShiftData({
          ...shiftData,
          currentBreakStart: new Date().toISOString(),
          cycleElapsedBeforeBreak: cycleElapsed
        });
      } else {
        setShiftData({
          ...shiftData,
          currentBreakStart: new Date().toISOString()
        });
      }

      setBreakActive(true);
    }
  };

  const handleShiftEnd = () => {
    if (!shiftData) return;

    if (cycleActive) {
      alert('Please end the current cycle before ending shift');
      return;
    }

    if (breakActive) {
      alert('Please end the current break before ending shift');
      return;
    }

    if (!window.confirm('End shift?')) return;

    const endTime = new Date().toISOString();
    const startTime = new Date(shiftData.shiftStartTime);
    const totalDuration = new Date(endTime).getTime() - startTime.getTime();

    const completedShift: CompletedShift = {
      id: Date.now().toString(),
      workerName: shiftData.workerName,
      shiftStartTime: shiftData.shiftStartTime,
      shiftEndTime: endTime,
      totalShiftDuration: totalDuration,
      cycles: shiftData.cycles,
      breaks: shiftData.breaks
    };

    // Save to completed shifts
    const updated = [...completedShifts, completedShift];
    setCompletedShifts(updated);
    localStorage.setItem(COMPLETED_SHIFTS_KEY, JSON.stringify(updated));

    // Clear active shift
    localStorage.removeItem(STORAGE_KEY);
    setShiftData(null);
    setShiftActive(false);

    alert('Shift ended successfully! Data saved.');
  };

  const generatePDF = (shift: CompletedShift): Blob => {
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text('Shift Time Study Report', 14, 20);

    doc.setFontSize(12);
    doc.text(`Worker: ${shift.workerName}`, 14, 35);
    doc.text(`Shift Start: ${formatDateTime(shift.shiftStartTime)}`, 14, 42);
    doc.text(`Shift End: ${formatDateTime(shift.shiftEndTime)}`, 14, 49);
    doc.text(`Total Duration: ${formatTime(shift.totalShiftDuration)}`, 14, 56);

    if (shift.cycles.length > 0) {
      const cycleData = shift.cycles.map(c => [
        c.cycleNumber,
        formatDateTime(c.startTime),
        formatDateTime(c.endTime),
        formatTime(c.duration)
      ]);

      autoTable(doc, {
        head: [['Cycle #', 'Start Time', 'End Time', 'Duration']],
        body: cycleData,
        startY: 65,
        styles: { fontSize: 9 },
        headStyles: { fillColor: [33, 150, 243] }
      });
    }

    if (shift.breaks.length > 0) {
      const breakData = shift.breaks.map(b => [
        b.breakNumber,
        formatDateTime(b.startTime),
        formatDateTime(b.endTime),
        formatTime(b.duration)
      ]);

      const finalY = (doc as any).lastAutoTable?.finalY || 65;

      autoTable(doc, {
        head: [['Break #', 'Start Time', 'End Time', 'Duration']],
        body: breakData,
        startY: finalY + 15,
        styles: { fontSize: 9 },
        headStyles: { fillColor: [255, 152, 0] }
      });
    }

    return doc.output('blob');
  };

  const generateExcel = (shift: CompletedShift): Blob => {
    const workbook = XLSX.utils.book_new();

    const summaryData = [
      ['Shift Time Study Report'],
      [''],
      ['Worker Name', shift.workerName],
      ['Shift Start', formatDateTime(shift.shiftStartTime)],
      ['Shift End', formatDateTime(shift.shiftEndTime)],
      ['Total Duration', formatTime(shift.totalShiftDuration)],
      ['Total Cycles', shift.cycles.length],
      ['Total Breaks', shift.breaks.length]
    ];
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

    if (shift.cycles.length > 0) {
      const cyclesData = shift.cycles.map(c => ({
        'Cycle #': c.cycleNumber,
        'Start Time': formatDateTime(c.startTime),
        'End Time': formatDateTime(c.endTime),
        'Duration': formatTime(c.duration)
      }));
      const cyclesSheet = XLSX.utils.json_to_sheet(cyclesData);
      XLSX.utils.book_append_sheet(workbook, cyclesSheet, 'Cycles');
    }

    if (shift.breaks.length > 0) {
      const breaksData = shift.breaks.map(b => ({
        'Break #': b.breakNumber,
        'Start Time': formatDateTime(b.startTime),
        'End Time': formatDateTime(b.endTime),
        'Duration': formatTime(b.duration)
      }));
      const breaksSheet = XLSX.utils.json_to_sheet(breaksData);
      XLSX.utils.book_append_sheet(workbook, breaksSheet, 'Breaks');
    }

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    return new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  };

  const downloadPDF = (shift: CompletedShift) => {
    const pdfBlob = generatePDF(shift);
    const url = URL.createObjectURL(pdfBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shift-report-${shift.workerName}-${new Date(shift.shiftEndTime).toISOString().split('T')[0]}.pdf`;
    a.click();
  };

  const downloadExcel = (shift: CompletedShift) => {
    const excelBlob = generateExcel(shift);
    const url = URL.createObjectURL(excelBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shift-report-${shift.workerName}-${new Date(shift.shiftEndTime).toISOString().split('T')[0]}.xlsx`;
    a.click();
  };

  const handleAdminLogin = () => {
    if (adminUsername === ADMIN_USERNAME && adminPassword === ADMIN_PASSWORD) {
      setIsAdminLoggedIn(true);
      setAdminUsername('');
      setAdminPassword('');
    } else {
      alert('Invalid credentials!');
    }
  };

  const handleAdminLogout = () => {
    setIsAdminLoggedIn(false);
    setIsAdminMode(false);
  };

  const deleteShift = (id: string) => {
    if (!window.confirm('Delete this shift report?')) return;
    const updated = completedShifts.filter(s => s.id !== id);
    setCompletedShifts(updated);
    localStorage.setItem(COMPLETED_SHIFTS_KEY, JSON.stringify(updated));
  };

  const clearAllData = () => {
    if (!window.confirm('Delete ALL shift reports? This cannot be undone!')) return;
    setCompletedShifts([]);
    localStorage.removeItem(COMPLETED_SHIFTS_KEY);
    alert('All data cleared!');
  };

  // Admin Login Screen
  if (isAdminMode && !isAdminLoggedIn) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: 'white', borderRadius: '15px', padding: '40px', maxWidth: '400px', width: '100%' }}>
          <h2 style={{ marginBottom: '30px', textAlign: 'center' }}>Admin Login</h2>
          <input
            type="text"
            placeholder="Username"
            value={adminUsername}
            onChange={(e) => setAdminUsername(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && document.getElementById('password-input')?.focus()}
            style={{ width: '100%', padding: '15px', fontSize: '1rem', border: '2px solid #e0e0e0', borderRadius: '10px', marginBottom: '15px', boxSizing: 'border-box' }}
            autoFocus
          />
          <input
            id="password-input"
            type="password"
            placeholder="Password"
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAdminLogin()}
            style={{ width: '100%', padding: '15px', fontSize: '1rem', border: '2px solid #e0e0e0', borderRadius: '10px', marginBottom: '20px', boxSizing: 'border-box' }}
          />
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={handleAdminLogin} style={{ ...btnStyle, background: '#4caf50', flex: 1 }}>Login</button>
            <button onClick={() => setIsAdminMode(false)} style={{ ...btnStyle, background: '#9e9e9e', flex: 1 }}>Cancel</button>
          </div>
        </div>
      </div>
    );
  }

  // Admin Dashboard
  if (isAdminMode && isAdminLoggedIn) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)', padding: '20px' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
            <h1 style={{ color: '#1976d2' }}>Admin Dashboard</h1>
            <button onClick={handleAdminLogout} style={{ ...btnStyle, background: '#f44336' }}>Logout</button>
          </div>

          <div style={{ background: 'white', padding: '20px', borderRadius: '10px', marginBottom: '20px' }}>
            <h2>Shift Reports ({completedShifts.length})</h2>
            {completedShifts.length > 0 && (
              <button onClick={clearAllData} style={{ ...btnStyle, background: '#f44336', marginTop: '10px' }}>Clear All Data</button>
            )}
          </div>

          {completedShifts.length === 0 ? (
            <div style={{ background: 'white', padding: '40px', borderRadius: '10px', textAlign: 'center', color: '#666' }}>
              No shift reports yet
            </div>
          ) : (
            [...completedShifts].reverse().map((shift) => (
              <div key={shift.id} style={{ background: 'white', border: '2px solid #e0e0e0', borderRadius: '10px', padding: '20px', marginBottom: '15px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '15px' }}>
                  <div>
                    <h3 style={{ color: '#1976d2', marginBottom: '10px' }}>{shift.workerName}</h3>
                    <div style={{ fontSize: '0.9rem', color: '#666' }}>
                      <div>Start: {formatDateTime(shift.shiftStartTime)}</div>
                      <div>End: {formatDateTime(shift.shiftEndTime)}</div>
                      <div>Duration: {formatTime(shift.totalShiftDuration)}</div>
                      <div>Cycles: {shift.cycles.length} | Breaks: {shift.breaks.length}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '10px', flexDirection: 'column' }}>
                    <button onClick={() => downloadPDF(shift)} style={{ ...btnStyle, background: '#e53935', fontSize: '0.85rem' }}>Download PDF</button>
                    <button onClick={() => downloadExcel(shift)} style={{ ...btnStyle, background: '#1e88e5', fontSize: '0.85rem' }}>Download Excel</button>
                    <button onClick={() => deleteShift(shift.id)} style={{ ...btnStyle, background: '#9e9e9e', fontSize: '0.85rem' }}>Delete</button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  // Worker Interface
  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ maxWidth: '500px', width: '100%' }}>
        <h1 style={{ color: 'white', textAlign: 'center', marginBottom: '40px', fontSize: '2rem' }}>
          {shiftActive && shiftData ? `${shiftData.workerName}'s Shift` : 'Time Study'}
        </h1>

        {showNameInput && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
            <div style={{ background: 'white', borderRadius: '15px', padding: '30px', maxWidth: '400px', width: '100%' }}>
              <h2 style={{ marginBottom: '20px' }}>Enter Your Name</h2>
              <input
                type="text"
                placeholder="Worker Name"
                value={workerName}
                onChange={(e) => setWorkerName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && startShift()}
                style={{ width: '100%', padding: '15px', fontSize: '1.1rem', border: '2px solid #e0e0e0', borderRadius: '10px', marginBottom: '20px', boxSizing: 'border-box' }}
                autoFocus
              />
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={startShift} style={{ ...btnStyle, background: '#4caf50', flex: 1 }}>Start Shift</button>
                <button onClick={() => { setShowNameInput(false); setWorkerName(''); }} style={{ ...btnStyle, background: '#9e9e9e', flex: 1 }}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {!shiftActive ? (
            <button onClick={handleShiftStart} style={{ ...bigBtnStyle, background: '#4caf50' }}>SHIFT START</button>
          ) : (
            <>
              <button onClick={handleCycleStart} disabled={cycleActive} style={{ ...bigBtnStyle, background: '#2196f3', opacity: cycleActive ? 0.5 : 1 }}>
                {cycleActive ? 'CYCLE RUNNING...' : 'CYCLE START'}
              </button>

              <button onClick={handleCycleEnd} disabled={!cycleActive} style={{ ...bigBtnStyle, background: '#ff9800', opacity: !cycleActive ? 0.5 : 1 }}>CYCLE END</button>

              <button onClick={handleBreakToggle} style={{ ...bigBtnStyle, background: breakActive ? '#f44336' : '#ffc107' }}>
                {breakActive ? 'BREAK END' : 'BREAK START'}
              </button>

              <button onClick={handleShiftEnd} disabled={cycleActive || breakActive} style={{ ...bigBtnStyle, background: '#e91e63', opacity: (cycleActive || breakActive) ? 0.5 : 1 }}>SHIFT END</button>

              <div style={{ background: 'rgba(255,255,255,0.9)', borderRadius: '15px', padding: '20px', marginTop: '20px' }}>
                <div style={{ fontSize: '0.9rem', color: '#666' }}>
                  <div style={{ marginBottom: '8px' }}><strong>Cycles Completed:</strong> {shiftData?.cycles.length || 0}</div>
                  <div style={{ marginBottom: '8px' }}><strong>Breaks Taken:</strong> {shiftData?.breaks.length || 0}</div>
                  <div><strong>Status:</strong> {(cycleActive && breakActive) ? '⏸️ Cycle Paused (On Break)' : cycleActive ? '🔵 Cycle Active' : breakActive ? '🟡 On Break' : '⚪ Idle'}</div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Admin Access Button */}
        <div style={{ marginTop: '40px', textAlign: 'center' }}>
          <button onClick={() => setIsAdminMode(true)} style={{ padding: '10px 20px', fontSize: '0.8rem', background: 'rgba(255,255,255,0.2)', color: 'white', border: 'none', borderRadius: '20px', cursor: 'pointer' }}>Admin Access</button>
        </div>
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  padding: '15px 20px',
  fontSize: '1rem',
  fontWeight: 600,
  border: 'none',
  borderRadius: '10px',
  cursor: 'pointer',
  color: 'white',
  boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
};

const bigBtnStyle: React.CSSProperties = {
  padding: '25px 30px',
  fontSize: '1.5rem',
  fontWeight: 700,
  border: 'none',
  borderRadius: '15px',
  cursor: 'pointer',
  color: 'white',
  boxShadow: '0 6px 12px rgba(0,0,0,0.2)',
  transition: 'transform 0.1s',
  textTransform: 'uppercase',
  letterSpacing: '1px'
};

export default App;
