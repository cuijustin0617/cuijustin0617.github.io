import type {Exercise, Session, WorkoutState} from './workout.ts';
import {bodyweightAt, isAddedWeight, oneRepMax} from './strength.ts';

export type TrendMetric = 'max' | 'weight' | 'reps';
export type TrendPoint = {at:number; value:number; note:string};
export const muscleNames = {
 trapezius:'Traps', deltoids:'Shoulders', chest:'Chest', 'upper-back':'Lats & upper back', serratus:'Serratus',
 biceps:'Biceps', triceps:'Triceps', forearm:'Forearms', abs:'Abs', obliques:'Obliques', 'lower-back':'Lower back',
 gluteal:'Glutes', quadriceps:'Quads', hamstring:'Hamstrings', adductors:'Adductors', 'hip-flexors':'Hip flexors', calves:'Calves', tibialis:'Shins',
} as const;
export type Muscle = keyof typeof muscleNames;
export const muscles = Object.keys(muscleNames) as Muscle[];
export function trainingSessions(state:WorkoutState):Session[] {
 const sessions = new Map(state.history.map(s=>[s.id,s]));
 if(state.active) sessions.set(state.active.id,state.active);
 return [...sessions.values()];
}
export function setTime(session:Session, completedAt?:number) {
 return completedAt ?? session.finishedAt ?? session.startedAt;
}
export function exerciseTrend(state:WorkoutState, exercise:Exercise, metric:TrendMetric, since=0, now=Date.now(), usesBodyweight=isAddedWeight(exercise)):TrendPoint[] {
 const byDay = new Map<string,TrendPoint>();
 for(const session of trainingSessions(state)) for(const logged of session.exercises) {
  if(logged.exerciseId!==exercise.id) continue;
  for(const set of logged.sets) {
   const at=setTime(session,set.completedAt);
   if(!set.done || set.reps<1 || at<since || at>now) continue;
   let value:number|null=metric==='reps'?set.reps:metric==='weight'?set.weight:null;
   if(metric==='max') {
    const bw=usesBodyweight?bodyweightAt(state,at):0;
    if(bw===null) continue;
    const total=oneRepMax(set.weight+bw,set.reps);
    value=total===null?null:total-bw;
    if(!usesBodyweight && value!==null && value<=0) continue;
   }
   if(value===null || !Number.isFinite(value)) continue;
   const key=new Date(at).toLocaleDateString('en-CA');
   const old=byDay.get(key);
   if(!old || value>old.value || value===old.value && at>old.at) byDay.set(key,{at,value,note:`${set.weight} lb × ${set.reps} reps`});
  }
 }
 return [...byDay.values()].sort((a,b)=>a.at-b.at);
}

