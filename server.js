const express = require('express');
const fs = require('fs');
const path = require('path');
const os = require('os');
const qrcode = require('qrcode-terminal');
const QRCode = require('qrcode');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;
const TRIAL_DAYS = 7;

// ============================================================
// SECURITY MIDDLEWARE
// ============================================================

// Helmet: secure HTTP headers
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false
}));

// Global rate limiter: max 200 requests per 15 minutes per IP
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Troppe richieste dal tuo IP. Riprova tra 15 minuti.' }
});
app.use(globalLimiter);

// Strict rate limiter for API endpoints (anti-abuse)
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Limite di richieste API superato. Riprova tra un minuto.' }
});
app.use('/api/', apiLimiter);

// Strict limiter for payment routes
const paymentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Troppi tentativi di pagamento. Attendi un minuto.' }
});

// ============================================================
// MIDDLEWARE
// ============================================================
app.use(express.json({ limit: '50kb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ============================================================
// FILE PATHS
// ============================================================
const WORKOUTS_FILE = path.join(__dirname, 'data', 'workouts.json');
const HISTORY_FILE = path.join(__dirname, 'data', 'history.json');
const USERS_FILE = path.join(__dirname, 'data', 'users.json');

// ============================================================
// HELPERS
// ============================================================
function readJsonFile(filePath, defaultValue = []) {
  try {
    if (!fs.existsSync(filePath)) return defaultValue;
    const data = fs.readFileSync(filePath, 'utf8').trim();
    return data ? JSON.parse(data) : defaultValue;
  } catch (err) {
    console.error(`Errore lettura ${filePath}:`, err.message);
    return defaultValue;
  }
}

function writeJsonFile(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error(`Errore scrittura ${filePath}:`, err.message);
    return false;
  }
}

function getUserStatus(userId) {
  const users = readJsonFile(USERS_FILE, []);
  const user = users.find(u => u.id === userId);
  if (!user) return null;

  if (user.isPro) return { status: 'pro', user };

  const createdAt = new Date(user.createdAt);
  const now = new Date();
  const diffDays = (now - createdAt) / (1000 * 60 * 60 * 24);
  const daysLeft = Math.max(0, Math.ceil(TRIAL_DAYS - diffDays));

  if (daysLeft > 0) {
    return { status: 'trial', daysLeft, user };
  } else {
    return { status: 'expired', user };
  }
}

// Middleware to check user access (trial or pro)
function requireAccess(req, res, next) {
  const userId = req.headers['x-user-id'];
  if (!userId) {
    return res.status(401).json({ error: 'ID utente mancante.' });
  }
  const statusInfo = getUserStatus(userId);
  if (!statusInfo) {
    return res.status(401).json({ error: 'Utente non registrato.' });
  }
  if (statusInfo.status === 'expired') {
    return res.status(403).json({ error: 'Prova gratuita scaduta. Abbonati per continuare.', code: 'TRIAL_EXPIRED' });
  }
  req.userStatus = statusInfo;
  next();
}

// ============================================================
// USER MANAGEMENT ROUTES
// ============================================================

// Register a new user (or return existing status)
app.post('/api/user/register', (req, res) => {
  const { userId } = req.body;
  if (!userId || typeof userId !== 'string' || userId.length < 10) {
    return res.status(400).json({ error: 'ID utente non valido.' });
  }

  const users = readJsonFile(USERS_FILE, []);
  let user = users.find(u => u.id === userId);

  if (!user) {
    user = {
      id: userId,
      createdAt: new Date().toISOString(),
      isPro: false,
      subscription: null
    };
    users.push(user);
    writeJsonFile(USERS_FILE, users);
  }

  const statusInfo = getUserStatus(userId);
  res.json({
    status: statusInfo.status,
    daysLeft: statusInfo.daysLeft || 0,
    isPro: user.isPro,
    createdAt: user.createdAt
  });
});

// Get user status
app.get('/api/user/status', (req, res) => {
  const userId = req.headers['x-user-id'];
  if (!userId) return res.status(401).json({ error: 'ID utente mancante.' });

  const statusInfo = getUserStatus(userId);
  if (!statusInfo) {
    return res.status(404).json({ error: 'Utente non trovato.' });
  }

  res.json({
    status: statusInfo.status,
    daysLeft: statusInfo.daysLeft || 0,
    isPro: statusInfo.user.isPro,
    subscription: statusInfo.user.subscription
  });
});

// ============================================================
// PAYMENT ROUTES - STRIPE
// ============================================================

// Create Stripe Checkout Session
app.post('/api/payment/create-stripe-session', paymentLimiter, requireAccess, async (req, res) => {
  const { plan } = req.body; // 'monthly' | 'quarterly'
  const userId = req.headers['x-user-id'];

  // Stripe is initialized only if key is configured
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return res.status(503).json({
      error: 'Pagamenti Stripe non ancora configurati. Configura STRIPE_SECRET_KEY nelle variabili ambiente del server.',
      configRequired: true
    });
  }

  try {
    const stripe = require('stripe')(stripeKey);
    const prices = {
      monthly: { amount: 299, interval: 'month', label: '2,99€ / Mese' },
      quarterly: { amount: 699, interval: 'month', interval_count: 3, label: '6,99€ / 3 Mesi' }
    };
    const selectedPlan = prices[plan] || prices.monthly;
    const baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'eur',
          unit_amount: selectedPlan.amount,
          recurring: {
            interval: selectedPlan.interval,
            ...(selectedPlan.interval_count ? { interval_count: selectedPlan.interval_count } : {})
          },
          product_data: {
            name: 'HYROX Companion PRO',
            description: `Abbonamento ${selectedPlan.label} - Accesso completo a timer, WOD e storico.`,
            images: [`${baseUrl}/icon-512.png`]
          }
        },
        quantity: 1
      }],
      mode: 'subscription',
      success_url: `${baseUrl}/?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/?payment=cancelled`,
      metadata: { userId }
    });

    res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error('Errore Stripe:', err.message);
    res.status(500).json({ error: 'Errore durante la creazione della sessione di pagamento.' });
  }
});

