import { navigate } from '../router.js';
import { signOutUser } from '../services/auth.js';

export function renderNav(container) {
  const nav = document.createElement('nav');
  nav.className = 'bottom-nav';
  nav.innerHTML = `
    <button class="nav-btn" data-route="/" aria-label="Home">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
      <span>Home</span>
    </button>
    <button class="nav-btn nav-btn--add" data-route="/new" aria-label="New entry">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="16"/>
        <line x1="8" y1="12" x2="16" y2="12"/>
      </svg>
      <span>Add</span>
    </button>
    <button class="nav-btn nav-btn--signout" aria-label="Sign out">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
        <polyline points="16 17 21 12 16 7"/>
        <line x1="21" y1="12" x2="9" y2="12"/>
      </svg>
      <span>Sign out</span>
    </button>
  `;

  nav.querySelectorAll('[data-route]').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.route));
  });

  nav.querySelector('.nav-btn--signout').addEventListener('click', () => signOutUser());

  container.appendChild(nav);
  return nav;
}

export function updateActiveNav(nav) {
  const hash = window.location.hash.slice(1) || '/';
  nav.querySelectorAll('[data-route]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.route === hash);
  });
}