// Movement-based estimates for Wout's existing catalogue. No exercise catalogue is imported.
// Primary movers receive 1 set; supporting movers receive 0.5. Not a recovery model.
export function exerciseMuscles(exercise:Exercise):Partial<Record<Muscle,number>> {
 const n=exercise.name.toLowerCase();
 const load=(primary:Muscle[],secondary:Muscle[]=[])=>Object.fromEntries([...secondary.map(m=>[m,.5]),...primary.map(m=>[m,1])]) as Partial<Record<Muscle,number>>;
 if(/calf|calves/.test(n)) return load(['calves']);
 if(/tibialis|shin raise/.test(n)) return load(['tibialis']);
 if(/hip adduction/.test(n)) return load(['adductors']);
 if(/abduction|side leg raise/.test(n)) return load(['gluteal']);
 if(/leg curl|nordic|glute ham/.test(n)) return load(['hamstring'],['gluteal']);
 if(/leg extension|sissy squat/.test(n)) return load(['quadriceps']);
 if(/hip thrust|glute bridge|glute kickback|hip extension|cable kickback/.test(n)) return load(['gluteal'],['hamstring']);
 if(/deadlift|good morning|pull through/.test(n)) return load(['hamstring','gluteal'],['lower-back','upper-back','forearm']);
 if(/squat|leg press|lunge|sled leg|sled press/.test(n)) return load(['quadriceps','gluteal'],['adductors','hamstring']);
 if(/shrug|neck curl|neck extension/.test(n)) return load(['trapezius']);
 if(/back extension|reverse hyper|superman/.test(n)) return load(['lower-back'],['gluteal','hamstring']);
 if(/reverse fly|face pull|y raise|external rotation/.test(n)) return load(['deltoids','upper-back'],['trapezius']);
 if(/pullover|straight arm pulldown/.test(n)) return load(['upper-back'],['serratus']);
 if(/pull up|chin up|pulldown|row|pulldown/.test(n)) return load(['upper-back'],['biceps','forearm','deltoids']);
 if(/muscle up/.test(n)) return load(['upper-back','triceps'],['chest','biceps','deltoids']);
 if(/dip|close grip|diamond|jm press|tate press/.test(n)) return load(['triceps'],['chest','deltoids']);
 if(/lateral raise|front raise/.test(n)) return load(['deltoids']);
 if(/clean|snatch|jerk|thruster|wall ball/.test(n)) return load(['quadriceps','gluteal','deltoids'],['hamstring','trapezius','lower-back']);
 if(/farmers walk/.test(n)) return load(['forearm','trapezius'],['abs']);
 if(/leg raise|knee raise|toes to bar/.test(n)) return load(['abs','hip-flexors']);
 if(/russian twist|side crunch|side bend|woodchopper|side plank/.test(n)) return load(['obliques'],['abs']);
 if(/reverse.*curl|wrist.*curl|zottman/.test(n)) return load(['forearm'],['biceps']);
 if(exercise.bodypart==='Chest') return load(['chest'],/fly/.test(n)?[]:['triceps','deltoids']);
 if(exercise.bodypart==='Shoulders') return load(['deltoids'],['triceps']);
 if(exercise.bodypart==='Biceps') return load(['biceps'],['forearm']);
 if(exercise.bodypart==='Triceps') return load(['triceps']);
 if(exercise.bodypart==='Forearms') return load(['forearm']);
 if(exercise.bodypart==='Core') return load(['abs'],['obliques']);
 return {};
}
export type BodyRegion='upper'|'lower'|'core';
export function exerciseRegions(exercise:Exercise):BodyRegion[]{
 if(exercise.bodypart==='Core')return ['core'];
 const primary=Object.entries(exerciseMuscles(exercise)).filter(([,credit])=>credit===1).map(([m])=>m);
 const lower=['gluteal','quadriceps','hamstring','adductors','hip-flexors','calves','tibialis'];
 const upper=['trapezius','deltoids','chest','upper-back','serratus','biceps','triceps','forearm'];
 const regions:BodyRegion[]=[];
 if(primary.some(m=>upper.includes(m)))regions.push('upper');
 if(primary.some(m=>lower.includes(m)))regions.push('lower');
 if(!regions.length&&primary.length)regions.push('core');
 return regions;
}
/** User-defined same-day order credits. Count each distinct exercise once per region/date. */
export function creditedSetEvents(state:WorkoutState,catalog:Exercise[],now=Date.now()){
 const byId=new Map(catalog.map(e=>[e.id,e]));
 const events=trainingSessions(state).flatMap(session=>session.exercises.flatMap((logged,exerciseIndex)=>logged.sets.flatMap((set,setIndex)=>{
  const at=setTime(session,set.completedAt);
  return set.done&&set.reps>0&&at<=now?[{exercise:byId.get(logged.exerciseId),exerciseId:logged.exerciseId,at,sessionId:session.id,startedAt:session.startedAt,exerciseIndex,setIndex}]:[];
 }))).sort((a,b)=>a.at-b.at||a.startedAt-b.startedAt||a.sessionId.localeCompare(b.sessionId)||a.exerciseIndex-b.exerciseIndex||a.setIndex-b.setIndex);
 const days=new Map<string,Map<BodyRegion,Map<string,number>>>();
 return events.map(event=>{
  const day=new Date(event.at).toDateString();
  if(!days.has(day))days.set(day,new Map());
  const regionMap=days.get(day)!,regions=event.exercise?exerciseRegions(event.exercise):[];
  let discount=1;
  for(const region of regions){
   if(!regionMap.has(region))regionMap.set(region,new Map());
   const order=regionMap.get(region)!;
   if(!order.has(event.exerciseId))order.set(event.exerciseId,order.size===0?1:order.size===1?.85:.75);
   discount=Math.min(discount,order.get(event.exerciseId)!);
  }
  return {...event,discount};
 });
}
export function muscleTraining(state:WorkoutState,catalog:Exercise[],since=0,now=Date.now(),discountOrder=false) {
 const entries=Object.fromEntries(muscles.map(m=>[m,{sets:0,exercises:{} as Record<string,number>,last:0}])) as Record<Muscle,{sets:number;exercises:Record<string,number>;last:number}>;
 let completedSets=0,unmappedSets=0,effectiveUnits=0;
 // Compute order before the range cutoff so earlier work on a boundary day still counts.
 for(const event of creditedSetEvents(state,catalog,now)){
  if(event.at<since)continue;
  const mapping=event.exercise?exerciseMuscles(event.exercise):{},discount=discountOrder?event.discount:1;
  completedSets++;effectiveUnits+=Math.round(discount*1000);
  if(!Object.keys(mapping).length)unmappedSets++;
  for(const [slug,credit]of Object.entries(mapping)){
   const entry=entries[slug as Muscle],value=Math.round(credit!*discount*1000);
   entry.sets+=value;entry.exercises[event.exerciseId]=(entry.exercises[event.exerciseId]??0)+value;entry.last=Math.max(entry.last,event.at);
  }
 }
 // Integer thousandths prevent .85/.75/supporting sums drifting at a display rounding boundary.
 for(const entry of Object.values(entries)){entry.sets/=1000;for(const id of Object.keys(entry.exercises))entry.exercises[id]/=1000;}
 return {entries,completedSets,unmappedSets,effectiveSets:effectiveUnits/1000};
}
