import { validateReferences, type Snapshot, type Unit } from './schema';

export const CATALOG_REVISION_ID = 'catalog-v2';
export const TEXTBOOK_REVISION_ID = 'textbook-v1';
const catalogOrders: Record<string, number> = { 'PU1-U0-HELLO': 0, 'PU1-U1': 1, 'PU1-U2': 2, 'PU1-U3': 3, 'PU1-U4': 4, 'PU1-U5': 5, 'PU1-U6': 6, 'PU1-U7': 7 };
const pendingOutlineIds = new Set(['PU1-U0-HELLO', 'PU1-U1', 'PU1-U2', 'PU1-U3', 'PU1-U5', 'PU1-U6', 'PU1-U7']);

export function isCatalogCurrent(snapshot: Snapshot): boolean {
  if (!snapshot.audit.some((entry) => entry.id === CATALOG_REVISION_ID)) return false;
  return Object.entries(catalogOrders).every(([id, order]) => {
    const unit = snapshot.units.find((item) => item.id === id);
    return Boolean(unit && unit.order === order && (!pendingOutlineIds.has(id) || unit.reference_outline));
  });
}

export function isTextbookCurrent(snapshot: Snapshot): boolean {
  if (!snapshot.audit.some((entry) => entry.id === TEXTBOOK_REVISION_ID)) return false;
  const importedAssets = snapshot.assets.filter((asset) => asset.storage_ref.startsWith('local-file:Pupil_s Book_'));
  const importedPages = snapshot.pages.filter((page) => importedAssets.some((asset) => asset.id === page.asset_id));
  const requiredFiles = ['1-10', '11-20', '21-30', '31-40', '41-50', '51-60', '61-70', '71-80', '81-90'];
  if (!requiredFiles.every((range) => importedAssets.some((asset) => asset.filename.includes(`_${range}.pdf`)))) return false;
  if (importedPages.length < 90) return false;
  return Object.keys(catalogOrders).every((id) => {
    const unit = snapshot.units.find((item) => item.id === id);
    return Boolean(unit?.review_status === 'verified' && unit.source_page_ids.length > 0 && unit.reference_outline);
  });
}

export function isSeedCurrent(snapshot: Snapshot): boolean {
  return isCatalogCurrent(snapshot) && isTextbookCurrent(snapshot);
}

export function unitOrder(unit: Unit): number {
  if (unit.order !== undefined) return unit.order;
  if (/hello/i.test(unit.id) || /^hello$/i.test(unit.title)) return 0;
  const match = unit.id.match(/-U(\d+)(?:-|$)/i);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

export function sortUnits<T extends Unit>(units: readonly T[]): T[] {
  return [...units].sort((a, b) => unitOrder(a) - unitOrder(b) || a.title.localeCompare(b.title, 'en'));
}

export function reconcileSeed(existingInput: Snapshot, incomingInput: Snapshot): Snapshot {
  const existing = validateReferences(existingInput);
  const incoming = validateReferences(incomingInput);
  const catalogRevision = incoming.audit.find((entry) => entry.id === CATALOG_REVISION_ID);
  const textbookRevision = incoming.audit.find((entry) => entry.id === TEXTBOOK_REVISION_ID);
  if (!catalogRevision) throw new Error(`Incoming seed is missing ${CATALOG_REVISION_ID}`);
  const needsCatalog = !isCatalogCurrent(existing);
  const needsTextbook = Boolean(textbookRevision) && !isTextbookCurrent(existing);
  if (!needsCatalog && !needsTextbook) return structuredClone(existing);

  const result = structuredClone(existing);
  const knownUnit = (id: string) => /^PU1-U(?:0-HELLO|[1-7])$/.test(id);
  const incomingMaterials = new Set(incoming.units.filter((unit) => knownUnit(unit.id)).map((unit) => unit.material_id));

  for (const material of incoming.materials) {
    if (incomingMaterials.has(material.id) && !result.materials.some((row) => row.id === material.id)) result.materials.push(structuredClone(material));
  }
  for (const sourceUnit of sortUnits(incoming.units.filter((unit) => knownUnit(unit.id)))) {
    const current = result.units.find((unit) => unit.id === sourceUnit.id);
    if (!current) result.units.push(structuredClone(sourceUnit));
    else {
      current.order = sourceUnit.order;
      current.reference_outline = sourceUnit.reference_outline ? structuredClone(sourceUnit.reference_outline) : undefined;
      if (needsTextbook && sourceUnit.review_status === 'verified') {
        current.title = sourceUnit.title;
        current.printed_page_range = sourceUnit.printed_page_range;
        current.source_page_ids = [...new Set([...current.source_page_ids, ...sourceUnit.source_page_ids])];
        current.review_status = 'verified';
      } else if (current.review_status === 'pending' && current.printed_page_range === null) current.printed_page_range = sourceUnit.printed_page_range;
    }
  }

  const addMissing = <T extends { id: string }>(target: T[], source: readonly T[], allowed: (row: T) => boolean) => {
    const ids = new Set(target.map((row) => row.id));
    for (const row of source) if (allowed(row) && !ids.has(row.id)) { target.push(structuredClone(row)); ids.add(row.id); }
  };
  addMissing(result.assets, incoming.assets, (row) => incomingMaterials.has(row.material_id));
  addMissing(result.pages, incoming.pages, (row) => !row.unit_id || knownUnit(row.unit_id));
  addMissing(result.sections, incoming.sections, (row) => knownUnit(row.unit_id));
  for (const sourceSkill of incoming.skills.filter((row) => knownUnit(row.unit_id))) {
    const current = result.skills.find((row) => row.id === sourceSkill.id);
    if (!current) {
      result.skills.push(structuredClone(sourceSkill));
    } else if (needsTextbook && current.version < 2 && sourceSkill.review_status === 'verified') {
      Object.assign(current, structuredClone(sourceSkill));
    }
  }
  const knownSkillIds = new Set(incoming.skills.filter((skill) => knownUnit(skill.unit_id)).map((skill) => skill.id));
  addMissing(result.tasks, incoming.tasks, (row) => row.skill_ids.every((id) => knownSkillIds.has(id)));
  addMissing(result.jobs, incoming.jobs, (row) => row.id === 'textbook-import-2026-10-14');
  result.units = sortUnits(result.units);
  if (!result.audit.some((entry) => entry.id === CATALOG_REVISION_ID)) result.audit.push(structuredClone(catalogRevision));
  if (textbookRevision && !result.audit.some((entry) => entry.id === TEXTBOOK_REVISION_ID)) result.audit.push(structuredClone(textbookRevision));
  return validateReferences(result);
}
