import Dexie, { type EntityTable } from 'dexie';
import { CATALOG_REVISION_ID, isSeedCurrent, reconcileSeed } from './catalog';
import { migrateBackup } from './migrations';
import { snapshotSchema, validateReferences, type Snapshot } from './schema';
import { appPath, publicDemo } from './runtime';
import { isPublicCatalogCurrent, reconcilePublicSeed } from './public-catalog';

type SnapshotRow = { key: 'current'; value: Snapshot };
type BlobRow = { id: string; blob: Blob };

class CompanionDatabase extends Dexie {
  snapshots!: EntityTable<SnapshotRow, 'key'>;
  blobs!: EntityTable<BlobRow, 'id'>;
  constructor() {
    super(publicDemo ? 'english-companion-public-demo' : 'andy-english-companion');
    this.version(1).stores({ snapshots: '&key', blobs: '&id' });
  }
}

let database: CompanionDatabase | undefined;
let queue: Promise<unknown> = Promise.resolve();
let initialSeedRequest: Promise<Snapshot> | undefined;

function getDatabase(): CompanionDatabase {
  if (typeof indexedDB === 'undefined') throw new Error('IndexedDB is unavailable; local learning data cannot be stored safely.');
  database ??= new CompanionDatabase();
  return database;
}

function serialized<T>(operation: () => Promise<T>): Promise<T> {
  const result = queue.then(operation, operation);
  queue = result.then(() => undefined, () => undefined);
  return result;
}

async function fetchInitialSeed(): Promise<Snapshot> {
  initialSeedRequest ??= (async () => {
    const response = await fetch(appPath('/seed.json'), { cache: 'no-store' });
    if (!response.ok) throw new Error(`Initial learning data could not be loaded (${response.status}).`);
    let input: unknown;
    try { input = await response.json(); } catch { throw new Error('Initial learning data is not valid JSON.'); }
    return validateReferences(snapshotSchema.parse(input));
  })();
  const request = initialSeedRequest;
  try { return await request; }
  catch (error) { if (initialSeedRequest === request) initialSeedRequest = undefined; throw error; }
}

async function readOrInitialize(db: CompanionDatabase): Promise<Snapshot> {
  const existing = await db.snapshots.get('current');
  if (existing) {
    const current = validateReferences(existing.value);
    const isCurrent = publicDemo ? isPublicCatalogCurrent : isSeedCurrent;
    if (isCurrent(current)) return current;
    let seed: Snapshot;
    try { seed = await fetchInitialSeed(); } catch { return current; }
    // Local textbook and public original content have separate release markers.
    if (publicDemo ? !isPublicCatalogCurrent(seed) : !seed.audit.some(entry=>entry.id===CATALOG_REVISION_ID)) return current;
    return db.transaction('rw', db.snapshots, async () => {
      const latestRow = await db.snapshots.get('current');
      if (!latestRow) throw new Error('Snapshot disappeared during catalog reconciliation');
      const latest = validateReferences(latestRow.value);
      if (isCurrent(latest)) return latest;
      const upgraded = publicDemo ? reconcilePublicSeed(latest, seed) : reconcileSeed(latest, seed);
      await db.snapshots.put({ key: 'current', value: upgraded });
      return upgraded;
    });
  }
  const seed = await fetchInitialSeed();
  await db.transaction('rw', db.snapshots, async () => {
    const raced = await db.snapshots.get('current');
    if (!raced) await db.snapshots.put({ key: 'current', value: seed });
  });
  return validateReferences((await db.snapshots.get('current'))?.value ?? seed);
}

export function loadSnapshot(): Promise<Snapshot> {
  return serialized(async () => structuredClone(await readOrInitialize(getDatabase())));
}

export function mutateSnapshot(fn: (draft: Snapshot) => void): Promise<Snapshot> {
  return serialized(async () => {
    const db = getDatabase();
    await readOrInitialize(db);
    return db.transaction('rw', db.snapshots, async () => {
      const row = await db.snapshots.get('current');
      if (!row) throw new Error('Snapshot disappeared during transaction');
      const draft = structuredClone(row.value);
      fn(draft);
      const validated = validateReferences(draft);
      await db.snapshots.put({ key: 'current', value: validated });
      return structuredClone(validated);
    });
  });
}

const collections: Array<keyof Omit<Snapshot, 'schema_version'>> = ['materials', 'assets', 'pages', 'units', 'sections', 'skills', 'tasks', 'lessons', 'sessions', 'observations', 'notes', 'audio', 'jobs', 'audit'];

export function mergeBackup(input: unknown): Promise<Snapshot> {
  return serialized(async () => {
    const db = getDatabase();
    const current = await readOrInitialize(db);
    const imported = migrateBackup(input, current);
    return db.transaction('rw', db.snapshots, async () => {
      const latest = validateReferences((await db.snapshots.get('current'))?.value ?? current);
      const merged = structuredClone(latest) as Snapshot;
      for (const name of collections) {
        const target = merged[name] as Array<{ id: string }>;
        const known = new Set(target.map((row) => row.id));
        for (const row of imported[name] as Array<{ id: string }>) if (!known.has(row.id)) { target.push(structuredClone(row)); known.add(row.id); }
      }
      const validated = validateReferences(merged);
      await db.snapshots.put({ key: 'current', value: validated });
      return structuredClone(validated);
    });
  });
}

export function saveBlob(id: string, blob: Blob): Promise<void> {
  if (!id) return Promise.reject(new Error('Blob id is required'));
  return serialized(async () => { await getDatabase().blobs.put({ id, blob }); });
}

export function getBlob(id: string): Promise<Blob | undefined> {
  return serialized(async () => (await getDatabase().blobs.get(id))?.blob);
}

export function deleteBlob(id: string): Promise<void> {
  return serialized(async () => { await getDatabase().blobs.delete(id); });
}

export function clearAll(): Promise<void> {
  return serialized(async () => {
    const db = getDatabase();
    await db.transaction('rw', db.snapshots, db.blobs, async () => { await db.snapshots.clear(); await db.blobs.clear(); });
  });
}
