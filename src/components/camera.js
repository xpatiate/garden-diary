export function createCameraComponent(onPhotos) {
  const wrapper = document.createElement('div');
  wrapper.className = 'camera-component';

  wrapper.innerHTML = `
    <div class="camera-buttons">
      <button type="button" class="btn btn--secondary btn--icon" id="btn-camera">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
          <circle cx="12" cy="13" r="4"/>
        </svg>
        Take photo
      </button>
      <button type="button" class="btn btn--secondary btn--icon" id="btn-gallery">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <polyline points="21 15 16 10 5 21"/>
        </svg>
        Choose from gallery
      </button>
    </div>
    <input type="file" id="input-camera" accept="image/*" capture="environment" style="display:none" />
    <input type="file" id="input-gallery" accept="image/*" multiple style="display:none" />
    <div class="photo-previews" id="photo-previews"></div>
  `;

  const inputCamera = wrapper.querySelector('#input-camera');
  const inputGallery = wrapper.querySelector('#input-gallery');
  const previews = wrapper.querySelector('#photo-previews');

  wrapper.querySelector('#btn-camera').addEventListener('click', () => inputCamera.click());
  wrapper.querySelector('#btn-gallery').addEventListener('click', () => inputGallery.click());

  function handleFiles(files) {
    const blobs = Array.from(files);
    blobs.forEach(blob => {
      const img = document.createElement('img');
      img.src = URL.createObjectURL(blob);
      img.className = 'photo-preview-thumb';
      previews.appendChild(img);
    });
    onPhotos(blobs);
  }

  inputCamera.addEventListener('change', e => { if (e.target.files.length) handleFiles(e.target.files); });
  inputGallery.addEventListener('change', e => { if (e.target.files.length) handleFiles(e.target.files); });

  return wrapper;
}
