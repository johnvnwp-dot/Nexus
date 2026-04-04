import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, Unlock, Delete, AlertTriangle, Loader2, Package, Info, X } from 'lucide-react';

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
           title="View PUDO Workflow"
         >
           <Info size={16} />
         </button>
       )}
    </div>
  );
};

// 🌟 THE WORKFLOW EXPLANATION OVERLAY (Pickup Only)
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
         SmartLocker Pick-Up
      </h2>

      <div className="space-y-6 text-slate-300 text-sm sm:text-base leading-relaxed">
        <div className="border-l-2 border-emerald-500 pl-4">
          <h3 className="text-emerald-400 font-bold text-lg mb-3">Customer Collection Process</h3>
          <ul className="list-disc list-inside space-y-3 ml-2">
            <li>The customer receives a notification and enters their 6-digit WhatsApp PIN code.</li>
            <li><strong>Payment (If applicable):</strong> If the item is marked as COD (Cash on Delivery), the customer scans the on-screen QR code to settle the balance before the door will unlock.</li>
            <li>The locker door opens, they retrieve their item, and physically close the door.</li>
            <li>That locker is now empty and marked as <strong className="text-red-400">Unavailable</strong> in the system until a courier reprovisions it with an empty bag.</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
);

export interface PickUpFlowProps {
  onDone: () => void;
  config?: any;
}

