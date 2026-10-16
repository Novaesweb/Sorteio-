// Optional Vercel frontend: proxy to the single persistent Node backend.
// BACKEND_URL is configured only in Vercel's server environment, never in VITE_.
export default async function handler(req, res) {
  const backend = process.env.BACKEND_URL;
  if (!backend || !backend.startsWith('https://')) return res.status(503).json({ error:'Configure BACKEND_URL com a URL HTTPS do servidor persistente.' });
  const pathname = new URL(req.url, 'https://frontend.invalid').pathname;
  if (!pathname.startsWith('/api/')) return res.status(404).end();
  try {
    const headers = {};
    for (const name of ['cookie','origin','content-type']) if (req.headers[name]) headers[name] = req.headers[name];
    const hasBody = !['GET','HEAD'].includes(req.method);
    const response = await fetch(new URL(pathname, backend), {
      method:req.method, headers, redirect:'manual', signal:AbortSignal.timeout(15000),
      ...(hasBody ? { body:typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {}) } : {})
    });
    res.statusCode = response.status;
    for (const name of ['content-type','set-cookie','cache-control','x-content-type-options','referrer-policy']) {
      const value = response.headers.get(name); if (value) res.setHeader(name,value);
    }
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch { res.status(502).json({ error:'Não foi possível acessar o servidor. Tente novamente em instantes.' }); }
}
