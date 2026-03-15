import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock exifr — EXIF parsing is tested separately; we control its output here
vi.mock('exifr', () => ({
  parse: vi.fn(),
}));

import { parse } from 'exifr';
import { getPhotoDate, groupPhotosByDate, localDateStr } from '../services/exif.js';

function makeFile(name, type = 'image/jpeg') {
  return new File(['img'], name, { type });
}

beforeEach(() => vi.clearAllMocks());

// ── localDateStr ──────────────────────────────────────────────

describe('localDateStr', () => {
  it('formats a date as YYYY-MM-DD in local time', () => {
    expect(localDateStr(new Date(2025, 2, 15))).toBe('2025-03-15');
  });

  it('pads single-digit months and days', () => {
    expect(localDateStr(new Date(2025, 0, 5))).toBe('2025-01-05');
  });
});

// ── getPhotoDate — EXIF ───────────────────────────────────────

describe('getPhotoDate — EXIF', () => {
  it('returns DateTimeOriginal when present', async () => {
    const date = new Date(2025, 2, 15, 10, 30);
    parse.mockResolvedValue({ DateTimeOriginal: date });

    const result = await getPhotoDate(makeFile('photo.jpg'));
    expect(result).toEqual(date);
  });

  it('falls back to CreateDate if DateTimeOriginal is absent', async () => {
    const date = new Date(2025, 2, 10);
    parse.mockResolvedValue({ CreateDate: date });

    const result = await getPhotoDate(makeFile('photo.jpg'));
    expect(result).toEqual(date);
  });

  it('falls back to DateTime if the others are absent', async () => {
    const date = new Date(2025, 1, 20);
    parse.mockResolvedValue({ DateTime: date });

    const result = await getPhotoDate(makeFile('photo.jpg'));
    expect(result).toEqual(date);
  });

  it('falls back to filename parsing if EXIF returns no date', async () => {
    parse.mockResolvedValue({});

    const result = await getPhotoDate(makeFile('IMG_20250315_142305.jpg'));
    expect(result).toEqual(new Date(2025, 2, 15));
  });

  it('falls back to filename parsing if EXIF throws', async () => {
    parse.mockRejectedValue(new Error('not a jpeg'));

    const result = await getPhotoDate(makeFile('20250315_142305.jpg'));
    expect(result).toEqual(new Date(2025, 2, 15));
  });

  it('returns null if EXIF throws and filename has no date', async () => {
    parse.mockRejectedValue(new Error('not a jpeg'));

    const result = await getPhotoDate(makeFile('DSC_1234.jpg'));
    expect(result).toBeNull();
  });
});

// ── getPhotoDate — filename parsing ───────────────────────────

describe('getPhotoDate — filename patterns', () => {
  beforeEach(() => parse.mockResolvedValue({}));

  const cases = [
    ['IMG_20250315_142305.jpg',              new Date(2025, 2, 15)],
    ['20250315_142305.jpg',                  new Date(2025, 2, 15)],
    ['2025-03-15 14.23.05.jpg',             new Date(2025, 2, 15)],
    ['2025-03-15_14-23-05.jpg',             new Date(2025, 2, 15)],
    ['Screenshot_20250315-142305.jpg',       new Date(2025, 2, 15)],
    ['WhatsApp Image 2025-03-15 at 14.jpg', new Date(2025, 2, 15)],
  ];

  cases.forEach(([filename, expected]) => {
    it(`parses date from "${filename}"`, async () => {
      const result = await getPhotoDate(makeFile(filename));
      expect(result).toEqual(expected);
    });
  });

  it('returns null for a filename with no recognisable date', async () => {
    expect(await getPhotoDate(makeFile('DSC_1234.jpg'))).toBeNull();
    expect(await getPhotoDate(makeFile('photo.jpg'))).toBeNull();
  });

  it('rejects years outside 2000–2099', async () => {
    expect(await getPhotoDate(makeFile('19991231_photo.jpg'))).toBeNull();
  });
});

// ── groupPhotosByDate ─────────────────────────────────────────

describe('groupPhotosByDate', () => {
  const f1 = makeFile('a.jpg');
  const f2 = makeFile('b.jpg');
  const f3 = makeFile('c.jpg');
  const f4 = makeFile('d.jpg');

  it('groups files by calendar date', () => {
    const { groups, unmatched } = groupPhotosByDate([
      { file: f1, date: new Date(2025, 2, 15) },
      { file: f2, date: new Date(2025, 2, 15) },
      { file: f3, date: new Date(2025, 2, 10) },
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0].dateStr).toBe('2025-03-15');
    expect(groups[0].files).toEqual([f1, f2]);
    expect(groups[1].dateStr).toBe('2025-03-10');
    expect(groups[1].files).toEqual([f3]);
    expect(unmatched).toHaveLength(0);
  });

  it('sorts groups newest-first', () => {
    const { groups } = groupPhotosByDate([
      { file: f1, date: new Date(2025, 0, 1) },
      { file: f2, date: new Date(2025, 5, 15) },
      { file: f3, date: new Date(2025, 2, 10) },
    ]);

    expect(groups.map(g => g.dateStr)).toEqual(['2025-06-15', '2025-03-10', '2025-01-01']);
  });

  it('puts files with no date in unmatched', () => {
    const { groups, unmatched } = groupPhotosByDate([
      { file: f1, date: new Date(2025, 2, 15) },
      { file: f2, date: null },
      { file: f3, date: null },
    ]);

    expect(groups).toHaveLength(1);
    expect(unmatched).toEqual([f2, f3]);
  });

  it('returns empty groups and all unmatched when no dates found', () => {
    const { groups, unmatched } = groupPhotosByDate([
      { file: f1, date: null },
      { file: f2, date: null },
    ]);

    expect(groups).toHaveLength(0);
    expect(unmatched).toEqual([f1, f2]);
  });

  it('handles an empty input', () => {
    const { groups, unmatched } = groupPhotosByDate([]);
    expect(groups).toHaveLength(0);
    expect(unmatched).toHaveLength(0);
  });

  it('preserves the representative date on each group', () => {
    const date = new Date(2025, 2, 15, 14, 0);
    const { groups } = groupPhotosByDate([{ file: f1, date }]);
    expect(groups[0].date).toEqual(date);
  });
});
