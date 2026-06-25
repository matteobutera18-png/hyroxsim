import { initTimer, blockTimer } from './timer.js';
import { initWods, blockWods } from './wod.js';
import { initHistory, fetchHistoryAndPRs } from './history.js';

// ============================================================
// GLOBAL USER STATE
// ============================================================
let currentUserId = null;
let currentUserStatus = null; // 'trial' | 'pro' | 'expired'
let selectedPaymentPlan = 'quarterly';

// Expose paywall functions globally for inline onclick handlers
window.showPaywall = showPaywall;
window.hidePaywall = hidePaywall;
window.selectPlan = selectPlan;
window.payWithStripe = payWithStripe;
window.payWithPayPal = payWithPayPal;

// ============================================================
// INITIALISATION
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  setupTabs();

  // Check for successful payment return from Stripe
  const params = new URLSearchParams(window.location.search);
  if (params.get('payment') === 'success') {
    window.history.replaceState({}, '', '/');
    await handlePaymentSuccess();
  }

  // Register/get user on every load
  await initUser();
});

// ============================================================
// USER MANAGEMENT
// ============================================================

async function initUser() {
  const token = localStorage.getItem('hyrox_token');
  currentUserId = localStorage.getItem('hyrox_user_id');

  if (!token) {
    // If no token, wait for auth.js to handle login modal
    return;
  }

  try {
    const res = await fetch('/api/user/status', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (res.ok) {
      const data = await res.json();
      currentUserStatus = data.status;
      applyUserStatus(data);
    } else {
      throw new Error('Token non valido');
    }
  } catch (err) {
    console.warn('Server non raggiungibile, utilizzo stato offline:', err.message);
    const cached = localStorage.getItem('hyrox_status');
    if (cached) {
      const data = JSON.parse(cached);
      currentUserStatus = data.status;
      applyUserStatus(data);
    } else {
      currentUserStatus = 'trial';
      applyUserStatus({ status: 'trial', daysLeft: 7 });
    }
  }

  // Initialise modules after status is known
  initTimer(currentUserId, currentUserStatus);
  initWods(currentUserId, currentUserStatus);
  initHistory();

  registerServiceWorker();
}

function applyUserStatus(data) {
  // Cache status for offline fallback
  localStorage.setItem('hyrox_status', JSON.stringify(data));

  const trialBadge = document.getElementById('trial-badge');
  const proBadge = document.getElementById('pro-badge');
  const daysLeftEl = document.getElementById('trial-days-left');
  const trialBanner = document.getElementById('trial-banner');

  // Hide all first
  trialBadge.classList.add('hidden');
  proBadge.classList.add('hidden');
  trialBanner.classList.add('hidden');

  if (data.status === 'pro') {
    proBadge.classList.remove('hidden');
  } else if (data.status === 'trial') {
    trialBadge.classList.remove('hidden');
    if (daysLeftEl) daysLeftEl.textContent = data.daysLeft || 7;
  } else if (data.status === 'expired') {
    trialBanner.classList.remove('hidden');
    // Block features
    blockTimer();
    blockWods();
    // Auto-show paywall after brief delay
    setTimeout(showPaywall, 1500);
  }
}

async function handlePaymentSuccess() {
  const token = localStorage.getItem('hyrox_token');
  if (!token) return;

  try {
    // Re-fetch updated status from backend
    const res = await fetch('/api/user/status', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      const data = await res.json();
      if (data.isPro) {
        currentUserStatus = 'pro';
        applyUserStatus({ status: 'pro' });
        showToast('🎉 Abbonamento attivato! Benvenuto in HYROX PRO!');
      }
    }
  } catch (err) {
    console.error('Errore verifica pagamento:', err);
  }
}

// ============================================================
// PAYWALL LOGIC
// ============================================================
function showPaywall() {
  document.getElementById('paywall-modal').classList.remove('hidden');
  // Default selection
  selectPlan('quarterly');
}

function hidePaywall() {
  document.getElementById('paywall-modal').classList.add('hidden');
}

function selectPlan(plan) {
  selectedPaymentPlan = plan;

  const quarterly = document.getElementById('plan-quarterly');
  const monthly = document.getElementById('plan-monthly');

  if (plan === 'quarterly') {
    quarterly.classList.add('border-hyrox-yellow', 'bg-hyrox-yellow/10');
    quarterly.classList.remove('border-hyrox-gray');
    monthly.classList.remove('border-hyrox-yellow', 'bg-hyrox-yellow/10');
    monthly.classList.add('border-hyrox-gray');
  } else {
    monthly.classList.add('border-hyrox-yellow', 'bg-hyrox-yellow/10');
    monthly.classList.remove('border-hyrox-gray');
    quarterly.classList.remove('border-hyrox-yellow', 'bg-hyrox-yellow/10');
    quarterly.classList.add('border-hyrox-gray');
  }
}

async function payWithStripe() {
  const btn = document.getElementById('btn-pay-stripe');
  btn.textContent = 'Apertura pagamento...';
  btn.disabled = true;
  
  const token = localStorage.getItem('hyrox_token');

  try {
    const res = await fetch('/api/payment/create-stripe-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ plan: selectedPaymentPlan })
    });

    const data = await res.json();

    if (data.configRequired) {
      showToast('⚙️ Stripe non ancora configurato. Aggiungi STRIPE_SECRET_KEY nelle variabili ambiente del server.', 'info');
      btn.textContent = 'Paga con Carta (Stripe)';
      btn.disabled = false;
      return;
    }

    if (data.url) {
      window.location.href = data.url;
    } else {
      throw new Error(data.error || 'Errore sconosciuto');
    }
  } catch (err) {
    console.error('Errore Stripe:', err);
    showToast('Errore durante il pagamento. Riprova.', 'error');
    btn.textContent = 'Paga con Carta (Stripe)';
    btn.disabled = false;
  }
}

