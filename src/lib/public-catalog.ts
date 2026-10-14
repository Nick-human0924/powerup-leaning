import { sortUnits } from './catalog';
import { validateReferences, type Snapshot } from './schema';

export const PUBLIC_CATALOG_REVISION_ID = 'public-demo-catalog-v2';
const unitIds = ['DEMO-U0-HELLO', 'DEMO-U1', 'DEMO-U2', 'DEMO-U3', 'DEMO-UNIT-DAILY', 'DEMO-U5', 'DEMO-U6', 'DEMO-U7'];

export function isPublicCatalogCurrent(snapshot: Snapshot): boolean {
  return snapshot.audit.some(row => row.id === PUBLIC_CATALOG_REVISION_ID)
    && unitIds.every((id, order) => snapshot.units.some(unit => unit.id === id && unit.order === order));
}

// Public releases only add educational content. Existing evidence, edits and local
// imports are retained, including records referencing the first four demo skills.
export function reconcilePublicSeed(existingInput: Snapshot, incomingInput: Snapshot): Snapshot {
  const existing = validateReferences(existingInput);
  const incoming = validateReferences(incomingInput);
  if (!isPublicCatalogCurrent(incoming)) throw new Error('Public catalog release is incomplete.');
  if (isPublicCatalogCurrent(existing)) return structuredClone(existing);
  if (['lessons', 'sessions', 'observations', 'notes', 'audio', 'jobs'].some(key => incoming[key as keyof Snapshot].length)) {
    throw new Error('Public catalog must not contain personal history.');
  }
  const result = structuredClone(existing);
  for (const name of ['materials', 'assets', 'pages', 'units', 'sections', 'skills', 'tasks', 'audit'] as const) {
    const target = result[name] as Array<{ id: string }>;
    const known = new Set(target.map(row => row.id));
    for (const row of incoming[name]) if (!known.has(row.id)) {
      target.push(structuredClone(row)); known.add(row.id);
    }
  }
  for (const unit of incoming.units) {
    const current = result.units.find(row => row.id === unit.id)!;
    current.order = unit.order;
    // The v1 daily sample becomes Unit 4. Keep its ID and all linked evidence.
    if (unit.id === 'DEMO-UNIT-DAILY') {
      current.title = unit.title;
      current.reference_outline = structuredClone(unit.reference_outline);
    }
  }
  result.units = sortUnits(result.units);
  return validateReferences(result);
}
