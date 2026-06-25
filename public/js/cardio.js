// Bluetooth Heart Rate logic using Web Bluetooth API

export const CardioState = {
  isConnected: false,
  currentBpm: 0,
  device: null,
  server: null,
  characteristic: null,
  sessionData: [], // Store BPMs during a session for average/max calculation
  isRecording: false
};

const displayContainer = document.getElementById('cardio-live-display');
const connectBtn = document.getElementById('btn-connect-cardio');
const bpmValueEl = document.getElementById('bpm-value');
const bpmZoneEl = document.getElementById('bpm-zone');

function updateZone(bpm) {
  const age = parseInt(localStorage.getItem('hyrox_user_age') || '30', 10);
  const maxBpm = 220 - age;
  
  const percentage = bpm / maxBpm;
  
  let zoneName = "RIPOSO";
  let colorClass = "text-gray-400";
  
  if (percentage >= 0.9) {
    zoneName = "VO2 MAX";
    colorClass = "text-red-500";
  } else if (percentage >= 0.8) {
    zoneName = "SOGLIA ANAEROBICA";
    colorClass = "text-orange-500";
  } else if (percentage >= 0.7) {
    zoneName = "AEROBICA";
    colorClass = "text-hyrox-yellow";
  } else if (percentage >= 0.6) {
    zoneName = "FAT BURN";
    colorClass = "text-green-400";
  } else if (percentage >= 0.5) {
    zoneName = "RISCALDAMENTO";
    colorClass = "text-blue-400";
  }

  bpmZoneEl.textContent = zoneName;
  bpmZoneEl.className = `ml-2 text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-gray-800 ${colorClass}`;
}

function handleHeartRateMeasurement(event) {
  const value = event.target.value;
  // Heart Rate Measurement Characteristic format:
  // First byte: Flags. Bit 0 indicates if HR format is 8-bit (0) or 16-bit (1).
  const flags = value.getUint8(0);
  const is16Bit = flags & 0x01;
  
  let bpm;
  if (is16Bit) {
    bpm = value.getUint16(1, true); // Little endian
  } else {
    bpm = value.getUint8(1);
  }

  CardioState.currentBpm = bpm;
  bpmValueEl.textContent = bpm;
  updateZone(bpm);

  if (CardioState.isRecording) {
    CardioState.sessionData.push(bpm);
  }
}

function onDisconnected() {
  CardioState.isConnected = false;
  CardioState.device = null;
  connectBtn.classList.remove('hidden');
  displayContainer.classList.add('hidden');
  console.log('Bluetooth Device disconnected');
}

export async function connectCardio() {
  try {
    if (!navigator.bluetooth) {
      alert("Il tuo browser non supporta il Web Bluetooth (Usa Chrome/Edge su Android/Desktop). Apple disabilita questa API su iOS Safari.");
      return;
    }

    const device = await navigator.bluetooth.requestDevice({
      filters: [{ services: ['heart_rate'] }]
    });

    CardioState.device = device;
    device.addEventListener('gattserverdisconnected', onDisconnected);

    const server = await device.gatt.connect();
    CardioState.server = server;

    const service = await server.getPrimaryService('heart_rate');
    const characteristic = await service.getCharacteristic('heart_rate_measurement');
    
    CardioState.characteristic = characteristic;
    await characteristic.startNotifications();
    characteristic.addEventListener('characteristicvaluechanged', handleHeartRateMeasurement);

    CardioState.isConnected = true;
    connectBtn.classList.add('hidden');
    displayContainer.classList.remove('hidden');
    
  } catch (error) {
    console.error("Bluetooth Connection Error:", error);
    if(error.name !== 'NotFoundError') {
      alert("Errore di connessione Bluetooth: " + error.message);
    }
  }
}

export function startRecording() {
  CardioState.isRecording = true;
  CardioState.sessionData = [];
}

export function stopRecordingAndGetStats() {
  CardioState.isRecording = false;
  
  if (CardioState.sessionData.length === 0) {
    return { avgBpm: 0, maxBpm: 0 };
  }

  const max = Math.max(...CardioState.sessionData);
  const avg = Math.round(CardioState.sessionData.reduce((a, b) => a + b, 0) / CardioState.sessionData.length);
  
  return { avgBpm: avg, maxBpm: max };
}

document.addEventListener('DOMContentLoaded', () => {
  if (connectBtn) {
    connectBtn.addEventListener('click', connectCardio);
  }
});

// Expose to window for timer integration
window.CardioAPI = {
  startRecording,
  stopRecordingAndGetStats,
  getState: () => CardioState
};
