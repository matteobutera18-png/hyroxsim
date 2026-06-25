import { navigateToTab } from './app.js';

// Specifiche pesi ufficiali HYROX per categoria
export const CATEGORY_WEIGHTS = {
  'single-men': {
    name: 'Single Men',
    sledPush: '175 kg (incl. sled)',
    sledPull: '125 kg (incl. sled)',
    farmers: '2x 24 kg',
    lunges: '20 kg',
    wallBalls: '9 kg (75 reps)'
  },
  'single-women': {
    name: 'Single Women',
    sledPush: '125 kg (incl. sled)',
    sledPull: '75 kg (incl. sled)',
    farmers: '2x 16 kg',
    lunges: '10 kg',
    wallBalls: '4 kg (75 reps)'
  },
  'pro-men': {
    name: 'Pro Men',
    sledPush: '225 kg (incl. sled)',
    sledPull: '175 kg (incl. sled)',
    farmers: '2x 32 kg',
    lunges: '30 kg',
    wallBalls: '9 kg (100 reps)'
  },
  'pro-women': {
    name: 'Pro Women',
    sledPush: '175 kg (incl. sled)',
    sledPull: '125 kg (incl. sled)',
    farmers: '2x 24 kg',
    lunges: '20 kg',
    wallBalls: '6 kg (100 reps)'
  },
  'doubles': {
    name: 'Doubles (M/Mix/W)',
    sledPush: '175 kg / 125 kg',
    sledPull: '125 kg / 75 kg',
    farmers: '2x 24 kg / 16 kg',
    lunges: '20 kg / 10 kg',
    wallBalls: '9 kg / 4 kg (75 reps)'
  }
};

// Stazioni ufficiali nell'ordine corretto
export const STATIONS = [
  { id: 'skierg', name: 'SkiErg', specs: '1000m', type: 'station' },
  { id: 'sled-push', name: 'Sled Push', specs: '50m', type: 'station' },
  { id: 'sled-pull', name: 'Sled Pull', specs: '50m', type: 'station' },
  { id: 'burpee-jumps', name: 'Burpee Broad Jump', specs: '80m', type: 'station' },
  { id: 'rowing', name: 'Rowing', specs: '1000m', type: 'station' },
  { id: 'farmers-carry', name: 'Farmers Carry', specs: '200m', type: 'station' },
  { id: 'sandbag-lunges', name: 'Sandbag Lunges', specs: '100m', type: 'station' },
  { id: 'wall-balls', name: 'Wall Balls', specs: '75/100 Reps', type: 'station' }
];

// Stato globale del Timer
let timerState = {
  isRunning: false,
  startTime: null,
  accumulatedTime: 0,
  currentSplitStartTime: null,
  currentSplitAccumulated: 0,
  
  // Frazioni caricate nell'allenamento corrente
  steps: [],
  currentStepIndex: -1,
  splits: [], // array di { name, duration, timestamp }
  
  category: 'single-men',
  workoutName: 'Gara Completa',
  
  // Timer interval references
  animationFrameId: null
};

// Elementi DOM del simulatore
let selectedCategory = 'single-men';
let isFullSimulation = true;
let includeCustomRun = true;

let currentUserId = null;
let timerBlocked = false;

export function initTimer(userId, userStatus) {
  currentUserId = userId || null;
  timerBlocked = (userStatus === 'expired');

  setupCategoryButtons();
  setupSimulationTypeButtons();
  setupCustomCheckboxes();
  
  // Pulsante per avviare la simulazione
  document.getElementById('btn-start-simulation').addEventListener('click', startSimulationFromConfig);
  
  // Pulsante Split Gigante
  document.getElementById('btn-giant-split').addEventListener('click', handleGiantSplitClick);
  
  // Pulsanti di controllo
  document.getElementById('btn-timer-pause').addEventListener('click', togglePauseResume);
  document.getElementById('btn-timer-reset').addEventListener('click', resetTimerConfirm);
  
  // Pre-carica categoria di default
  selectCategory('single-men');
}

