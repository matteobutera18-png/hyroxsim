import { getToken } from './auth.js';

document.addEventListener('DOMContentLoaded', () => {
  const nameInput = document.getElementById('settings-name');
  const ageInput = document.getElementById('settings-age');
  const saveBtn = document.getElementById('btn-save-settings');

  async function loadSettings() {
    const token = getToken();
    if (!token) return;

    try {
      const res = await fetch('/api/user/status', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.profile) {
          nameInput.value = data.profile.name || '';
          ageInput.value = data.profile.age || 25;
          localStorage.setItem('hyrox_user_age', ageInput.value);
        }
      }
    } catch (err) {
      console.error('Error loading settings', err);
    }
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      const token = getToken();
      if (!token) return;

      saveBtn.disabled = true;
      saveBtn.textContent = 'Salvataggio...';

      const name = nameInput.value;
      const age = parseInt(ageInput.value, 10);

      try {
        const res = await fetch('/api/user/settings', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ name, age })
        });
        
        if (res.ok) {
          localStorage.setItem('hyrox_user_age', age);
          saveBtn.textContent = 'Salvato!';
          saveBtn.classList.remove('bg-hyrox-yellow');
          saveBtn.classList.add('bg-green-500', 'text-white');
          setTimeout(() => {
            saveBtn.textContent = 'Salva Profilo';
            saveBtn.classList.add('bg-hyrox-yellow');
            saveBtn.classList.remove('bg-green-500', 'text-white');
            saveBtn.disabled = false;
          }, 2000);
        } else {
          saveBtn.textContent = 'Errore';
          saveBtn.disabled = false;
        }
      } catch (err) {
        saveBtn.textContent = 'Errore Rete';
        saveBtn.disabled = false;
      }
    });
  }

  // Hook into tab switching or auth success to load settings
  window.addEventListener('auth-success', loadSettings);
  
  // Also load immediately if we have a token
  if (getToken()) {
    loadSettings();
  }
});
