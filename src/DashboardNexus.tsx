import React, { useState, useEffect } from 'react';
import { Wifi, Truck, Package, ToggleLeft, ToggleRight, Info, X } from 'lucide-react';

// 🌟 THE WORKFLOW EXPLANATION OVERLAY (Updated to "absolute" to stay in the tablet screen)
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
         SmartLocker PUDO Workflow
      </h2>

      <div className="space-y-6 text-slate-300 text-sm sm:text-base leading-relaxed">
        <div>
          <h3 className="text-white font-bold text-lg mb-1">The Base State</h3>
          <p>To facilitate seamless sending, all available lockers are pre-provisioned with an empty courier bag.</p>
        </div>

        <div className="border-l-2 border-blue-500 pl-4">
          <h3 className="text-blue-400 font-bold text-lg mb-1">1. Customer: Drop-Off</h3>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>The customer enters their details, consignee details, and selects a payment method.</li>
            <li>Once approved, a door opens. They remove the empty bag, place their item inside, seal it, and return it.</li>
            <li>Once closed, the locker is marked as <strong className="text-red-400">Unavailable</strong> until cleared by a courier.</li>
          </ul>
        </div>

        <div className="border-l-2 border-emerald-500 pl-4">
          <h3 className="text-emerald-400 font-bold text-lg mb-1">2. Customer: Pick-Up</h3>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>The customer enters their WhatsApp PIN code (and settles COD balances if applicable).</li>
            <li>The door opens, they retrieve their item, and close the door.</li>
            <li>That locker is now empty and marked as <strong className="text-red-400">Unavailable</strong> until reprovisioned.</li>
          </ul>
        </div>

        <div className="border-l-2 border-amber-500 pl-4">
          <h3 className="text-amber-400 font-bold text-lg mb-1">3. Courier: Daily Operations</h3>
          <ul className="list-disc list-inside space-y-2 ml-2">
            <li><strong>Drop-Off & Exchange:</strong> The courier assigns incoming parcels. If a target locker contains an outgoing parcel, the courier removes it, places the new incoming parcel inside, and closes the door.</li>
            <li><strong>Sweep:</strong> The courier opens remaining unavailable lockers to collect any other outgoing customer parcels destined for the depot.</li>
            <li><strong>Restock:</strong> Finally, the courier opens all empty doors and replenishes them with fresh courier bags, resetting the system.</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
);

export interface DashboardProps {
  onPickup: () => void;
  onDropoff: () => void;
  onCourier: () => void;
  onStatusClick: () => void;
  kioskConfig?: any;
}

