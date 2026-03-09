import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../firebase.js';

const MAX_PX = 1920;
const JPEG_QUALITY = 0.85;

export function resizeImage(blob) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Failed to load image')); };
    img.onload = () => {
      const scale = Math.min(1, MAX_PX / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob(result => {
        if (result) resolve(result);
        else reject(new Error('Canvas toBlob returned null'));
      }, 'image/jpeg', JPEG_QUALITY);
    };
    img.src = url;
  });
}

export async function uploadPhoto(userId, entryId, blob) {
  const resized = await resizeImage(blob);
  const filename = `${Date.now()}.jpg`;
  const photoRef = ref(storage, `users/${userId}/entries/${entryId}/${filename}`);
  await uploadBytes(photoRef, resized);
  return photoRef.fullPath;
}

export async function uploadPhotos(userId, entryId, blobs, onProgress) {
  const paths = [];
  for (let i = 0; i < blobs.length; i++) {
    if (onProgress) onProgress(i + 1, blobs.length);
    paths.push(await uploadPhoto(userId, entryId, blobs[i]));
  }
  return paths;
}

export function getPhotoUrl(path) {
  return getDownloadURL(ref(storage, path));
}

export async function deletePhoto(path) {
  return deleteObject(ref(storage, path));
}
