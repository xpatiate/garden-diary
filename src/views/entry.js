import { getEntry, deleteEntry } from '../services/entries.js';
import { getPhotoUrl, deletePhoto } from '../services/photos.js';
import { navigate } from '../router.js';

function formatDate(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export async function renderEntry(container, user, entryId) {
  container.innerHTML = `
    <div class="view entry-view">
      <header class="app-header app-header--back">
        <button class="btn btn--ghost" id="btn-back">← Back</button>
        <h1>Entry</h1>
        <button class="btn btn--ghost btn--danger" id="btn-delete">Delete</button>
      </header>
      <main class="entry-detail" id="entry-detail">
        <div class="loading">Loading…</div>
      </main>
    </div>
  `;

  container.querySelector('#btn-back').addEventListener('click', () => navigate('/'));

  const detail = container.querySelector('#entry-detail');

  try {
    const entry = await getEntry(user.uid, entryId);

    if (!entry) {
      detail.innerHTML = `<p class="error">Entry not found.</p>`;
      return;
    }

    // Fetch photo URLs in parallel
    const photoUrls = entry.photoRefs?.length
      ? await Promise.all(entry.photoRefs.map(getPhotoUrl))
      : [];

    detail.innerHTML = `
      <h2 class="entry-date">${formatDate(entry.date)}</h2>
      ${photoUrls.length > 0 ? `
        <div class="photo-grid">
          ${photoUrls.map((url, i) => `
            <a href="${url}" target="_blank" rel="noopener">
              <img class="photo-thumb" src="${url}" alt="Garden photo ${i + 1}" loading="lazy" />
            </a>
          `).join('')}
        </div>
      ` : ''}
      ${entry.textNote ? `
        <section class="entry-section">
          <h3>Notes</h3>
          <p class="entry-text">${entry.textNote.replace(/\n/g, '<br>')}</p>
        </section>
      ` : ''}
      ${entry.voiceTranscript ? `
        <section class="entry-section">
          <h3>Voice note</h3>
          <p class="entry-text entry-text--transcript">${entry.voiceTranscript}</p>
        </section>
      ` : ''}
      ${entry.tags?.length > 0 ? `
        <div class="entry-tags">
          ${entry.tags.map(t => `<span class="tag-chip">${t}</span>`).join('')}
        </div>
      ` : ''}
      ${!entry.textNote && !entry.voiceTranscript && !photoUrls.length ? `
        <p class="empty-state">No content in this entry.</p>
      ` : ''}
    `;

    // Delete
    container.querySelector('#btn-delete').addEventListener('click', async () => {
      if (!confirm('Delete this entry and all its photos?')) return;
      try {
        // Delete photos from storage first
        await Promise.all((entry.photoRefs || []).map(deletePhoto));
        await deleteEntry(user.uid, entryId);
        navigate('/');
      } catch (err) {
        console.error(err);
        alert('Failed to delete entry.');
      }
    });

  } catch (err) {
    detail.innerHTML = `<p class="error">Failed to load entry.</p>`;
    console.error(err);
  }
}
