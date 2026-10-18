import { randomInt } from 'node:crypto';
export function createDraw(ids) {
 if(ids.length<2||new Set(ids).size!==ids.length) throw new Error('Participantes insuficientes ou repetidos');
 let targets;
 do {targets=[...ids];for(let i=targets.length-1;i>0;i--){const j=randomInt(i+1);[targets[i],targets[j]]=[targets[j],targets[i]];}}while(targets.some((id,i)=>id===ids[i]));
 return ids.map((giver,i)=>({giver,receiver:targets[i]}));
}
export function createFamilyDraw(people){return createDraw(people.map(p=>p.id)).map(p=>({...p,receiverSlot:1}));}