export function blockTimer() {
  timerBlocked = true;
  // Disable the giant split button
  const btn = document.getElementById('btn-giant-split');
  if (btn) {
    btn.disabled = true;
    btn.classList.add('opacity-50', 'pointer-events-none');
    const action = document.getElementById('giant-btn-action');
    const sub = document.getElementById('giant-btn-sub');
    if (action) action.textContent = 'ABBONATI PER USARE IL TIMER';
    if (sub) sub.textContent = 'La prova gratuita è terminata';
  }
  const startBtn = document.getElementById('btn-start-simulation');
  if (startBtn) {
    startBtn.disabled = true;
    startBtn.classList.add('opacity-50');
    startBtn.textContent = '⚡ Abbonati per usare il simulatore';
  }
}

// ----------------------------------------------------
// SEZIONE CONFIGURAZIONE SIMULATORE
// ----------------------------------------------------

function setupCategoryButtons() {
  const buttons = document.querySelectorAll('#category-selector button');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const cat = btn.getAttribute('data-cat');
      selectCategory(cat);
    });
  });
}

function selectCategory(cat) {
  selectedCategory = cat;
  
  // Aggiorna classi bottoni
  const buttons = document.querySelectorAll('#category-selector button');
  buttons.forEach(btn => {
    if (btn.getAttribute('data-cat') === cat) {
      btn.classList.add('bg-hyrox-yellow', 'text-black', 'border-hyrox-yellow', 'glow-yellow');
      btn.classList.remove('bg-hyrox-gray', 'text-white', 'border-hyrox-gray');
    } else {
      btn.classList.remove('bg-hyrox-yellow', 'text-black', 'border-hyrox-yellow', 'glow-yellow');
      btn.classList.add('bg-hyrox-gray', 'text-white', 'border-hyrox-gray');
    }
  });

  // Aggiorna scheda pesi
  const weights = CATEGORY_WEIGHTS[cat];
  const card = document.getElementById('weights-info-card');
  if (weights && card) {
    card.classList.remove('hidden');
    document.getElementById('w-sled-push').textContent = weights.sledPush;
    document.getElementById('w-sled-pull').textContent = weights.sledPull;
    document.getElementById('w-farmers').textContent = weights.farmers;
    document.getElementById('w-lunges').textContent = weights.lunges;
    
    // Per wall balls, mostriamo le specifiche in base alla categoria
    let wbText = weights.wallBalls;
    if (cat === 'doubles') {
      wbText = '9 kg (Uomini) / 4 kg (Donne) - 75 Reps';
    }
    document.getElementById('w-wall-balls').textContent = wbText;
  }
}

function setupSimulationTypeButtons() {
  const btnFull = document.getElementById('btn-sim-full');
  const btnCustom = document.getElementById('btn-sim-custom');
  const customOptions = document.getElementById('custom-sim-options');

  btnFull.addEventListener('click', () => {
    isFullSimulation = true;
    btnFull.classList.add('bg-hyrox-yellow', 'text-black', 'border-hyrox-yellow', 'glow-yellow');
    btnFull.classList.remove('bg-hyrox-gray', 'text-white', 'border-hyrox-gray');
    
    btnCustom.classList.remove('bg-hyrox-yellow', 'text-black', 'border-hyrox-yellow', 'glow-yellow');
    btnCustom.classList.add('bg-hyrox-gray', 'text-white', 'border-hyrox-gray');
    
    customOptions.classList.add('hidden');
  });

  btnCustom.addEventListener('click', () => {
    isFullSimulation = false;
    btnCustom.classList.add('bg-hyrox-yellow', 'text-black', 'border-hyrox-yellow', 'glow-yellow');
    btnCustom.classList.remove('bg-hyrox-gray', 'text-white', 'border-hyrox-gray');
    
    btnFull.classList.remove('bg-hyrox-yellow', 'text-black', 'border-hyrox-yellow', 'glow-yellow');
    btnFull.classList.add('bg-hyrox-gray', 'text-white', 'border-hyrox-gray');
    
    customOptions.classList.remove('hidden');
  });

  // Gestione corsa in MetCon
  const btnRunYes = document.getElementById('btn-run-yes');
  const btnRunNo = document.getElementById('btn-run-no');

  btnRunYes.addEventListener('click', () => {
    includeCustomRun = true;
    btnRunYes.classList.add('bg-hyrox-yellow', 'text-black', 'border-hyrox-yellow');
    btnRunYes.classList.remove('bg-hyrox-gray', 'text-white', 'border-hyrox-gray');
    
    btnRunNo.classList.remove('bg-hyrox-yellow', 'text-black', 'border-hyrox-yellow');
    btnRunNo.classList.add('bg-hyrox-gray', 'text-white', 'border-hyrox-gray');
  });

  btnRunNo.addEventListener('click', () => {
    includeCustomRun = false;
    btnRunNo.classList.add('bg-hyrox-yellow', 'text-black', 'border-hyrox-yellow');
    btnRunNo.classList.remove('bg-hyrox-gray', 'text-white', 'border-hyrox-gray');
    
    btnRunYes.classList.remove('bg-hyrox-yellow', 'text-black', 'border-hyrox-yellow');
    btnRunYes.classList.add('bg-hyrox-gray', 'text-white', 'border-hyrox-gray');
  });
}

