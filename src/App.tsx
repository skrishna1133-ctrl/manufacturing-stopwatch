import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
// import emailjs from '@emailjs/browser'; // For future email functionality

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
  cycleElapsedBeforeBreak: number | null; // Track elapsed time when cycle is paused for break
}

const STORAGE_KEY = 'active-shift-data';
// const SUPERVISOR_EMAIL = 'skrishna1133@gmail.com'; // For future email functionality

function App() {
  const [shiftActive, setShiftActive] = useState(false);
  const [cycleActive, setCycleActive] = useState(false);
  const [breakActive, setBreakActive] = useState(false);
  const [showNameInput, setShowNameInput] = useState(false);
  const [workerName, setWorkerName] = useState('');
  const [shiftData, setShiftData] = useState<ShiftData | null>(null);

  const formatTime = (ms: number): string => {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatDateTime = (isoString: string): string => {
    return new Date(isoString).toLocaleString();
  };

  // Load saved shift data on mount
  useEffect(() => {
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
  }, []);

  // Auto-save shift data whenever it changes
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
      // End break
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

      // If cycle was paused for this break, resume it
      if (shiftData.cycleElapsedBeforeBreak !== null) {
        // Resume cycle by adjusting start time
        const now = Date.now();
        updatedShiftData.currentCycleStart = new Date(now - shiftData.cycleElapsedBeforeBreak).toISOString();
        updatedShiftData.cycleElapsedBeforeBreak = null;
      }

      setShiftData(updatedShiftData);
      setBreakActive(false);
    } else {
      // Start break

      // If cycle is active, confirm and pause it
      if (cycleActive) {
        if (!window.confirm('Take a break? This will pause the current cycle.')) {
          return;
        }

        // Calculate elapsed time in current cycle
        const cycleElapsed = Date.now() - new Date(shiftData.currentCycleStart!).getTime();

        setShiftData({
          ...shiftData,
          currentBreakStart: new Date().toISOString(),
          cycleElapsedBeforeBreak: cycleElapsed
        });
      } else {
        // No active cycle, just start break
        setShiftData({
          ...shiftData,
          currentBreakStart: new Date().toISOString()
        });
      }

      setBreakActive(true);
    }
  };

  const generatePDF = (data: ShiftData): Blob => {
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text('Shift Time Study Report', 14, 20);

    doc.setFontSize(12);
    doc.text(`Worker: ${data.workerName}`, 14, 35);
    doc.text(`Shift Start: ${formatDateTime(data.shiftStartTime)}`, 14, 42);
    doc.text(`Shift End: ${data.shiftEndTime ? formatDateTime(data.shiftEndTime) : 'N/A'}`, 14, 49);
    doc.text(`Total Duration: ${formatTime(data.totalShiftDuration)}`, 14, 56);

    // Cycles table
    if (data.cycles.length > 0) {
      const cycleData = data.cycles.map(c => [
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

    // Breaks table
    if (data.breaks.length > 0) {
      const breakData = data.breaks.map(b => [
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

  const generateExcel = (data: ShiftData): Blob => {
    const workbook = XLSX.utils.book_new();

    // Summary sheet
    const summaryData = [
      ['Shift Time Study Report'],
      [''],
      ['Worker Name', data.workerName],
      ['Shift Start', formatDateTime(data.shiftStartTime)],
      ['Shift End', data.shiftEndTime ? formatDateTime(data.shiftEndTime) : 'N/A'],
      ['Total Duration', formatTime(data.totalShiftDuration)],
      ['Total Cycles', data.cycles.length],
      ['Total Breaks', data.breaks.length]
    ];
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

    // Cycles sheet
    if (data.cycles.length > 0) {
      const cyclesData = data.cycles.map(c => ({
        'Cycle #': c.cycleNumber,
        'Start Time': formatDateTime(c.startTime),
        'End Time': formatDateTime(c.endTime),
        'Duration': formatTime(c.duration)
      }));
      const cyclesSheet = XLSX.utils.json_to_sheet(cyclesData);
      XLSX.utils.book_append_sheet(workbook, cyclesSheet, 'Cycles');
    }

    // Breaks sheet
    if (data.breaks.length > 0) {
      const breaksData = data.breaks.map(b => ({
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

  /*
  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };
  */

  /*
  // Future: Email functionality with EmailJS
  // Uncomment and configure when ready:

  const sendEmail = async (data: ShiftData) => {
    try {
      setSending(true);
      const pdfBlob = generatePDF(data);
      const excelBlob = generateExcel(data);
      const pdfBase64 = await blobToBase64(pdfBlob);
      const excelBase64 = await blobToBase64(excelBlob);

      emailjs.init('YOUR_PUBLIC_KEY');
      await emailjs.send('YOUR_SERVICE_ID', 'YOUR_TEMPLATE_ID', {
        to_email: SUPERVISOR_EMAIL,
        worker_name: data.workerName,
        shift_date: formatDateTime(data.shiftStartTime),
        total_cycles: data.cycles.length,
        total_breaks: data.breaks.length,
        pdf_attachment: pdfBase64,
        excel_attachment: excelBase64
      });

      alert('Shift report sent successfully!');
      localStorage.removeItem(STORAGE_KEY);
      setShiftData(null);
      setShiftActive(false);
      setSending(false);
    } catch (error) {
      console.error('Failed to send email:', error);
      alert('Failed to send report.');
      setSending(false);
    }
  };
  */

  const handleShiftEnd = async () => {
    if (!shiftData) return;

    if (cycleActive) {
      alert('Please end the current cycle before ending shift');
      return;
    }

    if (breakActive) {
      alert('Please end the current break before ending shift');
      return;
    }

    if (!window.confirm('End shift and send report to supervisor?')) return;

    const endTime = new Date().toISOString();
    const startTime = new Date(shiftData.shiftStartTime);
    const totalDuration = new Date(endTime).getTime() - startTime.getTime();

    const finalData: ShiftData = {
      ...shiftData,
      shiftEndTime: endTime,
      totalShiftDuration: totalDuration
    };

    // For now, download files locally since EmailJS setup needs configuration
    // You'll need to set up EmailJS account and replace the keys above

    // Generate and download files
    const pdfBlob = generatePDF(finalData);
    const excelBlob = generateExcel(finalData);

    const pdfUrl = URL.createObjectURL(pdfBlob);
    const excelUrl = URL.createObjectURL(excelBlob);

    const pdfLink = document.createElement('a');
    pdfLink.href = pdfUrl;
    pdfLink.download = `shift-report-${finalData.workerName}-${new Date().toISOString().split('T')[0]}.pdf`;
    pdfLink.click();

    const excelLink = document.createElement('a');
    excelLink.href = excelUrl;
    excelLink.download = `shift-report-${finalData.workerName}-${new Date().toISOString().split('T')[0]}.xlsx`;
    excelLink.click();

    alert('Shift ended! Reports downloaded. (Email functionality requires EmailJS setup)');

    // Clear data
    localStorage.removeItem(STORAGE_KEY);
    setShiftData(null);
    setShiftActive(false);

    // Uncomment this when EmailJS is configured:
    // await sendEmail(finalData);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ maxWidth: '500px', width: '100%' }}>
        <h1 style={{ color: 'white', textAlign: 'center', marginBottom: '40px', fontSize: '2rem' }}>
          {shiftActive && shiftData ? `${shiftData.workerName}'s Shift` : 'Time Study'}
        </h1>

        {/* Worker Name Input Modal */}
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
                <button onClick={startShift} style={{ ...btnStyle, background: '#4caf50', flex: 1 }}>
                  Start Shift
                </button>
                <button onClick={() => { setShowNameInput(false); setWorkerName(''); }} style={{ ...btnStyle, background: '#9e9e9e', flex: 1 }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {!shiftActive ? (
            <button onClick={handleShiftStart} style={{ ...bigBtnStyle, background: '#4caf50' }}>
              SHIFT START
            </button>
          ) : (
            <>
              <button
                onClick={handleCycleStart}
                disabled={cycleActive}
                style={{ ...bigBtnStyle, background: '#2196f3', opacity: cycleActive ? 0.5 : 1 }}
              >
                {cycleActive ? 'CYCLE RUNNING...' : 'CYCLE START'}
              </button>

              <button
                onClick={handleCycleEnd}
                disabled={!cycleActive}
                style={{ ...bigBtnStyle, background: '#ff9800', opacity: !cycleActive ? 0.5 : 1 }}
              >
                CYCLE END
              </button>

              <button
                onClick={handleBreakToggle}
                style={{ ...bigBtnStyle, background: breakActive ? '#f44336' : '#ffc107' }}
              >
                {breakActive ? 'BREAK END' : 'BREAK START'}
              </button>

              <button
                onClick={handleShiftEnd}
                disabled={cycleActive || breakActive}
                style={{ ...bigBtnStyle, background: '#e91e63', opacity: (cycleActive || breakActive) ? 0.5 : 1 }}
              >
                SHIFT END
              </button>

              {/* Status Display */}
              <div style={{ background: 'rgba(255,255,255,0.9)', borderRadius: '15px', padding: '20px', marginTop: '20px' }}>
                <div style={{ fontSize: '0.9rem', color: '#666' }}>
                  <div style={{ marginBottom: '8px' }}>
                    <strong>Cycles Completed:</strong> {shiftData?.cycles.length || 0}
                  </div>
                  <div style={{ marginBottom: '8px' }}>
                    <strong>Breaks Taken:</strong> {shiftData?.breaks.length || 0}
                  </div>
                  <div>
                    <strong>Status:</strong> {
                      (cycleActive && breakActive) ? '⏸️ Cycle Paused (On Break)' :
                      cycleActive ? '🔵 Cycle Active' :
                      breakActive ? '🟡 On Break' :
                      '⚪ Idle'
                    }
                  </div>
                </div>
              </div>
            </>
          )}
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