const DashboardNexus: React.FC<DashboardProps> = ({ 
  onPickup, 
  onDropoff,
  onCourier, 
  onStatusClick,
  kioskConfig 
}) => {
  const [isIdle, setIsIdle] = useState(true); 
  const [isWaking, setIsWaking] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  
  // 🌟 THE GLOBAL HINTS TOGGLE
  const [showHints, setShowHints] = useState(() => localStorage.getItem('demoHints') !== 'false');

  const toggleHints = () => {
    const newVal = !showHints;
    setShowHints(newVal);
    localStorage.setItem('demoHints', newVal.toString());
    window.dispatchEvent(new Event('demo_hints_toggled'));
  };

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    const resetTimer = () => {
      if (isIdle || showInfo) return; 
      clearTimeout(timeout);
      timeout = setTimeout(() => setIsIdle(true), 60000); 
    };

    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('touchstart', resetTimer);
    window.addEventListener('click', resetTimer);
    window.addEventListener('keypress', resetTimer);

    resetTimer();
    return () => {
      clearTimeout(timeout);
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('touchstart', resetTimer);
      window.removeEventListener('click', resetTimer);
      window.removeEventListener('keypress', resetTimer);
    };
  }, [isIdle, showInfo]);

  const handleWakeUp = () => {
    setIsWaking(true);
    setTimeout(() => {
      setIsIdle(false);
      setIsWaking(false);
    }, 400); 
  };

  return (
    <div className="relative w-full h-full bg-[#020617] flex flex-col font-sans overflow-hidden">
      
      {/* 🌟 RENDER THE OVERLAY IF TRIGGERED */}
      {showInfo && <WorkflowInfoOverlay onClose={() => setShowInfo(false)} />}

      <div 
        className={`absolute inset-0 z-[100] bg-black transition-opacity duration-500 flex flex-col items-center justify-end pb-32 ${isIdle ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={handleWakeUp}
      >
        <video 
          autoPlay 
          loop 
          muted 
          playsInline 
          className="absolute inset-0 w-full h-full object-cover opacity-60"
        >
          <source src="/promo.mp4" type="video/mp4" />
        </video>

        <div className="absolute inset-0 bg-gradient-to-b from-slate-900/40 via-blue-900/20 to-black/90"></div>

        <div className="relative z-10 flex flex-col items-center">
          <button 
            onClick={(e) => { e.stopPropagation(); handleWakeUp(); }}
            className={`px-16 py-6 border-4 border-white/20 hover:border-white/50 bg-black/40 backdrop-blur-md rounded-full shadow-[0_0_50px_rgba(0,0,0,0.5)] transition-all duration-300 cursor-pointer ${isWaking ? 'scale-110 opacity-0' : 'animate-pulse hover:scale-105'}`}
          >
            <span className="text-5xl font-black text-white tracking-widest uppercase drop-shadow-lg">Touch To Start</span>
          </button>
        </div>
      </div>

      <header className="flex justify-between items-center p-6 relative z-50">
        <div>
          <h1 className="text-2xl font-extrabold text-white">SmartLocker</h1>
          <p className="text-blue-400 text-sm font-black mt-1 tracking-wider uppercase">
            UNIT ID: {kioskConfig?.SITE_ID || 'NEXUS-SIM-01'}
          </p>
        </div>
        
        <button 
          onClick={onStatusClick}
          className="bg-transparent border-none outline-none focus:ring-0 cursor-pointer p-0 m-0"
        >
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-green-500/20 bg-green-500/5">
              <Wifi size={16} className="text-green-500" />
              <span className="text-green-500 text-sm font-bold tracking-tight">System Online</span>
            </div>
        </button>
      </header>

      <main className="flex-1 flex items-center justify-center gap-12 p-6 z-10">
        <button
          onClick={() => { if (!isWaking && onPickup) onPickup(); }}
          className="group relative flex flex-col items-center justify-center w-[300px] h-[300px] bg-blue-600 rounded-[48px] shadow-2xl transition-all hover:bg-blue-500 active:scale-95 overflow-hidden cursor-pointer"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100" />
          <Truck size={80} className="text-white mb-6" strokeWidth={1.5} />
          <span className="text-3xl font-black text-white tracking-widest uppercase">Pickup</span>
          <p className="text-blue-100 mt-4 text-lg opacity-80">I have a code</p>
        </button>

        <button
          onClick={() => { if (!isWaking && onDropoff) onDropoff(); }}
          className="group relative flex flex-col items-center justify-center w-[300px] h-[300px] bg-slate-800 rounded-[48px] shadow-2xl transition-all border-[6px] border-slate-700 hover:border-slate-600 active:scale-95 overflow-hidden cursor-pointer"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100" />
          <Package size={80} className="text-slate-400 mb-6 group-hover:text-white transition-colors" strokeWidth={1.5} />
          <span className="text-3xl font-black text-white tracking-widest uppercase">Drop-off</span>
          <p className="text-slate-400 mt-4 text-lg group-hover:text-slate-200">Send a package</p>
        </button>
      </main>

      <footer className="absolute bottom-6 left-0 right-0 px-8 flex justify-between items-end z-50">
        {/* Left Side: Hints Toggle */}
        <div className="w-[200px] flex items-end pb-2">
          <button 
             onClick={toggleHints} 
             className="flex items-center gap-2 text-slate-500 hover:text-slate-300 transition-colors"
          >
            {showHints ? <ToggleRight size={24} className="text-yellow-500" /> : <ToggleLeft size={24} />}
            <span className="text-xs font-bold uppercase tracking-wider">Demo Hints {showHints ? 'ON' : 'OFF'}</span>
          </button>
        </div> 
        
        {/* Center: Info Button & Version */}
        <div className="flex flex-col items-center gap-3">
          <button 
             onClick={() => setShowInfo(true)} 
             className="flex items-center gap-2 text-yellow-500/80 hover:text-yellow-400 transition-colors bg-yellow-500/10 px-4 py-2 rounded-lg border border-yellow-500/20 shadow-sm"
          >
            <Info size={18} />
            <span className="text-xs font-bold uppercase tracking-wider">How it Works</span>
          </button>
          <div className="text-center text-slate-600 text-xs font-medium">
            v3.5.0 Build 2026-03-26 | Enterprise Kiosk Mode Active
          </div>
        </div>

        {/* Right Side: Courier Button */}
        <div className="w-[200px] flex justify-end">
          <button 
            onClick={() => { if (!isWaking && onCourier) onCourier(); }}
            className="flex items-center gap-2 px-5 py-3 bg-[#0f172a] border border-slate-700/80 hover:border-slate-500 rounded-2xl text-slate-400 hover:text-white transition-all active:scale-95 cursor-pointer shadow-lg"
          >
            <Truck size={18} />
            <span className="font-bold text-sm tracking-widest uppercase">Courier</span>
          </button>
        </div>
      </footer>
    </div>
  );
};

export default DashboardNexus;