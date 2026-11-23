import type {Exercise, WorkoutState} from './workout.ts';
import {exerciseMuscles,muscles,muscleTraining,setTime,trainingSessions,type Muscle} from './training-progress.ts';
export type MuscleFrequency = {days:number;directDays:number;sets:number;last:number;exercises:Record<string,number>};
/** Days are distinct local calendar dates, not exercise or set counts. */
export function muscleFrequency(state:WorkoutState,catalog:Exercise[],since=0,now=Date.now()):Record<Muscle,MuscleFrequency> {
 const workload=muscleTraining(state,catalog,since,now,true);
 const days=Object.fromEntries(muscles.map(m=>[m,new Set<string>()])) as Record<Muscle,Set<string>>;
 const direct=Object.fromEntries(muscles.map(m=>[m,new Set<string>()])) as Record<Muscle,Set<string>>;
 const byId=new Map(catalog.map(e=>[e.id,e]));
 for(const session of trainingSessions(state))for(const logged of session.exercises){
  const exercise=byId.get(logged.exerciseId);if(!exercise)continue;
  const mapping=exerciseMuscles(exercise);
  for(const set of logged.sets){
   const at=setTime(session,set.completedAt);if(!set.done||set.reps<1||at<since||at>now)continue;
   const day=new Date(at).toDateString();
   for(const [muscle,credit] of Object.entries(mapping)){const m=muscle as Muscle;days[m].add(day);if(credit===1)direct[m].add(day);}
  }
 }
 return Object.fromEntries(muscles.map(m=>[m,{...workload.entries[m],days:days[m].size,directDays:direct[m].size}])) as Record<Muscle,MuscleFrequency>;
}