async function payWithPayPal() {
  const btn = document.getElementById('btn-pay-paypal');
  btn.textContent = 'Connessione PayPal...';
  btn.disabled = true;
  
  const token = localStorage.getItem('hyrox_token');

  try {
    const res = await fetch('/api/payment/paypal-create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ plan: selectedPaymentPlan })
    });

    const data = await res.json();

    if (data.configRequired) {
      showToast('⚙️ PayPal non ancora configurato. Aggiungi PAYPAL_CLIENT_ID nelle variabili ambiente del server.', 'info');
      btn.textContent = 'Paga con PayPal';
      btn.disabled = false;
      return;
    }

    // If PayPal is configured, redirect to PayPal approval URL
    if (data.approvalUrl) {
      window.location.href = data.approvalUrl;
    }
  } catch (err) {
    console.error('Errore PayPal:', err);
    showToast('Errore durante il pagamento PayPal. Riprova.', 'error');
    btn.textContent = 'Paga con PayPal';
    btn.disabled = false;
  }
}

// ============================================================
// TOAST NOTIFICATION
// ============================================================
function showToast(message, type = 'success') {
  const colors = {
    success: 'bg-hyrox-yellow text-black',
    error: 'bg-red-600 text-white',
    info: 'bg-blue-600 text-white'
  };
  const toast = document.createElement('div');
  toast.className = `fixed bottom-28 left-4 right-4 max-w-md mx-auto ${colors[type]} rounded-xl px-4 py-3 text-sm font-bold text-center z-[10000] shadow-lg`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// ============================================================
// TAB ROUTING
// ============================================================
function setupTabs() {
  const tabs = document.querySelectorAll('[data-tab]');
  const contents = document.querySelectorAll('.tab-content');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.getAttribute('data-tab');

      // Block timer and wod if expired
      if (currentUserStatus === 'expired' && (target === 'timer' || target === 'wod')) {
        showPaywall();
        return;
      }

      tabs.forEach(t => {
        t.classList.remove('active');
        t.classList.add('text-gray-400');
        t.classList.remove('text-white');
      });
      tab.classList.add('active');
      tab.classList.remove('text-gray-400');
      tab.classList.add('text-white');

      contents.forEach(c => {
        c.id === `tab-${target}` ? c.classList.add('active') : c.classList.remove('active');
      });

      if (target === 'history') fetchHistoryAndPRs();
    });
  });

  document.querySelector('[data-tab="sim"]')?.click();
}

// ============================================================
// SERVICE WORKER REGISTRATION
// ============================================================
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('SW registrato:', reg.scope))
      .catch(err => console.error('SW errore:', err));
  }
}

export function navigateToTab(tabName) {
  document.querySelector(`[data-tab="${tabName}"]`)?.click();
}