const PickUpFlow: React.FC<PickUpFlowProps> = ({ onDone, config }) => {
  // ==========================================
  // 🧠 THE BRAIN (STATE & LOGIC)
  // ==========================================
  const [pin, setPin] = useState('');
  const [status, setStatus] = useState<'IDLE' | 'PAYMENT' | 'SUCCESS' | 'ERROR' | 'LOCKED'>('IDLE');
  const [attempts, setAttempts] = useState(0);
  const [assignedLocker, setAssignedLocker] = useState<string | null>(null);
  const [activeHardware, setActiveHardware] = useState<{board: number, channel: number} | null>(null);
  const [paymentData, setPaymentData] = useState<{amount: string, orderId: string, qrBase64: string | null}>({ amount: '0.00', orderId: '', qrBase64: null });
  const [isDoorClosed, setIsDoorClosed] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isVerifying = useRef(false);

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

  // 🌟 VIRTUAL SENSOR POLLING LOOP FOR PICKUP
  useEffect(() => {
    let pollInterval: ReturnType<typeof setInterval>; 
    let nagTimer: ReturnType<typeof setTimeout>;

    if (status === 'SUCCESS' && activeHardware && !isDoorClosed) {
      try { new Audio('/pop.mp3').play().catch(() => {}); } catch(e) {}

      nagTimer = setTimeout(() => {
          try { new Audio('/close-door.mp3').play().catch(() => {}); } catch(e) {}
      }, 3000);

      setTimeout(() => {
        pollInterval = setInterval(() => {
          const isClosed = (window as any).VIRTUAL_DOORS?.[activeHardware.channel] === 'closed';
          
          if (isClosed) {
            console.log(`[VIRTUAL SENSOR] DOOR ${activeHardware.channel} IS CLOSED!`);
            try { new Audio('/thank-you.mp3').play().catch(() => {}); } catch(e) {}

            setIsDoorClosed(true); 
            clearInterval(pollInterval);
            clearTimeout(nagTimer);
            
            setTimeout(() => {
                if (typeof onDone === 'function') onDone();
            }, 2000);
          }
        }, 1000);
      }, 2000);
    }

    return () => { 
      if (pollInterval) clearInterval(pollInterval); 
      if (nagTimer) clearTimeout(nagTimer); 
    };
  }, [status, activeHardware, isDoorClosed, onDone]);

  // 🌟 HANDLE AUTO-DISMISS TIMERS
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (status === 'LOCKED') {
        timer = setTimeout(() => { if (typeof onDone === 'function') onDone() }, 4000);
    }
    return () => clearTimeout(timer);
  }, [status, onDone]);

  const handleNumber = (n: string) => {
    resetInactivityTimer();
    if (pin.length < 6 && status === 'IDLE') setPin(p => p + n);
  };

  const handleSubmit = async () => {
    if (pin.length !== 6) return;
    if (isVerifying.current) return;
    isVerifying.current = true;
    
    resetInactivityTimer();
    
    setTimeout(() => {
        if (pin === '888888') {
            setPaymentData({ amount: '25.00', orderId: 'SIM-PAY-123', qrBase64: 'MOCK-QR' });
            setStatus('PAYMENT');
            
            setTimeout(() => {
                setStatus('SUCCESS');
                setAssignedLocker('2');
                setActiveHardware({ board: 1, channel: 2 });
                window.dispatchEvent(new CustomEvent('TOGGLE_VIRTUAL_DOOR', { detail: { doorId: 2, state: 'open' } }));
            }, 4000);

        } else if (pin === '123456') {
            setStatus('SUCCESS');
            setAssignedLocker('5');
            setActiveHardware({ board: 1, channel: 5 });
            window.dispatchEvent(new CustomEvent('TOGGLE_VIRTUAL_DOOR', { detail: { doorId: 5, state: 'open' } }));
            
        } else {
            const next = attempts + 1;
            setAttempts(next);
            setIsShaking(true);
            
            if (next >= 3) {
                setStatus('LOCKED');
            } else {
                setStatus('ERROR');
                setTimeout(() => { setStatus('IDLE'); setPin(''); setIsShaking(false); }, 800);
            }
        }
        isVerifying.current = false;
    }, 1000); 
  };


  // ==========================================
  // 🎭 THE FACE (UI RENDER)
  // ==========================================
  return (
    <div className="h-full w-full bg-[#0f172a] rounded-xl border border-slate-700 shadow-2xl flex flex-col relative overflow-hidden font-sans p-4 sm:p-6 lg:p-8">
        {showInfo && <WorkflowInfoOverlay onClose={() => setShowInfo(false)} />}
        
        {/* Header / Cancel Block */}
        <div className="flex justify-between items-center w-full mb-2 shrink-0 z-50 relative">
          {status !== 'SUCCESS' ? (
            <button 
              onClick={onDone} 
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all active:scale-95 border border-white/5 cursor-pointer"
            >
              <ChevronLeft size={16} /> BACK
            </button>
          ) : <div />}
        </div>

        {/* 📜 FLUID CONTAINER FOR STEPS */}
        <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col justify-center relative w-full">
            
            {/* STEP 1: AUTHENTICATION / PIN */}
            {(status === 'IDLE' || status === 'ERROR') && (
               <div className="flex flex-col items-center justify-center w-full max-w-sm mx-auto py-2">
                
                {/* TITLE & HEADER */}
                <div className="flex flex-col items-center mb-8">
                  <h1 className="text-2xl sm:text-3xl font-black uppercase mb-1 sm:mb-2 tracking-tight text-white text-center">Enter Collection Code</h1>
                  <p className="text-slate-400 text-sm text-center">Input your 6-digit notification code.</p>
                </div>

                {/* 1. LARGER NUMPAD (TOP) */}
                <div className="w-full relative mb-8">
                   <div className="grid grid-cols-3 gap-3 sm:gap-4">
                     {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                         <button key={n} onClick={() => handleNumber(n.toString())} className="h-14 sm:h-16 bg-slate-600 hover:bg-slate-500 active:scale-95 transition-all rounded-xl text-white text-2xl font-black shadow-md border-b-4 border-slate-700 active:border-b-0 active:translate-y-1">
                         {n}
                         </button>
                     ))}
                     <button onClick={() => { setPin(''); resetInactivityTimer(); }} className="h-14 sm:h-16 bg-red-600 hover:bg-red-500 active:scale-95 rounded-xl text-white font-black text-lg shadow-md border-b-4 border-red-800 active:border-b-0 active:translate-y-1 uppercase">Clr</button>
                     <button onClick={() => handleNumber('0')} className="h-14 sm:h-16 bg-slate-600 hover:bg-slate-500 active:scale-95 rounded-xl text-white text-2xl font-black shadow-md border-b-4 border-slate-700 active:border-b-0 active:translate-y-1">0</button>
                     <button onClick={() => { setPin((p: string) => p.slice(0, -1)); resetInactivityTimer(); }} className="h-14 sm:h-16 bg-slate-800 hover:bg-slate-700 active:scale-95 rounded-xl text-white flex items-center justify-center shadow-md border-b-4 border-slate-900 active:border-b-0 active:translate-y-1"><Delete size={24}/></button>
                   </div>
                </div>
                
                {/* 2. PIN BOXES (MIDDLE) */}
                <div className={`grid grid-cols-6 gap-2 sm:gap-3 w-full mb-6 ${isShaking ? 'animate-[shake_0.4s_ease-in-out]' : ''}`}>
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className={`h-12 sm:h-14 rounded-xl flex items-center justify-center text-2xl font-bold transition-all border-2 
                      ${status === 'ERROR' ? 'border-red-500 bg-red-500/10 text-red-500' : pin[i] ? 'border-blue-500 bg-blue-500/10 text-blue-300 shadow-[0_0_15px_rgba(59,130,246,0.3)]' : 'border-slate-700 bg-slate-800/50'}`}>
                      {pin[i] || ''}
                    </div>
                  ))}
                </div>

                {/*44 3. YELLOW HINT & BUTTON (BOTTOM) */}
                <div className="flex flex-col items-center w-full relative">
                    
                    {status === 'ERROR' ? (
                        <p className="text-red-500 font-bold uppercase tracking-widest text-sm mb-4 text-center">
                          Invalid PIN. {3 - attempts} attempts left.
                        </p>
                    ) : (
                        <div className="h-6 mb-4 flex justify-center items-center w-full relative">
                           {/* 🌟 TRIGGER ADDED HERE */}
                           <DemoHint 
                             message="Demo PINs: 123456 or 888888" 
                             onInfoClick={() => setShowInfo(true)} 
                             className="text-sm" 
                           />
                        </div>
                    )}

                    <button 
                        onClick={handleSubmit}
                        disabled={pin.length < 6}
                        className={`w-full py-4 sm:py-5 rounded-2xl font-black uppercase tracking-widest transition-all active:scale-95 shadow-xl text-lg
                        ${pin.length === 6 ? 'bg-blue-500 hover:bg-blue-400 text-white shadow-[0_0_20px_rgba(59,130,246,0.4)]' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}
                    >
                        Verify Code
                    </button>
                </div>
              </div>
            )}

            {/* STEP 2: LOCKED OUT */}
            {status === 'LOCKED' && (
              <div className="flex flex-col items-center justify-center h-full w-full animate-in zoom-in duration-300">
                  <div className="w-20 h-20 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mb-6">
                      <AlertTriangle size={40} />
                  </div>
                  <h2 className="text-3xl font-black text-white uppercase tracking-widest mb-2">Access Blocked</h2>
                  <p className="text-slate-400 text-lg mb-8">Too many failed attempts.</p>
                  <p className="text-slate-500 text-sm">Returning to dashboard...</p>
              </div>
            )}

            {/* STEP 3: PAYMENT REQUIRED */}
            {status === 'PAYMENT' && (
              <div className="flex flex-col items-center justify-center h-full text-center py-4 animate-in fade-in duration-500 w-full max-w-md mx-auto">
                  <h2 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-widest mb-2">Payment Required</h2>
                  <p className="text-slate-400 text-sm sm:text-base mb-6">Please settle the balance to open the locker.</p>
                  
                  <div className="w-64 h-64 bg-white rounded-2xl p-4 mb-6 flex items-center justify-center shadow-2xl border-4 border-slate-800 relative">
                     <img 
                       src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=https://www.smartlocker.africa`} 
                       alt="ContiPay QR" 
                       className="w-full h-full rounded-xl shadow-sm border border-slate-200 animate-in zoom-in duration-500" 
                     />
                  </div>
                  
                  <h2 className="text-5xl sm:text-6xl font-black text-white mb-2 tracking-tighter">
                    ZWG {paymentData.amount}
                  </h2>
                  <p className="text-slate-500 mb-8 text-lg font-bold">Scan to Pay with ContiPay</p>

                  <div className="relative w-full flex flex-col items-center mt-4">
                     <div className="h-6 mb-2 flex justify-center w-full relative">
                        <DemoHint message="Wait 4 seconds for auto-approval" className="text-sm" />
                     </div>
                     <div className="flex items-center justify-center gap-3 w-full px-6 py-4 bg-amber-500/10 border-2 border-amber-500/30 text-amber-500 text-sm font-black rounded-2xl uppercase tracking-widest">
                         <Loader2 size={18} className="animate-spin" /> Simulating Success...
                     </div>
                  </div>
              </div>
            )}

            {/* STEP 4: SUCCESS / DOOR OPEN */}
            {status === 'SUCCESS' && (
              <div className="absolute inset-0 w-full h-full z-[100] bg-[#0f172a] rounded-xl flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in-95 duration-300">
                  
                  <div className="relative h-6 mb-4 w-full flex justify-center">
                     <DemoHint message="Click the open 3D door on the right! ->" className="hidden md:flex text-lg" />
                  </div>

                  <div className="w-16 h-16 sm:w-20 sm:h-20 bg-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center border-2 border-emerald-500 mb-6 shadow-[0_0_30px_rgba(16,185,129,0.3)]">
                      <Unlock className="w-8 h-8 sm:w-10 sm:h-10" />
                  </div>
                  <h2 className="text-3xl sm:text-5xl font-black uppercase text-white mb-6 tracking-tight">Door {assignedLocker} is Open!</h2>

                  <div className="bg-sky-500/10 border-2 border-sky-500/30 p-6 sm:p-8 rounded-3xl mb-8 w-full max-w-md shadow-xl">
                    <p className="text-lg sm:text-xl text-sky-100 font-medium leading-relaxed">
                      Please remove your parcel and <strong className="text-white underline decoration-sky-500 underline-offset-4">click the virtual 3D door to close it</strong>.
                    </p>
                  </div>

                  <div className="flex flex-col items-center gap-3 animate-in fade-in">
                    <Loader2 className="w-8 h-8 text-sky-500 animate-spin" />
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] sm:text-xs animate-pulse">
                        Waiting for sensor to confirm door closed...
                    </p>
                  </div>
              </div>
            )}
            
        </div>
        {/* 🌟 FLOATING "HOW IT WORKS" BUTTON */}
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

export default PickUpFlow;