// Stripe Webhook - receives payment confirmed events
app.post('/api/payment/stripe-webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeKey || !webhookSecret) {
    return res.status(503).json({ error: 'Stripe non configurato.' });
  }

  const stripe = require('stripe')(stripeKey);
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], webhookSecret);
  } catch (err) {
    console.error('Errore verifica webhook Stripe:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId = session.metadata?.userId;

    if (userId) {
      const users = readJsonFile(USERS_FILE, []);
      const userIndex = users.findIndex(u => u.id === userId);
      if (userIndex !== -1) {
        users[userIndex].isPro = true;
        users[userIndex].subscription = {
          provider: 'stripe',
          sessionId: session.id,
          plan: session.metadata?.plan || 'monthly',
          activatedAt: new Date().toISOString()
        };
        writeJsonFile(USERS_FILE, users);
        console.log(`✅ Utente ${userId} attivato come PRO tramite Stripe.`);
      }
    }
  }

  res.json({ received: true });
});

// ============================================================
// PAYMENT ROUTES - PAYPAL
// ============================================================

// Get PayPal payment info (for client-side redirect)
app.post('/api/payment/paypal-create', paymentLimiter, requireAccess, (req, res) => {
  const { plan } = req.body;
  const paypalClientId = process.env.PAYPAL_CLIENT_ID;
  const paypalClientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (!paypalClientId || !paypalClientSecret) {
    return res.status(503).json({
      error: 'Pagamenti PayPal non ancora configurati. Configura PAYPAL_CLIENT_ID e PAYPAL_CLIENT_SECRET nelle variabili ambiente.',
      configRequired: true
    });
  }

  const prices = {
    monthly: { amount: '2.99', label: 'Mensile' },
    quarterly: { amount: '6.99', label: 'Trimestrale' }
  };
  const selectedPlan = prices[plan] || prices.monthly;

  res.json({
    clientId: paypalClientId,
    amount: selectedPlan.amount,
    currency: 'EUR',
    description: `HYROX Companion PRO - ${selectedPlan.label}`,
    userId: req.headers['x-user-id']
  });
});

