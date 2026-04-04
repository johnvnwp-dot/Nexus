import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, Package, Unlock, Delete, X, CheckCircle2, AlertTriangle, Loader2, Info } from 'lucide-react';

// 🌟 CLEAN, TEXT-ONLY PULSING HINT COMPONENT WITH INFO BUTTON
const DemoHint = ({ message, className = "", onInfoClick }: { message: string, className?: string, onInfoClick?: () => void }) => {
  const [show, setShow] = useState(() => localStorage.getItem('demoHints') !== 'false');
  
  useEffect(() => {
    const handleToggle = () => setShow(localStorage.getItem('demoHints') !== 'false');
    window.addEventListener('demo_hints_toggled', handleToggle);
    return () => window.removeEventListener('demo_hints_toggled', handleToggle);
  }, []);

  if (!show) return null;

  return (
    <div className={`flex items-center justify-center gap-2 animate-pulse text-yellow-400 font-normal tracking-wide z-[200] ${className}`}>
       <span>{message}</span>
       {onInfoClick && (
         <button 
           onClick={(e) => { e.preventDefault(); e.stopPropagation(); onInfoClick(); }} 
           className="pointer-events-auto bg-yellow-400/20 hover:bg-yellow-400/40 text-yellow-400 rounded-full p-1 transition-colors"
           title="View Courier Workflow"
         >
           <Info size={16} />
         </button>
       )}
    </div>
  );
};

// 🌟 THE WORKFLOW EXPLANATION OVERLAY (Courier Only)
const WorkflowInfoOverlay = ({ onClose }: { onClose: () => void }) => (
  <div className="absolute inset-0 z-[999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 sm:p-8 animate-in fade-in duration-300 pointer-events-auto">
    <div className="bg-slate-900 border-2 border-slate-700 rounded-3xl p-6 sm:p-8 max-w-2xl w-full max-h-full overflow-y-auto shadow-2xl relative">
      <button 
        onClick={onClose}
        className="absolute top-4 right-4 bg-slate-800 hover:bg-slate-700 text-white rounded-full p-2 transition-colors active:scale-95"
      >
        <X size={24} />
      </button>

      <h2 className="text-2xl font-black text-white uppercase mb-6 tracking-wide flex items-center gap-3">
         <Info className="text-yellow-400" size={28} />
         Courier Operations
      </h2>

      <div className="space-y-6 text-slate-300 text-sm sm:text-base leading-relaxed">
        <div className="border-l-2 border-amber-500 pl-4">
          <h3 className="text-amber-400 font-bold text-lg mb-2">1. Sweep (Clear Old Parcels)</h3>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>The system identifies lockers containing outgoing customer parcels.</li>
            <li>Open the target locker, secure the parcel in a courier bag, and <strong className="text-white">scan/type the bag's barcode</strong> to link it for tracking.</li>
          </ul>
        </div>

        <div className="border-l-2 border-sky-500 pl-4">
          <h3 className="text-sky-400 font-bold text-lg mb-2">2. Drop-Off (Load New Parcels)</h3>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Type/Scan the incoming parcel's barcode to automatically allocate an available locker.</li>
            <li><strong>Swap & Go:</strong> If the assigned locker has an existing outgoing parcel or an empty bag, remove it and place your delivery inside.</li>
          </ul>
        </div>

        <div className="border-l-2 border-purple-500 pl-4">
          <h3 className="text-purple-400 font-bold text-lg mb-2">3. Restock (Provision Empty Bags)</h3>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Open empty doors (where customers previously collected items).</li>
            <li>Scan a new empty courier bag to assign it to that locker.</li>
            <li>Close the door to reset the locker for the next customer's drop-off.</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
);

interface CourierFlowProps {
  onDone: () => void;
}