function setupCustomCheckboxes() {
  const container = document.getElementById('stations-checkboxes');
  container.innerHTML = '';
  
  STATIONS.forEach(station => {
    const label = document.createElement('label');
    label.className = 'flex items-center gap-3 p-2 bg-hyrox-gray/40 rounded-lg border border-hyrox-gray/60 cursor-pointer select-none';
    
    label.innerHTML = `
      <input type="checkbox" data-station="${station.id}" checked class="accent-hyrox-yellow w-4 h-4 rounded">
      <span>${station.name} (${station.specs})</span>
    `;
    container.appendChild(label);
  });
}

// ----------------------------------------------------
// LOGICA CARICAMENTO WORKOUT & CAMBIO SCHERMO
// ----------------------------------------------------

function startSimulationFromConfig() {
  let steps = [];
  let name = '';
  
  if (isFullSimulation) {
    name = 'Gara Completa';
    
    // Costruisci il percorso gara ufficiale alternando 1km Corsa, Stazione
    for (let i = 0; i < STATIONS.length; i++) {
      const station = STATIONS[i];
      const stationNum = i + 1;
      
      // 1. Corsa 1km
      steps.push({
        name: `1km Run (${stationNum}/8)`,
        specs: 'Corsa sul tracciato',
        type: 'run'
      });
      
      // 2. Stazione Workout (Roxzone Rimossa)
      const weights = CATEGORY_WEIGHTS[selectedCategory];
      let specText = station.specs;
      if (station.id === 'sled-push') specText += ` @ ${weights.sledPush}`;
      if (station.id === 'sled-pull') specText += ` @ ${weights.sledPull}`;
      if (station.id === 'farmers-carry') specText += ` @ ${weights.farmers}`;
      if (station.id === 'sandbag-lunges') specText += ` @ ${weights.lunges}`;
      if (station.id === 'wall-balls') specText += ` @ ${weights.wallBalls}`;
      
      steps.push({
        name: station.name,
        specs: specText,
        type: 'station'
      });
    }
  } else {
    // Simulazione ridotta
    name = 'MetCon Ridotta';
    const checkedBoxes = document.querySelectorAll('#stations-checkboxes input[type="checkbox"]:checked');
    const selectedStationIds = Array.from(checkedBoxes).map(cb => cb.getAttribute('data-station'));
    
    if (selectedStationIds.length === 0) {
      alert('Seleziona almeno una stazione per la MetCon ridotta!');
      return;
    }
    
    let counter = 1;
    selectedStationIds.forEach(id => {
      const station = STATIONS.find(s => s.id === id);
      if (!station) return;
      
      if (includeCustomRun) {
        steps.push({
          name: `1km Run (${counter}/${selectedStationIds.length})`,
          specs: 'Corsa sul tracciato',
          type: 'run'
        });
      }
      
      const weights = CATEGORY_WEIGHTS[selectedCategory];
      let specText = station.specs;
      if (station.id === 'sled-push') specText += ` @ ${weights.sledPush}`;
      if (station.id === 'sled-pull') specText += ` @ ${weights.sledPull}`;
      if (station.id === 'farmers-carry') specText += ` @ ${weights.farmers}`;
      if (station.id === 'sandbag-lunges') specText += ` @ ${weights.lunges}`;
      if (station.id === 'wall-balls') specText += ` @ ${weights.wallBalls}`;
      
      steps.push({
        name: station.name,
        specs: specText,
        type: 'station'
      });
      
      counter++;
    });
  }
  
  loadWorkout(name, selectedCategory, steps);
}

