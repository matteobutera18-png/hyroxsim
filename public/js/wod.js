import { loadWorkout } from './timer.js';

let wodsDatabase = [];
let wodBlocked = false;

export function initWods(userId, userStatus) {
  wodBlocked = (userStatus === 'expired');

  const btnGenerate = document.getElementById('btn-generate-wod');
  btnGenerate.addEventListener('click', () => {
    if (wodBlocked) {
      window.showPaywall?.();
      return;
    }
    generateRandomWod();
  });
  
  // Carica i WOD dal server all'avvio
  fetch('/api/workouts')
    .then(res => res.json())
    .then(data => {
      wodsDatabase = data;
    })
    .catch(err => {
      console.error("Errore nel caricamento dei WOD:", err);
      wodsDatabase = getWodsFallback();
    });
}

export function blockWods() {
  wodBlocked = true;
  const btn = document.getElementById('btn-generate-wod');
  if (btn) {
    btn.innerHTML = '⚡ Abbonati per sbloccare i WOD';
    btn.classList.add('opacity-60');
  }
}


function generateRandomWod() {
  if (wodsDatabase.length === 0) {
    alert("Database dei WOD non pronto. Riprova tra un attimo.");
    return;
  }
  
  const randomIndex = Math.floor(Math.random() * wodsDatabase.length);
  const wod = wodsDatabase[randomIndex];
  
  renderWodCard(wod);
}

function renderWodCard(wod) {
  const container = document.getElementById('wod-card-container');
  
  // Format difficulty badge color
  let diffColor = 'bg-gray-700 text-gray-200';
  if (wod.difficulty === 'Principiante') diffColor = 'bg-green-950 text-green-400 border border-green-900/40';
  if (wod.difficulty === 'Intermedio') diffColor = 'bg-blue-950 text-blue-400 border border-blue-900/40';
  if (wod.difficulty === 'Avanzato') diffColor = 'bg-red-950 text-red-400 border border-red-900/40';
  
  // Format formatting rules in workout text
  const workoutHtml = wod.workout
    .split('\n')
    .map(line => {
      if (line.trim().startsWith('-')) {
        return `<li class="ml-4 list-disc text-gray-300 font-medium py-0.5">${line.replace('-', '').trim()}</li>`;
      }
      return `<p class="font-bold text-white text-sm mt-2">${line}</p>`;
    })
    .join('');
    
  container.innerHTML = `
    <div class="bg-hyrox-dark p-6 rounded-2xl border border-hyrox-gray space-y-4 shadow-lg animate-[fadeIn_0.3s_ease-out]">
      <!-- Header -->
      <div class="flex justify-between items-start">
        <span class="text-[10px] bg-hyrox-yellow text-black font-black px-2 py-0.5 rounded-md uppercase tracking-wider">
          ${wod.type}
        </span>
        <span class="text-[10px] px-2 py-0.5 rounded-md font-bold ${diffColor}">
          ${wod.difficulty}
        </span>
      </div>
      
      <!-- WOD Details -->
      <div class="space-y-1">
        <h3 class="text-xl font-black text-white tracking-tight uppercase">${wod.name}</h3>
        <p class="text-xs text-gray-400 font-semibold uppercase tracking-wider">Focus: ${wod.target}</p>
      </div>
      
      <!-- Description -->
      <p class="text-xs text-gray-400 italic bg-hyrox-gray/25 p-3 rounded-lg border border-hyrox-gray/40">
        "${wod.description}"
      </p>
      
      <!-- Workout structure -->
      <div class="space-y-1 bg-hyrox-darker/60 p-4 rounded-xl border border-hyrox-gray/40">
        <h4 class="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Esercizi</h4>
        <div class="space-y-0.5">
          ${workoutHtml}
        </div>
      </div>
      
      <!-- Load WOD to timer CTA -->
      <button id="btn-load-wod-timer" data-wod-id="${wod.id}" class="w-full bg-hyrox-yellow hover:bg-yellow-400 text-black text-xs font-black py-3 rounded-xl transition uppercase tracking-wider flex items-center justify-center gap-1.5 active:scale-95">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-4 h-4">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        Carica questo WOD nel Timer
      </button>
    </div>
  `;
  
  // Aggiungi event listener per caricare il WOD nel timer
  document.getElementById('btn-load-wod-timer').addEventListener('click', () => {
    loadWodIntoTimer(wod);
  });
}

function loadWodIntoTimer(wod) {
  const steps = parseWodToSteps(wod);
  loadWorkout(wod.name, 'single-men', steps);
}

