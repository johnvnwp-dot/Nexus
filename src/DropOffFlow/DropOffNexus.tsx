import React, { useState, useEffect } from 'react';
import type { LockerSize } from './index';
import { ChevronLeft, Box, Loader2, X, Home, Globe2, Truck, School, Send, ShieldCheck, Building, CreditCard, AlertTriangle, DoorOpen, UserPen, MapPin, CheckCircle2, ArrowRight, PenLine, Banknote } from 'lucide-react';

// 🌟 NEW: CLEAN, NON-BOLD, PULSING TEXT COMPONENT
const DemoHint = ({ message, className = "" }: { message: string, className?: string }) => {
  const [show, setShow] = useState(() => localStorage.getItem('demoHints') !== 'false');
  
  useEffect(() => {
    const handleToggle = () => setShow(localStorage.getItem('demoHints') !== 'false');
    window.addEventListener('demo_hints_toggled', handleToggle);
    return () => window.removeEventListener('demo_hints_toggled', handleToggle);
  }, []);

  if (!show) return null;

  return (
    <div className={`pointer-events-none animate-pulse text-yellow-400 font-normal tracking-wide z-[200] ${className}`}>
       {message}
    </div>
  );
};

const SIZE_DETAILS: Record<LockerSize, { label: string; desc: string }> = {
  'SMALL': { label: 'Small', desc: 'Documents (less than 500 grams)' },
  'MEDIUM': { label: 'Medium', desc: 'Larger items (500g to 5kg)' },
  'LARGE': { label: 'Large', desc: 'Bulk items (5kg to 10kg)' },
};

