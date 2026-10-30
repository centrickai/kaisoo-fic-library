/* The Fic Shelf: visual-only 4-digit PIN gate (NOT security). */
(() => {
  'use strict';
  const PIN = '1288'; // CHANGE THIS. Do not use a sensitive PIN.
  const KEY = 'ficShelfPinUnlocked';
  const isUnlocked = () => sessionStorage.getItem(KEY) === 'yes';

  function init() {
    if (isUnlocked()) {
      document.documentElement.classList.remove('fic-pin-locked');
      return;
    }

    document.documentElement.classList.add('fic-pin-locked');

    const overlay = document.createElement('div');
    overlay.id = 'ficPinOverlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'ficPinTitle');
    overlay.innerHTML = `
      <div class="fic-pin-card">
        <div class="fic-pin-mark" aria-hidden="true">✦</div>
        <p class="fic-pin-eyebrow"></p>
        <h1 id="ficPinTitle"></h1>
        <p class="fic-pin-description"></p>
        <p class="fic-pin-hint">Hint: 🐧🐻🥋🔢</p>
        <form id="ficPinForm" autocomplete="off">
          <label for="ficPinInput" class="fic-pin-label">4-digit PIN</label>
          <input id="ficPinInput" type="password" inputmode="numeric"
                 pattern="[0-9]{4}" minlength="4" maxlength="4"
                 autocomplete="off" required aria-describedby="ficPinError" />
          <p id="ficPinError" class="fic-pin-error" role="alert"></p>
          <button type="submit" class="fic-pin-submit">Unlock shelf ♡</button>
        </form>
      </div>`;
    document.body.appendChild(overlay);
    const input = document.getElementById('ficPinInput');
    input.addEventListener('input', () => {
      input.value = input.value.replace(/\D/g, '').slice(0, 4);
      document.getElementById('ficPinError').textContent = '';
    });
    document.getElementById('ficPinForm').addEventListener('submit', event => {
      event.preventDefault();
      if (input.value === PIN) {
        sessionStorage.setItem(KEY, 'yes');
        overlay.classList.add('fic-pin-unlocking');
        document.documentElement.classList.remove('fic-pin-locked');
        setTimeout(() => overlay.remove(), 280);
      } else {
        document.getElementById('ficPinError').textContent = 'Incorrect PIN. Please try again.';
        input.value = '';
        input.focus();
      }
    });
    input.focus();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else init();
})();
