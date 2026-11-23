import { validProgressSettings, type ProgressGoal } from './progress-goals.ts';
import type { BodyweightEntry } from './strength.ts';
import { oneRepMax } from './strength.ts';
export type Exercise = {
    id: string;
    name: string;
    aliases: string[];
    category: string;
    bodypart: string;
    type?: string;
    benchmarkLoad?: 'added-weight';
    benchmarkProxy?: { name: string; source: string; scale?: number; note?: string };
    loadNote?: string;
    benchmarkTier?: { labels: string[]; sourceName: string; retrieved: string; note: string };
    source?: string;
    benchmarkEvidence?: { retrieved: string; communityLifts: number; note: string };
    benchmarks?: Record<string, number[]>;
    byBodyweight?: Record<string, number[][]>;
};
export type SetRow = {
    id: string;
    weight: number;
    reps: number;
    done: boolean;
    completedAt?: number;
};
export type LoggedExercise = {
    id: string;
    exerciseId: string;
    sets: SetRow[];
};
export type Session = {
    id: string;
    name: string;
    startedAt: number;
    finishedAt?: number;
    exercises: LoggedExercise[];
};
export type WorkoutState = {
    active: Session | null;
    history: Session[];
    favorites: string[];
    accessibleExercises?: string[];
    bodyweights?: BodyweightEntry[];
    progressGoals?: ProgressGoal[];
    progressSeries?: string[];
    profile: {
        sex: 'male' | 'female';
        bodyweight: number | null;
    };
};
export const uid = () => crypto.randomUUID();
const localDateParts = (at: number) => { const date = new Date(at); return [date.getFullYear(), date.getMonth() + 1, date.getDate()] as const; };
export function dateInputValue(at: number) { const [year, month, day] = localDateParts(at); return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`; }
function moveToLocalDate(at: number, date: string) { const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date); if (!match) throw new Error('Choose a valid workout date.'); const next = new Date(at); next.setFullYear(Number(match[1]), Number(match[2]) - 1, Number(match[3])); if (dateInputValue(next.getTime()) !== date) throw new Error('Choose a valid workout date.'); return next.getTime(); }
export function setSessionDate(session: Session, date: string): Session { const startedAt = moveToLocalDate(session.startedAt, date); const finishedAt = session.finishedAt === undefined ? undefined : moveToLocalDate(session.finishedAt, date); return { ...session, startedAt, ...(finishedAt === undefined ? {} : { finishedAt }), exercises: session.exercises.map(exercise => ({ ...exercise, sets: exercise.sets.map(set => ({ ...set, ...(set.completedAt === undefined ? {} : { completedAt: moveToLocalDate(set.completedAt, date) }) })) })) }; }
export function sessionEventTime(session: Session, now = Date.now()) { return moveToLocalDate(now, dateInputValue(session.finishedAt ?? session.startedAt)); }
export function emptyState(): WorkoutState { return { active: null, history: [], favorites: ['bench-press', 'squat', 'lat-pulldown', 'dumbbell-shoulder-press', 'romanian-deadlift', 'dumbbell-lateral-raise'], profile: { sex: 'male', bodyweight: null } }; }
export function beginSession(state: WorkoutState): WorkoutState { if (state.active)
    return state; return { ...state, active: { id: uid(), name: 'Freestyle workout', startedAt: Date.now(), exercises: [] } }; }
export function getPreviousSets(state: WorkoutState, id: string): SetRow[] { for (const h of [...state.history].sort((a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0))) {
    const found = h.exercises.find(e => e.exerciseId === id);
    const sets = found?.sets.filter(s => s.done);
    if (sets?.length)
        return sets;
} return []; }
export function addExercise(state: WorkoutState, id: string): WorkoutState { const previous = getPreviousSets(state, id); const active = state.active ?? { id: uid(), name: 'Freestyle workout', startedAt: Date.now(), exercises: [] }; const sets = Array.from({ length: 3 }, (_, i) => { const p = previous[i] ?? previous.at(-1); return { id: uid(), weight: p?.weight ?? 0, reps: p?.reps ?? 8, done: false }; }); return { ...state, active: { ...active, exercises: [...active.exercises, { id: uid(), exerciseId: id, sets }] } }; }
export function changeWeight(weight: number, direction: number) { return Math.max(0, Math.min(3000, weight + direction * 5)); }
export function finishSession(state: WorkoutState, now = Date.now()): WorkoutState { if (!state.active)
    throw new Error('No active workout'); if (!validateState(state))
    throw new Error('Completed sets need at least one rep.'); const exercises = state.active.exercises.map(e => ({ ...e, sets: e.sets.filter(s => s.done) })).filter(e => e.sets.length); if (!exercises.length)
    throw new Error('Complete at least one set to finish.'); const finishedAt = sessionEventTime(state.active, now); return { ...state, active: null, history: [{ ...state.active, finishedAt, exercises }, ...state.history].sort((a, b) => (b.finishedAt ?? b.startedAt) - (a.finishedAt ?? a.startedAt)) }; }
export function automaticFavoriteIds(state:WorkoutState,now=Date.now()):Set<string>{
 const ids=new Set<string>();
 for(const session of [...state.history,...(state.active?[state.active]:[])])for(const logged of session.exercises){
  if(logged.sets.some(set=>set.done&&set.reps>0&&(set.completedAt??session.finishedAt??session.startedAt)<=now))ids.add(logged.exerciseId);
 }
 return ids;
}
export function favoriteExerciseIds(state:WorkoutState,now=Date.now()):Set<string>{return new Set([...state.favorites,...automaticFavoriteIds(state,now)]);}
export function rankExercises(catalog:Exercise[],state:WorkoutState,tab:string,query:string):Exercise[]{
 let list=catalog.filter(e=>[e.name,...e.aliases,e.bodypart,e.category].join(' ').toLowerCase().includes(query.trim().toLowerCase()));
 const dates=new Map<string,number>(),counts=new Map<string,number>(),now=Date.now();
 for(const session of [...state.history,...(state.active?[state.active]:[])])for(const logged of session.exercises){
  const times=logged.sets.filter(set=>set.done&&set.reps>0).map(set=>set.completedAt??session.finishedAt??session.startedAt).filter(at=>at<=now);
  if(!times.length)continue;
  dates.set(logged.exerciseId,Math.max(dates.get(logged.exerciseId)??0,...times));
  counts.set(logged.exerciseId,(counts.get(logged.exerciseId)??0)+1);
 }
 if(tab==='favorites'){const favorites=favoriteExerciseIds(state,now);list=list.filter(e=>favorites.has(e.id)).sort((a,b)=>(dates.get(b.id)??0)-(dates.get(a.id)??0));}
 if(tab==='recent')list=list.filter(e=>dates.has(e.id)).sort((a,b)=>(dates.get(b.id)??0)-(dates.get(a.id)??0));
 if(tab==='frequent')list=list.filter(e=>counts.has(e.id)).sort((a,b)=>(counts.get(b.id)??0)-(counts.get(a.id)??0));
 return list;
}

const finite = (n: unknown, max: number) => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= max;
const short = (s: unknown, max = 200) => typeof s === 'string' && s.length > 0 && s.length <= max;
function validSession(x: any): boolean { return x && short(x.id) && short(x.name) && finite(x.startedAt, 1e14) && (x.finishedAt === undefined || finite(x.finishedAt, 1e14)) && Array.isArray(x.exercises) && x.exercises.length <= 100 && x.exercises.every((e: any) => e && short(e.id) && short(e.exerciseId) && Array.isArray(e.sets) && e.sets.length <= 100 && e.sets.every((s: any) => s && short(s.id) && finite(s.weight, 3000) && finite(s.reps, 999) && Number.isInteger(s.reps) && typeof s.done === 'boolean' && (s.completedAt === undefined || finite(s.completedAt, 1e14)) && (!s.done || s.reps >= 1))); }
export function validateState(x: any): x is WorkoutState { return !!(x && typeof x === 'object' && validProgressSettings(x) && (x.accessibleExercises === undefined || Array.isArray(x.accessibleExercises) && x.accessibleExercises.length <= 1000 && x.accessibleExercises.every((id:unknown) => short(id)) && new Set(x.accessibleExercises).size === x.accessibleExercises.length) && (x.active === null || validSession(x.active)) && Array.isArray(x.history) && x.history.length <= 5000 && x.history.every(validSession) && (x.bodyweights === undefined || Array.isArray(x.bodyweights) && x.bodyweights.length <= 20000 && x.bodyweights.every((e: any) => e && short(e.id) && finite(e.weight,1500) && e.weight > 0 && finite(e.recordedAt,1e14))) && Array.isArray(x.favorites) && x.favorites.length <= 500 && x.favorites.every((s: unknown) => short(s)) && x.profile && ['male', 'female'].includes(x.profile.sex) && (x.profile.bodyweight === null || finite(x.profile.bodyweight, 1500))); }
export function sessionStats(session: Session | null) { const sets = session?.exercises.flatMap(e => e.sets).filter(s => s.done) ?? []; return { sets: sets.length, volume: sets.reduce((n, s) => n + s.weight * s.reps, 0), exercises: session?.exercises.length ?? 0, total: session?.exercises.reduce((n, e) => n + e.sets.length, 0) ?? 0 }; }
export const estimatedMax = oneRepMax;
export const levels = ['Beginner', 'Novice', 'Intermediate', 'Advanced', 'Elite'];
export function benchmarkFor(exercise: Exercise, sex: string, bodyweight: number | null) { if (bodyweight) {
    const rows = exercise.byBodyweight?.[sex];
    if (rows?.length) {
        const row = rows.reduce((a, b) => Math.abs(a[0] - bodyweight) <= Math.abs(b[0] - bodyweight) ? a : b);
        return { values: row.slice(1), label: `${sex === 'male' ? 'Male' : 'Female'} · ${row[0]} lb bodyweight`, personal: true };
    }
} return { values: exercise.benchmarks?.[sex] ?? null, label: `${sex === 'male' ? 'Male' : 'Female'} · entire community`, personal: false }; }

export function editSession(state: WorkoutState, sessionId: string, edit: (session: Session) => Session): WorkoutState {
    if (!state.history.some(h => h.id === sessionId)) return state;
    return { ...state, history: state.history.map(h => h.id === sessionId ? { ...edit(h), id: h.id } : h).sort((a, b) => (b.finishedAt ?? b.startedAt) - (a.finishedAt ?? a.startedAt)) };
}
export function enterSetNumbers(row: SetRow, numbers: Partial<Pick<SetRow, 'weight' | 'reps'>>, at = Date.now()): SetRow {
    const next = { ...row, ...numbers };
    return { ...next, done: next.reps >= 1, completedAt: next.reps >= 1 ? (row.completedAt ?? at) : undefined };
}
