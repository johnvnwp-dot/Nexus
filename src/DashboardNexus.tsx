import React, { useState, useEffect } from 'react';
import { Wifi, Truck, Package, ToggleLeft, ToggleRight } from 'lucide-react';

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
      if (isIdle) return; 
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
  }, [isIdle]);

  const handleWakeUp = () => {
    setIsWaking(true);
    setTimeout(() => {
      setIsIdle(false);
      setIsWaking(false);
    }, 400); 
  };

  return (
    <div className="relative w-full h-full bg-[#020617] flex flex-col font-sans overflow-hidden">
      
      <div 
        className={`absolute inset-0 z-[100] bg-black transition-opacity duration-500 flex flex-col items-center justify-end pb-32 ${isIdle ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={handleWakeUp}
      >
        {/* 🎬 YOUR VIDEO TAG IS BACK */}
        <video 
          autoPlay 
          loop 
          muted 
          playsInline 
          className="absolute inset-0 w-full h-full object-cover opacity-60"
        >
          {/* Make sure this path matches your actual video file! */}
          <source src="/promo.mp4" type="video/mp4" />
        </video>

        {/* Gradient overlay to make the text pop against the video */}
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
        {/* 🌟 DEMO HINTS TOGGLE */}
        <div className="flex flex-col items-start gap-2 w-[200px]">
          <button 
             onClick={toggleHints} 
             className="flex items-center gap-2 text-slate-500 hover:text-slate-300 transition-colors"
          >
            {showHints ? <ToggleRight size={24} className="text-yellow-500" /> : <ToggleLeft size={24} />}
            <span className="text-xs font-bold uppercase tracking-wider">Demo Hints {showHints ? 'ON' : 'OFF'}</span>
          </button>
        </div> 
        
        <div className="text-center text-slate-600 text-xs font-medium pb-2">
          v3.5.0 Build 2026-03-26 | Enterprise Kiosk Mode Active
        </div>

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