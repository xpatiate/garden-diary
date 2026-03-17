import { getEntries } from '../services/entries.js';
import { getPhotoUrl } from '../services/photos.js';
import { navigate } from '../router.js';

export async function renderPhotos(container, user) {
  container.innerHTML = `
    <div class="view photos-view">
      <header class="app-header">
        <h1>Photos</h1>
      </header>
      <div class="tag-filter-bar" id="tag-filter-bar"></div>
      <main class="photo-grid" id="photo-grid">
        <div class="loading">Loading photos…</div>
      </main>
    </div>
  `;

  const grid = container.querySelector('#photo-grid');
  const filterBar = container.querySelector('#tag-filter-bar');

  try {
    const entries = await getEntries(user.uid);

    // Collect all (entryId, photoRef, tags) pairs, newest entries first
    const photos = [];
    for (const entry of entries) {
      for (const ref of (entry.photoRefs || [])) {
        photos.push({ ref, entryId: entry.id, tags: entry.tags || [] });
      }
    }

    const allTags = [...new Set(entries.flatMap(e => e.tags || []))].sort();
    let activeTag = null;

    function renderFilterBar() {
      filterBar.innerHTML = allTags.map(tag => `
        <button class="tag-filter-chip${activeTag === tag ? ' active' : ''}" data-tag="${tag}">${tag}</button>
      `).join('');

      filterBar.querySelectorAll('.tag-filter-chip').forEach(btn => {
        btn.addEventListener('click', () => {
          activeTag = activeTag === btn.dataset.tag ? null : btn.dataset.tag;
          renderFilterBar();
          renderGrid();
        });
      });
    }

    function renderGrid() {
      const filtered = activeTag
        ? photos.filter(p => p.tags.includes(activeTag))
        : photos;

      if (filtered.length === 0) {
        grid.innerHTML = activeTag
          ? `<div class="empty-state">No photos tagged "${activeTag}".</div>`
          : '<div class="empty-state">No photos yet.</div>';
        return;
      }

      grid.innerHTML = '';

      for (const { ref, entryId } of filtered) {
        const cell = document.createElement('button');
        cell.className = 'photo-cell';
        cell.setAttribute('aria-label', 'View entry');
        cell.innerHTML = '<div class="photo-cell__placeholder"></div>';
        cell.addEventListener('click', () => {
          sessionStorage.setItem('entryBack', '/photos');
          navigate(`/entry/${entryId}`);
        });
        grid.appendChild(cell);

        getPhotoUrl(ref).then(url => {
          if (!cell.isConnected) return;
          const img = document.createElement('img');
          img.src = url;
          img.loading = 'lazy';
          img.alt = '';
          img.className = 'photo-cell__img';
          cell.innerHTML = '';
          cell.appendChild(img);
        }).catch(() => {
          cell.remove();
        });
      }
    }

    renderFilterBar();
    renderGrid();

  } catch (err) {
    grid.innerHTML = `<div class="error">Failed to load photos: ${err.code || err.message}</div>`;
    console.error(err);
  }
}
