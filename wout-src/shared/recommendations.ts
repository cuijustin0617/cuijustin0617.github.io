import {addExercise,editSession,favoriteExerciseIds,type Exercise,type Session,type WorkoutState} from './workout.ts';
import {exerciseMuscles,muscleNames,setTime,creditedSetEvents,type Muscle} from './training-progress.ts';
import {muscleFrequency} from './analytics.ts';
import {strengthLeaderboard} from './strength.ts';
const DAY=86400000;
const completedIds=(session:Session,now:number)=>session.exercises.filter(e=>e.sets.some(s=>s.done&&s.reps>0&&setTime(session,s.completedAt)<=now)).map(e=>e.exerciseId);
export function automaticAccessIds(state:WorkoutState):Set<string>{
 const now=Date.now(),ids=new Set(state.favorites);
 for(const session of [...state.history,...(state.active?[state.active]:[])])for(const id of completedIds(session,now))ids.add(id);
 return ids;
}
export function accessibleExerciseIds(state:WorkoutState):Set<string>{return new Set([...automaticAccessIds(state),...(state.accessibleExercises??[])]);}
/** Mark access and add to either an active workout or the selected historical session atomically. */
export function addAccessibleExercise(state:WorkoutState,id:string,editingId?:string):WorkoutState{
 const accessibleExercises=[...new Set([...(state.accessibleExercises??[]),id])];
 return editingId?{...editSession(state,editingId,session=>addExercise({...state,active:session},id).active!),accessibleExercises}:addExercise({...state,accessibleExercises},id);
}
export type Suggestion={exercise:Exercise;reason:string;score:number};
export type BalanceGroup={muscle:Muscle;name:string;lastTrained:number|null;reason:string;options:Suggestion[]};
export const COOLDOWN_HOURS=36;
const HOUR=3600000;
const majorMuscles:Muscle[]=['chest','quadriceps','hamstring','gluteal'];
// User preference, not a measured muscle-mass or recovery estimate.
const largerGroups=new Set<Muscle>(['chest','upper-back','quadriceps','hamstring','gluteal']);
function balanceTargets(exercise:Exercise):Muscle[]{
 const mapping=exerciseMuscles(exercise);
 const targets=Object.entries(mapping).filter(([,credit])=>credit===1).map(([m])=>m as Muscle);
 // Dips and close-grip bench are useful chest choices even though their mapping
 // credits chest as supporting. Preserve that credit for workload and cooldowns.
 if((mapping.chest??0)>0&&/dip|bench[ -]?press/.test(exercise.name.toLowerCase())&&!targets.includes('chest'))targets.push('chest');
 return targets;
}
function cooldownMuscles(exercise:Exercise):Muscle[]{
 const mapping=exerciseMuscles(exercise);
 return majorMuscles.filter(m=>(mapping[m]??0)>0);
}
export type Cooldown={exercise:Exercise;until:number;remainingHours:number};
/** User-defined holds plus transparent workload/recency ranking; no interval prediction. */
export function suggestExercises(state:WorkoutState,catalog:Exercise[],now=Date.now(),limit=4):{likely:Suggestion[];balanced:Suggestion[];balanceGroups:BalanceGroup[];coolingDown:Cooldown[]}{
 const favorites=favoriteExerciseIds(state,now),planned=new Set(state.active?.exercises.map(e=>e.exerciseId)??[]);
 const access=new Set([...(state.accessibleExercises??[]),...favorites]);
 const events=creditedSetEvents(state,catalog,now),lastMajor=new Map<Muscle,number>();
 for(const event of events){
  access.add(event.exerciseId);
  if(event.exercise)for(const m of cooldownMuscles(event.exercise))lastMajor.set(m,Math.max(lastMajor.get(m)??0,event.at));
 }
 const available=catalog.filter(e=>access.has(e.id)&&!planned.has(e.id)),coolingDown:Cooldown[]=[];
 const candidates=available.filter(exercise=>{
  const until=Math.max(0,...cooldownMuscles(exercise).map(m=>lastMajor.has(m)?lastMajor.get(m)!+COOLDOWN_HOURS*HOUR:0));
  if(until>now){coolingDown.push({exercise,until,remainingHours:Math.ceil((until-now)/HOUR)});return false;}
  return true;
 });
 coolingDown.sort((a,b)=>a.until-b.until||a.exercise.name.localeCompare(b.exercise.name));
 const week=muscleFrequency(state,catalog,now-7*DAY,now),all=muscleFrequency(state,catalog,0,now);
 const primary=balanceTargets;
 const plannedMuscles=new Set<Muscle>();
 for(const logged of state.active?.exercises??[]){
  const exercise=catalog.find(e=>e.id===logged.exerciseId);if(!exercise)continue;
  for(const muscle of primary(exercise))plannedMuscles.add(muscle);
 }
 // Filter future sets before using the existing exercise percentiles as a small tie-breaker.
 const eligible=(session:Session)=>({...session,exercises:session.exercises.map(e=>({...e,sets:e.sets.filter(set=>setTime(session,set.completedAt)<=now)}))});
 const rankedState={...state,history:state.history.filter(s=>s.id!==state.active?.id).map(eligible),active:state.active?eligible(state.active):null};
 const ranks=new Map(strengthLeaderboard(rankedState,catalog,now).ranked.filter(r=>r.rankingKind==='percentile').map(r=>[r.exercise.id,r.percentile.value]));
 // Rank muscle groups by their most recent work across ALL exercises, including supporting work.
 // An old exercise variant cannot make a recently trained muscle appear neglected.
 const lastExercise=new Map<string,number>();
 for(const event of events)lastExercise.set(event.exerciseId,Math.max(lastExercise.get(event.exerciseId)??0,event.at));
 const targets=[...new Set(candidates.flatMap(primary))].filter(m=>!plannedMuscles.has(m));
 targets.sort((a,b)=>all[a].last-all[b].last||week[a].sets-week[b].sets||Number(largerGroups.has(b))-Number(largerGroups.has(a))||muscleNames[a].localeCompare(muscleNames[b]));
 const balanceGroups:BalanceGroup[]=targets.slice(0,Math.max(0,limit)).map(muscle=>{
  const lastTrained=all[muscle].last||null;
  const age=lastTrained===null?null:Math.max(0,(now-lastTrained)/HOUR);
  const last=age===null?'No logged training':age<48?`${Math.floor(age)}h since training`:`${Math.floor(age/24)}d since training`;
  const reason=`${last} · ${Number(week[muscle].sets.toFixed(2))} sets / 7d${largerGroups.has(muscle)?' · Large muscle group':''}`;
  const options=candidates.filter(e=>primary(e).includes(muscle)).sort((a,b)=>
   (lastExercise.get(a.id)??0)-(lastExercise.get(b.id)??0)||
   (ranks.get(a.id)??100)-(ranks.get(b.id)??100)||a.name.localeCompare(b.name)
  ).slice(0,3).map(exercise=>{
   const at=lastExercise.get(exercise.id),rank=ranks.get(exercise.id);
   const exerciseAge=at===undefined?null:Math.max(0,(now-at)/HOUR);
   const detail=exerciseAge===null?'Not logged yet':exerciseAge<48?`${Math.floor(exerciseAge)}h since this exercise`:`${Math.floor(exerciseAge/24)}d since this exercise`;
   return {exercise,score:at===undefined?now/HOUR:(now-at)/HOUR,reason:`${detail}${rank!==undefined&&rank<35?' · lower-ranked lift':''}`};
  });
  return {muscle,name:muscleNames[muscle],lastTrained,reason,options};
 });
 // Retain a unique flat list for consumers needing exercise IDs; the UI uses the groups.
 const balanced=[...new Map(balanceGroups.flatMap(group=>group.options).map(item=>[item.exercise.id,item])).values()];
 const lastPlanned=state.active?.exercises.at(-1)?.exerciseId;
 const history=state.history.filter(s=>s.id!==state.active?.id&&(s.finishedAt??s.startedAt)<=now);
 const records=history.map(session=>({session,ids:completedIds(session,now),at:session.finishedAt??session.startedAt}));
 const likely=candidates.map(exercise=>{
  const appearances=[...new Map(records.filter(r=>r.ids.includes(exercise.id)).map(r=>[new Date(r.at).toDateString(),r])).values()];
  let sequence=0,position=0;
  for(const record of appearances){
   const fresh=Math.pow(.5,Math.max(0,(now-record.at)/DAY)/60),index=record.ids.indexOf(exercise.id);
   if(lastPlanned&&index>0&&record.ids[index-1]===lastPlanned)sequence+=fresh;
   position+=fresh/(1+Math.abs(index-planned.size));
  }
  const score=sequence*5+position+Math.log1p(appearances.length)+(favorites.has(exercise.id)?.8:0);
  return {exercise,score,reason:sequence>0?`Previously after ${catalog.find(e=>e.id===lastPlanned)?.name??'your last exercise'} · cooldown clear`:appearances.length?'Previously logged · cooldown clear':'Accessible · cooldown clear'};
 }).sort((a,b)=>b.score-a.score||a.exercise.name.localeCompare(b.exercise.name)).slice(0,Math.max(0,limit));
 return {likely,balanced,balanceGroups,coolingDown};
}
