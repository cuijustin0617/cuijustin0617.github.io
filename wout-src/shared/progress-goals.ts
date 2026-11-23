import { latestBodyweight, oneRepMax } from './strength.ts';
import { exerciseTrend, type TrendPoint } from './training-progress.ts';
import type { Exercise, WorkoutState } from './workout.ts';

export type GoalReps = 1 | 5 | 8;
export type LiftGoal = { exerciseId: string; weight: number; reps: GoalReps };
export type ProgressGoal = { date: string; bodyweight?: number; lifts: LiftGoal[] };
export const DAY = 86_400_000;
export const DEFAULT_SERIES = ['bodyweight', 'bench-press', 'neutral-grip-pull-ups', 'squat', 'romanian-deadlift', 'machine-row'];

export function localDate(at: number) {
    const date = new Date(at);
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

// Calendar dates share a day coordinate, including across daylight saving changes.
export const goalTime = (date: string) => Date.parse(date + 'T00:00:00Z');
export const chartDay = (at: number) => goalTime(localDate(at));
const validDate = (date: unknown): date is string => typeof date === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(goalTime(date)) &&
    new Date(goalTime(date)).toISOString().slice(0, 10) === date;

export function validProgressSettings(state: WorkoutState) {
    const goals = state.progressGoals;
    if (goals !== undefined) {
        if (!Array.isArray(goals) || goals.length > 3) return false;
        for (const goal of goals) {
            if (!goal || !validDate(goal.date) || !Array.isArray(goal.lifts) || goal.lifts.length > 1000) return false;
            if (goal.bodyweight !== undefined && (!Number.isFinite(goal.bodyweight) || goal.bodyweight <= 0 || goal.bodyweight > 1500)) return false;
            if (goal.bodyweight === undefined && !goal.lifts.length) return false;
            if (!goal.lifts.every(lift => lift && typeof lift.exerciseId === 'string' && lift.exerciseId.length > 0 &&
                lift.exerciseId.length <= 200 && Number.isFinite(lift.weight) && lift.weight >= 0 &&
                lift.weight <= 3000 && [1, 5, 8].includes(lift.reps))) return false;
            if (new Set(goal.lifts.map(lift => lift.exerciseId)).size !== goal.lifts.length) return false;
        }
        if (new Set(goals.map(goal => goal.date)).size !== goals.length) return false;
    }
    const series = state.progressSeries;
    return series === undefined || (Array.isArray(series) && series.length <= 1000 &&
        series.every(id => typeof id === 'string' && id.length > 0 && id.length <= 200) &&
        new Set(series).size === series.length);
}

export function goalEquivalent(lift: LiftGoal, exercise: Exercise, bodyweight: number | null) {
    if (lift.reps === 1) return lift.weight;
    if (exercise.category !== 'Bodyweight') return oneRepMax(lift.weight, lift.reps);
    if (!bodyweight) return null;
    const total = oneRepMax(bodyweight + lift.weight, lift.reps);
    return total === null ? null : total - bodyweight;
}

export function progressPoints(state: WorkoutState, exercise: Exercise | undefined, now: number): TrendPoint[] {
    const raw = exercise
        ? exerciseTrend(state, exercise, 'max', 0, now, exercise.category === 'Bodyweight')
        : (state.bodyweights ?? []).filter(entry => entry.recordedAt <= now)
            .map(entry => ({ at: entry.recordedAt, value: entry.weight, note: '' }));
    const daily = new Map<number, TrendPoint>();
    for (const point of raw.slice().sort((a, b) => a.at - b.at)) {
        const at = chartDay(point.at);
        daily.set(at, { ...point, at });
    }
    return [...daily.values()];
}

export function targetPoints(goals: ProgressGoal[], exercise: Exercise | undefined, state: WorkoutState): TrendPoint[] {
    return goals.flatMap(goal => {
        const at = goalTime(goal.date);
        if (!exercise) return goal.bodyweight === undefined ? [] : [{ at, value: goal.bodyweight, note: 'Bodyweight goal' }];
        const lift = goal.lifts.find(item => item.exerciseId === exercise.id);
        if (!lift) return [];
        const value = goalEquivalent(lift, exercise, goal.bodyweight ?? latestBodyweight(state));
        return value === null ? [] : [{ at, value, note: `${lift.weight} lb × ${lift.reps}` }];
    });
}

export function projectTrend(points: TrendPoint[], today: number, end: number, minimum = 0): TrendPoint[] {
    const last = points.at(-1);
    if (!last || end <= today) return [];
    const recent = points.filter(point => last.at - point.at <= 90 * DAY).slice(-30);
    // Fit levels against elapsed days: unchanged sessions still contribute evidence,
    // while stepwise progress no longer disappears in a median of zero intervals.
    const samples = recent.map(point => ({
        x: (point.at - last.at) / DAY,
        y: point.value,
        weight: Math.pow(0.5, (last.at - point.at) / DAY / 35),
    }));
    const totalWeight = samples.reduce((sum, point) => sum + point.weight, 0);
    const meanX = samples.reduce((sum, point) => sum + point.weight * point.x, 0) / totalWeight;
    const meanY = samples.reduce((sum, point) => sum + point.weight * point.y, 0) / totalWeight;
    const variance = samples.reduce((sum, point) => sum + point.weight * (point.x - meanX) ** 2, 0);
    const covariance = samples.reduce((sum, point) => sum + point.weight * (point.x - meanX) * (point.y - meanY), 0);
    const staleness = Math.max(0, (today - last.at) / DAY);
    const rate = (variance > 0 ? covariance / variance : 0) * Math.pow(0.5, staleness / 60);
    const span = (last.at - recent[0].at) / DAY;
    const provisional = recent.length < 4 || span < 14;
    const note = recent.length < 2 ? 'Flat projection · log another day to estimate a trend'
        : Math.abs(rate) < 1e-9 ? 'Flat projection · recent measurements are steady'
        : provisional ? 'Provisional projection · limited history' : 'Projection · recent fitted trend';
    return Array.from({ length: 49 }, (_, i) => {
        const at = last.at + (end - last.at) * i / 48;
        const days = (at - last.at) / DAY;
        // Preserve the recent slope near the last log, then ease gradually rather
        // than forcing a hard plateau. This is a trend scenario, not a guarantee.
        const value = Math.max(minimum, last.value + rate * 180 * Math.log1p(days / 180));
        return { at, value, note };
    });
}
