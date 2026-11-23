import type { Exercise, SetRow, WorkoutState } from './workout.ts';

export type BodyweightEntry = { id: string; weight: number; recordedAt: number };
export function latestBodyweight(state: WorkoutState): number | null {
    return [...(state.bodyweights ?? [])].sort((a,b) => b.recordedAt-a.recordedAt)[0]?.weight ?? state.profile.bodyweight;
}
export function logBodyweight(state: WorkoutState, weight: number, recordedAt = Date.now(), id = crypto.randomUUID()): WorkoutState {
    if (!Number.isFinite(weight) || weight <= 0 || weight > 1500 || !Number.isFinite(recordedAt) || recordedAt < 0 || recordedAt > Date.now()) throw Error('Enter a valid weight and a measurement time that is not in the future.');
    const bodyweights = [...(state.bodyweights ?? []).filter(e => e.id !== id), { id, weight, recordedAt }];
    const next = { ...state, bodyweights };
    return { ...next, profile: { ...state.profile, bodyweight: latestBodyweight(next) } };
}
export function bodyweightAt(state: WorkoutState, at: number): number | null {
    const entries = [...(state.bodyweights ?? [])].sort((a,b) => b.recordedAt-a.recordedAt);
    const day = new Date(at).toDateString();
    return (entries.find(e => new Date(e.recordedAt).toDateString() === day) ?? entries.find(e => e.recordedAt <= at))?.weight ?? latestBodyweight(state);
}
// Matches Strength Level's published Brzycki/Epley blend; preserve precision until display.
export function oneRepMax(weight: number, reps: number): number | null {
    if (!Number.isFinite(weight) || weight < 0 || !Number.isInteger(reps) || reps < 1 || reps > 30) return null;
    if (reps === 1) return weight;
    const epley = weight * (1 + reps/30), brzycki = weight * 36/(37-reps);
    if (reps <= 8) return brzycki;
    if (reps >= 10) return epley;
    return brzycki + (epley-brzycki)*(reps-8)/2;
}
// Invert the existing estimate, using total load for added-weight movements.
export function repMaxFromOneRepMax(max: number, reps: number, bodyweight = 0): number | null {
    const factor = oneRepMax(1, reps);
    if (factor === null || !Number.isFinite(max) || !Number.isFinite(bodyweight) || bodyweight < 0 || max + bodyweight < 0) return null;
    return (max + bodyweight) / factor - bodyweight;
}
export function bodyweightStandards(exercise: Exercise, sex: string, weight: number) {
    if (exercise.type === 'Bodyweight/Reps' && exercise.benchmarkLoad !== 'added-weight') return null;
    const rows = exercise.byBodyweight?.[sex]?.filter(r => r.length === 6).slice().sort((a,b) => a[0]-b[0]);
    if (!rows?.length) return null;
    const low = rows.filter(r => r[0] <= weight).at(-1) ?? rows[0];
    const high = rows.find(r => r[0] >= weight) ?? rows.at(-1)!;
    const fraction = low[0] === high[0] ? 0 : (weight-low[0])/(high[0]-low[0]);
    return { values: low.slice(1).map((v,i) => v + (high[i+1]-v)*fraction), clamped: weight < rows[0][0] || weight > rows.at(-1)![0], referenceWeight: Math.max(rows[0][0],Math.min(rows.at(-1)![0],weight)) };
}
export function percentile(max: number, standards: number[]) {
    const boundaries = [5,20,50,80,95];
    if (max < standards[0]) return {value:5,label:'<5%',level:'Below beginner'};
    if (max > standards[4]) return {value:95,label:'>95%',level:'Elite'};
    let value = 95;
    for (let i=1;i<5;i++) if (max <= standards[i]) { value = boundaries[i-1]+(max-standards[i-1])/(standards[i]-standards[i-1])*(boundaries[i]-boundaries[i-1]); break; }
    const level = value >= 95 ? 'Elite' : value >= 80 ? 'Advanced' : value >= 50 ? 'Intermediate' : value >= 20 ? 'Novice' : 'Beginner';
    return { value, label:`${value.toFixed(1)}%`, level };
}
// An ordinal position across reference tiers is not a population percentile.
export function tierRating(max:number, standards:number[], labels:string[]) {
    if(max<standards[0])return {value:0,label:'Provisional',level:'Beginner'};
    if(max>=standards.at(-1)!)return {value:100,label:'Provisional',level:labels.at(-1)!};
    const index=standards.findLastIndex(value=>max>=value);
    const fraction=(max-standards[index])/(standards[index+1]-standards[index]);
    return {value:((index+fraction)/(standards.length-1))*100,label:'Provisional',level:labels[index]};
}
export const isAddedWeight = (exercise: Exercise) => exercise.benchmarkLoad === 'added-weight' || ['pull-ups','dips','chin-ups'].includes(exercise.id);
export function strengthLeaderboard(state: WorkoutState, catalog: Exercise[], now = Date.now()) {
    const referenceBodyweight = latestBodyweight(state);
    type Ranked = {exercise: Exercise; estimatedMax: number; percentile: ReturnType<typeof percentile>; rankingKind:'percentile'|'tier'|'proxy'; set: SetRow; at: number; trainingBodyweight: number | null; referenceBodyweight: number; clamped: boolean; standards: number[]};
    const best = new Map<string,Ranked>();
    const unavailable = new Map<string,{exercise:Exercise;reason:string}>();
    const sessions = [...state.history, ...(state.active ? [state.active] : [])];
    for (const session of sessions) for (const logged of session.exercises) {
        const exercise = catalog.find(e => e.id === logged.exerciseId);
        if (!exercise || !logged.sets.some(s => s.done)) continue;
        const standards = referenceBodyweight ? bodyweightStandards(exercise,state.profile.sex,referenceBodyweight) : null;
        if (!referenceBodyweight || !standards) { unavailable.set(exercise.id,{exercise,reason:!referenceBodyweight?'Log your bodyweight to rank':'No verified bodyweight standards'}); continue; }
        for (const set of logged.sets.filter(s => s.done)) {
            const at = set.completedAt ?? session.finishedAt ?? session.startedAt;
            if (at > now) continue;
            const trainingBodyweight = isAddedWeight(exercise) ? bodyweightAt(state,at) : null;
            const totalMax = oneRepMax(set.weight + (trainingBodyweight ?? 0),set.reps);
            if (totalMax === null) continue;
            const estimatedMax = totalMax - (trainingBodyweight ?? 0);
            if (!isAddedWeight(exercise) && estimatedMax <= 0) continue;
            const rating=exercise.benchmarkTier?tierRating(estimatedMax,standards.values,exercise.benchmarkTier.labels):percentile(estimatedMax,standards.values);
            const entry:Ranked = {exercise,estimatedMax,percentile:rating,rankingKind:exercise.benchmarkTier?'tier':exercise.benchmarkProxy?.scale?'proxy':'percentile',set,at,trainingBodyweight,referenceBodyweight,clamped:standards.clamped,standards:standards.values};
            const previous = best.get(exercise.id);
            if (!previous || estimatedMax > previous.estimatedMax || estimatedMax === previous.estimatedMax && at > previous.at) best.set(exercise.id,entry);
        }
        if (!best.has(exercise.id)) unavailable.set(exercise.id,{exercise,reason:'Log a completed set of 1–30 reps with a valid load'});
    }
    return {ranked:[...best.values()].sort((a,b) => b.percentile.value-a.percentile.value || a.exercise.name.localeCompare(b.exercise.name)),unranked:[...unavailable.values()].filter(e=>!best.has(e.exercise.id))};
}
