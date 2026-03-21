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
    <button class="nav-btn" data-route="/photos" aria-label="Photos">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
      </svg>
      <span>Photos</span>
    </button>
    <button class="nav-btn" data-route="/todos" aria-label="To-do">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/>
        <polyline points="4 6 5 7 7 5"/><polyline points="4 12 5 13 7 11"/><polyline points="4 18 5 19 7 17"/>
      </svg>
      <span>To-do</span>
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
