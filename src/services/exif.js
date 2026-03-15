import { parse } from 'exifr';

// Attempt to extract a date from EXIF metadata
async function dateFromExif(file) {
  try {
    const tags = await parse(file, ['DateTimeOriginal', 'CreateDate', 'DateTime']);
    const d = tags?.DateTimeOriginal ?? tags?.CreateDate ?? tags?.DateTime;
    if (d instanceof Date && !isNaN(d)) return d;
  } catch {
    // exifr throws on non-JPEG or corrupt files — fall through
  }
  return null;
}

// Attempt to extract a date from common photo filename patterns:
//   IMG_20250315_142305.jpg  /  20250315_142305.jpg  /  2025-03-15 14.23.05.jpg
//   Screenshot_20250315-142305.jpg  /  WhatsApp Image 2025-03-15 at ...
function dateFromFilename(name) {
  const match = name.match(/(\d{4})[_\-.]?(\d{2})[_\-.]?(\d{2})/);
  if (!match) return null;
  const [, y, m, d] = match.map(Number);
  if (y < 2000 || y > 2099 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(y, m - 1, d);
  return isNaN(date) ? null : date;
}

// Returns a 'YYYY-MM-DD' string in local time
export function localDateStr(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// Returns the best date found for a file, or null if none
export async function getPhotoDate(file) {
  return (await dateFromExif(file)) ?? dateFromFilename(file.name);
}

// Groups [{file, date}] by local calendar date.
// Returns { groups: [{dateStr, date, files}] sorted newest-first, unmatched: File[] }
export function groupPhotosByDate(dateResults) {
  const map = new Map();
  const unmatched = [];

  for (const { file, date } of dateResults) {
    if (!date) {
      unmatched.push(file);
      continue;
    }
    const key = localDateStr(date);
    if (!map.has(key)) map.set(key, { dateStr: key, date, files: [] });
    map.get(key).files.push(file);
  }

  const groups = [...map.values()].sort((a, b) => b.date - a.date);
  return { groups, unmatched };
}
