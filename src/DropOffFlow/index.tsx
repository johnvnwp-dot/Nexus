import React, { useState, useEffect, useRef } from 'react';
import DropOffNexus from './DropOffNexus';

export type LockerSize = 'SMALL' | 'MEDIUM' | 'LARGE';

interface DropOffFlowProps {
  onDone: () => void;
}

const DropOffFlow: React.FC<DropOffFlowProps> = ({ onDone }) => {
  // 1. Navigation State
  const [step, setStep] = useState<string>('SIZE');
  const [serviceType, setServiceType] = useState<'LOCAL' | 'INTERNATIONAL' | null>(null);
  const [localServiceType, setLocalServiceType] = useState<'DOOR' | 'LOCKER' | null>(null);
  const [destinationCity, setDestinationCity] = useState<string | null>(null);
  const [selectedZone, setSelectedZone] = useState<number | null>(null);
  const [size, setSize] = useState<LockerSize | null>(null);
  
  // 2. Hardware & Scanner States
  const [sizeAvailability, setSizeAvailability] = useState<Record<string, number | boolean>>({ SMALL: true, MEDIUM: true, LARGE: true });
  const [isLoadingSizes, setIsLoadingSizes] = useState(false);
  const [dynamicDestinations, setDynamicDestinations] = useState<string[]>(['Harare', 'Bulawayo', 'Mutare']);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(true);
  
  // 3. Global Pricing & Config State
  const [sysConfig, setSysConfig] = useState<any>({ pricing: { local_l2l_small: "15.00", local_l2l_medium: "25.00", local_l2l_large: "35.00" }});
  const [isConfigLoading, setIsConfigLoading] = useState(false);
  const [demoAlert, setDemoAlert] = useState<string | null>(null);

  // 4. Payment QR State
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [isGeneratingQr, setIsGeneratingQr] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'IDLE' | 'ERROR'>('IDLE');

  // 5. Form States
  const [senderName, setSenderName] = useState('');
  const [senderPhone, setSenderPhone] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const [senderOtp, setSenderOtp] = useState('');
  const [expectedOtp, setExpectedOtp] = useState('1234');
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isPhoneVerified, setIsPhoneVerified] = useState(false);

  const [consigneeName, setConsigneeName] = useState('');
  const [consigneePhone, setConsigneePhone] = useState('');
  const [consigneeEmail, setConsigneeEmail] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [suburb, setSuburb] = useState('');
  const [town, setTown] = useState('');
  const [country, setCountry] = useState('');
  const [postalCode, setPostalCode] = useState('');

  // 6. Active Transaction States
  const [activeLocker, setActiveLocker] = useState<any>(null);
  const isAllocating = useRef(false);
  const [generatedPin, setGeneratedPin] = useState('');
  const [waybillNumber, setWaybillNumber] = useState('');

  // 🌟 DEMO HOOK: Generate QR Code & Auto-Approve Payment
  useEffect(() => {
    if (step === 'PAYMENT') {
      setIsGeneratingQr(true);
      setTimeout(() => {
        setQrCodeData('DEMO-QR-CODE');
        setIsGeneratingQr(false);
        
        // 🪄 MAGIC DEMO: Auto-succeed the payment after 4 seconds
        setTimeout(() => {
          startPayment();
        }, 4000);

      }, 1500);
    }
  }, [step]);