export function loadWorkout(name, category, steps) {
  // Resetta lo stato del timer prima di caricare il nuovo allenamento
  resetTimerState();
  
  timerState.workoutName = name;
  timerState.category = category;
  timerState.steps = steps;
  timerState.currentStepIndex = -1; // Non ancora iniziato
  
  // Aggiorna l'interfaccia grafica del Timer
  document.getElementById('timer-workout-name').textContent = name;
  
  const catBadge = document.getElementById('timer-category-badge');
  catBadge.textContent = CATEGORY_WEIGHTS[category]?.name || category.replace('-', ' ').toUpperCase();
  catBadge.classList.remove('hidden');
  
  updateTimerUI();
  
  // Naviga alla scheda Timer
  navigateToTab('timer');
}

// ----------------------------------------------------
// MOTORE DEL TIMER & STOPWATCH
// ----------------------------------------------------

function runTimerLoop() {
  if (!timerState.isRunning) return;
  
  const now = performance.now();
  
  // Tempo totale trascorso
  const totalElapsed = timerState.accumulatedTime + (now - timerState.startTime);
  
  // Tempo del parziale corrente
  const splitElapsed = timerState.currentSplitAccumulated + (now - timerState.currentSplitStartTime);
  
  // Aggiorna display
  updateDisplays(totalElapsed, splitElapsed);
  
  // Continua il loop con requestAnimationFrame per la massima precisione ed efficienza
  timerState.animationFrameId = requestAnimationFrame(runTimerLoop);
}

function updateDisplays(totalMs, splitMs) {
  const totalFmt = formatTime(totalMs);
  const splitFmt = formatTime(splitMs);
  
  document.getElementById('timer-display').innerHTML = `${totalFmt.main}<span class="text-2xl text-hyrox-yellow font-bold">${totalFmt.centi}</span>`;
  document.getElementById('timer-split-display').textContent = `Parziale: ${splitFmt.main}${splitFmt.centi}`;
}

function formatTime(ms) {
  let totalSeconds = Math.floor(ms / 1000);
  let hours = Math.floor(totalSeconds / 3600);
  let minutes = Math.floor((totalSeconds % 3600) / 60);
  let seconds = totalSeconds % 60;
  let centiseconds = Math.floor((ms % 1000) / 10);
  
  let hStr = hours > 0 ? String(hours).padStart(2, '0') + ':' : '';
  let mStr = String(minutes).padStart(2, '0');
  let sStr = String(seconds).padStart(2, '0');
  let cStr = String(centiseconds).padStart(2, '0');
  
  return {
    main: `${hStr}${mStr}:${sStr}`,
    centi: `.${cStr}`
  };
}

// Formatta ms in stringa human readable semplice (es. "05:12")
export function formatDurationSimple(ms) {
  let totalSeconds = Math.floor(ms / 1000);
  let hours = Math.floor(totalSeconds / 3600);
  let minutes = Math.floor((totalSeconds % 3600) / 60);
  let seconds = totalSeconds % 60;
  
  let hStr = hours > 0 ? `${hours}h ` : '';
  let mStr = String(minutes).padStart(2, '0');
  let sStr = String(seconds).padStart(2, '0');
  
  return `${hStr}${mStr}:${sStr}`;
}