const CourierFlow: React.FC<CourierFlowProps> = ({ onDone }) => {
  // ==========================================
  // 🧠 THE BRAIN (STATE & LOGIC)
  // ==========================================
  const [step, setStep] = useState<'PIN' | 'DASHBOARD' | 'SWEEPING' | 'DROPOFF' | 'RESTOCKING'>('PIN');
  const [pin, setPin] = useState('');
  const [status, setStatus] = useState<'IDLE' | 'LOADING' | 'ERROR'>('IDLE');
  const [showInfo, setShowInfo] = useState(false);

  const [kioskStats, setKioskStats] = useState({ sweepsPending: 0, restocksPending: 0, availableDrops: 0, isLoaded: false });
  const [restockLocker, setRestockLocker] = useState<{id: string, label: string, board: number, channel: number} | null>(null);
  const [restockSubStep, setRestockSubStep] = useState<'FETCHING' | 'AWAITING_SCAN' | 'AWAITING_CLOSE' | 'SAVING' | 'WARNING' | 'DONE'>('FETCHING');
  const restockStateRef = useRef({ subStep: 'FETCHING', locker: null as any, barcode: '' });
  const [restockMessage, setRestockMessage] = useState('Fetching next available locker...');
  
  const [allocationError, setAllocationError] = useState<string | null>(null);
  const [existingContent, setExistingContent] = useState<string>('EMPTY');
  const [dropoffState, setDropoffState] = useState<'SCAN' | 'SIZE' | 'SUCCESS' | 'SECURED'>('SCAN');
  const [scannedBarcode, setScannedBarcode] = useState('');
  const [allocatedLocker, setAllocatedLocker] = useState<{label: string, pin: string, board: number, channel: number} | null>(null);
  const [isAllocating, setIsAllocating] = useState(false);

  const [sweepQueue, setSweepQueue] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFetchingSweep, setIsFetchingSweep] = useState(false);
  const [sweepActionState, setSweepActionState] = useState<'PENDING_SCAN' | 'WAITING_DOOR_CLOSE'>('PENDING_SCAN');
  const [sweepBarcode, setSweepBarcode] = useState('');
  const [isLinking, setIsLinking] = useState(false);
  const [currentHardware, setCurrentHardware] = useState<{board: number, channel: number} | null>(null);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetInactivityTimer = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      if (typeof onDone === 'function') onDone();
    }, 120000);
  };

  useEffect(() => {
    resetInactivityTimer();
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, []);

  useEffect(() => {
      restockStateRef.current = { subStep: restockSubStep, locker: restockLocker, barcode: scannedBarcode };
  }, [restockSubStep, restockLocker, scannedBarcode]);

  // VIRTUAL SENSOR: SWEEPING
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    const checkSweepDoorStatus = () => {
      if (step !== 'SWEEPING' || sweepQueue.length === 0 || currentIndex >= sweepQueue.length || !currentHardware) return;
      const isClosed = (window as any).VIRTUAL_DOORS?.[currentHardware.channel] === 'closed';
      if (isClosed && sweepActionState === 'WAITING_DOOR_CLOSE') {
        try { new Audio('/thank-you.mp3').play().catch(() => {}); } catch(e) {}
        handleNextDoor();
      } else {
        timeoutId = setTimeout(checkSweepDoorStatus, 1000);
      }
    };
    if (step === 'SWEEPING') checkSweepDoorStatus();
    return () => clearTimeout(timeoutId);
  }, [step, currentIndex, sweepQueue, currentHardware, sweepActionState]);

  // VIRTUAL SENSOR: DROPOFF
  useEffect(() => {
    let pollInterval: ReturnType<typeof setInterval>;
    if (dropoffState === 'SUCCESS' && allocatedLocker) {
      pollInterval = setInterval(() => {
        const isClosed = (window as any).VIRTUAL_DOORS?.[allocatedLocker.channel] === 'closed';
        if (isClosed) {
            try { new Audio('/thank-you.mp3').play().catch(() => {}); } catch(e) {}
            setDropoffState('SCAN');
            setScannedBarcode('');
            clearInterval(pollInterval);
        }
      }, 1000);
    }
    return () => clearInterval(pollInterval);
  }, [dropoffState, allocatedLocker]);

  // VIRTUAL SENSOR: RESTOCKING
  useEffect(() => {
      let pollTimer: ReturnType<typeof setInterval>;
      if (step === 'RESTOCKING') {
          pollTimer = setInterval(() => {
              const { subStep, locker, barcode } = restockStateRef.current;
              if (locker && (subStep === 'AWAITING_SCAN' || subStep === 'AWAITING_CLOSE')) {
                  const isClosed = (window as any).VIRTUAL_DOORS?.[locker.channel] === 'closed';
                  if (isClosed) {
                      if (subStep === 'AWAITING_SCAN') {
                          setRestockSubStep('WARNING');
                          try { new Audio('/pop.mp3').play().catch(() => {}); } catch(e) {}
                          window.dispatchEvent(new CustomEvent('TOGGLE_VIRTUAL_DOOR', { detail: { doorId: locker.channel, state: 'open' } }));
                      } else if (subStep === 'AWAITING_CLOSE') {
                          try { new Audio('/thank-you.mp3').play().catch(() => {}); } catch(e) {}
                          setRestockSubStep('SAVING');
                          executeSaveBag(locker.id, barcode);
                      }
                  }
              }
          }, 1000);
      }
      return () => clearInterval(pollTimer);
  }, [step]);

  const handleNumber = (n: string) => {
    resetInactivityTimer();
    if (pin.length < 6 && status === 'IDLE') setPin(p => p + n);
  };

  const handleAuth = async () => {
    if (pin.length !== 6) return;
    setStatus('LOADING');
    resetInactivityTimer();
    setTimeout(() => {
        if (pin === '999999') {
            setStep('DASHBOARD');
            setStatus('IDLE');
        } else {
            setStatus('ERROR');
            setTimeout(() => { setStatus('IDLE'); setPin(''); }, 1000);
        }
    }, 800);
  };

  const triggerHardwareOpen = (doorLabel: string) => {
    resetInactivityTimer();
    setSweepActionState('PENDING_SCAN');
    setSweepBarcode('');
    const channel = parseInt(doorLabel.replace(/\D/g, ''), 10) || 1;
    setCurrentHardware({ board: 1, channel });
    try { new Audio('/pop.mp3').play().catch(() => {}); } catch(e) {}
    window.dispatchEvent(new CustomEvent('TOGGLE_VIRTUAL_DOOR', { detail: { doorId: channel, state: 'open' } }));
  };

  const fetchSweepList = async () => {
    setIsFetchingSweep(true);
    resetInactivityTimer();
    setTimeout(() => {
        const mockQueue = ['Door 3', 'Door 7'];
        setSweepQueue(mockQueue);
        setCurrentIndex(0);
        setStep('SWEEPING');
        triggerHardwareOpen(mockQueue[0]);
        setIsFetchingSweep(false);
    }, 1000);
  };

  const handleLinkBag = async (barcode: string) => {
    setIsLinking(true);
    resetInactivityTimer();
    console.log(`[SIMULATOR] Linking bag with barcode: ${barcode}`); 
    setTimeout(() => {
        setSweepActionState('WAITING_DOOR_CLOSE');
        setIsLinking(false);
    }, 800);
  };

  const handleMarkEmpty = async () => {
    if (!window.confirm("Are you sure this locker is empty?")) return;
    setIsLinking(true);
    resetInactivityTimer();
    setTimeout(() => {
        setSweepActionState('WAITING_DOOR_CLOSE');
        setIsLinking(false);
    }, 800);
  };

  const popCurrentDoor = () => {
    if (sweepQueue[currentIndex]) triggerHardwareOpen(sweepQueue[currentIndex]);
  };

  const handleNextDoor = () => {
    resetInactivityTimer();
    setCurrentIndex((prevIndex) => {
      const nextIndex = prevIndex + 1;
      if (nextIndex < sweepQueue.length) triggerHardwareOpen(sweepQueue[nextIndex]);
      return nextIndex;
    });
  };

  const handleDropoffAllocation = async () => {
    setIsAllocating(true);
    resetInactivityTimer();
    setAllocationError(null);
    setTimeout(() => {
        if (scannedBarcode === 'ERROR') {
            setAllocationError("Simulated Error: Invalid Barcode.");
            setScannedBarcode('');
        } else {
            setAllocatedLocker({ label: 'Door 4', pin: '1234', board: 1, channel: 4 });
            setExistingContent('CUSTOMER_DROP');
            setDropoffState('SUCCESS');
            try { new Audio('/pop.mp3').play().catch(() => {}); } catch(e) {}
            window.dispatchEvent(new CustomEvent('TOGGLE_VIRTUAL_DOOR', { detail: { doorId: 4, state: 'open' } }));
        }
        setIsAllocating(false);
    }, 1000);
  };

  const fetchNextRestockLocker = async () => {
      setRestockSubStep('FETCHING');
      setRestockMessage('Finding next empty locker...');
      setRestockLocker(null);
      setScannedBarcode('');
      setTimeout(() => {
          const mockLocker = { id: 'lck_1', label: 'Door 1', board: 1, channel: 1 };
          setRestockLocker(mockLocker);
          setRestockMessage(`Scan a new empty bag for Door 1`);
          setRestockSubStep('AWAITING_SCAN');
          try { new Audio('/pop.mp3').play().catch(() => {}); } catch(e) {}
          window.dispatchEvent(new CustomEvent('TOGGLE_VIRTUAL_DOOR', { detail: { doorId: 1, state: 'open' } }));
      }, 1000);
  };

  const executeSaveBag = async (lockerId: string, barcode: string) => {
      setStatus('LOADING');
      setRestockMessage('Saving bag and checking for next locker...');
      console.log(`[SIMULATOR] Saving bag [${barcode}] into locker [${lockerId}]`); 
      setTimeout(() => {
          setStatus('IDLE');
          setRestockMessage('All lockers provisioned!');
          setRestockSubStep('DONE');
      }, 1000);
  };

  const handleRestockScan = (e: React.FormEvent) => {
      e.preventDefault();
      if (!scannedBarcode.trim() || !restockLocker) return;
      setRestockSubStep('AWAITING_CLOSE');
  };

  // MOCK STATS
  useEffect(() => {
    if (step === 'DASHBOARD') {
        const t = setTimeout(() => {
            setKioskStats({ sweepsPending: 2, restocksPending: 1, availableDrops: 5, isLoaded: true });
        }, 600);
        return () => clearTimeout(t);
    }
  }, [step]);


  // ==========================================
  // 🎭 THE FACE (UI RENDER)
  // ==========================================
  
  if (step === 'RESTOCKING') {
      return (
          <div className="h-full w-full bg-slate-900 rounded-xl border border-slate-700 flex flex-col items-center justify-center p-4 sm:p-8 relative overflow-hidden font-sans">
              
              {/* 🌟 RENDER OVERLAY IN RESTOCKING SCREEN TOO */}
              {showInfo && <WorkflowInfoOverlay onClose={() => setShowInfo(false)} />}
              
              {!['AWAITING_SCAN', 'AWAITING_CLOSE', 'WARNING', 'SAVING'].includes(restockSubStep) && (
                  <button onClick={() => setStep('DASHBOARD')} className="absolute top-4 left-4 sm:top-6 sm:left-6 text-slate-400 hover:text-white flex items-center gap-2 text-sm sm:text-lg font-bold bg-slate-800/50 px-4 py-2 sm:px-5 sm:py-2.5 rounded-full transition-all active:scale-95 border border-slate-700">
                      <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" /> Dashboard
                  </button>
              )}
              
              {restockSubStep !== 'WARNING' && restockSubStep !== 'DONE' && (
                  <>
                      <div className="bg-purple-500/20 p-3 sm:p-4 rounded-full mb-4 sm:mb-6">
                          <Package className="w-10 h-10 sm:w-12 sm:h-12 text-purple-400" />
                      </div>
                      <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-widest mb-4 text-center">Restock Empty Bags</h2>
                  </>
              )}
              
              <div className={`bg-slate-800/80 border ${restockSubStep === 'WARNING' ? 'border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.2)]' : 'border-slate-700'} p-6 sm:p-8 rounded-3xl w-full max-w-md sm:max-w-xl text-center transition-all duration-500`}>
                  {restockSubStep === 'WARNING' ? (
                      <div className="flex flex-col items-center animate-in zoom-in duration-300 py-2 sm:py-4">
                          <div className="bg-red-500/20 p-4 sm:p-6 rounded-full mb-4">
                              <AlertTriangle className="w-12 h-12 sm:w-16 sm:h-16 text-red-500 animate-pulse" />
                          </div>
                          <h3 className="text-xl sm:text-2xl font-black text-red-500 uppercase tracking-widest mb-2">Warning</h3>
                          <p className="text-base sm:text-xl text-slate-200 text-center mb-6 leading-relaxed">
                              Door {restockLocker?.label} was closed without a scan!<br/>
                              <span className="text-red-400 font-bold text-xs sm:text-sm">The door has been forced back open.</span>
                          </p>
                          <button 
                              onClick={() => setRestockSubStep('AWAITING_SCAN')}
                              className="bg-red-600 hover:bg-red-500 text-white px-6 py-3 sm:px-8 sm:py-4 rounded-xl font-bold uppercase transition-all active:scale-95 text-base sm:text-lg shadow-lg w-full"
                          >
                              Acknowledge & Scan
                          </button>
                      </div>
                  ) : restockSubStep === 'DONE' ? (
                      <div className="flex flex-col items-center animate-in zoom-in duration-300 py-4">
                          <CheckCircle2 className="w-16 h-16 sm:w-20 sm:h-20 text-emerald-400 mb-4" />
                          <h3 className="text-2xl sm:text-3xl font-black text-emerald-400 uppercase tracking-widest mb-2">Complete</h3>
                          <p className="text-base sm:text-lg text-slate-300 text-center mb-6">{restockMessage}</p>
                          <button onClick={() => setStep('DASHBOARD')} className="bg-slate-700 hover:bg-slate-600 text-white px-6 py-3 sm:px-8 sm:py-4 rounded-xl font-bold uppercase transition-all active:scale-95 w-full">
                              Return to Dashboard
                          </button>
                      </div>
                  ) : (
                      <>
                          <p className="text-slate-300 text-base sm:text-lg mb-4">{restockMessage}</p>
                          {restockLocker && (
                              <div className="text-4xl sm:text-5xl font-black text-purple-400 mb-6 drop-shadow-md">
                                  {restockLocker.label}
                              </div>
                          )}
                          {restockSubStep === 'AWAITING_CLOSE' ? (
                              <div className="flex flex-col items-center animate-in fade-in py-2">
                                  <CheckCircle2 className="w-12 h-12 sm:w-16 sm:h-16 text-emerald-400 mb-3 animate-pulse" />
                                  <div className="text-lg sm:text-xl font-bold text-emerald-400 mb-2">Ready to Secure</div>
                                  <div className="text-xs sm:text-sm text-slate-300 mb-6">Click the 3D Virtual door to close it.</div>
                                  <button 
                                      onClick={() => {
                                          setRestockSubStep('SAVING');
                                          if (restockLocker) executeSaveBag(restockLocker.id, scannedBarcode);
                                      }} 
                                      className="bg-slate-700 hover:bg-emerald-600 text-white px-4 py-2 sm:px-5 sm:py-2.5 rounded-lg font-bold transition-all active:scale-95 text-xs border border-slate-600 flex items-center gap-2"
                                  >
                                      <Unlock size={14} /> Force Save
                                  </button>
                              </div>
                          ) : restockLocker && status !== 'LOADING' && restockSubStep === 'AWAITING_SCAN' ? (
                              <form onSubmit={handleRestockScan} className="flex flex-col gap-3 sm:gap-4">
                                  <div className="h-6 mb-2 flex justify-center w-full">
                                    <DemoHint message="Scan a new empty bag" onInfoClick={() => setShowInfo(true)} className="text-sm" />
                                  </div>
                                  <input 
                                      autoFocus
                                      type="text" 
                                      placeholder="Type Barcode..." 
                                      value={scannedBarcode}
                                      onChange={(e) => setScannedBarcode(e.target.value)}
                                      className="w-full bg-slate-900 border-2 border-purple-500/50 text-white text-lg sm:text-xl text-center p-3 sm:p-4 rounded-xl focus:outline-none focus:border-purple-400 placeholder:text-slate-600 transition-all"
                                  />
                                  <button type="submit" className="bg-purple-500 hover:bg-purple-400 text-white px-6 py-3 sm:py-4 rounded-xl font-bold uppercase transition-all active:scale-95 text-base sm:text-lg shadow-md mt-1 sm:mt-2">
                                      Confirm Scan
                                  </button>
                              </form>
                          ) : null}

                          {(status === 'LOADING' || restockSubStep === 'FETCHING' || restockSubStep === 'SAVING') && (
                              <div className="flex justify-center items-center py-4 sm:py-6">
                                  <Loader2 className="w-10 h-10 sm:w-12 sm:h-12 text-purple-400 animate-spin" />
                              </div>
                          )}
                      </>
                  )}
              </div>

              {/* 🌟 FLOATING "HOW IT WORKS" BUTTON (Restocking View) */}
              <div className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 pointer-events-auto">
                <button 
                  onClick={(e) => { e.preventDefault(); setShowInfo(true); }} 
                  className="flex items-center gap-2 text-yellow-500/80 hover:text-yellow-400 transition-colors bg-[#0f172a] px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl border-2 border-yellow-500/20 shadow-lg active:scale-95"
                >
                  <Info size={18} className="text-yellow-500" />
                  <span className="text-xs sm:text-sm font-bold uppercase tracking-wider">How it Works</span>
                </button>
              </div>

          </div>
      );
  }

  return (
    <div className="h-full w-full bg-[#0f172a] rounded-xl border border-slate-700 shadow-2xl flex flex-col relative overflow-hidden font-sans p-4 sm:p-6 lg:p-8">
        
        {/* 🌟 RENDER OVERLAY IN MAIN SCREEN */}
        {showInfo && <WorkflowInfoOverlay onClose={() => setShowInfo(false)} />}

        {/* Header / Cancel Block */}
        <div className="flex justify-between items-center w-full mb-4 sm:mb-6 shrink-0 z-50 relative">
          {!(step === 'DROPOFF' && dropoffState === 'SUCCESS') && 
           !(step === 'SWEEPING' && sweepActionState === 'WAITING_DOOR_CLOSE') ? (
            <button 
              type="button"
              onClick={(e) => {
                e.preventDefault(); 
                if (step === 'PIN' || step === 'DASHBOARD') {
                  if (typeof onDone === 'function') onDone(); 
                } else {
                  setStep('DASHBOARD');
                  setDropoffState('SCAN'); 
                  setScannedBarcode('');   
                  setSweepQueue([]);       
                }
              }} 
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all active:scale-95 border border-white/5 cursor-pointer"
            >
              {step === 'PIN' || step === 'DASHBOARD' ? <><ChevronLeft size={16} /> LOGOUT</> : <><X size={16} /> CANCEL</>}
            </button>
          ) : <div /> }

          <div className="flex items-center gap-2 bg-amber-500/10 text-amber-400 text-[10px] sm:text-xs font-bold px-3 py-1.5 sm:px-4 sm:py-2 rounded-full border border-amber-500/20">
            <Package size={14} /> <span className="hidden sm:inline">COURIER ACCESS</span>
          </div>
        </div>

        {/* 📜 FLUID CONTAINER FOR STEPS */}
        <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col justify-center relative w-full">
            
            {/* STEP 1: AUTHENTICATION */}
            {step === 'PIN' && (
               <div className="flex flex-col md:flex-row gap-6 md:gap-10 items-center justify-center w-full max-w-2xl mx-auto py-4">
                <div className="flex flex-col flex-1 gap-2 w-full max-w-xs md:max-w-none">
                   <div className="grid grid-cols-3 gap-2">
                     {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                         <button key={n} onClick={() => handleNumber(n.toString())} className="h-14 sm:h-16 bg-slate-50 hover:bg-white active:scale-95 transition-all rounded-xl text-slate-900 text-xl sm:text-2xl font-black shadow-md">
                         {n}
                         </button>
                     ))}
                     <button onClick={() => { setPin(''); resetInactivityTimer(); }} className="h-14 sm:h-16 bg-red-600 hover:bg-red-500 active:scale-95 rounded-xl text-white font-black text-base sm:text-lg shadow-md uppercase">Clr</button>
                     <button onClick={() => handleNumber('0')} className="h-14 sm:h-16 bg-slate-50 hover:bg-white active:scale-95 rounded-xl text-slate-900 text-xl sm:text-2xl font-black shadow-md">0</button>
                     <button onClick={() => { setPin((p: string) => p.slice(0, -1)); resetInactivityTimer(); }} className="h-14 sm:h-16 bg-slate-700 hover:bg-slate-600 active:scale-95 rounded-xl text-white flex items-center justify-center shadow-md"><Delete className="w-5 h-5 sm:w-6 sm:h-6" /></button>
                   </div>
                </div>

                <div className="flex-1 flex flex-col justify-center w-full text-center md:text-left">
                  <h1 className="text-2xl sm:text-3xl font-black uppercase mb-1 sm:mb-2 tracking-tight text-white">Courier Login</h1>
                  <p className="text-slate-400 text-xs sm:text-sm mb-3 sm:mb-4">Enter your 6-digit master PIN.</p>
                  
                  <div className="h-8 mb-4 sm:mb-6 flex justify-center md:justify-start w-full">
                     <DemoHint message="Demo PIN: 999999" onInfoClick={() => setShowInfo(true)} className="text-sm" />
                  </div>
                  
                  <div className="grid grid-cols-6 gap-1.5 sm:gap-2 mb-4 sm:mb-6 max-w-xs mx-auto md:max-w-none md:mx-0">
                    {[...Array(6)].map((_, i) => (
                      <div key={i} className={`h-12 sm:h-14 rounded-xl flex items-center justify-center text-xl sm:text-3xl font-black transition-all border-2 
                        ${status === 'ERROR' ? 'border-red-500 bg-red-500/10 text-red-500' : pin[i] ? 'border-amber-500 bg-amber-500/10 text-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.15)]' : 'border-slate-800 bg-slate-900/50'}`}>
                        {pin[i] ? '•' : ''}
                      </div>
                    ))}
                  </div>
                  <button 
                    onClick={handleAuth} 
                    disabled={pin.length < 6 || status === 'LOADING'}
                    className={`w-full max-w-xs mx-auto md:max-w-none h-14 sm:h-16 rounded-xl text-lg sm:text-xl font-black uppercase transition-all shadow-md mt-1
                    ${pin.length === 6 ? 'bg-amber-500 text-slate-900 active:scale-[0.96] hover:bg-amber-400' : 'bg-slate-800 text-slate-600 opacity-50 cursor-not-allowed'}`}
                >
                    {status === 'ERROR' ? 'INVALID PIN' : status === 'LOADING' ? 'VERIFYING...' : 'AUTHORIZE'}
                </button>
                </div>
              </div>
            )}

            {/* STEP 2: COURIER DASHBOARD - FLUID SCALING */}
            {step === 'DASHBOARD' && (
              <div className="flex flex-col items-center justify-center w-full max-w-3xl mx-auto py-2 sm:py-4 animate-in fade-in duration-500">
                 {!kioskStats.isLoaded ? (
                     <div className="flex flex-col items-center gap-3 sm:gap-4 mt-6">
                         <Loader2 className="w-8 h-8 sm:w-10 sm:h-10 text-sky-500 animate-spin" />
                         <h2 className="text-sm sm:text-base font-bold text-slate-400 uppercase tracking-widest animate-pulse">Scanning Inventory...</h2>
                     </div>
                 ) : (
                     <>
                       <div className="text-center mb-6 sm:mb-8">
                         <h2 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight mb-1 sm:mb-2">Courier Operations</h2>
                         <p className="text-xs sm:text-sm text-slate-400 font-bold px-4">
                           {kioskStats.sweepsPending > 0 ? "⚠️ You have lockers to clear before dropping off." : "✅ Kiosk cleared. Ready for Drop-Offs!"}
                         </p>
                         <div className="h-6 mt-4 flex justify-center w-full">
                            <DemoHint message="Always Sweep before you Drop-off" onInfoClick={() => setShowInfo(true)} className="text-sm" />
                         </div>
                       </div>

                       <div className="grid grid-cols-3 gap-2 sm:gap-4 w-full px-2">
                         {/* SWEEP */}
                         <button 
                             onClick={fetchSweepList}
                             disabled={isFetchingSweep}
                             className={`relative flex flex-col items-center justify-center p-3 sm:p-5 rounded-2xl border-2 transition-all duration-300 group ${
                                 kioskStats.sweepsPending > 0 
                                 ? 'bg-amber-500/20 border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.15)] hover:bg-amber-500/30 scale-105 z-10' 
                                 : 'bg-slate-800/40 border-slate-700/50 hover:bg-slate-800 opacity-60 hover:opacity-100'
                             } ${isFetchingSweep ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                             <Delete className={`w-8 h-8 sm:w-10 sm:h-10 mb-2 sm:mb-3 ${kioskStats.sweepsPending > 0 ? 'text-amber-400' : 'text-slate-500'} ${isFetchingSweep ? 'animate-pulse' : ''}`} />
                             <span className={`text-sm sm:text-xl font-black uppercase mb-0.5 sm:mb-1 ${kioskStats.sweepsPending > 0 ? 'text-amber-50' : 'text-slate-300'}`}>
                                 {isFetchingSweep ? "Loading" : "Sweep"}
                             </span>
                             <span className="text-slate-400 font-bold text-[9px] sm:text-xs text-center leading-tight">Clear old parcels</span>
                          </button>

                          {/* DROP-OFF */}
                          <button 
                             onClick={() => { setDropoffState('SCAN'); setScannedBarcode(''); setStep('DROPOFF'); }} 
                             className={`relative flex flex-col items-center justify-center p-3 sm:p-5 rounded-2xl border-2 transition-all duration-300 group ${
                                 kioskStats.sweepsPending === 0 
                                 ? 'bg-sky-500/20 border-sky-500 shadow-[0_0_20px_rgba(14,165,233,0.15)] hover:bg-sky-500/30 scale-105 z-10' 
                                 : 'bg-slate-800/40 border-slate-700/50 hover:bg-slate-800 opacity-60 hover:opacity-100'
                             }`}
                          >
                             <Package className={`w-8 h-8 sm:w-10 sm:h-10 mb-2 sm:mb-3 ${kioskStats.sweepsPending === 0 ? 'text-sky-400' : 'text-slate-500'}`} />
                             <span className={`text-sm sm:text-xl font-black uppercase mb-0.5 sm:mb-1 ${kioskStats.sweepsPending === 0 ? 'text-sky-50' : 'text-slate-300'}`}>Drop-Off</span>
                             <span className="text-slate-400 font-bold text-[9px] sm:text-xs text-center leading-tight">Load new parcels</span>
                          </button>

                          {/* RESTOCK */}
                          <button 
                             onClick={() => { fetchNextRestockLocker(); setStep('RESTOCKING'); }} 
                             className={`relative flex flex-col items-center justify-center p-3 sm:p-5 rounded-2xl border-2 transition-all duration-300 group ${
                                 kioskStats.sweepsPending === 0 && kioskStats.restocksPending > 0
                                 ? 'bg-purple-500/20 border-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.15)] hover:bg-purple-500/30 scale-105 z-10' 
                                 : 'bg-slate-800/40 border-slate-700/50 hover:bg-slate-800 opacity-60 hover:opacity-100'
                             }`}
                          >
                             <Unlock className={`w-8 h-8 sm:w-10 sm:h-10 mb-2 sm:mb-3 ${kioskStats.sweepsPending === 0 && kioskStats.restocksPending > 0 ? 'text-purple-400' : 'text-slate-500'}`} />
                             <span className={`text-sm sm:text-xl font-black uppercase mb-0.5 sm:mb-1 ${kioskStats.sweepsPending === 0 && kioskStats.restocksPending > 0 ? 'text-purple-50' : 'text-slate-300'}`}>Restock</span>
                             <span className="text-slate-400 font-bold text-[9px] sm:text-xs text-center leading-tight">Provision empty bags</span>
                          </button>
                       </div>
                     </>
                 )}
              </div>
            )}

            {/* STEP 3: SWEEPING */}
            {step === 'SWEEPING' && (
              <div className="flex flex-col items-center justify-center h-full py-4 sm:py-6 animate-in slide-in-from-right-8 duration-500 max-w-3xl mx-auto w-full">
                {sweepQueue.length === 0 ? (
                  <div className="text-center flex flex-col items-center">
                     <CheckCircle2 className="w-12 h-12 sm:w-16 sm:h-16 text-green-500 mb-3 sm:mb-4" />
                     <h2 className="text-2xl sm:text-3xl font-black uppercase text-white mb-2">All Clear!</h2>
                     <p className="text-slate-400 text-sm sm:text-base">There are no expired or outgoing parcels to collect.</p>
                     <button onClick={() => setStep('DASHBOARD')} className="mt-6 sm:mt-8 bg-slate-800 hover:bg-slate-700 text-white px-5 py-2.5 sm:px-6 sm:py-3 rounded-xl font-bold uppercase transition-all active:scale-95 border border-white/10 text-sm sm:text-base">
                        Back to Dashboard
                     </button>
                  </div>
                ) : currentIndex >= sweepQueue.length ? (
                  <div className="text-center flex flex-col items-center">
                     <CheckCircle2 className="w-12 h-12 sm:w-16 sm:h-16 text-green-500 mb-3 sm:mb-4" />
                     <h2 className="text-2xl sm:text-3xl font-black uppercase text-white mb-2">Sweep Complete</h2>
                     <p className="text-slate-400 text-sm sm:text-base">You have successfully cleared {sweepQueue.length} lockers.</p>
                     <button onClick={() => setStep('DASHBOARD')} className="mt-6 sm:mt-8 bg-green-500 hover:bg-green-400 text-slate-900 px-5 py-2.5 sm:px-6 sm:py-3 rounded-xl font-bold uppercase transition-all active:scale-95 shadow-[0_0_20px_rgba(34,197,94,0.3)] text-sm sm:text-base">
                        Finish & Return
                     </button>
                  </div>
                ) : (
                  <div className="flex flex-col md:flex-row w-full gap-6 md:gap-8 items-center px-4">
                    <div className="flex-1 flex flex-col text-center md:text-left">
                      <div className="text-amber-500 font-bold tracking-widest text-[10px] sm:text-xs mb-2">
                        SWEEP PROGRESS ({currentIndex + 1} OF {sweepQueue.length})
                      </div>
                      <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black uppercase text-white mb-2 tracking-tight">Collect Parcel</h2>
                      <p className="text-slate-400 text-sm sm:text-base mb-6 leading-relaxed">
                        Open the locker, secure the parcel inside a courier bag, and <strong className="text-amber-400">type the bag's barcode</strong> to link it.
                      </p>
                      
                      <div className="w-full h-1.5 sm:h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                        <div 
                          className="h-full bg-amber-500 transition-all duration-500"
                          style={{ width: `${((currentIndex) / sweepQueue.length) * 100}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex-1 w-full bg-slate-800/50 border border-slate-700 p-6 rounded-3xl flex flex-col items-center text-center shadow-xl relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-full h-1.5 bg-amber-500"></div>
                      
                      <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px] sm:text-xs mb-1 sm:mb-2 mt-1">Target Locker</span>
                      <div className="text-5xl sm:text-6xl font-black text-white mb-4 sm:mb-6 drop-shadow-md">{sweepQueue[currentIndex]}</div>

                      {sweepActionState === 'PENDING_SCAN' ? (
                          <div className="w-full flex flex-col items-center animate-in zoom-in-95 duration-300">
                              <div className="h-6 mb-3 flex justify-center w-full">
                                 <DemoHint message="Scan the bag you are putting the parcel into" onInfoClick={() => setShowInfo(true)} className="text-sm" />
                              </div>
                              <input 
                                  type="text"
                                  autoFocus
                                  value={sweepBarcode}
                                  onChange={(e) => {
                                      setSweepBarcode(e.target.value);
                                      resetInactivityTimer();
                                  }}
                                  onKeyDown={(e) => {
                                      if (e.key === 'Enter' && sweepBarcode.length > 3) handleLinkBag(sweepBarcode);
                                  }}
                                  placeholder="Type Barcode..."
                                  disabled={isLinking}
                                  className="w-full bg-slate-900 border-2 border-amber-500/50 text-white text-center text-lg sm:text-xl font-mono p-3 sm:p-4 rounded-xl focus:border-amber-400 focus:outline-none mb-3 sm:mb-4 shadow-inner"
                              />
                              <div className="flex flex-col w-full gap-2 sm:gap-3">
                                  <button 
                                      onClick={() => handleLinkBag(sweepBarcode)}
                                      disabled={sweepBarcode.length < 3 || isLinking}
                                      className="w-full bg-amber-500 hover:bg-amber-400 disabled:bg-slate-700 disabled:text-slate-500 text-slate-900 py-3 rounded-xl font-black uppercase tracking-wider transition-all active:scale-95 shadow-md flex items-center justify-center gap-2 text-sm sm:text-base"
                                  >
                                      {isLinking ? <Loader2 className="animate-spin w-4 h-4 sm:w-5 sm:h-5" /> : <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />} Link Bag
                                  </button>
                                  
                                  <button 
                                      onClick={handleMarkEmpty}
                                      disabled={isLinking}
                                      className="w-full bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-500 py-2.5 rounded-lg font-bold uppercase tracking-widest text-[10px] sm:text-xs transition-all active:scale-95 flex items-center justify-center gap-2"
                                  >
                                      <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Locker is Empty
                                  </button>
                              </div>
                          </div>
                      ) : (
                          <div className="w-full flex flex-col items-center animate-in zoom-in duration-300 bg-emerald-500/10 border-2 border-emerald-500/30 p-4 sm:p-6 rounded-xl">
                              <CheckCircle2 className="w-8 h-8 sm:w-10 sm:h-10 text-emerald-500 mb-2 sm:mb-3" />
                              <h3 className="text-lg sm:text-xl font-black text-white uppercase tracking-widest mb-1 sm:mb-2">Bag Linked!</h3>
                              <p className="text-emerald-400 font-bold text-xs sm:text-sm">Please click the 3D door to close it.</p>
                          </div>
                      )}

                      <button 
                        onClick={popCurrentDoor}
                        className="w-full text-slate-500 hover:text-slate-300 text-[10px] sm:text-xs font-bold uppercase tracking-wider mt-4 sm:mt-5 transition-colors flex items-center justify-center gap-2"
                      >
                        <Unlock className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Pop Door Again
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* STEP 4: DROP-OFF FLOW */}
            {step === 'DROPOFF' && (
              <div className="flex flex-col items-center justify-center h-full py-4 sm:py-8 animate-in slide-in-from-right-8 duration-500 w-full max-w-xl mx-auto px-4">
                {dropoffState === 'SCAN' && (
                  <div className="text-center w-full">
                    <h2 className="text-2xl sm:text-3xl font-black uppercase text-white mb-2 tracking-tight">Type Parcel Barcode</h2>
                    <p className="text-slate-400 text-sm sm:text-base mb-6">Enter the tracking number below.</p>
                    
                    <div className="h-6 mb-4 flex justify-center w-full">
                       <DemoHint message="Type TRK-12345 or any string > 3 chars" onInfoClick={() => setShowInfo(true)} className="text-sm" />
                    </div>
                    
                    {allocationError && (
                      <div className="bg-red-500/10 border border-red-500 text-red-400 p-3 sm:p-4 rounded-xl mb-4 sm:mb-6 flex flex-col items-center gap-2 animate-in fade-in zoom-in">
                        <AlertTriangle className="w-6 h-6 sm:w-8 sm:h-8" />
                        <p className="text-base sm:text-lg font-bold text-center">{allocationError}</p>
                        <p className="text-xs sm:text-sm opacity-80 text-center">Return parcel to the depot or try a different size.</p>
                      </div>
                    )}
                    
                    <input 
                      type="text" 
                      autoFocus
                      value={scannedBarcode}
                      onChange={(e) => {
                        setScannedBarcode(e.target.value);
                        setAllocationError(null); 
                        resetInactivityTimer();
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && scannedBarcode.length > 3) handleDropoffAllocation();
                      }}
                      placeholder="e.g. TRK-987654321"
                      disabled={isAllocating}
                      className="w-full bg-slate-900 border-2 border-slate-700 text-white text-center text-xl sm:text-2xl p-4 sm:p-5 rounded-2xl focus:border-sky-500 focus:outline-none mb-4 sm:mb-6 transition-colors shadow-inner disabled:opacity-50"
                    />
                    
                    <button 
                      onClick={() => handleDropoffAllocation()}
                      disabled={scannedBarcode.length < 3 || isAllocating}
                      className="w-full flex items-center justify-center bg-sky-500 hover:bg-sky-400 disabled:bg-slate-800 disabled:text-slate-600 text-white py-3 sm:py-4 rounded-xl font-black text-lg sm:text-xl uppercase tracking-wider transition-all active:scale-95 shadow-md"
                    >
                      {isAllocating ? <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin" /> : "Drop Off Parcel"}
                    </button>
                  </div>
                )}

                {dropoffState === 'SUCCESS' && allocatedLocker && (
                  <div className="absolute inset-0 w-full h-full z-[100] bg-[#0f172a] rounded-xl flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300">
                     <div className="h-6 mb-4 flex justify-center w-full">
                        <DemoHint message="Swap & Go: The core concept of a PUDO locker" onInfoClick={() => setShowInfo(true)} className="text-sm" />
                     </div>
                     <div className="w-16 h-16 sm:w-20 sm:h-20 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center border-2 border-green-500 mb-4 shadow-[0_0_20px_rgba(34,197,94,0.3)]">
                         <Unlock className="w-8 h-8 sm:w-10 sm:h-10" />
                     </div>
                     <h2 className="text-3xl sm:text-4xl font-black uppercase text-white mb-4 sm:mb-6 tracking-tight">Door Open</h2>

                     <div className="bg-amber-500/10 border-2 border-amber-500 p-5 sm:p-6 rounded-2xl sm:rounded-3xl mb-6 sm:mb-8 w-full max-w-xl shadow-[0_0_30px_rgba(245,158,11,0.15)]">
                        <h3 className="text-xl sm:text-2xl font-black text-amber-400 leading-tight uppercase tracking-widest mb-3 sm:mb-4 flex items-center justify-center gap-2 sm:gap-3">
                          <AlertTriangle className="w-6 h-6 sm:w-8 sm:h-8 animate-pulse" /> Swap & Go
                        </h3>
                        <p className="text-base sm:text-lg text-amber-50 font-medium leading-relaxed">
                          {existingContent === 'CUSTOMER_DROP' && "Remove the customer's parcel, place your delivery inside, and "}
                          {existingContent === 'HAS_EMPTY_BAG' && "Remove the empty bag, place your delivery inside, and "}
                          {existingContent === 'EMPTY' && "Place your delivery inside, and "}
                          <strong className="text-white">click the virtual 3D door to close it</strong>.
                        </p>
                     </div>

                     <div className="bg-slate-800 border border-slate-700 px-5 py-2.5 sm:px-6 sm:py-3 rounded-full mb-8 sm:mb-10 flex items-center gap-3 sm:gap-4 shadow-md">
                        <span className="text-slate-400 font-bold uppercase tracking-wider text-xs sm:text-sm">Target Locker:</span>
                        <span className="text-xl sm:text-2xl font-black text-sky-400">{allocatedLocker.label}</span>
                     </div>

                     <div className="flex flex-col items-center gap-2 sm:gap-3 animate-in fade-in">
                        <Loader2 className="w-8 h-8 sm:w-10 sm:h-10 text-sky-500 animate-spin" />
                        <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] sm:text-xs animate-pulse">
                            Waiting for sensor to confirm...
                        </p>
                     </div>
                  </div>
                )}
              </div>
            )}
        </div>

        {/* 🌟 FLOATING "HOW IT WORKS" BUTTON (Main View) */}
        <div className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 pointer-events-auto">
          <button 
             onClick={(e) => { e.preventDefault(); setShowInfo(true); }} 
             className="flex items-center gap-2 text-yellow-500/80 hover:text-yellow-400 transition-colors bg-[#0f172a] px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl border-2 border-yellow-500/20 shadow-lg active:scale-95"
          >
            <Info size={18} className="text-yellow-500" />
            <span className="text-xs sm:text-sm font-bold uppercase tracking-wider">How it Works</span>
          </button>
        </div>

    </div>
  );
};

export default CourierFlow;