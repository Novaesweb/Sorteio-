// Vite's Vercel functions support one dynamic segment per directory.
// Administrative endpoints need this explicit second level; the root API
// dynamic route cannot match /api/admin/login or /api/admin/dashboard.
import handler from '../[...path].mjs';
export const config={maxDuration:30};
export default handler;
