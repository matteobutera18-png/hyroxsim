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

let isLoginMode = true;

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
  const form = document.getElementById('auth-form');
  const toggleBtn = document.getElementById('btn-auth-toggle');
  const submitBtn = document.getElementById('btn-auth-submit');
  const errorText = document.getElementById('auth-error');
  const phoneGroup = document.getElementById('auth-phone-group');
  const toggleText = document.getElementById('auth-toggle-text');
  const logoutBtn = document.getElementById('btn-logout');

  // Run initial check
  checkAuth();

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      isLoginMode = !isLoginMode;
      if (isLoginMode) {
        phoneGroup.classList.add('hidden');
        document.getElementById('auth-phone').removeAttribute('required');
        submitBtn.textContent = 'Accedi';
        toggleText.textContent = 'Non hai un account?';
        toggleBtn.textContent = 'Registrati';
      } else {
        phoneGroup.classList.remove('hidden');
        document.getElementById('auth-phone').setAttribute('required', 'true');
        submitBtn.textContent = 'Registrati';
        toggleText.textContent = 'Hai già un account?';
        toggleBtn.textContent = 'Accedi';
      }
      errorText.classList.add('hidden');
    });
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorText.classList.add('hidden');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Attendi...';

      const email = document.getElementById('auth-email').value;
      const password = document.getElementById('auth-password').value;
      const phone = document.getElementById('auth-phone').value;

      const endpoint = isLoginMode ? '/api/auth/login' : '/api/auth/register';
      const body = isLoginMode ? { email, password } : { email, password, phone };

      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        const data = await res.json();

        if (res.ok && data.token) {
          setToken(data.token);
          localStorage.setItem('hyrox_user_id', data.user.id);
          if (data.user.age) localStorage.setItem('hyrox_user_age', data.user.age);
          document.getElementById('auth-modal').classList.add('hidden');
          window.location.reload(); 
        } else {
          errorText.textContent = data.error || 'Errore di autenticazione';
          errorText.classList.remove('hidden');
        }
      } catch (err) {
        errorText.textContent = 'Errore di connessione al server.';
        errorText.classList.remove('hidden');
      }

      submitBtn.disabled = false;
      submitBtn.textContent = isLoginMode ? 'Accedi' : 'Registrati';
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      removeToken();
      localStorage.removeItem('hyrox_user_id');
      window.location.reload();
    });
  }
});
