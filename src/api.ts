export type Person = { id:number; name:string; confirmed_at?:string|null; revealed_at?:string|null; has_code?:number };
export type Event = { participants:Person[]; startedAt:string|null; storageReady?:boolean };
export type Me = Person & { startedAt:string|null };
export type Result = { participant:string; receiver:Person; revealedAt:string };
export type Dashboard = Event & { audit:{id:number;action:string;created_at:string}[] };
export type Code = { id:number;name:string;code:string };
export class ApiError extends Error { constructor(message:string, public status:number) { super(message); } }
export async function api<T>(path:string, data?:unknown):Promise<T> {
  let response:Response;
  try { response = await fetch(`/api${path}`, { credentials:'same-origin', ...(data === undefined ? {} : { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) }) }); }
  catch { throw new ApiError('Sem conexão com o servidor. Tente novamente.', 0); }
  const value = await response.json().catch(() => ({ error:'O servidor não está disponível. Tente novamente.' }));
  if (!response.ok) throw new ApiError(value.error || 'Não foi possível continuar.', response.status);
  return value;
}
