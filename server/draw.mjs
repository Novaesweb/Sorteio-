import { randomInt } from 'node:crypto';
export function createDraw(ids) {
  if (ids.length < 2 || new Set(ids).size !== ids.length) throw new Error('São necessários pelo menos dois participantes únicos.');
  let shuffled;
  do {
    shuffled = [...ids];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
  } while (shuffled.some((id, i) => id === ids[i]));
  return ids.map((giver, i) => ({ giver, receiver: shuffled[i] }));
}

// Family exception: Iris receives two gifts, replacing Erick as a recipient.
export function createFamilyDraw(people) {
 const iris=people.find(p=>p.name==='Iris Ferreira')?.id,erick=people.find(p=>p.name==='Erick')?.id;
 if(!iris||!erick)throw new Error('Confira Iris Ferreira e Erick na lista da família.');
 let pairs;
 do {pairs=createDraw(people.map(p=>p.id)).map(p=>({...p,receiver:p.receiver===erick?iris:p.receiver}));}
 while(pairs.some(p=>p.giver===p.receiver));
 const slots=new Map();
 return pairs.map(p=>{const slot=(slots.get(p.receiver)||0)+1;slots.set(p.receiver,slot);return {...p,receiverSlot:slot};});
}
