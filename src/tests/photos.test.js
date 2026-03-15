import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// --- Firebase mocks (vi.hoisted so they're available in hoisted vi.mock factories) ---
const { mockUploadBytes, mockGetDownloadURL, mockDeleteObject, mockRef } = vi.hoisted(() => ({
  mockUploadBytes: vi.fn(),
  mockGetDownloadURL: vi.fn(),
  mockDeleteObject: vi.fn(),
  mockRef: vi.fn((_, path) => ({ fullPath: path })),
}));

vi.mock('../firebase.js', () => ({ storage: {} }));

vi.mock('firebase/storage', () => ({
  ref: mockRef,
  uploadBytes: mockUploadBytes,
  getDownloadURL: mockGetDownloadURL,
  deleteObject: mockDeleteObject,
}));

import { resizeImage, uploadPhoto, uploadPhotos, getPhotoUrl, deletePhoto } from '../services/photos.js';

// --- Canvas / Image / URL mocks ---
let mockCanvasBlob;
let mockImageDimensions;
let capturedCanvas;

beforeEach(() => {
  vi.clearAllMocks();

  mockCanvasBlob = new Blob(['fake-jpeg'], { type: 'image/jpeg' });
  mockImageDimensions = { width: 100, height: 100 };

  const fakeCtx = { drawImage: vi.fn() };
  capturedCanvas = {
    width: 0,
    height: 0,
    getContext: vi.fn(() => fakeCtx),
    toBlob: vi.fn((cb) => cb(mockCanvasBlob)),
  };

  vi.spyOn(document, 'createElement').mockImplementation((tag) => {
    if (tag === 'canvas') return capturedCanvas;
    return document.createElement.wrappedJSObject?.(tag) ?? document.createElementNS('http://www.w3.org/1999/xhtml', tag);
  });

  global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
  global.URL.revokeObjectURL = vi.fn();

  // Mock Image constructor — triggers onload immediately with mocked dimensions
  global.Image = class {
    set src(_url) {
      this.width = mockImageDimensions.width;
      this.height = mockImageDimensions.height;
      Promise.resolve().then(() => this.onload?.());
    }
  };
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('resizeImage', () => {
  it('resolves with a Blob', async () => {
    const result = await resizeImage(new Blob(['img']));
    expect(result).toBeInstanceOf(Blob);
  });

  it('does not upscale images smaller than 1920px', async () => {
    mockImageDimensions = { width: 800, height: 600 };
    await resizeImage(new Blob(['img']));

    expect(capturedCanvas.width).toBe(800);
    expect(capturedCanvas.height).toBe(600);
  });

  it('scales down the longest side to 1920px', async () => {
    mockImageDimensions = { width: 3840, height: 2160 };
    await resizeImage(new Blob(['img']));

    expect(capturedCanvas.width).toBe(1920);
    expect(capturedCanvas.height).toBe(1080);
  });

  it('scales by the longest side (portrait image)', async () => {
    mockImageDimensions = { width: 1080, height: 3840 };
    await resizeImage(new Blob(['img']));

    expect(capturedCanvas.width).toBe(540);
    expect(capturedCanvas.height).toBe(1920);
  });

  it('rejects if canvas.toBlob returns null', async () => {
    capturedCanvas.toBlob = vi.fn((cb) => cb(null));

    await expect(resizeImage(new Blob(['img']))).rejects.toThrow('Canvas toBlob returned null');
  });

  it('rejects if the image fails to load', async () => {
    global.Image = class {
      set src(_url) {
        Promise.resolve().then(() => this.onerror?.());
      }
    };

    await expect(resizeImage(new Blob(['img']))).rejects.toThrow('Failed to load image');
  });

  it('revokes the object URL after load', async () => {
    await resizeImage(new Blob(['img']));
    expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });
});

describe('uploadPhoto', () => {
  it('returns the storage path (fullPath)', async () => {
    mockUploadBytes.mockResolvedValue();

    const path = await uploadPhoto('user1', 'entry1', new Blob(['img']));
    expect(path).toMatch(/^users\/user1\/entries\/entry1\/\d+\.jpg$/);
  });

  it('calls uploadBytes with the resized blob', async () => {
    mockUploadBytes.mockResolvedValue();

    await uploadPhoto('user1', 'entry1', new Blob(['img']));

    expect(mockUploadBytes).toHaveBeenCalledOnce();
    const [, uploadedBlob] = mockUploadBytes.mock.calls[0];
    expect(uploadedBlob).toBe(mockCanvasBlob);
  });
});

describe('uploadPhotos', () => {
  it('calls onProgress for each photo with index and total', async () => {
    mockUploadBytes.mockResolvedValue();
    const onProgress = vi.fn();
    const blobs = [new Blob(['a']), new Blob(['b']), new Blob(['c'])];

    await uploadPhotos('user1', 'entry1', blobs, onProgress);

    expect(onProgress).toHaveBeenCalledTimes(3);
    expect(onProgress).toHaveBeenNthCalledWith(1, 1, 3);
    expect(onProgress).toHaveBeenNthCalledWith(2, 2, 3);
    expect(onProgress).toHaveBeenNthCalledWith(3, 3, 3);
  });

  it('returns paths for all uploaded photos', async () => {
    mockUploadBytes.mockResolvedValue();
    const blobs = [new Blob(['a']), new Blob(['b'])];

    const paths = await uploadPhotos('user1', 'entry1', blobs);

    expect(paths).toHaveLength(2);
    paths.forEach(p => expect(p).toMatch(/^users\/user1\/entries\/entry1\/\d+\.jpg$/));
  });

  it('works without an onProgress callback', async () => {
    mockUploadBytes.mockResolvedValue();
    await expect(uploadPhotos('user1', 'entry1', [new Blob(['a'])])).resolves.toHaveLength(1);
  });
});

describe('getPhotoUrl', () => {
  it('calls getDownloadURL with a ref for the path', async () => {
    mockGetDownloadURL.mockResolvedValue('https://example.com/photo.jpg');

    const url = await getPhotoUrl('users/user1/entries/e1/photo.jpg');

    expect(mockRef).toHaveBeenCalledWith({}, 'users/user1/entries/e1/photo.jpg');
    expect(url).toBe('https://example.com/photo.jpg');
  });
});

describe('deletePhoto', () => {
  it('calls deleteObject with a ref for the path', async () => {
    mockDeleteObject.mockResolvedValue();

    await deletePhoto('users/user1/entries/e1/photo.jpg');

    expect(mockRef).toHaveBeenCalledWith({}, 'users/user1/entries/e1/photo.jpg');
    expect(mockDeleteObject).toHaveBeenCalledOnce();
  });
});