// ----------------------------------------------------
// STATE MACHINE DEL WORKOUT / EVENTI SPLIT
// ----------------------------------------------------

function handleGiantSplitClick() {
  playBeep();
  
  // STATO 0: Non ancora avviato
  if (timerState.currentStepIndex === -1) {
    if (timerState.steps.length === 0) {
      alert("Carica una simulazione prima di far partire il timer!");
      return;
    }
    
    // Avvia la prima stazione
    timerState.isRunning = true;
    timerState.currentStepIndex = 0;
    
    const now = performance.now();
    timerState.startTime = now;
    timerState.currentSplitStartTime = now;
    
    // Aggiorna HUD attivi
    document.getElementById('active-session-indicator').classList.remove('hidden');
    document.getElementById('nav-timer-dot').classList.remove('hidden');
    
    // Cambia stato bottone
    updateGiantButton();
    updateTimerUI();
    
    // Avvia il loop
    runTimerLoop();
    return;
  }
  
  // STATO 1: In esecuzione, facciamo split per passare al blocco successivo
  const now = performance.now();
  const splitDuration = timerState.currentSplitAccumulated + (now - timerState.currentSplitStartTime);
  
  // Registriamo lo split corrente
  const currentStep = timerState.steps[timerState.currentStepIndex];
  timerState.splits.push({
    name: currentStep.name,
    duration: splitDuration,
    type: currentStep.type
  });
  
  // Passiamo al blocco successivo
  timerState.currentStepIndex++;
  
  // Controlliamo se abbiamo completato tutte le frazioni
  if (timerState.currentStepIndex >= timerState.steps.length) {
    // Fine allenamento!
    timerState.isRunning = false;
    cancelAnimationFrame(timerState.animationFrameId);
    
    // Ferma gli indicatori
    document.getElementById('active-session-indicator').classList.add('hidden');
    document.getElementById('nav-timer-dot').classList.add('hidden');
    
    // Calcola il tempo totale finale
    const finalTotalTime = timerState.accumulatedTime + (now - timerState.startTime);
    timerState.accumulatedTime = finalTotalTime;
    
    // Reset del parziale
    timerState.currentSplitAccumulated = 0;
    
    // Aggiorna l'interfaccia per il completamento
    updateDisplays(finalTotalTime, 0);
    
    playBeep(1200, 0.4); // Suono di vittoria prolungato
    
    saveWorkoutSession();
    return;
  }
  
  // Se non è finito, resetta il timer del parziale per la nuova frazione
  timerState.currentSplitStartTime = now;
  timerState.currentSplitAccumulated = 0;
  
  updateTimerUI();
  updateGiantButton();
  renderSplitsList();
}

function updateGiantButton() {
  const actionText = document.getElementById('giant-btn-action');
  const subText = document.getElementById('giant-btn-sub');
  const btn = document.getElementById('btn-giant-split');
  
  if (timerState.currentStepIndex === -1) {
    actionText.textContent = "AVVIA GARA";
    subText.textContent = "Clicca per iniziare";
    btn.className = "w-full bg-hyrox-yellow text-black font-black text-2xl py-8 rounded-3xl transition duration-150 uppercase tracking-widest shadow-[0_8px_30px_rgb(193,248,10,0.3)] hover:brightness-110 active:scale-95 flex flex-col items-center justify-center gap-1 min-h-[140px]";
    return;
  }
  
  const currentStep = timerState.steps[timerState.currentStepIndex];
  const nextStep = timerState.steps[timerState.currentStepIndex + 1];
  
  let nextName = nextStep ? nextStep.name : "TRAGUARDO";
  
  subText.textContent = `Prossimo: ${nextName}`;
  
  if (currentStep.type === 'run') {
    actionText.textContent = "CORSA COMPLETATA";
    btn.className = "w-full bg-blue-500 text-white font-black text-2xl py-8 rounded-3xl transition duration-150 uppercase tracking-widest shadow-[0_8px_30px_rgba(59,130,246,0.4)] hover:brightness-110 active:scale-95 flex flex-col items-center justify-center gap-1 min-h-[140px]";
  } else if (currentStep.type === 'roxzone') {
    actionText.textContent = "ENTRA IN STAZIONE";
    btn.className = "w-full bg-amber-500 text-black font-black text-2xl py-8 rounded-3xl transition duration-150 uppercase tracking-widest shadow-[0_8px_30px_rgba(245,158,11,0.4)] hover:brightness-110 active:scale-95 flex flex-col items-center justify-center gap-1 min-h-[140px]";
  } else {
    actionText.textContent = "STAZIONE COMPLETATA";
    btn.className = "w-full bg-hyrox-yellow text-black font-black text-2xl py-8 rounded-3xl transition duration-150 uppercase tracking-widest shadow-[0_8px_30px_rgb(193,248,10,0.3)] hover:brightness-110 active:scale-95 flex flex-col items-center justify-center gap-1 min-h-[140px]";
  }
}

