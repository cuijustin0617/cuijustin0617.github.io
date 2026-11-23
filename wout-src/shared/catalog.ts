import raw from '../data/exercise-catalog.runtime.json';
import type { Exercise } from './workout.ts';

/** Exact runtime catalog (already includes the CMU Chest Press enrichment). IDs are immutable. */
export const catalog = raw as unknown as Exercise[];
export const exerciseById = new Map(catalog.map(e => [e.id, e]));
