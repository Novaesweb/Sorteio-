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
