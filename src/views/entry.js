import { getEntry, updateEntry, deleteEntry, getEntries } from '../services/entries.js';
import { getPhotoUrl, uploadPhotos, deletePhoto } from '../services/photos.js';
import { createCameraComponent } from '../components/camera.js';
import { createTagInput } from '../components/tag-input.js';
import { navigate } from '../router.js';

function formatDate(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function tsToInputDate(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toISOString().slice(0, 10);
}

export async function renderEntry(container, user, entryId) {
  container.innerHTML = `
    <div class="view entry-view">
      <header class="app-header app-header--back">
        <button class="btn btn--ghost" id="btn-back">← Back</button>
        <h1>Entry</h1>
        <div style="display:flex;gap:4px">
          <button class="btn btn--ghost" id="btn-edit">Edit</button>
          <button class="btn btn--ghost btn--danger" id="btn-delete">Delete</button>
        </div>
      </header>
      <main class="entry-detail" id="entry-detail">
        <div class="loading">Loading…</div>
      </main>
    </div>
  `;

  const backRoute = sessionStorage.getItem('entryBack') || '/';
  sessionStorage.removeItem('entryBack');
  container.querySelector('#btn-back').addEventListener('click', () => navigate(backRoute));

  const detail = container.querySelector('#entry-detail');

  let entry, photoUrls;

  try {
    entry = await getEntry(user.uid, entryId);
    if (!entry) {
      detail.innerHTML = `<p class="error">Entry not found.</p>`;
      return;
    }
    photoUrls = entry.photoRefs?.length
      ? await Promise.all(entry.photoRefs.map(getPhotoUrl))
      : [];
  } catch (err) {
    detail.innerHTML = `<p class="error">Failed to load entry.</p>`;
    console.error(err);
    return;
  }

  container.querySelector('#btn-edit').addEventListener('click', () => {
    renderEdit(detail, entry, photoUrls, user, entryId, (updated, updatedUrls) => {
      entry = updated;
      photoUrls = updatedUrls;
      renderView(detail, entry, photoUrls);
    });
  });

  container.querySelector('#btn-delete').addEventListener('click', async () => {
    if (!confirm('Delete this entry and all its photos?')) return;
    try {
      await Promise.all((entry.photoRefs || []).map(deletePhoto));
      await deleteEntry(user.uid, entryId);
      navigate('/');
    } catch (err) {
      console.error(err);
      alert('Failed to delete entry.');
    }
  });

  renderView(detail, entry, photoUrls);
}

export function openLightbox(urls, startIndex) {
  let current = startIndex;

  const lb = document.createElement('div');
  lb.className = 'lightbox';
  lb.innerHTML = `
    <button class="lightbox-close" aria-label="Close">&#x2715;</button>
    ${urls.length > 1 ? `<button class="lightbox-prev" aria-label="Previous">&#8249;</button>` : ''}
    <div class="lightbox-img-wrap">
      <img class="lightbox-img" src="${urls[current]}" alt="" />
    </div>
    ${urls.length > 1 ? `<button class="lightbox-next" aria-label="Next">&#8250;</button>` : ''}
    ${urls.length > 1 ? `<div class="lightbox-counter"></div>` : ''}
  `;

  const img = lb.querySelector('.lightbox-img');
  const counter = lb.querySelector('.lightbox-counter');

  function show(index) {
    current = (index + urls.length) % urls.length;
    img.src = urls[current];
    if (counter) counter.textContent = `${current + 1} / ${urls.length}`;
  }

  function close() {
    lb.remove();
    document.removeEventListener('keydown', onKey);
  }

  function onKey(e) {
    if (e.key === 'Escape')      close();
    if (e.key === 'ArrowLeft')   show(current - 1);
    if (e.key === 'ArrowRight')  show(current + 1);
  }

  lb.querySelector('.lightbox-close').addEventListener('click', close);
  lb.querySelector('.lightbox-prev')?.addEventListener('click', () => show(current - 1));
  lb.querySelector('.lightbox-next')?.addEventListener('click', () => show(current + 1));

  // Tap the dark backdrop (not the image or buttons) to close
  lb.addEventListener('click', e => { if (e.target === lb) close(); });

  document.addEventListener('keydown', onKey);
  show(current);

  document.getElementById('app').appendChild(lb);
}

function renderView(detail, entry, photoUrls) {
  detail.innerHTML = `
    <h2 class="entry-date">${formatDate(entry.date)}</h2>
    ${photoUrls.length > 0 ? `
      <div class="photo-grid">
        ${photoUrls.map((url, i) => `
          <img class="photo-thumb photo-thumb--tap" src="${url}" alt="Garden photo ${i + 1}" loading="lazy" data-index="${i}" />
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

  detail.querySelectorAll('.photo-thumb--tap').forEach(img => {
    img.addEventListener('click', () => openLightbox(photoUrls, Number(img.dataset.index)));
  });
}

function renderEdit(detail, entry, photoUrls, user, entryId, onSaved) {
  // Track mutations
  const deletedRefs = new Set();
  const newPhotos = [];
  let currentPhotoUrls = [...photoUrls];
  let tags = [...(entry.tags || [])];

  detail.innerHTML = `
    <div class="new-entry-form">
      <label class="field-label" for="edit-date">Date</label>
      <input class="input" type="date" id="edit-date" value="${tsToInputDate(entry.date)}" />

      <label class="field-label">Photos</label>
      <div id="edit-existing-photos" class="edit-existing-photos"></div>
      <div id="camera-slot"></div>

      <label class="field-label" for="edit-text">Text note</label>
      <textarea class="input textarea" id="edit-text" rows="5">${entry.textNote || ''}</textarea>

      <label class="field-label" for="edit-voice">Voice transcript</label>
      <textarea class="input textarea" id="edit-voice" rows="4">${entry.voiceTranscript || ''}</textarea>

      <label class="field-label">Tags</label>
      <div id="tag-slot"></div>

      <div style="display:flex;gap:10px;margin-top:8px">
        <button class="btn btn--secondary btn--save" id="btn-cancel">Cancel</button>
        <button class="btn btn--primary btn--save" id="btn-save">Save changes</button>
      </div>
      <p class="save-error" id="save-error"></p>
    </div>
  `;

  // Render existing photos with delete buttons
  function renderExistingPhotos() {
    const el = detail.querySelector('#edit-existing-photos');
    if (currentPhotoUrls.length === 0) { el.innerHTML = ''; return; }
    el.innerHTML = `
      <div class="photo-grid photo-grid--edit">
        ${currentPhotoUrls.map((url, i) => `
          <div class="photo-thumb-wrap">
            <img class="photo-thumb" src="${url}" alt="Photo ${i + 1}" />
            <button type="button" class="photo-delete-btn" data-index="${i}" aria-label="Remove photo">×</button>
          </div>
        `).join('')}
      </div>
    `;
    el.querySelectorAll('.photo-delete-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const i = Number(btn.dataset.index);
        deletedRefs.add(entry.photoRefs[i]);
        entry.photoRefs.splice(i, 1);
        currentPhotoUrls.splice(i, 1);
        renderExistingPhotos();
      });
    });
  }
  renderExistingPhotos();

  // Camera component for new photos
  const camera = createCameraComponent(blobs => newPhotos.push(...blobs));
  detail.querySelector('#camera-slot').appendChild(camera);

  // Tag input pre-populated
  const tagComponent = createTagInput(t => { tags = t; }, entry.tags || []);
  detail.querySelector('#tag-slot').appendChild(tagComponent);

  // Populate tag suggestions from existing entries (non-blocking)
  getEntries(user.uid).then(entries => {
    const allTags = [...new Set(entries.flatMap(e => e.tags || []))].sort();
    if (allTags.length) tagComponent.setSuggestions(allTags);
  }).catch(() => {});

  detail.querySelector('#btn-cancel').addEventListener('click', () => {
    renderView(detail, entry, photoUrls);
  });

  detail.querySelector('#btn-save').addEventListener('click', async () => {
    const saveBtn = detail.querySelector('#btn-save');
    const errorEl = detail.querySelector('#save-error');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';
    errorEl.textContent = '';

    try {
      // Delete removed photos from storage
      await Promise.all([...deletedRefs].map(deletePhoto));

      // Upload new photos
      let newRefs = [];
      if (newPhotos.length > 0) {
        newRefs = await uploadPhotos(user.uid, entryId, newPhotos, (i, total) => {
          saveBtn.textContent = `Uploading photo ${i}/${total}…`;
        });
      }

      const updatedData = {
        date: new Date(detail.querySelector('#edit-date').value),
        textNote: detail.querySelector('#edit-text').value.trim(),
        voiceTranscript: detail.querySelector('#edit-voice').value.trim(),
        tags,
        photoRefs: [...entry.photoRefs, ...newRefs],
      };

      await updateEntry(user.uid, entryId, updatedData);

      // Build updated entry and photo URLs for view mode
      const updatedEntry = { ...entry, ...updatedData };
      const updatedUrls = updatedEntry.photoRefs.length
        ? await Promise.all(updatedEntry.photoRefs.map(getPhotoUrl))
        : [];

      onSaved(updatedEntry, updatedUrls);
    } catch (err) {
      console.error(err);
      errorEl.textContent = `Failed: ${err.code || err.message}`;
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save changes';
    }
  });
}
