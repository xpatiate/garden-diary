import { createEntry, updateEntry } from '../services/entries.js';
import { uploadPhotos } from '../services/photos.js';
import { getPhotoDate, groupPhotosByDate, localDateStr } from '../services/exif.js';
import { navigate } from '../router.js';

function formatGroupDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

export async function renderImport(container, user) {
  container.innerHTML = `
    <div class="view import-view">
      <header class="app-header app-header--back">
        <button class="btn btn--ghost" id="btn-back">← Back</button>
        <h1>Import Photos</h1>
      </header>
      <main class="import-main" id="import-main">
        <div class="import-pick">
          <p class="import-hint">
            Choose photos from your gallery. They'll be grouped into entries by the date each photo was taken.
          </p>
          <input type="file" id="import-file-input" accept="image/*" multiple style="display:none" />
          <button class="btn btn--primary btn--save" id="btn-pick">Choose photos</button>
        </div>
      </main>
    </div>
  `;

  container.querySelector('#btn-back').addEventListener('click', () => navigate('/'));

  const main = container.querySelector('#import-main');
  const fileInput = container.querySelector('#import-file-input');

  container.querySelector('#btn-pick').addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', async () => {
    if (!fileInput.files.length) return;
    await showPreview(Array.from(fileInput.files));
  });

  // ── Preview ──────────────────────────────────────────────────────────────

  async function showPreview(files) {
    main.innerHTML = `<div class="loading">Reading photo dates… (${files.length} photo${files.length !== 1 ? 's' : ''})</div>`;

    const dateResults = await Promise.all(
      files.map(async file => ({ file, date: await getPhotoDate(file) }))
    );

    const { groups, unmatched } = groupPhotosByDate(dateResults);

    let blobUrls = [];
    let unmatchedDate = '';

    function cleanup() {
      blobUrls.forEach(u => URL.revokeObjectURL(u));
      blobUrls = [];
    }

    function renderPreview() {
      cleanup();

      const totalEntries = groups.length + (unmatched.length > 0 ? 1 : 0);
      const canImport = unmatched.length === 0 || !!unmatchedDate;

      main.innerHTML = `
        <div class="import-preview">
          <p class="import-summary">
            ${files.length} photo${files.length !== 1 ? 's' : ''}
            → ${totalEntries} entr${totalEntries !== 1 ? 'ies' : 'y'}
          </p>

          ${groups.map(group => `
            <div class="import-group">
              <div class="import-group-header">
                <span class="import-group-date">${formatGroupDate(group.dateStr)}</span>
                <span class="import-group-count">${group.files.length} photo${group.files.length !== 1 ? 's' : ''}</span>
              </div>
              <div class="import-thumbs" id="thumbs-${group.dateStr}"></div>
            </div>
          `).join('')}

          ${unmatched.length > 0 ? `
            <div class="import-group import-group--unmatched">
              <div class="import-group-header">
                <span class="import-group-date import-group-date--warn">
                  ⚠ ${unmatched.length} photo${unmatched.length !== 1 ? 's' : ''} — date not found
                </span>
              </div>
              <div class="import-thumbs" id="thumbs-unmatched"></div>
              <label class="field-label" style="margin-top:10px">Assign a date for these photos</label>
              <input class="input" type="date" id="unmatched-date" value="${unmatchedDate}" />
            </div>
          ` : ''}

          <div class="import-actions">
            <button class="btn btn--secondary" id="btn-cancel">Cancel</button>
            <button class="btn btn--primary" id="btn-import" ${!canImport ? 'disabled' : ''}>
              Import ${totalEntries} entr${totalEntries !== 1 ? 'ies' : 'y'}
            </button>
          </div>
        </div>
      `;

      // Inject thumbnails via blob URLs (no upload yet)
      function addThumbs(containerId, thumbFiles) {
        const el = main.querySelector(`#${containerId}`);
        if (!el) return;
        thumbFiles.forEach(file => {
          const url = URL.createObjectURL(file);
          blobUrls.push(url);
          const img = document.createElement('img');
          img.src = url;
          img.className = 'import-thumb';
          img.alt = '';
          el.appendChild(img);
        });
      }

      groups.forEach(group => addThumbs(`thumbs-${group.dateStr}`, group.files));
      if (unmatched.length > 0) addThumbs('thumbs-unmatched', unmatched);

      // Unmatched date picker
      main.querySelector('#unmatched-date')?.addEventListener('change', e => {
        unmatchedDate = e.target.value;
        renderPreview();
      });

      main.querySelector('#btn-cancel').addEventListener('click', () => {
        cleanup();
        navigate('/');
      });

      main.querySelector('#btn-import').addEventListener('click', () => {
        cleanup();

        const entriesToCreate = [...groups];
        if (unmatched.length > 0 && unmatchedDate) {
          const [y, m, d] = unmatchedDate.split('-').map(Number);
          entriesToCreate.push({ dateStr: unmatchedDate, date: new Date(y, m - 1, d), files: unmatched });
          entriesToCreate.sort((a, b) => b.date - a.date);
        }

        startImport(entriesToCreate);
      });
    }

    renderPreview();
  }

  // ── Import ───────────────────────────────────────────────────────────────

  async function startImport(entriesToCreate) {
    const items = entriesToCreate.map(g => ({
      ...g, status: 'pending', detail: '',
    }));

    function renderProgress() {
      main.innerHTML = `
        <div class="import-progress-list">
          ${items.map(item => {
            const label = new Date(item.date).toLocaleDateString('en-GB', {
              day: 'numeric', month: 'short', year: 'numeric',
            });
            const icons = { pending: '○', importing: '⟳', done: '✓', error: '✗' };
            return `
              <div class="import-progress-item import-progress-item--${item.status}">
                <span class="import-progress-icon">${icons[item.status]}</span>
                <div class="import-progress-text">
                  <span class="import-progress-label">${label} · ${item.files.length} photo${item.files.length !== 1 ? 's' : ''}</span>
                  ${item.detail ? `<span class="import-progress-detail">${item.detail}</span>` : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    renderProgress();

    let allOk = true;
    for (const item of items) {
      item.status = 'importing';
      renderProgress();
      try {
        const docRef = await createEntry(user.uid, { date: item.date, photoRefs: [] });
        const paths = await uploadPhotos(user.uid, docRef.id, item.files, (i, total) => {
          item.detail = `uploading photo ${i} of ${total}`;
          renderProgress();
        });
        await updateEntry(user.uid, docRef.id, { photoRefs: paths });
        item.status = 'done';
        item.detail = '';
      } catch (err) {
        item.status = 'error';
        item.detail = err.message || 'Upload failed';
        allOk = false;
        console.error(err);
      }
      renderProgress();
    }

    if (allOk) {
      setTimeout(() => navigate('/'), 1000);
    } else {
      main.insertAdjacentHTML('beforeend', `
        <div style="padding:16px;text-align:center">
          <p style="color:var(--danger);margin-bottom:12px">Some entries failed to import.</p>
          <button class="btn btn--primary" id="btn-done">Go to home</button>
        </div>
      `);
      main.querySelector('#btn-done').addEventListener('click', () => navigate('/'));
    }
  }
}
