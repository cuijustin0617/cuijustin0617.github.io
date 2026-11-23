import type {Exercise} from './workout.ts';
export type EquipmentKind='barbell'|'dumbbell'|'machine'|'bars'|'cable'|'bodyweight';
export const equipmentLabels:Record<EquipmentKind,string>={barbell:'Barbell',dumbbell:'Dumbbell',machine:'Machine',bars:'Bars',cable:'Cable',bodyweight:'Bodyweight'};
export function equipmentKind(exercise:Exercise):EquipmentKind{
 if(exercise.category==='Dumbbell'||/dumbbell/i.test(exercise.name))return 'dumbbell';
 if(exercise.category==='Machine'||/smith/i.test(exercise.name))return 'machine';
 if(exercise.category==='Cable')return 'cable';
 if(exercise.category==='Bodyweight')return !/bench dip|ring /i.test(exercise.name)&&/pull.?up|chin.?up|dip|muscle.?up/i.test(exercise.name)?'bars':'bodyweight';
 return 'barbell';
}