function updateTimerUI() {
  const currentStep = timerState.steps[timerState.currentStepIndex];
  
  const subLabel = document.getElementById('hud-sub-label');
  const currentState = document.getElementById('hud-current-state');
  const specs = document.getElementById('hud-workout-specs');
  
  if (!currentStep) {
    subLabel.textContent = "STATO ATTUALE";
    currentState.textContent = "Allenamento non avviato";
    specs.textContent = "Scegli una scheda e premi Avvia";
    
    // Disabilita controlli
    document.getElementById('btn-timer-pause').disabled = true;
    return;
  }
  
  document.getElementById('btn-timer-pause').disabled = false;
  
  if (currentStep.type === 'run') {
    subLabel.textContent = "FRAZIONE CORRENTE";
    currentState.className = "text-2xl font-black tracking-tight text-blue-400 uppercase";
    currentState.textContent = currentStep.name;
    specs.textContent = currentStep.specs;
  } else if (currentStep.type === 'roxzone') {
    subLabel.textContent = "FRAZIONE CORRENTE";
    currentState.className = "text-2xl font-black tracking-tight text-amber-500 uppercase";
    currentState.textContent = currentStep.name;
    specs.textContent = currentStep.specs;
  } else {
    subLabel.textContent = "STAZIONE ATTUALE";
    currentState.className = "text-2xl font-black tracking-tight text-hyrox-yellow uppercase";
    currentState.textContent = currentStep.name;
    specs.textContent = currentStep.specs;
  }
  
  document.getElementById('laps-counter').textContent = `${timerState.currentStepIndex + 1} / ${timerState.steps.length}`;
}

function renderSplitsList() {
  const list = document.getElementById('splits-list');
  if (timerState.splits.length === 0) {
    list.innerHTML = `<div class="p-4 text-center text-sm text-gray-500">I parziali compariranno qui.</div>`;
    return;
  }
  
  list.innerHTML = '';
  
  // Mostra i parziali in ordine inverso (l'ultimo in alto per massima visibilità)
  [...timerState.splits].reverse().forEach((split, index) => {
    const realIndex = timerState.splits.length - index;
    const item = document.createElement('div');
    item.className = 'px-4 py-3 flex justify-between items-center text-sm';
    
    let colorClass = 'text-white';
    if (split.type === 'run') colorClass = 'text-blue-400';
    if (split.type === 'roxzone') colorClass = 'text-amber-500';
    if (split.type === 'station') colorClass = 'text-hyrox-yellow';
    
    const formattedSplit = formatTime(split.duration);
    
    item.innerHTML = `
      <div class="flex items-center gap-2">
        <span class="text-xs text-gray-500 font-bold w-4">#${realIndex}</span>
        <span class="font-bold ${colorClass}">${split.name}</span>
      </div>
      <span class="font-mono text-gray-300">${formattedSplit.main}<span class="text-xs text-gray-500">${formattedSplit.centi}</span></span>
    `;
    list.appendChild(item);
  });
}

