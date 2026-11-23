import { validateState, type WorkoutState } from './workout.ts';
export type AccountUser = {
    id: string;
    name: string;
    email: string;
};
export type RefreshStamp = {
    generation: number;
    sequence: number;
    revision: number;
};
export function canApplyRefresh(start: RefreshStamp, current: RefreshStamp & {
    busy: boolean;
}) { return !current.busy && start.generation === current.generation && start.sequence === current.sequence && start.revision === current.revision; }
export function readPending(storage: Pick<Storage, 'getItem'>, userId: string): {
    state: WorkoutState;
    revision: number;
} | null { if (!userId)
    return null; try {
    const value = JSON.parse(storage.getItem('set-pending-' + userId) || 'null');
    return value && validateState(value.state) && Number.isInteger(value.revision) && value.revision >= 0 ? value : null;
}
catch {
    return null;
} }