const DropOffNexus = (props: any) => {
  const {
    step, setStep, goBack, scrollContainerRef, isLoadingSizes, sizeAvailability, 
    handleSizeSelect, onDone, handleServiceSelect, sysConfig,
    handleLocalServiceType, handleZoneSelect, handleCitySelect,
    serviceType, localServiceType, destinationCity, resetOtpFlow,
    senderName, senderPhone, senderEmail, senderOtp, setFocusedField, focusedField,
    isPhoneVerified, isOtpSent, isVerifying, handleSendOtp,
    consigneeName, consigneePhone, consigneeEmail, addressLine1, suburb, town, postalCode, country, 
    isGeneratingQr, getCalculatedPrice, startPayment, activeLocker,
    paymentStatus, setPaymentStatus, handleCodSelect
  } = props;

  const ENABLE_SIMULATOR = true;

  useEffect(() => {
    if (step === 'SERVICE_TYPE' && !sysConfig?.settings?.intl_enabled) {
      handleServiceSelect('LOCAL');
    }
  }, [step, sysConfig, handleServiceSelect]);

  const handleSmartBack = () => {
    if (step === 'LOCAL_SERVICE_TYPE' && !sysConfig?.settings?.intl_enabled) {
      setStep('SIZE');
    } else if (step === 'PAYMENT_METHOD') {
      setStep('CONSIGNEE_DETAILS');
    } else if (step === 'PAYMENT') {
      setStep('PAYMENT_METHOD');
    } else {
      goBack();
    }
  };

  const simulatePaymentSuccess = async () => {
    startPayment();
  };

  const handleNativeChange = (field: string, value: string) => {
    const setters: Record<string, (val: string) => void> = {
      senderName: props.setSenderName, senderPhone: props.setSenderPhone, senderEmail: props.setSenderEmail, senderOtp: props.setSenderOtp,
      consigneeName: props.setConsigneeName, consigneePhone: props.setConsigneePhone, consigneeEmail: props.setConsigneeEmail,
      addressLine1: props.setAddressLine1, suburb: props.setSuburb, town: props.setTown, country: props.setCountry, postalCode: props.setPostalCode
    };
    if (setters[field]) setters[field](value);
  };

  const getProgressIndex = () => {
    const steps = ['SIZE', 'SERVICE_TYPE', 'SENDER_DETAILS', 'CONSIGNEE_DETAILS', 'PAYMENT_METHOD', 'PAYMENT', 'WAITING_CLOSE'];
    if (step === 'LOCAL_SERVICE_TYPE' || step === 'ZONE_SELECT' || step === 'DESTINATION_CITY') return 1; 
    const idx = steps.indexOf(step);
    return idx === -1 ? 0 : idx;
  };

  const renderHeaderTitle = () => {
    switch(step) {
      case 'SIZE': return "SELECT LOCKER SIZE";
      case 'SERVICE_TYPE': return "SHIPMENT SCOPE";
      case 'LOCAL_SERVICE_TYPE': return "DELIVERY METHOD";
      case 'DESTINATION_CITY': return "SELECT DESTINATION";
      case 'ZONE_SELECT': return "DESTINATION ZONE";
      case 'PAYMENT_METHOD': return "PAYMENT OPTIONS";
      case 'PAYMENT': return "SECURE PAYMENT";
      case 'WAITING_CLOSE': return "FINALIZING DROP-OFF";
      default: return "";
    }
  };

  const checkNeedsAttention = (field: string) => {
    switch (field) {
      case 'senderName': return (senderName || '').trim().length < 3;
      case 'senderPhone': { 
          const phone = (senderPhone || '').replace(/\s/g, ''); 
          return !/^\+?[0-9]{9,15}$/.test(phone); 
      }
      case 'consigneeName': return (consigneeName || '').trim().length < 3;
      case 'consigneePhone': {
          const phone = (consigneePhone || '').replace(/\s/g, '');
          if (serviceType === 'INTERNATIONAL' && !phone.startsWith('+')) return true;
          return !/^\+?[0-9]{9,15}$/.test(phone);
      }
      case 'addressLine1': return (addressLine1 || '').trim().length < 3;
      case 'suburb': return (suburb || '').trim().length < 2;
      case 'town': return (town || '').trim().length < 2;
      case 'country': return (country || '').trim().length < 2;
      case 'senderEmail': case 'consigneeEmail': case 'postalCode': return false;
      default: return false;
    }
  };

  const isSenderReady = () => !checkNeedsAttention('senderName') && !checkNeedsAttention('senderPhone');
  
  const isRecipientReady = () => {
    if (checkNeedsAttention('consigneeName') || checkNeedsAttention('consigneePhone')) return false;
    if (serviceType === 'LOCAL' && localServiceType === 'LOCKER') return true;
    if (serviceType === 'LOCAL' && localServiceType === 'DOOR') {
      if (checkNeedsAttention('addressLine1') || checkNeedsAttention('suburb') || checkNeedsAttention('town')) return false;
    }
    if (serviceType === 'INTERNATIONAL') {
      if (checkNeedsAttention('addressLine1') || checkNeedsAttention('town') || checkNeedsAttention('country')) return false;
    }
    return true;
  };

  const inputClass = (field: string, forceDisable = false) => {
    const isFocused = focusedField === field;
    const needsAttention = checkNeedsAttention(field);
    let style = 'bg-slate-800/50 border-slate-700 hover:border-slate-500 cursor-text'; 
    if (needsAttention) style = 'bg-red-950/20 border-red-500/60 hover:border-red-400 cursor-text'; 
    if (isFocused) style = 'bg-slate-800 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.3)] cursor-text';
    if (forceDisable) style = 'bg-slate-900/50 border-slate-800/50 cursor-not-allowed opacity-50 hover:border-slate-800/50';
    return `w-full border-2 rounded-xl px-4 py-4 text-xl font-bold outline-none transition-all ${forceDisable ? 'text-slate-400' : 'text-white'} ${style}`;
  };

  return (
    <div className="h-full w-full flex flex-col bg-slate-900 font-sans overflow-hidden rounded-xl border border-slate-700 relative">
      
      {/* 🔙 HEADER */}
      <header className="shrink-0 flex items-center justify-between px-8 py-4 bg-slate-900 border-b border-slate-800 z-20 shadow-sm">
        <div className="flex-1">
          <button onClick={handleSmartBack} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors group">
            <ChevronLeft size={32} className="group-active:-translate-x-1 transition-transform" />
            <span className="text-lg font-bold uppercase tracking-widest">Back</span>
          </button>
        </div>

        <div className="flex-[2] flex justify-center items-center">
          {step === 'SENDER_DETAILS' ? (
            <div className="flex items-center gap-3 animate-in fade-in">
              <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400"><UserPen size={20} /></div>
              <h2 className="text-xl font-black text-white uppercase tracking-tight">Your Details <span className="text-slate-400 font-bold tracking-widest text-sm ml-2">| Sender Info</span></h2>
            </div>
          ) : step === 'CONSIGNEE_DETAILS' ? (
            <div className="flex items-center gap-3 animate-in fade-in">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400"><MapPin size={20} /></div>
              <h2 className="text-xl font-black text-white uppercase tracking-tight">Recipient Details <span className="text-slate-400 font-bold tracking-widest text-sm ml-2">| Full Info</span></h2>
            </div>
          ) : (
            <h2 className="text-2xl font-black text-white uppercase tracking-tighter">{renderHeaderTitle()}</h2>
          )}
        </div>

        <div className="flex-1 flex items-center justify-end gap-6">
          <div className="flex gap-2">
            {[0, 1, 2, 3, 4, 5, 6].map((idx) => (
              <div key={idx} className={`h-1.5 rounded-full transition-all duration-700 w-2 ${idx < getProgressIndex() + 1 ? 'bg-blue-500' : 'bg-slate-800'}`} />
            ))}
          </div>
          {step !== 'ALLOCATING' && step !== 'WAITING_CLOSE' && (
            <button 
              onClick={onDone} 
              className="flex items-center gap-1.5 px-5 py-2.5 bg-red-500/10 hover:bg-red-500 border border-red-500/30 hover:border-red-500 rounded-full text-red-500 hover:text-white active:scale-95 transition-all text-xs font-black uppercase tracking-widest shadow-sm"
            >
              <X size={16} strokeWidth={3} /> Cancel
            </button>
          )}
        </div>
      </header>

      {/* MAIN CONTENT WRAPPER */}
      <div className="flex-1 relative flex flex-col overflow-hidden">
        
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-8 flex flex-col no-scrollbar pb-12">
          
          {step === 'SIZE' && (
            <div className="text-center animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto py-12 flex flex-col items-center">
              {isLoadingSizes ? (
                  <div className="flex flex-col items-center justify-center mt-20 gap-6">
                      <Loader2 size={80} className="animate-spin text-blue-500" />
                      <p className="text-slate-400 font-black uppercase tracking-widest text-xl">Scanning Hardware...</p>
                  </div>
              ) : (
                  <>
                    <div className="grid grid-cols-3 gap-8 mt-6">
                      {(['SMALL', 'MEDIUM', 'LARGE'] as LockerSize[]).map((s) => {
                        const { label, desc } = SIZE_DETAILS[s];
                        const isAvailable = sizeAvailability ? !!sizeAvailability[s] : false;
                        const count = sizeAvailability ? sizeAvailability[s] : 0;
                        
                        return (
                          <button key={s} onClick={() => isAvailable && handleSizeSelect(s)} disabled={!isAvailable} className={`group relative flex flex-col items-center p-10 rounded-[48px] border-4 transition-all shadow-2xl overflow-hidden ${isAvailable ? 'bg-slate-800/50 border-slate-800 hover:border-blue-500 hover:bg-slate-800 cursor-pointer' : 'bg-slate-900/80 border-red-900/30 opacity-60 cursor-not-allowed grayscale'}`}>
                            
                            {isAvailable && count !== true && count !== false && count !== undefined && (
                              <div className="absolute top-8 right-8 bg-slate-900 border-2 border-slate-700 px-4 py-2 rounded-2xl flex items-center gap-2 shadow-lg">
                                 <span className="text-sky-400 font-black text-xl leading-none">{count}</span>
                                 <span className="text-slate-500 font-bold text-xs uppercase tracking-widest leading-none mt-0.5">Avail</span>
                              </div>
                            )}

                            {!isAvailable && (
                                <div className="absolute inset-0 bg-red-900/10 flex items-center justify-center backdrop-blur-[1px] z-10">
                                    <div className="bg-red-600 text-white font-black text-2xl px-8 py-3 rounded-full uppercase tracking-[0.2em] border-4 border-red-400 shadow-2xl transform -rotate-12">Full</div>
                                </div>
                            )}
                            <Box size={80} className={`${s === 'SMALL' ? 'scale-75' : s === 'LARGE' ? 'scale-125' : ''} ${isAvailable ? 'text-slate-500 group-hover:text-blue-400' : 'text-slate-700'} mb-8 transition-colors`} />
                            <span className="text-4xl font-black text-white uppercase mb-4 tracking-tighter">{label}</span>
                            <p className="text-slate-400 text-lg font-bold uppercase tracking-widest leading-tight opacity-80">{desc}</p>
                          </button>
                        );
                      })}
                    </div>
                    {/* 🌟 NEW HINT FOR SIZE */}
                    <DemoHint message="Select the correct locker size for your parcel" className="mt-12 text-lg" />
                  </>
              )}
            </div>
          )}

          {step === 'SERVICE_TYPE' && sysConfig?.settings?.intl_enabled && (
            <div className="flex flex-col items-center justify-center h-full gap-12 py-12 animate-in fade-in zoom-in-95 duration-500">
              <div className="flex gap-12 w-full max-w-5xl">
                <button 
                  onClick={() => handleServiceSelect('LOCAL')} 
                  className="flex-1 group flex flex-col items-center justify-center p-16 bg-blue-600 rounded-[48px] shadow-2xl transition-all hover:bg-blue-500 active:scale-95"
                >
                  <Home size={100} className="text-white mb-8" />
                  <span className="text-4xl font-black text-white uppercase">Local</span>
                  <p className="text-blue-100 mt-4 text-xl opacity-80 font-bold">Zimbabwe Only</p>
                </button>

                {sysConfig?.settings?.intl_enabled && (
                  <button 
                    onClick={() => {
                      if (props.setTown) props.setTown('');
                      if (props.setPostalCode) props.setPostalCode('');
                      if (props.setCountry) props.setCountry('');
                      handleServiceSelect('INTERNATIONAL');
                    }} 
                    className="flex-1 group flex flex-col items-center justify-center p-16 bg-slate-800 border-4 border-slate-700 rounded-[48px] shadow-2xl transition-all hover:border-slate-500 active:scale-95"
                  >
                    <Globe2 size={100} className="text-slate-400 mb-8" />
                    <span className="text-4xl font-black text-white uppercase">International</span>
                    <p className="text-slate-400 mt-4 text-xl font-bold">Worldwide</p>
                  </button>
                )}
              </div>
            </div>
          )}

          {step === 'LOCAL_SERVICE_TYPE' && (
            <div className="flex flex-col items-center justify-center h-full gap-12 py-12 animate-in fade-in zoom-in-95 duration-500">
              <div className="flex gap-12 w-full max-w-5xl">
                <button 
                  onClick={() => {
                    if (props.setTown) props.setTown('');
                    if (props.setSuburb) props.setSuburb('');
                    if (props.setAddressLine1) props.setAddressLine1('');
                    handleLocalServiceType('DOOR');
                  }} 
                  className="flex-1 group flex flex-col items-center justify-center p-16 bg-blue-600 rounded-[48px] shadow-2xl transition-all hover:bg-blue-500 active:scale-95"
                >
                  <Truck size={100} className="text-white mb-8" />
                  <span className="text-4xl font-black text-white uppercase">Locker to Door</span>
                  <p className="text-blue-100 mt-4 text-xl opacity-80 font-bold">Home Delivery</p>
                </button>

                <button 
                  onClick={() => handleLocalServiceType('LOCKER')} 
                  className="flex-1 group flex flex-col items-center justify-center p-16 bg-slate-800 border-4 border-slate-700 rounded-[48px] shadow-2xl transition-all hover:border-slate-500 active:scale-95"
                >
                  <School size={100} className="text-slate-400 mb-8" />
                  <span className="text-4xl font-black text-white uppercase">Locker to Locker</span>
                  <p className="text-slate-400 mt-4 text-xl font-bold">Pick up at Hub</p>
                </button>
              </div>
              {/* 🌟 NEW HINT FOR LOCAL SERVICE */}
              <DemoHint message="Choose a Destination" className="mt-2 text-lg" />
            </div>
          )}

          {step === 'DESTINATION_CITY' && (
            <div className="flex flex-col items-center justify-center py-6 animate-in fade-in duration-500 max-w-6xl mx-auto h-full">
              <div className="grid grid-cols-3 gap-4 w-full">
                {(props.dynamicDestinations || []).map((city: string) => (
                  <button key={city} onClick={() => handleCitySelect(city)} className="p-5 bg-slate-800 border-2 border-slate-700 rounded-2xl text-xl font-bold text-white hover:border-blue-500 hover:bg-slate-700 transition-all active:scale-95 shadow-lg flex items-center justify-center text-center">
                    {city}
                  </button>
                ))}

                {(!props.dynamicDestinations || props.dynamicDestinations.length === 0) && (
                    <div className="col-span-3 flex flex-col items-center justify-center text-center mt-12 bg-slate-800/30 border-2 border-dashed border-slate-700 p-12 rounded-[40px]">
                        <Building size={60} className="text-slate-600 mb-6" />
                        <span className="text-4xl font-black text-slate-500 uppercase tracking-widest mb-4">Coming Soon</span>
                        <p className="text-slate-400 text-xl font-bold max-w-2xl">
                            You are currently at the only active locker location in this network. More destinations will be available shortly!
                        </p>
                    </div>
                )}
              </div>
            </div>
          )}

          {step === 'ZONE_SELECT' && (
            <div className="flex flex-col items-center justify-center h-full gap-8 py-12 animate-in fade-in duration-500">
              <div className="grid grid-cols-2 gap-8 w-full max-w-5xl">
                {Array.from({ length: props.sysConfig?.settings?.active_intl_zones || 0 }).map((_, i) => {
                  const zoneId = i + 1;
                  const regionDescription = props.sysConfig?.settings?.[`zone${zoneId}_name`] 
                                         || props.sysConfig?.settings?.[`zone${zoneId}_regions`] 
                                         || props.sysConfig?.settings?.[`zone${zoneId}_desc`]
                                         || `Routing Region ${zoneId}`;

                  return (
                    <button 
                      key={zoneId} 
                      onClick={() => props.handleZoneSelect(zoneId)} 
                      className="flex flex-col items-start p-10 bg-slate-800 border-4 border-slate-700 rounded-[40px] hover:border-blue-500 transition-all text-left group active:scale-95 shadow-xl"
                    >
                      <span className="text-3xl font-black text-white mb-3 group-hover:text-blue-400 uppercase tracking-tight">
                        Zone {zoneId}
                      </span>
                      <p className="text-slate-400 text-xl font-medium leading-relaxed">
                        {regionDescription}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* SENDER DETAILS */}
          {step === 'SENDER_DETAILS' && (
            <div className="max-w-4xl mx-auto py-10 animate-in fade-in slide-in-from-right-8 duration-500 w-full">
              <div className="bg-slate-800/30 p-10 rounded-[40px] border border-slate-700/50 shadow-2xl overflow-hidden transition-all duration-500">
                <div className="space-y-8 mt-2">
                  
                  <div className="flex gap-4">
                    <div className="flex-[1.5] space-y-2 relative">
                      {/* 🌟 NEW HINT FOR NAME */}
                      <DemoHint message="Enter a min of 3 characters" className="absolute -top-6 left-2 text-xs" />
                      <label className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] ml-4">Full Name</label>
                      <input 
                          onFocus={() => setFocusedField('senderName')} 
                          onChange={(e) => handleNativeChange('senderName', e.target.value)} 
                          value={senderName} 
                          className={inputClass('senderName', isOtpSent)} 
                          placeholder="Type here..."
                          disabled={isOtpSent} 
                      />
                    </div>
                    <div className="flex-1 space-y-2 relative">
                      {/* 🌟 NEW HINT FOR PHONE */}
                      <DemoHint message="Enter at least 9 numbers" className="absolute -top-6 left-2 text-xs" />
                      <label className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] ml-4">Phone Number</label>
                      <input 
                          onFocus={() => setFocusedField('senderPhone')} 
                          onChange={(e) => handleNativeChange('senderPhone', e.target.value)} 
                          value={senderPhone} 
                          className={inputClass('senderPhone', isOtpSent)} 
                          placeholder="Type here..."
                          disabled={isOtpSent} 
                      />
                    </div>
                  </div>
                  
                  <div className="flex gap-4 items-end">
                    <div className="flex-1 space-y-2">
                      <label className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] ml-4">Email Address (Optional)</label>
                      <input 
                          onFocus={() => setFocusedField('senderEmail')} 
                          onChange={(e) => handleNativeChange('senderEmail', e.target.value)} 
                          value={senderEmail} 
                          className={inputClass('senderEmail', isOtpSent)} 
                          placeholder="your@email.com"
                          disabled={isOtpSent} 
                      />
                    </div>
                    
                    {!isOtpSent ? (
                        <button type="button" onClick={handleSendOtp} disabled={!isSenderReady()} className={`w-48 py-4 rounded-xl text-white font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg h-[64px] ${!isSenderReady() || isVerifying ? 'bg-slate-800 text-slate-600 cursor-not-allowed border-2 border-slate-700' : 'bg-blue-600 hover:bg-blue-500 active:scale-95 border-2 border-blue-500'}`}>
                          {isVerifying ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />} Get Code
                        </button>
                    ) : !isPhoneVerified ? (
                        <div className="w-48 py-4 rounded-xl bg-blue-500/10 text-blue-400 font-black uppercase tracking-widest flex items-center justify-center gap-2 border-2 border-blue-500/30 shadow-lg cursor-default h-[64px]">
                            Code Sent
                        </div>
                    ) : (
                        <div className="w-48 py-4 rounded-xl bg-green-500/10 text-green-400 font-black uppercase tracking-widest flex items-center justify-center gap-2 border-2 border-green-500/30 shadow-lg cursor-default h-[64px]">
                            <ShieldCheck size={20} /> Verified
                        </div>
                    )}
                  </div>

                  {isOtpSent && !isPhoneVerified && (
                    <div className="mt-8 pt-8 border-t border-slate-700/50 animate-in slide-in-from-top-4 fade-in duration-500 flex flex-col items-center">
                      
                      {/* 🌟 NEW HINT FOR OTP */}
                      <DemoHint message="Type demo code here" className="mb-2 text-base" />
                      
                      <div className="bg-blue-500/5 p-8 rounded-3xl border border-blue-500/20 relative overflow-hidden w-full">
                        <div className="flex flex-col items-center text-center">
                          <span className="text-blue-400 font-black uppercase tracking-widest text-xl mb-6 flex items-center gap-3">
                              <ShieldCheck size={28} /> Enter 4-Digit Code
                          </span>

                          <div className="flex items-stretch gap-4 w-full max-w-md relative z-10">
                              <input 
                                autoFocus
                                onChange={(e) => handleNativeChange('senderOtp', e.target.value)} 
                                value={senderOtp} 
                                className="flex-1 bg-slate-900 border-2 border-blue-500 rounded-2xl p-4 text-5xl text-center font-mono tracking-[0.4em] text-white outline-none cursor-text shadow-inner h-[88px]" 
                                placeholder="----" 
                                maxLength={4}
                              />
                              <button type="button" onClick={(e) => { e.preventDefault(); resetOtpFlow?.(); }} className="flex flex-col items-center justify-center gap-1 px-6 bg-slate-800 border-2 border-slate-700 rounded-2xl text-slate-400 hover:bg-slate-700 hover:text-white transition-all active:scale-95 shadow-md h-[88px]">
                                <PenLine size={24} />
                                <span className="text-[10px] font-bold uppercase tracking-widest mt-1">Edit Info</span>
                              </button>
                          </div>

                          <div className="mt-8 py-2 px-6 rounded-full border border-yellow-500/30 bg-yellow-900/10 flex items-center shadow-lg">
                              <span className="text-yellow-400 font-bold uppercase tracking-widest text-xs">Simulated:</span>
                              <span className="text-yellow-300 font-normal tracking-widest text-lg ml-3">1 2 3 4</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {isPhoneVerified && (
                      <button type="button" onClick={() => { setFocusedField(null); setStep('CONSIGNEE_DETAILS'); }} className="w-full py-6 mt-8 bg-blue-600 hover:bg-blue-500 active:scale-95 rounded-[24px] text-2xl font-black text-white shadow-xl uppercase tracking-widest transition-all border-2 border-blue-500 flex items-center justify-center gap-3 animate-in fade-in zoom-in-95 duration-500">
                          CONTINUE TO RECIPIENT <ArrowRight size={28} />
                      </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* CONSIGNEE DETAILS */}
          {step === 'CONSIGNEE_DETAILS' && (
            <div className="max-w-4xl mx-auto py-10 animate-in fade-in slide-in-from-right-8 duration-500 w-full flex flex-col items-center">
              
              {/* 🌟 NEW HINT FOR TOP OF CONSIGNEE FORM */}
              <DemoHint message="Fill input boxes until they are no longer red" className="mb-4 text-lg" />
              
              <div className="bg-slate-800/30 p-10 rounded-[40px] border border-slate-700/50 shadow-2xl overflow-hidden w-full">
                <div className="space-y-8 animate-in slide-in-from-left-8 fade-in duration-300 pt-2">
                  
                  <div className="flex items-center justify-between mb-4 border-b border-slate-700/50 pb-6">
                     <h3 className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-3">
                       <MapPin className="text-emerald-500" size={24} /> Recipient Information
                     </h3>
                     <div className="px-5 py-2 rounded-xl bg-blue-500/10 border-2 border-blue-500/30 text-blue-400 font-black tracking-widest text-sm shadow-inner cursor-default">
                       {serviceType === 'INTERNATIONAL' ? 'INTERNATIONAL PARCEL' : localServiceType === 'LOCKER' ? 'LOCKER TO LOCKER' : 'LOCKER TO DOOR'}
                     </div>
                  </div>

                  <div className="space-y-6">
                    <div className="flex gap-4">
                      <div className="flex-[1.5] space-y-2">
                        <label className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] ml-4">Recipient Name</label>
                        <input 
                            onFocus={() => setFocusedField('consigneeName')} 
                            onChange={(e) => handleNativeChange('consigneeName', e.target.value)} 
                            value={consigneeName} 
                            className={inputClass('consigneeName')} 
                            placeholder="Type here..." 
                        />
                      </div>
                      <div className="flex-1 space-y-2">
                        <label className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] ml-4">Recipient Phone</label>
                        <input 
                            onFocus={() => setFocusedField('consigneePhone')} 
                            onChange={(e) => handleNativeChange('consigneePhone', e.target.value)} 
                            value={consigneePhone} 
                            className={inputClass('consigneePhone')} 
                            placeholder="Type here..." 
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] ml-4">Recipient Email (Optional)</label>
                      <input 
                          onFocus={() => setFocusedField('consigneeEmail')} 
                          onChange={(e) => handleNativeChange('consigneeEmail', e.target.value)} 
                          value={consigneeEmail} 
                          className={inputClass('consigneeEmail')} 
                          placeholder="recipient@email.com" 
                      />
                    </div>
                  </div>

                  {serviceType === 'LOCAL' && localServiceType === 'LOCKER' ? (
                    <div className="pt-2">
                      <div className="flex gap-6 p-6 bg-slate-900/50 rounded-3xl border border-slate-700/50">
                        <div className="w-24 flex flex-col items-center justify-center border-r border-slate-700/50 pr-6 shrink-0">
                          <MapPin className="text-emerald-500 mb-2" size={32} />
                          <span className="text-[10px] font-black text-slate-500 text-center uppercase tracking-widest leading-tight">Delivery<br/>Destination</span>
                        </div>
                        <div className="flex-1 flex flex-col justify-center text-center">
                          <h3 className="text-3xl font-black text-white uppercase tracking-tight">{destinationCity || 'Selected Locker'}</h3>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      {serviceType === 'LOCAL' && localServiceType === 'DOOR' && (
                        <div className="space-y-6 pt-2">
                          <div className="space-y-2">
                            <label className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] ml-4">Street Address</label>
                            <input 
                                onFocus={() => setFocusedField('addressLine1')} 
                                onChange={(e) => handleNativeChange('addressLine1', e.target.value)} 
                                value={addressLine1} 
                                className={inputClass('addressLine1')} 
                                placeholder="Type here..." 
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                              <label className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] ml-4">Suburb</label>
                              <input 
                                  onFocus={() => setFocusedField('suburb')} 
                                  onChange={(e) => handleNativeChange('suburb', e.target.value)} 
                                  value={suburb} 
                                  className={inputClass('suburb')} 
                                  placeholder="Type here..." 
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] ml-4">Town / City</label>
                              <input 
                                  onFocus={() => setFocusedField('town')} 
                                  onChange={(e) => handleNativeChange('town', e.target.value)} 
                                  value={town} 
                                  className={inputClass('town')} 
                                  placeholder="Type here..." 
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {serviceType === 'INTERNATIONAL' && (
                        <div className="space-y-6 pt-2">
                          <div className="space-y-2">
                            <label className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] ml-4">Street Address</label>
                            <input 
                                onFocus={() => setFocusedField('addressLine1')} 
                                onChange={(e) => handleNativeChange('addressLine1', e.target.value)} 
                                value={addressLine1} 
                                className={inputClass('addressLine1')} 
                                placeholder="Type here..." 
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                              <label className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] ml-4">Town / City</label>
                              <input 
                                  onFocus={() => setFocusedField('town')} 
                                  onChange={(e) => handleNativeChange('town', e.target.value)} 
                                  value={town} 
                                  className={inputClass('town')} 
                                  placeholder="Type here..." 
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] ml-4">Postal Code</label>
                              <input 
                                  onFocus={() => setFocusedField('postalCode')} 
                                  onChange={(e) => handleNativeChange('postalCode', e.target.value)} 
                                  value={postalCode} 
                                  className={inputClass('postalCode')} 
                                  placeholder="Type here..." 
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <label className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] ml-4">Country</label>
                            <input 
                                onFocus={() => setFocusedField('country')} 
                                onChange={(e) => handleNativeChange('country', e.target.value)} 
                                value={country} 
                                className={inputClass('country')} 
                                placeholder="Type here..." 
                            />
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  <div className="pt-6">
                    <button type="button" onClick={() => { setFocusedField(null); setStep('PAYMENT_METHOD'); }} disabled={!isRecipientReady()} className={`w-full py-6 rounded-[24px] text-2xl font-black text-white shadow-xl uppercase tracking-widest transition-all flex items-center justify-center gap-3 ${!isRecipientReady() ? 'bg-slate-800 text-slate-500 cursor-not-allowed border-2 border-slate-700' : 'bg-emerald-600 hover:bg-emerald-500 active:scale-95 border-2 border-emerald-500'}`}>
                      PROCEED TO PAYMENT <ArrowRight size={28} />
                    </button>
                  </div>

                </div>
              </div>

              {/* 🌟 NEW HINT FOR BOTTOM OF CONSIGNEE FORM */}
              <DemoHint message="This box will only activate when above info is complete!" className="mt-4 text-lg" />
            </div>
          )}

          {step === 'PAYMENT_METHOD' && (
            <div className="flex-1 flex flex-col items-center justify-center h-full gap-8 py-12 animate-in fade-in zoom-in-95 duration-500">
              <h2 className="text-4xl font-black text-white uppercase tracking-widest mb-8 text-center">How would you like to pay?</h2>
              
              <div className="flex gap-12 w-full max-w-5xl">
                <button 
                  onClick={() => setStep('PAYMENT')} 
                  className="flex-1 group flex flex-col items-center justify-center p-16 bg-blue-600 rounded-[48px] shadow-2xl transition-all hover:bg-blue-500 active:scale-95 border-4 border-blue-500"
                >
                  <CreditCard size={100} className="text-white mb-8" strokeWidth={1.5} />
                  <span className="text-4xl font-black text-white uppercase text-center">Proceed</span>
                  <p className="text-blue-100 mt-4 text-xl opacity-80 font-bold">Secure Online Payment (QR)</p>
                </button>
                
                <button 
                  onClick={() => handleCodSelect?.()} 
                  className="flex-1 group flex flex-col items-center justify-center p-16 bg-slate-800 border-4 border-slate-700 rounded-[48px] shadow-2xl transition-all hover:border-emerald-500 active:scale-95"
                >
                  <Banknote size={100} className="text-emerald-500 mb-8 group-hover:text-emerald-400 transition-colors" strokeWidth={1.5} />
                  <span className="text-4xl font-black text-white uppercase text-center">Pay on Collection</span>
                  <p className="text-slate-400 mt-4 text-xl font-bold group-hover:text-slate-300">Cash on Delivery (COD)</p>
                </button>
              </div>

              {/* 🌟 NEW HINT FOR PAYMENT METHOD */}
              <DemoHint message="Choose a payment method" className="mt-2 text-lg" />
            </div>
          )}

          {step === 'PAYMENT' && (
            <div className="flex flex-col items-center justify-center h-full text-center py-12 animate-in fade-in duration-500 w-full max-w-2xl mx-auto">
              
              {paymentStatus === 'ERROR' ? (
                <div className="flex flex-col items-center justify-center p-12 bg-slate-800/80 rounded-[40px] border-4 border-slate-700 w-full shadow-2xl animate-in zoom-in-95 duration-300">
                  <AlertTriangle size={80} className="text-amber-500 mb-6" />
                  <h2 className="text-4xl font-black text-white uppercase tracking-widest mb-4">
                    Transaction Incomplete
                  </h2>
                  <p className="text-slate-400 text-xl font-bold text-center mb-10 px-8">
                    We couldn't complete your payment. Please ensure you have sufficient funds or try a different payment method.
                  </p>
                  
                  <div className="flex gap-6 w-full">
                    <button 
                      onClick={() => {
                        setPaymentStatus('IDLE'); 
                        setStep('PAYMENT_METHOD'); 
                      }}
                      className="flex-1 py-6 bg-blue-600 hover:bg-blue-500 rounded-2xl text-white font-black uppercase tracking-widest text-xl transition-all shadow-lg active:scale-95 border-2 border-blue-500"
                    >
                      Try Again
                    </button>

                    <button 
                      onClick={onDone} 
                      className="flex-1 py-6 bg-slate-800 hover:bg-slate-700 rounded-2xl text-slate-300 font-black uppercase tracking-widest text-xl transition-all shadow-lg active:scale-95 border-2 border-slate-600"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="w-72 h-72 bg-white rounded-2xl p-4 mb-8 flex items-center justify-center shadow-2xl border-4 border-slate-800 relative">
                    {isGeneratingQr ? (
                      <div className="flex flex-col items-center">
                        <Loader2 size={40} className="animate-spin text-slate-300 mb-2" />
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Generating Link...</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center animate-in zoom-in duration-500">
                         <img 
                           src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=https://www.smartlocker.africa`} 
                           alt="ContiPay QR" 
                           className="w-48 h-48 rounded-xl shadow-sm border border-slate-200 mb-4" 
                         />
                      </div>
                    )}
                  </div>
                  <h2 className="text-6xl font-black text-white mb-2 tracking-tighter">
                    {sysConfig?.settings?.currency_symbol || 'ZWG '}{getCalculatedPrice()}
                  </h2>
                  <p className="text-slate-500 mb-12 text-2xl font-bold">Scan to Pay with ContiPay</p>
                  
                  {ENABLE_SIMULATOR && (
                    <button 
                      onClick={(e) => { 
                        e.currentTarget.disabled = true; 
                        simulatePaymentSuccess(); 
                      }} 
                      className="flex items-center justify-center gap-4 w-full max-w-md px-12 py-8 bg-slate-800 border-4 border-slate-700 text-white text-2xl font-black rounded-[32px] hover:border-blue-500 transition-all active:scale-95 shadow-2xl uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <CreditCard size={40} className="text-blue-500" /> SIMULATE SUCCESS
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {step === 'ALLOCATING' && (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <Loader2 size={120} className="text-blue-500 animate-spin mb-12" />
              <h2 className="text-6xl font-black text-white uppercase tracking-tighter">Allocating Locker...</h2>
            </div>
          )}

        {step === 'WAITING_CLOSE' && (
            <div className="flex flex-col items-center justify-center h-full text-center py-12 max-w-4xl mx-auto">
              {(() => {
                if (!activeLocker) {
                  return (
                    <div className="flex flex-col items-center gap-6">
                      <Loader2 size={80} className="text-blue-500 animate-spin" />
                      <h2 className="text-2xl font-bold text-white uppercase tracking-widest">Finalizing Session...</h2>
                    </div>
                  );
                }
                return (
                  <div className="animate-in slide-in-from-bottom-8 duration-700 flex flex-col items-center w-full relative">
                    
                    {/* 🌟 NEW HINT FOR WAITING CLOSE */}
                    <DemoHint message="Close the door by clicking on open door ->" className="mb-8 text-lg" />

                    <div className="w-full flex items-center justify-center gap-4 mb-12 bg-emerald-600/10 border-2 border-emerald-600/30 py-6 px-12 rounded-[32px] animate-pulse">
                      <DoorOpen className="text-emerald-500" size={40} />
                      <h2 className="text-4xl font-black text-emerald-500 uppercase tracking-tighter">Door {activeLocker.channel} is Open!</h2>
                    </div>
                    
                    <div className="w-full p-8 bg-sky-500/10 border-2 border-sky-500/30 rounded-[32px] flex flex-col items-center shadow-xl text-center">
                      <div className="flex items-center gap-3 mb-6">
                        <PenLine className="text-sky-400" size={32} />
                        <h3 className="text-3xl font-black text-white uppercase tracking-widest">Prepare Your Parcel</h3>
                      </div>
                      <p className="text-sky-100 text-2xl font-medium leading-relaxed max-w-2xl mb-8">
                        Please ensure your <strong className="text-white">Name and Destination Address</strong> are clearly written on your parcel before placing it inside the locker.
                      </p>
                      <strong className="text-emerald-400 flex flex-col items-center gap-4 text-2xl uppercase tracking-widest bg-slate-900 px-8 py-6 rounded-2xl border-2 border-emerald-500/50 shadow-inner">
                         <div className="flex items-center gap-4 mb-2"><CheckCircle2 size={30} /> Click the virtual 3D door on the right to close it.</div>
                         <div className="text-sm text-slate-500">(This will complete the drop-off)</div>
                      </strong>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DropOffNexus;