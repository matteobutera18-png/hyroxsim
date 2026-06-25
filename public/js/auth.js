export function getToken() {
  return localStorage.getItem('hyrox_token');
}

export function setToken(token) {
  localStorage.setItem('hyrox_token', token);
}

export function removeToken() {
  localStorage.removeItem('hyrox_token');
}

export function getUserId() {
  return localStorage.getItem('hyrox_user_id');
}

export async function checkAuth() {
  const token = getToken();
  const modal = document.getElementById('auth-modal');
  
  if (!token) {
    modal.classList.remove('hidden');
    return false;
  }
  
  try {
    const res = await fetch('/api/user/status', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      modal.classList.add('hidden');
      return true;
    } else {
      removeToken();
      modal.classList.remove('hidden');
      return false;
    }
  } catch (err) {
    console.error('Network error checking auth:', err);
    return false;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const toggleBtn = document.getElementById('btn-auth-toggle');
  const toggleText = document.getElementById('auth-toggle-text');
  
  const loginError = document.getElementById('login-error');
  const registerError = document.getElementById('register-error');
  const btnLoginSubmit = document.getElementById('btn-login-submit');
  const btnRegisterSubmit = document.getElementById('btn-register-submit');
  
  const logoutBtn = document.getElementById('btn-logout');

  let isLoginMode = true;

  // Run initial check
  checkAuth();

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      isLoginMode = !isLoginMode;
      loginError.classList.add('hidden');
      registerError.classList.add('hidden');
      
      if (isLoginMode) {
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
        toggleText.textContent = 'Non hai un account?';
        toggleBtn.textContent = 'Registrati';
      } else {
        loginForm.classList.add('hidden');
        registerForm.classList.remove('hidden');
        toggleText.textContent = 'Hai già un account?';
        toggleBtn.textContent = 'Accedi';
      }
    });
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      loginError.classList.add('hidden');
      btnLoginSubmit.disabled = true;
      btnLoginSubmit.textContent = 'Accesso in corso...';

      const email = document.getElementById('login-email').value;
      const password = document.getElementById('login-password').value;

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const data = await res.json();

        if (res.ok && data.token) {
          setToken(data.token);
          localStorage.setItem('hyrox_user_id', data.user.id);
          if (data.user.age) localStorage.setItem('hyrox_user_age', data.user.age);
          document.getElementById('auth-modal').classList.add('hidden');
          window.location.reload(); 
        } else {
          loginError.textContent = data.error || 'Credenziali non valide';
          loginError.classList.remove('hidden');
        }
      } catch (err) {
        loginError.textContent = 'Errore di connessione al server.';
        loginError.classList.remove('hidden');
      }

      btnLoginSubmit.disabled = false;
      btnLoginSubmit.textContent = 'Accedi';
    });
  }
  
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      registerError.classList.add('hidden');
      btnRegisterSubmit.disabled = true;
      btnRegisterSubmit.textContent = 'Creazione in corso...';

      const email = document.getElementById('register-email').value;
      const password = document.getElementById('register-password').value;
      const phone = document.getElementById('register-phone').value;
      
      // Pass the old user ID so the server can migrate existing data
      const oldUserId = getUserId();

      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, phone, oldUserId })
        });
        const data = await res.json();

        if (res.ok && data.token) {
          setToken(data.token);
          localStorage.setItem('hyrox_user_id', data.user.id);
          if (data.user.age) localStorage.setItem('hyrox_user_age', data.user.age);
          document.getElementById('auth-modal').classList.add('hidden');
          window.location.reload(); 
        } else {
          registerError.textContent = data.error || 'Errore di registrazione';
          registerError.classList.remove('hidden');
        }
      } catch (err) {
        registerError.textContent = 'Errore di connessione al server.';
        registerError.classList.remove('hidden');
      }

      btnRegisterSubmit.disabled = false;
      btnRegisterSubmit.textContent = 'Crea Account';
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      removeToken();
      // Notice: Do NOT wipe hyrox_user_id on logout. If they login again with the same account, it will overwrite it correctly.
      // If we remove it, and they try to use the app anonymously, it will create a new anonymous ID.
      // Actually, removing token is enough to trigger the auth modal.
      window.location.reload();
    });
  }
});