// PayPal capture order (called after frontend PayPal button confirms)
app.post('/api/payment/paypal-capture', paymentLimiter, (req, res) => {
  const { orderId, userId } = req.body;
  const paypalClientId = process.env.PAYPAL_CLIENT_ID;
  const paypalClientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (!paypalClientId || !paypalClientSecret) {
    return res.status(503).json({ error: 'PayPal non configurato.' });
  }

  if (!orderId || !userId) {
    return res.status(400).json({ error: 'Dati ordine mancanti.' });
  }

  // Activate user as PRO after PayPal capture
  const users = readJsonFile(USERS_FILE, []);
  const userIndex = users.findIndex(u => u.id === userId);
  if (userIndex !== -1) {
    users[userIndex].isPro = true;
    users[userIndex].subscription = {
      provider: 'paypal',
      orderId,
      plan: req.body.plan || 'monthly',
      activatedAt: new Date().toISOString()
    };
    writeJsonFile(USERS_FILE, users);
    console.log(`✅ Utente ${userId} attivato come PRO tramite PayPal.`);
    res.json({ success: true, message: 'Abbonamento attivato con successo!' });
  } else {
    res.status(404).json({ error: 'Utente non trovato.' });
  }
});

// ============================================================
// WORKOUT DATA ROUTES (protected)
// ============================================================

app.get('/api/workouts', (req, res) => {
  const workouts = readJsonFile(WORKOUTS_FILE, []);
  res.json(workouts);
});

app.get('/api/history', requireAccess, (req, res) => {
  const history = readJsonFile(HISTORY_FILE, []);
  res.json(history);
});

app.post('/api/history', requireAccess, (req, res) => {
  const newSession = req.body;
  if (!newSession || !newSession.category || !newSession.workoutName) {
    return res.status(400).json({ error: 'Dati sessione incompleti.' });
  }

  newSession.id = newSession.id || `session-${Date.now()}`;
  newSession.date = newSession.date || new Date().toISOString();

  const history = readJsonFile(HISTORY_FILE, []);
  history.push(newSession);

  if (writeJsonFile(HISTORY_FILE, history)) {
    res.status(201).json(newSession);
  } else {
    res.status(500).json({ error: 'Errore durante il salvataggio.' });
  }
});

app.get('/api/prs', requireAccess, (req, res) => {
  const history = readJsonFile(HISTORY_FILE, []);
  const prs = {};

  history.forEach(session => {
    if (!session.splits || !Array.isArray(session.splits)) return;
    session.splits.forEach(split => {
      const key = split.name;
      const duration = split.duration;
      if (duration && duration > 0) {
        if (!prs[key] || duration < prs[key].duration) {
          prs[key] = {
            duration,
            date: session.date,
            workoutName: session.workoutName,
            category: session.category
          };
        }
      }
    });
  });

  res.json(prs);
});

// ============================================================
// SPA FALLBACK
// ============================================================
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ============================================================
// SERVER STARTUP
// ============================================================
function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const name in interfaces) {
    for (const address of interfaces[name]) {
      if (address.family === 'IPv4' && !address.internal) return address.address;
    }
  }
  return null;
}

async function generateQrCodeFile(url) {
  try {
    const qrPath = path.join(__dirname, 'qr-code-palestra.png');
    await QRCode.toFile(qrPath, url, {
      errorCorrectionLevel: 'H',
      type: 'png',
      width: 800,
      margin: 4,
      color: { dark: '#000000', light: '#ffffff' }
    });
    console.log(`📄 QR Code salvato: ${qrPath}`);
  } catch (err) {
    console.error('Errore generazione QR Code immagine:', err.message);
  }
}

app.listen(PORT, async () => {
  const localIp = getLocalIpAddress() || 'localhost';
  const hostname = os.hostname().toLowerCase();
  const localUrl = `http://${localIp}:${PORT}`;
  const dnsUrl = `http://${hostname}.local:${PORT}`;
  const publicUrl = process.env.PUBLIC_URL || localUrl;

  console.log('\n======================================================');
  console.log('🚀 HYROX COMPANION PRO - SERVER AVVIATO');
  console.log('======================================================');
  console.log(`💻 Locale:        http://localhost:${PORT}`);
  console.log(`🌐 Rete locale:   ${localUrl}`);
  console.log(`🏷️  mDNS:          ${dnsUrl}`);
  if (process.env.PUBLIC_URL) {
    console.log(`🌍 Pubblico:      ${publicUrl}`);
  }
  console.log('======================================================');
  console.log('📱 QR CODE - SCANSIONA PER APRIRE L\'APP:\n');
  qrcode.generate(publicUrl, { small: true });
  console.log('======================================================\n');

  // Generate PNG QR code file
  await generateQrCodeFile(publicUrl);
});