// Converte la descrizione testuale del WOD in frazioni/split tracciabili nel timer
function parseWodToSteps(wod) {
  const steps = [];
  
  if (wod.id === 'wod-pbj') {
    // 4 Rounds: 400m Run, 15 Burpee, 400m Run, 20 Wall Balls
    for (let r = 1; r <= 4; r++) {
      steps.push({ name: `R${r}: 400m Run`, specs: 'Corri forte', type: 'run' });
      steps.push({ name: `R${r}: 15 Burpee Broad Jumps`, specs: 'Stazione 1', type: 'station' });
      steps.push({ name: `R${r}: 400m Run`, specs: 'Mantieni il passo', type: 'run' });
      steps.push({ name: `R${r}: 20 Wall Balls (9kg/4kg)`, specs: 'Stazione 2', type: 'station' });
    }
  } 
  else if (wod.id === 'wod-sled-engine') {
    // EMOM 20: Row, Sled Push, Sandbag, Rest
    for (let r = 1; r <= 5; r++) {
      steps.push({ name: `Giro ${r}: 15 Cal Row`, specs: 'Minuto 1', type: 'station' });
      steps.push({ name: `Giro ${r}: 4 Sled Push (10m)`, specs: 'Minuto 2', type: 'station' });
      steps.push({ name: `Giro ${r}: 15 Sandbag Lunges`, specs: 'Minuto 3', type: 'station' });
      steps.push({ name: `Giro ${r}: Recupero / Rest`, specs: 'Minuto 4', type: 'station' });
    }
  } 
  else if (wod.id === 'wod-hyrox-sim-short') {
    // 1000m Run -> SkiErg -> Row -> Farmers -> Wall Balls
    steps.push({ name: '1000m Run', specs: 'Inizio allenamento', type: 'run' });
    steps.push({ name: '1000m SkiErg', specs: 'Stazione 1', type: 'station' });
    steps.push({ name: '500m Row', specs: 'Stazione 2', type: 'station' });
    steps.push({ name: '100m Farmers Carry', specs: 'Stazione 3', type: 'station' });
    steps.push({ name: '50 Wall Balls', specs: 'Stazione 4', type: 'station' });
  } 
  else if (wod.id === 'wod-aerobic-power') {
    // EMOM 24: SkiErg, Burpee Jumps, Goblet Squat, Row
    for (let r = 1; r <= 6; r++) {
      steps.push({ name: `Giro ${r}: 15 Cal SkiErg`, specs: 'Minuto 1', type: 'station' });
      steps.push({ name: `Giro ${r}: 12 Burpee Broad Jumps`, specs: 'Minuto 2', type: 'station' });
      steps.push({ name: `Giro ${r}: 20 Goblet Squats`, specs: 'Minuto 3', type: 'station' });
      steps.push({ name: `Giro ${r}: 15 Cal Row / Run`, specs: 'Minuto 4', type: 'station' });
    }
  } 
  else if (wod.id === 'wod-roxzone-burner') {
    // For Time: Run 1000, WB 50, Run 800, Lunges 40, Run 600, Burpees 30, Run 400, Farmers 20
    steps.push({ name: '1000m Run', specs: 'Run 1', type: 'run' });
    steps.push({ name: '50 Wall Balls', specs: 'Stazione 1', type: 'station' });
    
    steps.push({ name: '800m Run', specs: 'Run 2', type: 'run' });
    steps.push({ name: '40 Sandbag Lunges', specs: 'Stazione 2', type: 'station' });
    
    steps.push({ name: '600m Run', specs: 'Run 3', type: 'run' });
    steps.push({ name: '30 Burpee Broad Jumps', specs: 'Stazione 3', type: 'station' });
    
    steps.push({ name: '400m Run', specs: 'Run 4', type: 'run' });
    steps.push({ name: '100m Farmers Carry', specs: 'Stazione 4', type: 'station' });
  } 
  else {
    // Parser di emergenza / WOD personalizzati
    steps.push({ name: 'Workout Inizio', specs: 'Parte 1', type: 'station' });
  }
  
  return steps;
}

// Fallback nel caso in cui il server sia offline (utilizzato come base per l'avvio client-side puro)
function getWodsFallback() {
  return [
    {
      "id": "wod-pbj",
      "name": "P'B & J (Power, Burpees & Jumps)",
      "type": "For Time",
      "description": "Un ottimo condizionamento che unisce corsa, burpees a salto in lungo e wall balls. Mantieni un ritmo costante sulle corse e spingi nelle stazioni.",
      "workout": "4 Rounds For Time:\n- 400m Run\n- 15 Burpee Broad Jumps\n- 400m Run\n- 20 Wall Balls",
      "difficulty": "Intermedio",
      "target": "Motore aerobico e forza resistente delle gambe"
    },
    {
      "id": "wod-sled-engine",
      "name": "Sled & Sandbag Engine",
      "type": "EMOM",
      "description": "Lavoro ad intervalli incentrato sulla spinta dello sled e sugli affondi con sandbag. Cerca di completare il lavoro di ogni minuto in circa 40-45 secondi per avere il giusto recupero.",
      "workout": "EMOM 20 Minuti (5 giri):\n- Minuto 1: 15 Calorie Row\n- Minuto 2: 4 Sled Push (10m ciascuno)\n- Minuto 3: 15 Sandbag Lunges (Affondi)\n- Minuto 4: Recupero Attivo",
      "difficulty": "Avanzato",
      "target": "Forza esplosiva e capacità di recupero sotto sforzo"
    }
  ];
}
