import { getEntries } from '../services/entries.js';
import { navigate } from '../router.js';

function formatDate(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function groupByDate(entries) {
  const groups = {};
  entries.forEach(entry => {
    const key = formatDate(entry.date);
    if (!groups[key]) groups[key] = [];
    groups[key].push(entry);
  });
  return groups;
}

export async function renderHome(container, user) {
  container.innerHTML = `
    <div class="view home-view">
      <header class="app-header">
        <h1>Garden Diary</h1>
      </header>
      <div class="tag-filter-bar" id="tag-filter-bar"></div>
      <main class="entry-list" id="entry-list">
        <div class="loading">Loading entries…</div>
      </main>
    </div>
  `;

  const listEl = container.querySelector('#entry-list');
  const filterBar = container.querySelector('#tag-filter-bar');
  let activeTag = null;

  try {
    const entries = await getEntries(user.uid);

    // Collect all unique tags
    const allTags = [...new Set(entries.flatMap(e => e.tags || []))].sort();

    if (allTags.length > 0) {
      function renderFilterBar() {
        filterBar.innerHTML = allTags.map(tag => `
          <button class="tag-filter-chip${activeTag === tag ? ' active' : ''}" data-tag="${tag}">${tag}</button>
        `).join('');
        filterBar.querySelectorAll('.tag-filter-chip').forEach(btn => {
          btn.addEventListener('click', () => {
            activeTag = activeTag === btn.dataset.tag ? null : btn.dataset.tag;
            renderFilterBar();
            renderList();
          });
        });
      }
      renderFilterBar();
    }

    function renderList() {
      const filtered = activeTag ? entries.filter(e => (e.tags || []).includes(activeTag)) : entries;

      if (filtered.length === 0) {
        listEl.innerHTML = `<div class="empty-state">${activeTag ? `No entries tagged "${activeTag}".` : 'No entries yet.<br>Tap <strong>+</strong> to add your first garden note.'}</div>`;
        return;
      }

      const groups = groupByDate(filtered);
      listEl.innerHTML = '';

      for (const [dateLabel, dayEntries] of Object.entries(groups)) {
        const section = document.createElement('section');
        section.className = 'date-group';
        section.innerHTML = `<h2 class="date-heading">${dateLabel}</h2>`;

        dayEntries.forEach(entry => {
          const card = document.createElement('div');
          card.className = 'entry-card';
          const preview = entry.textNote || entry.voiceTranscript || '(no notes)';
          const photoCount = entry.photoRefs?.length || 0;
          const entryTags = entry.tags || [];
          card.innerHTML = `
            <div class="entry-card__body">
              <p class="entry-card__preview">${preview.slice(0, 120)}${preview.length > 120 ? '…' : ''}</p>
              <div class="entry-card__meta">
                ${photoCount > 0 ? `<span class="entry-card__photos">📷 ${photoCount}</span>` : ''}
                ${entryTags.map(t => `<span class="tag-chip tag-chip--small">${t}</span>`).join('')}
              </div>
            </div>
          `;
          card.addEventListener('click', () => navigate(`/entry/${entry.id}`));
          section.appendChild(card);
        });

        listEl.appendChild(section);
      }
    }

    renderList();

  } catch (err) {
    listEl.innerHTML = `<div class="error">Failed to load entries: ${err.code || err.message}</div>`;
    console.error(err);
  }
}