// ----------------------------------------------------
// CONTROLLI AUSILIARI (PAUSE, RESET, SAVE)
// ----------------------------------------------------

function togglePauseResume() {
  if (!timerState.isRunning) {
    // Riprendi
    timerState.isRunning = true;
    const now = performance.now();
    timerState.startTime = now;
    timerState.currentSplitStartTime = now;
    
    document.getElementById('btn-timer-pause').innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-5 h-5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
      </svg>
      Sospendi
    `;
    
    runTimerLoop();
  } else {
    // Metti in pausa
    timerState.isRunning = false;
    cancelAnimationFrame(timerState.animationFrameId);
    
    const now = performance.now();
    timerState.accumulatedTime += (now - timerState.startTime);
    timerState.currentSplitAccumulated += (now - timerState.currentSplitStartTime);
    
    document.getElementById('btn-timer-pause').innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-5 h-5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
      </svg>
      Riprendi
    `;
  }
}

function resetTimerState() {
  timerState.isRunning = false;
  if (timerState.animationFrameId) {
    cancelAnimationFrame(timerState.animationFrameId);
  }
  timerState.startTime = null;
  timerState.accumulatedTime = 0;
  timerState.currentSplitStartTime = null;
  timerState.currentSplitAccumulated = 0;
  timerState.steps = [];
  timerState.currentStepIndex = -1;
  timerState.splits = [];
  
  // Riavvia testi
  document.getElementById('timer-display').innerHTML = `00:00:00<span class="text-2xl text-hyrox-yellow font-bold">.00</span>`;
  document.getElementById('timer-split-display').textContent = `Parziale: 00:00:00.00`;
  document.getElementById('active-session-indicator').classList.add('hidden');
  document.getElementById('nav-timer-dot').classList.add('hidden');
  document.getElementById('laps-counter').textContent = '0 / 0';
  document.getElementById('btn-timer-pause').innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-5 h-5">
      <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
    </svg>
    Sospendi
  `;
  
  updateGiantButton();
  updateTimerUI();
  renderSplitsList();
}

function resetTimerConfirm() {
  if (timerState.currentStepIndex !== -1) {
    if (!confirm("Sei sicuro di voler annullare l'allenamento in corso? I progressi andranno persi.")) {
      return;
    }
  }
  resetTimerState();
}

// Salva la sessione completata via API
function saveWorkoutSession() {
  const session = {
    workoutName: timerState.workoutName,
    category: timerState.category,
    totalTime: timerState.accumulatedTime,
    splits: timerState.splits,
    date: new Date().toISOString()
  };
  
  fetch('/api/history', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': currentUserId || ''
    },
    body: JSON.stringify(session)
  })
  .then(res => {
    if (!res.ok) throw new Error("Errore durante il salvataggio");
    return res.json();
  })
  .then(saved => {
    alert("Allenamento completato e salvato con successo nel tuo diario!");
    resetTimerState();
    navigateToTab('history');
  })
  .catch(err => {
    console.error(err);
    alert(`Impossibile connettersi al server per salvare l'allenamento. Lo abbiamo memorizzato temporaneamente nel browser.`);
    
    // Fallback salvataggio locale (localStorage) per un'esperienza fluida offline
    saveToLocalStorageFallback(session);
    resetTimerState();
    navigateToTab('history');
  });
}

function saveToLocalStorageFallback(session) {
  let localHist = [];
  try {
    localHist = JSON.parse(localStorage.getItem('hyrox_history') || '[]');
  } catch(e) {}
  
  session.id = `local-session-${Date.now()}`;
  localHist.push(session);
  localStorage.setItem('hyrox_history', JSON.stringify(localHist));
}

// Funzione ausiliaria per beeps
function playBeep(frequency = 800, duration = 0.15) {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);

    oscillator.start();
    oscillator.stop(audioCtx.currentTime + duration);
  } catch (e) {
    console.warn('Audio Context non supportato o bloccato:', e);
  }
}