// 🌟 DEMO HOOK: Virtual Sensor Polling (NOW WITH AUDIO)
  useEffect(() => {
    let pollInterval: any;
    let nagTimer: any;

    if (step === 'WAITING_CLOSE' && activeLocker) {
      // 🎵 1. Play POP sound instantly when the virtual door opens
      try { new Audio('/pop.mp3').play().catch(e => console.warn("Audio blocked:", e)); } catch(e) {}

      // 🎵 2. Audio Nag: If the door is open for 10 seconds, remind them!
      nagTimer = setTimeout(() => {
          try { new Audio('/close-door.mp3').play().catch(e => console.warn("Audio blocked:", e)); } catch(e) {}
      }, 3000);

      pollInterval = setInterval(() => {
        // Check the global simulator object to see if the user clicked the 3D door shut!
        const channel = activeLocker.channel;
        const isClosed = (window as any).VIRTUAL_DOORS?.[channel] === 'closed';

        if (isClosed) {
          console.log(`✅ [VIRTUAL SENSOR] Door ${channel} confirmed CLOSED!`);
          
          // 🎵 3. Play THANK YOU sound the moment it closes
          try { new Audio('/thank-you.mp3').play().catch(e => console.warn("Audio blocked:", e)); } catch(e) {}

          clearInterval(pollInterval);
          clearTimeout(nagTimer); // Stop the nag timer so it doesn't play after they leave!
          
          setTimeout(() => onDone(), 1500);
        }
      }, 1000);
    }
    
    return () => {
      if (pollInterval) clearInterval(pollInterval);
      if (nagTimer) clearTimeout(nagTimer);
    };
  }, [step, activeLocker, onDone]);

    // 🌟 DEMO HOOK: Auto-Verify OTP
  useEffect(() => {
    if (isOtpSent && senderOtp.length === 4 && !isPhoneVerified) {
        if (senderOtp === expectedOtp) {
            setIsPhoneVerified(true);
            setFocusedField(null);
            setStep('CONSIGNEE_DETAILS');
        } else {
            setDemoAlert("Invalid verification code. Please try again."); // 🌟 NO MORE NATIVE ALERT
            setSenderOtp(''); 
        }
    }
  }, [senderOtp, isOtpSent, expectedOtp, isPhoneVerified]);

  const isSenderFormValid = () => senderName.length >= 3 && senderPhone.length >= 9;
  const isConsigneeFormValid = () => consigneeName.length >= 3 && consigneePhone.length >= 9;
  
  const getCalculatedPrice = () => sysConfig.pricing[`local_l2l_${size?.toLowerCase()}`] || "0.00";
  const getKeyboardMode = () => focusedField ? 'text' : 'none';
  const getCurrentValue = () => ''; // Simplified for demo
  
  const handleKeyboardInput = (char: string) => {}; // Simplified for demo
  const handleKeyboardBackspace = () => {}; // Simplified for demo

  const handleSizeSelect = (s: LockerSize) => { setSize(s); setStep('SERVICE_TYPE'); };
  const handleServiceSelect = (type: 'LOCAL' | 'INTERNATIONAL') => { setServiceType(type); setStep(type === 'INTERNATIONAL' ? 'ZONE_SELECT' : 'LOCAL_SERVICE_TYPE'); };
  const handleLocalServiceType = (type: 'DOOR' | 'LOCKER') => { setLocalServiceType(type); setStep(type === 'LOCKER' ? 'DESTINATION_CITY' : 'SENDER_DETAILS'); };
  const handleCitySelect = (city: string) => { setDestinationCity(city); setTown(city); setStep('SENDER_DETAILS'); };
  const handleZoneSelect = (zoneId: number) => { setSelectedZone(zoneId); setStep('SENDER_DETAILS'); };

    const handleSendOtp = () => {
        setIsVerifying(true);
        setTimeout(() => {
            setIsOtpSent(true);
            setFocusedField('senderOtp');
            setIsVerifying(false);
            setDemoAlert("DEMO MODE: The Verification Code is 1234"); // 🌟 NO MORE NATIVE ALERT
        }, 1000);
    };

  const resetOtpFlow = () => { setIsOtpSent(false); setSenderOtp(""); setFocusedField("senderPhone"); };

  // 🔥 VIRTUAL HARDWARE TRIGGER
  const startPayment = () => {
    if (isAllocating.current) return;
    isAllocating.current = true;
    setStep('ALLOCATING');
    
    setTimeout(() => {
        // Map selected size to a virtual door
        const channel = size === 'SMALL' ? 1 : size === 'MEDIUM' ? 3 : 7;
        setActiveLocker({ board: 1, channel: channel });
        setGeneratedPin('1234');
        setWaybillNumber('SIM-' + Date.now().toString().slice(-6));
        
        // ✨ POP THE VIRTUAL DOOR OPEN!
        window.dispatchEvent(new CustomEvent('TOGGLE_VIRTUAL_DOOR', { detail: { doorId: channel, state: 'open' } }));

        setTimeout(() => {
          setStep('WAITING_CLOSE');
          isAllocating.current = false; 
        }, 800); 
    }, 1500);
  };

  const handleCodSelect = startPayment;

  const goBack = () => {
    setFocusedField(null);
    if (step === 'SIZE') onDone(); 
    else if (step === 'SERVICE_TYPE') setStep('SIZE');
    else if (step === 'LOCAL_SERVICE_TYPE') setStep('SERVICE_TYPE');
    else if (step === 'DESTINATION_CITY') setStep('LOCAL_SERVICE_TYPE');
    else if (step === 'SENDER_DETAILS') setStep('DESTINATION_CITY');
    else if (step === 'CONSIGNEE_DETAILS') setStep('SENDER_DETAILS');
    else if (step === 'PAYMENT_METHOD') setStep('CONSIGNEE_DETAILS');
    else if (step === 'PAYMENT') setStep('PAYMENT_METHOD');
    else onDone();
  };

const allProps = {
    step, setStep, size, setSize, serviceType, setServiceType,
    localServiceType, setLocalServiceType, selectedZone, setSelectedZone,
    senderPhone, setSenderPhone, senderName, setSenderName, senderEmail, setSenderEmail,
    senderOtp, setSenderOtp,  sysConfig, sizeAvailability, resetOtpFlow,
    isConfigLoading, isLoadingSizes, isPhoneVerified, isOtpSent,
    expectedOtp, qrCodeData, isGeneratingQr, onDone, paymentStatus, setPaymentStatus,
    addressLine1, suburb, town, postalCode, country, destinationCity,
    consigneeName, setConsigneeName, consigneePhone, setConsigneePhone,
    consigneeEmail, setConsigneeEmail, isSenderFormValid, isConsigneeFormValid,
    handleLocalServiceType, getCalculatedPrice, startPayment, activeLocker,
    waybillNumber, generatedPin, getKeyboardMode, getCurrentValue,
    handleKeyboardInput, handleKeyboardBackspace, currentOrderId: 'DEMO-ORDER',
    goBack, isKeyboardVisible, focusedField, handleServiceSelect,
    handleZoneSelect, handleCitySelect, setFocusedField, handleSendOtp, isVerifying,
    handleSizeSelect, layout: 'LANDSCAPE_10', dynamicDestinations,
    setTown, setSuburb, setPostalCode, setCountry, setAddressLine1,
    handleCodSelect, demoAlert, setDemoAlert
  };

  return <DropOffNexus {...allProps as any} />;
};

export default DropOffFlow;