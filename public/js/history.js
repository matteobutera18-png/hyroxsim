import { formatDurationSimple } from './timer.js';

function getUserId() {
  return localStorage.getItem('hyrox_user_id') || '';
}

export function initHistory() {
  fetchHistoryAndPRs();
}

export function fetchHistoryAndPRs() {
  const userId = getUserId();
  const headers = { 'x-user-id': userId };

  Promise.all([
    fetch('/api/history', { headers }).then(res => {
      if (res.status === 403) return []; // Trial expired, return empty
      if (!res.ok) throw new Error('History error');
      return res.json();
    }),
    fetch('/api/prs', { headers }).then(res => {
      if (res.status === 403) return {};
      if (!res.ok) throw new Error('PRs error');
      return res.json();
    })
  ])
  .then(([history, prs]) => {
    renderHistoryStats(history);
    renderPRs(prs);
    renderHistoryLogs(history);
  })
  .catch(err => {
    console.warn("Server non raggiungibile, uso dati offline.", err);
    const offlineHistory = getOfflineHistory();
    const offlinePRs = calculateOfflinePRs(offlineHistory);
    renderHistoryStats(offlineHistory);
    renderPRs(offlinePRs);
    renderHistoryLogs(offlineHistory);
  });
}


function renderHistoryStats(history) {
  const totalSessionsEl = document.getElementById('stats-total-sessions');
  const totalTimeEl = document.getElementById('stats-total-time');
  
  if (!totalSessionsEl || !totalTimeEl) return;
  
  totalSessionsEl.textContent = history.length;
  
  let totalMs = 0;
  history.forEach(session => {
    totalMs += (session.totalTime || 0);
  });
  
  const totalSeconds = Math.floor(totalMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  
  totalTimeEl.textContent = `${hours}h ${minutes}m`;
}

function renderPRs(prs) {
  const container = document.getElementById('pr-stats-list');
  if (!container) return;
  
  const prKeys = Object.keys(prs);
  
  if (prKeys.length === 0) {
    container.innerHTML = `
      <div class="col-span-2 text-center text-xs text-gray-500 py-6">
        Nessun record registrato. Completa un allenamento per calcolare i tuoi PR.
      </div>
    `;
    return;
  }
  
  container.innerHTML = '';
  
  prKeys.forEach(stationName => {
    const pr = prs[stationName];
    const item = document.createElement('div');
    item.className = 'bg-hyrox-gray/55 p-3 rounded-xl border border-hyrox-gray-light flex flex-col justify-between';
    
    // Format duration in human readable stopwatch style
    const timeFormatted = formatDurationSimple(pr.duration);
    
    item.innerHTML = `
      <span class="text-[10px] font-bold text-gray-400 uppercase truncate">${stationName}</span>
      <span class="text-lg font-black text-hyrox-yellow mt-0.5 font-mono">${timeFormatted}</span>
      <span class="text-[9px] text-gray-500 truncate mt-1">
        ${new Date(pr.date).toLocaleDateString('it-IT')} - ${pr.category.replace('-', ' ').toUpperCase()}
      </span>
    `;
    container.appendChild(item);
  });
}

function renderHistoryLogs(history) {
  const container = document.getElementById('history-logs-container');
  if (!container) return;
  
  if (history.length === 0) {
    container.innerHTML = `
      <div class="p-8 text-center text-sm text-gray-500 bg-hyrox-dark/30 rounded-2xl border border-hyrox-gray border-dashed">
        Nessun allenamento salvato nel diario.
      </div>
    `;
    return;
  }
  
  container.innerHTML = '';
  
  // Ordina le sessioni dall'ultima alla prima
  const sortedHistory = [...history].sort((a, b) => new Date(b.date) - new Date(a.date));
  
  sortedHistory.forEach((session, index) => {
    const card = document.createElement('div');
    card.className = 'bg-hyrox-dark rounded-2xl border border-hyrox-gray overflow-hidden';
    
    const formattedTotal = formatDurationSimple(session.totalTime);
    const dateFormatted = new Date(session.date).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    const categoryName = session.category.replace('-', ' ').toUpperCase();
    
    // Creiamo il corpo per gli split dettagliati
    let splitsRows = '';
    if (session.splits && Array.isArray(session.splits)) {
      session.splits.forEach((split, splitIdx) => {
        let colorClass = 'text-gray-300';
        if (split.type === 'run') colorClass = 'text-blue-400';
        if (split.type === 'roxzone') colorClass = 'text-amber-500';
        if (split.type === 'station') colorClass = 'text-hyrox-yellow';
        
        splitsRows += `
          <div class="flex justify-between items-center py-2 border-b border-hyrox-gray/20 text-xs last:border-b-0">
            <div class="flex items-center gap-2">
              <span class="text-[10px] text-gray-600 font-bold w-4">#${splitIdx + 1}</span>
              <span class="font-semibold ${colorClass}">${split.name}</span>
            </div>
            <span class="font-mono text-gray-400">${formatDurationSimple(split.duration)}</span>
          </div>
        `;
      });
    }
    
    const accordionId = `accordion-${session.id || index}`;
    
    card.innerHTML = `
      <!-- Accordion Header -->
      <button onclick="document.getElementById('${accordionId}').classList.toggle('hidden')" class="w-full text-left p-4 focus:outline-none flex justify-between items-center hover:bg-hyrox-gray/20 transition duration-100">
        <div class="space-y-1">
          <div class="flex items-center gap-2">
            <span class="text-[10px] bg-hyrox-gray-light text-gray-300 font-extrabold px-1.5 py-0.5 rounded uppercase">
              ${categoryName}
            </span>
            <span class="text-xs text-gray-500 font-semibold">${dateFormatted}</span>
          </div>
          <h4 class="text-sm font-black text-white uppercase tracking-tight">${session.workoutName}</h4>
        </div>
        <div class="flex items-center gap-3">
          <span class="text-lg font-black text-hyrox-yellow font-mono">${formattedTotal}</span>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-4 h-4 text-gray-400">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </div>
      </button>
      
      <!-- Accordion Content -->
      <div id="${accordionId}" class="hidden bg-hyrox-darker border-t border-hyrox-gray/40 p-4">
        <h5 class="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Split Dettagliati</h5>
        <div class="divide-y divide-hyrox-gray/20">
          ${splitsRows}
        </div>
      </div>
    `;
    
    container.appendChild(card);
  });
}

// ----------------------------------------------------
// OFFLINE FALLBACK LOGIC (localStorage)
// ----------------------------------------------------

function getOfflineHistory() {
  try {
    return JSON.parse(localStorage.getItem('hyrox_history') || '[]');
  } catch (e) {
    return [];
  }
}

function calculateOfflinePRs(history) {
  const prs = {};
  history.forEach(session => {
    if (!session.splits) return;
    session.splits.forEach(split => {
      const key = split.name;
      const duration = split.duration;
      if (duration && duration > 0) {
        if (!prs[key] || duration < prs[key].duration) {
          prs[key] = {
            duration: duration,
            date: session.date,
            workoutName: session.workoutName,
            category: session.category
          };
        }
      }
    });
  });
  return prs;
}

// Rendiamo l'accordion accessibile a livello globale visto che usiamo inline onclick
window.toggleAccordion = function(id) {
  const el = document.getElementById(id);
  if (el) el.classList.toggle('hidden');
};
