import './styles.css';
import { onAuthChange, signOutUser } from './services/auth.js';

const ALLOWED_EMAILS = ['catstarpipewall@gmail.com'];
import { renderLogin } from './views/login.js';
import { renderHome } from './views/home.js';
import { renderNewEntry } from './views/new-entry.js';
import { renderEntry } from './views/entry.js';
import { renderImport } from './views/import.js';
import { renderPhotos } from './views/photos.js';
import { renderNav, updateActiveNav } from './components/nav.js';
import { defineRoute, startRouter, navigate } from './router.js';

const appEl = document.getElementById('app');

let navEl = null;
let currentUser = null;

function getContentEl() {
  let el = document.getElementById('content');
  if (!el) {
    el = document.createElement('div');
    el.id = 'content';
    appEl.appendChild(el);
  }
  return el;
}

onAuthChange(user => {
  if (user && !ALLOWED_EMAILS.includes(user.email)) {
    signOutUser();
    appEl.innerHTML = '';
    navEl = null;
    renderLogin(appEl, 'Access denied. This is a private app.');
    return;
  }

  currentUser = user;

  if (!user) {
    appEl.innerHTML = '';
    navEl = null;
    renderLogin(appEl);
    return;
  }

  // First sign-in: build shell with nav
  if (!navEl) {
    appEl.innerHTML = '';
    getContentEl(); // ensure content div exists
    navEl = document.createElement('div');
    navEl.id = 'nav-wrapper';
    appEl.appendChild(navEl);
    renderNav(navEl);
  }

  // Update active nav on hash change
  window.addEventListener('hashchange', () => updateActiveNav(navEl.querySelector('.bottom-nav')));
  updateActiveNav(navEl.querySelector('.bottom-nav'));

  startRouter(getContentEl());
});

// Route definitions (registered once; router re-evaluates on hash change)
defineRoute('/', async (container) => {
  await renderHome(container, currentUser);
});

defineRoute('/new', async (container) => {
  await renderNewEntry(container, currentUser);
});

defineRoute('/entry/:id', async (container, params) => {
  await renderEntry(container, currentUser, params.id);
});

defineRoute('/import', async (container) => {
  await renderImport(container, currentUser);
});

defineRoute('/photos', async (container) => {
  await renderPhotos(container, currentUser);
});
