import { createEntry, updateEntry, getEntries } from '../services/entries.js';
import { uploadPhotos } from '../services/photos.js';
import { createCameraComponent } from '../components/camera.js';
import { createVoiceRecorder } from '../components/voice-recorder.js';
import { createTagInput } from '../components/tag-input.js';
import { navigate } from '../router.js';

export async function renderNewEntry(container, user) {
  const today = new Date().toISOString().slice(0, 10);

  container.innerHTML = `
    <div class="view new-entry-view">
      <header class="app-header app-header--back">
        <button class="btn btn--ghost" id="btn-back">← Back</button>
        <h1>New Entry</h1>
      </header>
      <main class="new-entry-form">
        <label class="field-label" for="entry-date">Date</label>
        <input class="input" type="date" id="entry-date" value="${today}" />

        <label class="field-label">Photos</label>
        <div id="camera-slot"></div>
        <button type="button" class="btn--import-link" id="btn-import-link">
          Import multiple photos by date →
        </button>

        <label class="field-label" for="text-note">Text note</label>
        <textarea class="input textarea" id="text-note" placeholder="What happened in the garden today?" rows="5"></textarea>

        <label class="field-label">Voice note</label>
        <div id="voice-slot"></div>

        <label class="field-label">Tags</label>
        <div id="tag-slot"></div>

        <button class="btn btn--primary btn--save" id="btn-save">Save entry</button>
        <p class="save-error" id="save-error"></p>
      </main>
    </div>
  `;

  container.querySelector('#btn-back').addEventListener('click', () => navigate('/'));
  container.querySelector('#btn-import-link').addEventListener('click', () => navigate('/import'));

  // State
  const pendingPhotos = [];
  let voiceTranscript = '';
  let tags = [];

  // Camera component
  const cameraComponent = createCameraComponent(blobs => pendingPhotos.push(...blobs));
  container.querySelector('#camera-slot').appendChild(cameraComponent);

  // Voice recorder
  const voiceComponent = createVoiceRecorder(text => { voiceTranscript = text; });
  container.querySelector('#voice-slot').appendChild(voiceComponent);

  // Tags
  const tagComponent = createTagInput(t => { tags = t; });
  container.querySelector('#tag-slot').appendChild(tagComponent);

  // Populate tag suggestions from existing entries (non-blocking)
  getEntries(user.uid).then(entries => {
    const allTags = [...new Set(entries.flatMap(e => e.tags || []))].sort();
    if (allTags.length) tagComponent.setSuggestions(allTags);
  }).catch(() => {});

  // Save
  container.querySelector('#btn-save').addEventListener('click', async () => {
    const saveBtn = container.querySelector('#btn-save');
    const errorEl = container.querySelector('#save-error');
    const dateVal = container.querySelector('#entry-date').value;
    const textNote = container.querySelector('#text-note').value.trim();

    saveBtn.disabled = true;
    errorEl.textContent = '';

    try {
      saveBtn.textContent = 'Saving…';
      const docRef = await createEntry(user.uid, {
        date: new Date(dateVal),
        textNote,
        voiceTranscript,
        tags,
        photoRefs: [],
      });

      if (pendingPhotos.length > 0) {
        const paths = await uploadPhotos(user.uid, docRef.id, pendingPhotos, (i, total) => {
          saveBtn.textContent = `Uploading photo ${i}/${total}…`;
        });
        await updateEntry(user.uid, docRef.id, { photoRefs: paths });
      }
      navigate('/');
    } catch (err) {
      console.error(err);
      errorEl.textContent = `Failed: ${err.code || err.message}`;
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save entry';
    }
  });
}
