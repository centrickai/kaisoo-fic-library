/* The Fic Shelf — server-verified visual PIN gate.
   This hides the PIN from client source; it does NOT secure public Supabase records/files. */
(() => {
  'use strict';
  const config = window.FIC_SHELF_CONFIG;
  const endpoint = config?.url?.replace(/\/$/, '') + '/functions/v1/verify-shelf-pin';
  const lockedClass = 'fic-pin-locked';

  // Lock immediately, before DOMContentLoaded, including on every reload.
  document.documentElement.classList.add(lockedClass);

  function init() {
    if (document.getElementById('ficPinOverlay')) return;
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
          <input id="ficPinInput" type="password" inputmode="numeric" pattern="[0-9]{4}"
                 minlength="4" maxlength="4" autocomplete="off" required
                 aria-describedby="ficPinError" />
          <p id="ficPinError" class="fic-pin-error" role="alert" aria-live="polite"></p>
          <button class="fic-pin-submit" type="submit">Unlock shelf ♡</button>
        </form>
      </div>`;
    document.body.appendChild(overlay);
    const input = overlay.querySelector('#ficPinInput');
    const form = overlay.querySelector('#ficPinForm');
    const error = overlay.querySelector('#ficPinError');
    const button = overlay.querySelector('.fic-pin-submit');
    input.addEventListener('input', () => {
      input.value = input.value.replace(/\D/g, '').slice(0, 4);
      error.textContent = '';
    });
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (button.disabled) return;
      if (!config?.url || config.url.includes('YOUR-PROJECT')) {
        error.textContent = 'Supabase URL is missing from config.js.';
        return;
      }
      button.disabled = true;
      button.textContent = 'Checking…';
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin: input.value }),
          cache: 'no-store'
        });
        const payload = await response.json();
        if (!response.ok || payload?.valid !== true) {
          error.textContent = response.status === 429
            ? 'Too many attempts. Try again later.'
            : 'Incorrect PIN. Please try again.';
          input.value = '';
          input.focus();
          return;
        }
        overlay.classList.add('fic-pin-unlocking');
        window.setTimeout(() => {
          overlay.remove();
          document.documentElement.classList.remove(lockedClass);
        }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 280);
      } catch (err) {
        console.error('PIN verification request failed:', err);
        error.textContent = 'Could not connect to the PIN verification service. Please try again.';
      } finally {
        button.disabled = false;
        button.textContent = 'Unlock shelf ♡';
      }
    });
    input.focus();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else init();
})();
