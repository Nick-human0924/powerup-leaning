import initialReference from '../../schemas/initial-reference.json';
import { snapshotSchema, type Snapshot } from './schema';

export const seedSnapshot: Snapshot = snapshotSchema.parse(initialReference);

export function createSeedSnapshot(): Snapshot {
  return structuredClone(seedSnapshot);
}
