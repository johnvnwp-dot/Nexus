import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Package, Lock, Unlock, Home } from 'lucide-react';
import DashboardNexus from './DashboardNexus';
import DropOffFlow from './DropOffFlow';
import PickUpFlow from './PickupFlow/PickupFlow';
import CourierFlow from './CourierFlow';

// --- VIRTUAL HARDWARE STATE ---
// This acts as our "Fake Database" for the simulator
type DoorState = 'closed' | 'open';
type DoorSize = 'small' | 'medium' | 'large';

interface VirtualDoor {
  id: number;
  label: string;
  state: DoorState;
  size: DoorSize;
  hasPackage: boolean;
}

const INITIAL_DOORS: VirtualDoor[] = [
  { id: 1, label: '01', state: 'closed', size: 'small', hasPackage: false },
  { id: 2, label: '02', state: 'closed', size: 'small', hasPackage: true },
  { id: 3, label: '03', state: 'closed', size: 'medium', hasPackage: false },
  { id: 4, label: '04', state: 'closed', size: 'medium', hasPackage: false },
  { id: 5, label: '05', state: 'closed', size: 'small', hasPackage: false },
  { id: 6, label: '06', state: 'closed', size: 'small', hasPackage: false },
  { id: 7, label: '07', state: 'closed', size: 'large', hasPackage: true },
  { id: 8, label: '08', state: 'closed', size: 'large', hasPackage: false },
];

