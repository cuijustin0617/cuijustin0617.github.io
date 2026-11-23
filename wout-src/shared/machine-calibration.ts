import type {Exercise} from './workout.ts';
import {oneRepMax} from './strength.ts';

/** Keep the existing chest-press ID so earlier logs use the CMU calibration. */
export function withCmuChestPress(catalog:Exercise[]):Exercise[] {
 const bench=catalog.find(exercise=>exercise.id==='bench-press');
 if(!bench?.byBodyweight||!bench.source)return catalog;
 const scale=oneRepMax(115,10)!/oneRepMax(175,1)!;
 const note=`CMU machine calibration: 115 lb × 10 matches a 175 lb × 1 bench press using estimated 1RM. Bench Press standards are scaled to ${(scale*100).toFixed(2)}%. This is a bench-equivalent estimate from one comparison, not measured machine-specific population percentiles. Log the displayed machine weight; compare on the same machine and settings.`;
 return catalog.map(exercise=>exercise.id!=='chest-press'?exercise:{
  ...exercise,name:'Chest Press Machine (CMU)',
  aliases:[...new Set([...exercise.aliases,'Chest Press','CMU Chest Press','Machine Chest Press'])],
  benchmarks:bench.benchmarks?Object.fromEntries(Object.entries(bench.benchmarks).map(([sex,values])=>[sex,values.map(value=>value*scale)])):undefined,
  byBodyweight:Object.fromEntries(Object.entries(bench.byBodyweight!).map(([sex,rows])=>[sex,rows.map(([weight,...values])=>[weight,...values.map(value=>value*scale)])])),
  benchmarkProxy:{name:bench.name,source:bench.source!,scale,note},
 });
}
