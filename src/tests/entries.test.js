import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Firebase mocks (vi.hoisted so they're available in hoisted vi.mock factories) ---
const {
  mockAddDoc, mockUpdateDoc, mockDeleteDoc, mockGetDocs, mockGetDoc,
  mockServerTimestamp, mockCollection, mockDoc, mockQuery, mockOrderBy, mockLimit,
} = vi.hoisted(() => ({
  mockAddDoc: vi.fn(),
  mockUpdateDoc: vi.fn(),
  mockDeleteDoc: vi.fn(),
  mockGetDocs: vi.fn(),
  mockGetDoc: vi.fn(),
  mockServerTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
  mockCollection: vi.fn((_db, ...segments) => ({ _path: segments.join('/') })),
  mockDoc: vi.fn((_db, ...segments) => ({ _path: segments.join('/'), id: segments.at(-1) })),
  mockQuery: vi.fn((col) => ({ _col: col })),
  mockOrderBy: vi.fn(),
  mockLimit: vi.fn(),
}));

vi.mock('../firebase.js', () => ({ db: {} }));

vi.mock('firebase/firestore', () => ({
  collection: mockCollection,
  addDoc: mockAddDoc,
  updateDoc: mockUpdateDoc,
  deleteDoc: mockDeleteDoc,
  doc: mockDoc,
  getDocs: mockGetDocs,
  getDoc: mockGetDoc,
  query: mockQuery,
  orderBy: mockOrderBy,
  limit: mockLimit,
  serverTimestamp: mockServerTimestamp,
}));

import { createEntry, updateEntry, deleteEntry, getEntries, getEntry } from '../services/entries.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createEntry', () => {
  it('calls addDoc with default fields merged with provided data', async () => {
    mockAddDoc.mockResolvedValue({ id: 'new-id' });

    await createEntry('user1', { textNote: 'Hello', date: '2024-01-01' });

    expect(mockAddDoc).toHaveBeenCalledOnce();
    const [, data] = mockAddDoc.mock.calls[0];
    expect(data.textNote).toBe('Hello');
    expect(data.date).toBe('2024-01-01');
    // Defaults applied
    expect(data.voiceTranscript).toBe('');
    expect(data.photoRefs).toEqual([]);
    expect(data.tags).toEqual([]);
    // Timestamps set
    expect(data.createdAt).toBe('SERVER_TIMESTAMP');
    expect(data.updatedAt).toBe('SERVER_TIMESTAMP');
  });

  it('allows caller data to override defaults (except timestamps)', async () => {
    mockAddDoc.mockResolvedValue({ id: 'x' });

    await createEntry('user1', { photoRefs: ['path/to/img.jpg'], tags: ['roses'] });

    const [, data] = mockAddDoc.mock.calls[0];
    expect(data.photoRefs).toEqual(['path/to/img.jpg']);
    expect(data.tags).toEqual(['roses']);
  });

  it('returns the doc ref from addDoc', async () => {
    const ref = { id: 'entry42' };
    mockAddDoc.mockResolvedValue(ref);

    const result = await createEntry('user1', {});
    expect(result).toBe(ref);
  });
});

describe('updateEntry', () => {
  it('calls updateDoc with provided data plus updatedAt', async () => {
    mockUpdateDoc.mockResolvedValue();

    await updateEntry('user1', 'entry1', { textNote: 'Updated text' });

    const [, data] = mockUpdateDoc.mock.calls[0];
    expect(data.textNote).toBe('Updated text');
    expect(data.updatedAt).toBe('SERVER_TIMESTAMP');
  });

  it('targets the correct Firestore path', async () => {
    mockUpdateDoc.mockResolvedValue();

    await updateEntry('user1', 'entry1', {});

    expect(mockDoc).toHaveBeenCalledWith({}, 'users', 'user1', 'entries', 'entry1');
  });
});

describe('deleteEntry', () => {
  it('calls deleteDoc for the correct entry path', async () => {
    mockDeleteDoc.mockResolvedValue();

    await deleteEntry('user1', 'entry1');

    expect(mockDeleteDoc).toHaveBeenCalledOnce();
    expect(mockDoc).toHaveBeenCalledWith({}, 'users', 'user1', 'entries', 'entry1');
  });
});

describe('getEntries', () => {
  it('returns an array of entries with id merged in', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        { id: 'e1', data: () => ({ textNote: 'note 1', tags: ['roses'] }) },
        { id: 'e2', data: () => ({ textNote: 'note 2', tags: [] }) },
      ],
    });

    const entries = await getEntries('user1');

    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual({ id: 'e1', textNote: 'note 1', tags: ['roses'] });
    expect(entries[1]).toEqual({ id: 'e2', textNote: 'note 2', tags: [] });
  });

  it('returns an empty array when there are no entries', async () => {
    mockGetDocs.mockResolvedValue({ docs: [] });

    const entries = await getEntries('user1');
    expect(entries).toEqual([]);
  });

  it('queries the correct collection path', async () => {
    mockGetDocs.mockResolvedValue({ docs: [] });

    await getEntries('user1');

    expect(mockCollection).toHaveBeenCalledWith({}, 'users', 'user1', 'entries');
  });
});

describe('getEntry', () => {
  it('returns null when the entry does not exist', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });

    const result = await getEntry('user1', 'missing');
    expect(result).toBeNull();
  });

  it('returns entry data with id when the entry exists', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      id: 'e1',
      data: () => ({ textNote: 'hello', tags: ['watering'] }),
    });

    const result = await getEntry('user1', 'e1');
    expect(result).toEqual({ id: 'e1', textNote: 'hello', tags: ['watering'] });
  });
});