function App() {
  const [doors, setDoors] = useState<VirtualDoor[]>(INITIAL_DOORS);
  const [currentStep, setCurrentStep] = useState<'DASHBOARD' | 'DROPOFF' | 'PICKUP' | 'COURIER'>('DASHBOARD');
  

  // 🌟 VIRTUAL HARDWARE SERVICE CONTROLLER
  // Later, your real UI on the left will call this function instead of a COM port
  const toggleVirtualDoor = (doorId: number) => {
    setDoors(current => 
      current.map(door => 
        door.id === doorId 
          ? { ...door, state: door.state === 'closed' ? 'open' : 'closed' }
          : door
      )
    );
  };

  // 🌟 SIMULATOR BRIDGE: Listens for commands from the DropOffFlow and updates global state
  useEffect(() => {
    // Keep a global record of door states so the polling sensor can read it!
    (window as any).VIRTUAL_DOORS = doors.reduce((acc, door) => ({...acc, [door.id]: door.state}), {});

    const handleDoorCommand = (e: any) => {
      const { doorId, state } = e.detail;
      setDoors(current => 
        current.map(door => door.id === doorId ? { ...door, state } : door)
      );
    };

    window.addEventListener('TOGGLE_VIRTUAL_DOOR', handleDoorCommand);
    return () => window.removeEventListener('TOGGLE_VIRTUAL_DOOR', handleDoorCommand);
  }, [doors]);

  return (    
    <div className="w-screen h-screen flex bg-slate-950 text-white overflow-hidden font-sans">
      
    {/* 🌟 NEW: FLOATING "BACK TO PORTAL" BUTTON */}
      <a 
        href="https://smartlocker.africa"
        className="absolute top-6 right-8 z-[100] flex items-center gap-3 px-6 py-3 bg-sky-500/10 hover:bg-sky-500/20 border-2 border-sky-500/30 hover:border-sky-500 rounded-full text-sky-400 hover:text-white transition-all shadow-[0_0_20px_rgba(14,165,233,0.15)] hover:shadow-[0_0_30px_rgba(14,165,233,0.3)] active:scale-95 cursor-pointer backdrop-blur-md group"
      >
        <Home size={20} className="group-hover:-translate-y-0.5 transition-transform" />
        <span className="font-black tracking-widest uppercase text-sm">Back to Home</span>
      </a>

      {/* =========================================
          LEFT SIDE: THE "BRAIN" (TABLET UI - 65%)
          ========================================= */}
      <div className="w-[65%] h-full bg-black border-r-4 border-slate-800 shadow-[20px_0_50px_rgba(0,0,0,0.5)] z-10 flex flex-col relative">
        {/* Hardware Bezel styling */}
        <div className="absolute top-0 w-full h-4 bg-slate-900 border-b border-slate-800 z-50"></div>
        <div className="absolute bottom-0 w-full h-4 bg-slate-900 border-t border-slate-800 z-50"></div>
        
        {/* 🌟 YOUR ACTUAL KIOSK UI MOUNTED HERE */}
        <div className="flex-1 w-full h-full p-4 overflow-hidden pt-6 pb-6">
          
          {currentStep === 'DASHBOARD' && (
            <DashboardNexus 
              onDropoff={() => setCurrentStep('DROPOFF')} 
              onPickup={() => setCurrentStep('PICKUP')}
              onCourier={() => setCurrentStep('COURIER')}
              onStatusClick={() => {}}
            />
          )}

          {currentStep === 'DROPOFF' && <DropOffFlow onDone={() => setCurrentStep('DASHBOARD')} />}

          {currentStep === 'PICKUP' && <PickUpFlow onDone={() => setCurrentStep('DASHBOARD')} config={{}} />}

          {currentStep === 'COURIER' && <CourierFlow onDone={() => setCurrentStep('DASHBOARD')} />}  

        </div>
      </div>

      {/* =========================================
          RIGHT SIDE: THE "BODY" (VIRTUAL LOCKER - 35%)
          ========================================= */}
      <div className="w-[35%] h-full bg-slate-950 p-8 flex flex-col items-center justify-center relative overflow-hidden">
        
        {/* Decorative Background grid */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-20"></div>

        <div className="z-10 w-full max-w-sm flex flex-col items-center">
          
          {/* Stacked header, now perfectly centered above the cabinet */}
          <div className="flex flex-col items-center mb-8 px-2 gap-3">
            <h2 className="text-lg font-black uppercase tracking-widest text-slate-400 flex items-center gap-3">
              <span className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]"></span>
              Virtual Hardware
            </h2>
            <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-800 px-3 py-1 rounded-full border border-slate-700">
              BOARD: 1 | PORT: VIRTUAL
            </span>
          </div>

          {/* THE CABINET CHASSIS */}
          <div className="bg-slate-900 p-6 border-[12px] border-slate-800 shadow-[0_30px_60px_rgba(0,0,0,0.8)] w-full">
            
            {/* LOCKER GRID */}
            <div className="grid grid-cols-2 gap-4 perspective-[2000px]">
              {doors.map((door) => (
                <div 
                  key={door.id} 
                  onClick={() => toggleVirtualDoor(door.id)}
                  className={`relative bg-slate-800 rounded-xl border-4 shadow-xl flex items-center justify-center cursor-pointer
                    ${door.state === 'open' ? 'border-amber-500/50' : 'border-slate-700'}
                    ${door.size === 'small' ? 'h-24' : door.size === 'medium' ? 'h-36' : 'h-48'}
                  `}
                  style={{ transformStyle: 'preserve-3d' }}
                >
                  
                  {/* THE INSIDE OF THE LOCKER */}
                  <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center shadow-inner rounded-lg">
                     {door.hasPackage ? (
                       <motion.div 
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: door.state === 'open' ? 1 : 0, scale: door.state === 'open' ? 1 : 0.8 }}
                          transition={{ delay: 0.2 }}
                       >
                         <Package size={40} className="text-amber-600 drop-shadow-[0_10px_15px_rgba(0,0,0,0.5)]" />
                       </motion.div>
                     ) : (
                       <span className="text-slate-800 font-black tracking-widest uppercase text-xs">Empty</span>
                     )}
                  </div>

                  {/* THE PHYSICAL DOOR (Animated) */}
                  <motion.div
                    className="absolute inset-0 origin-left bg-slate-700 hover:bg-slate-600 border-r-2 border-slate-600 flex flex-col p-3 shadow-[5px_0_15px_rgba(0,0,0,0.3)] transition-colors rounded-lg"
                    initial={false}
                    animate={{ rotateY: door.state === 'open' ? -105 : 0 }}
                    transition={{ type: "spring", stiffness: 80, damping: 15 }}
                  >
                    <div className="flex justify-between items-start w-full">
                      <span className="text-xl font-black text-slate-400 font-mono">{door.label}</span>
                      {door.state === 'open' ? <Unlock size={14} className="text-amber-500" /> : <Lock size={14} className="text-slate-500" />}
                    </div>
                    
                    {/* Decorative vents */}
                    <div className="mt-auto self-end flex flex-col gap-1 opacity-30">
                      <div className="w-8 h-1 bg-black rounded-full"></div>
                      <div className="w-8 h-1 bg-black rounded-full"></div>
                      <div className="w-8 h-1 bg-black rounded-full"></div>
                    </div>
                  </motion.div>

                </div>
              ))}
            </div>
            {/* Base of the cabinet (Visual detail) */}
            <div className="w-full h-2 bg-slate-950 mt-6 rounded-full opacity-50"></div>
          </div>

        </div>
      </div>
    </div>
  );
}

export default App;