import configuration from '../shared/supabase.json' with {type:'json'};
import { createSupabaseHandler } from '../server/supabase-proxy.mjs';
export const config={maxDuration:30};
export default createSupabaseHandler({
 endpoint:`${configuration.url}/functions/v1/familia-ferreira`,
 publishableKey:configuration.publishableKey,
 production:true,
 preview:process.env.VERCEL_ENV==='preview'
});
