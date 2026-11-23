import { emptyState, validateState, type WorkoutState } from '../shared/workout.ts';
type Database = {
    prepare(sql: string): {
        bind(...args: any[]): {
            first(): Promise<any>;
            run(): Promise<{
                meta: {
                    changes: number;
                };
            }>;
        };
    };
};
export async function loadState(db: Database, userId: string) { if (!userId)
    throw new Error('Authentication required'); const row = await db.prepare('SELECT data, revision FROM user_state WHERE user_id = ?').bind(userId).first(); return { state: row ? JSON.parse(row.data) as WorkoutState : emptyState(), revision: row?.revision ?? 0 }; }
export async function saveState(db: Database, userId: string, state: WorkoutState, revision: number, expectedUserId = userId) { if (expectedUserId !== userId)
    throw new Error('Account changed'); if (!userId)
    throw new Error('Authentication required'); if (!validateState(state) || !Number.isInteger(revision) || revision < 0)
    throw new Error('Invalid workout data'); const data = JSON.stringify(state); const now = Date.now(); const result = revision === 0 ? await db.prepare('INSERT INTO user_state (user_id, data, revision, updated_at) VALUES (?, ?, 1, ?) ON CONFLICT(user_id) DO NOTHING').bind(userId, data, now).run() : await db.prepare('UPDATE user_state SET data = ?, revision = revision + 1, updated_at = ? WHERE user_id = ? AND revision = ?').bind(data, now, userId, revision).run(); return result.meta.changes === 1 ? { revision: revision + 1, conflict: false } : { revision, conflict: true }; }
