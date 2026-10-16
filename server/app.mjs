import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { randomBytes } from 'node:crypto';
import { openDatabase } from './db.mjs';
import { createDraw } from './draw.mjs';
import { hashSecret, verifySecret, token, digest } from './security.mjs';

export function createApp({ databasePath = './data/familia.sqlite', adminHash = '', origin = '', production = false, dist = 'dist' } = {}) {
  if (production && (!origin.startsWith('https://') || !adminHash)) throw new Error('Configure APP_ORIGIN HTTPS e ADMIN_PASSWORD_HASH antes de publicar.');
  const db = openDatabase(databasePath), attempts = new Map();
  const now = () => new Date().toISOString();
  const audit = action => db.prepare('INSERT INTO audit(action) VALUES(?)').run(action);
  const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
  const rows = () => db.prepare('SELECT id,name,confirmed_at,revealed_at,code_hash IS NOT NULL AS has_code FROM participants ORDER BY id').all();
  const started = () => db.prepare('SELECT started_at FROM settings WHERE id=1').get().started_at;
  const transaction = work => { db.exec('BEGIN IMMEDIATE'); try { const result = work(); db.exec('COMMIT'); return result; } catch (e) { db.exec('ROLLBACK'); throw e; } };
  function newSession(res, role, participantId = null) {
    const raw = token(), age = role === 'admin' ? 28800 : 604800;
    db.prepare('DELETE FROM sessions WHERE expires < ?').run(Date.now());
    db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run(digest(raw), role, participantId, Date.now() + age * 1000);
    res.setHeader('Set-Cookie', `${production ? '__Host-' : ''}familia_${role}=${raw}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${age}${production ? '; Secure' : ''}`);
  }
  function session(req, role) {
    const cookieName = `${production ? '__Host-' : ''}familia_${role}`;
    const cookie = (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith(`${cookieName}=`));
    const raw = cookie?.slice(cookieName.length + 1);
    const row = raw && db.prepare('SELECT * FROM sessions WHERE hash=? AND expires>? AND role=?').get(digest(raw), Date.now(), role);
    if (!row) fail(401, 'Entre novamente para continuar.');
    return row;
  }
  function limit(req) {
    const key = req.socket.remoteAddress, time = Date.now();
    if (attempts.size > 10000) for (const [k,v] of attempts) if (v.until < time) attempts.delete(k);
    const item = attempts.get(key);
    if (!item || item.until < time) attempts.set(key, { count: 1, until: time + 15 * 60 * 1000 });
    else if (++item.count > 60) fail(429, 'Muitas tentativas. Aguarde 15 minutos.');
  }
  async function body(req) {
    if (!req.headers['content-type']?.startsWith('application/json')) fail(415, 'Envie os dados em JSON.');
    let raw = '';
    for await (const chunk of req) { raw += chunk; if (Buffer.byteLength(raw) > 8192) fail(413, 'Dados muito grandes.'); }
    try { return JSON.parse(raw || '{}'); } catch { fail(400, 'Dados inválidos.'); }
  }
  const server = createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (production) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000');
      res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
    }
    const send = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); };
    try {
      const path = new URL(req.url, 'http://localhost').pathname;
      if (!path.startsWith('/api/')) {
        if (req.method !== 'GET' && req.method !== 'HEAD') fail(405, 'Método não permitido.');
        const root = resolve(dist), requested = resolve(root, '.' + decodeURIComponent(path));
        if (!requested.startsWith(root + '/') && requested !== root) fail(404, 'Página não encontrada.');
        let file = requested;
        if (!extname(path)) file = resolve(root, 'index.html');
        try {
          const content = await readFile(file);
          const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'}[extname(file)] || 'application/octet-stream';
          res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': extname(file) === '.html' ? 'no-cache' : 'public, max-age=3600' });
          return res.end(req.method === 'HEAD' ? '' : content);
        } catch { fail(404, 'Página não encontrada. Execute npm run build primeiro.'); }
      }
      if (req.method === 'POST' && req.headers.origin && req.headers.origin !== origin) fail(403, 'Origem não permitida.');
      if (req.method === 'GET' && path === '/api/event') return send(200, { startedAt: started(), participants: rows().map(p => ({ id:p.id, name:p.name })), year:2027 });
      if (req.method === 'GET' && path === '/api/health') return send(200, { ok:true });
      if (req.method === 'POST' && path === '/api/login') {
        limit(req);
        const input = await body(req);
        const p = db.prepare('SELECT * FROM participants WHERE id=?').get(Number(input.id) || -1);
        // A dummy verification keeps unknown names and invalid codes on a similar work path.
        const valid = verifySecret(String(input.code || '').toUpperCase().trim(), p?.code_hash || hashSecret('invalid-placeholder'));
        if (!p || !valid) fail(401, 'Nome ou código incorreto. Confira com o organizador.');
        db.prepare('UPDATE participants SET confirmed_at=COALESCE(confirmed_at,?) WHERE id=?').run(now(), p.id);
        newSession(res, 'participant', p.id);
        return send(200, { ok:true });
      }
      if (req.method === 'POST' && path === '/api/admin/login') {
        limit(req); const input = await body(req);
        if (!adminHash) fail(503, 'O organizador precisa configurar a senha no servidor.');
        if (!verifySecret(input.password, adminHash)) fail(401, 'Senha incorreta.');
        newSession(res, 'admin'); audit('Login do organizador');
        return send(200, { ok:true });
      }
      if (req.method === 'POST' && ['/api/logout','/api/admin/logout'].includes(path)) {
        const role = path.includes('/admin/') ? 'admin' : 'participant';
        const s = session(req, role); db.prepare('DELETE FROM sessions WHERE hash=?').run(s.hash);
        res.setHeader('Set-Cookie', `${production ? '__Host-' : ''}familia_${role}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${production ? '; Secure' : ''}`);
        return send(200, { ok:true });
      }
      if (req.method === 'GET' && path === '/api/me') {
        const s = session(req, 'participant');
        const p = db.prepare('SELECT id,name,confirmed_at,revealed_at FROM participants WHERE id=?').get(s.participant_id);
        return send(200, { ...p, startedAt: started() });
      }
      if ((req.method === 'POST' && path === '/api/reveal') || (req.method === 'GET' && path === '/api/result')) {
        const s = session(req, 'participant');
        const p = db.prepare('SELECT * FROM participants WHERE id=?').get(s.participant_id);
        if (!started()) fail(409, 'O organizador ainda vai iniciar o sorteio.');
        if (req.method === 'GET' && !p.revealed_at) fail(409, 'Gire sua roleta primeiro.');
        const receiver = db.prepare('SELECT p.id,p.name FROM pairs JOIN participants p ON p.id=pairs.receiver WHERE giver=?').get(p.id);
        if (!receiver) fail(409, 'Sorteio indisponível. Consulte o organizador.');
        if (req.method === 'POST') db.prepare('UPDATE participants SET revealed_at=COALESCE(revealed_at,?) WHERE id=?').run(now(), p.id);
        return send(200, { participant:p.name, receiver, revealedAt:p.revealed_at || now() });
      }
      if (path.startsWith('/api/admin/')) {
        session(req, 'admin');
        if (req.method === 'GET' && path === '/api/admin/dashboard') return send(200, { participants:rows(), startedAt:started(), audit:db.prepare('SELECT * FROM audit ORDER BY id DESC LIMIT 20').all() });
        if (req.method === 'GET' && path === '/api/admin/results') return send(200, db.prepare('SELECT a.name AS giver,b.name AS receiver FROM pairs JOIN participants a ON a.id=giver JOIN participants b ON b.id=receiver ORDER BY a.id').all());
        if (req.method !== 'POST') fail(404, 'Operação não encontrada.');
        const input = await body(req);
        if (path === '/api/admin/codes') {
          const id = input.id == null ? null : Number(input.id);
          if (id !== null && !rows().some(p => p.id === id)) fail(404, 'Participante não encontrado.');
          const codes = transaction(() => {
            const output = [];
            for (const p of rows().filter(p => id !== null ? p.id === id : !p.has_code)) {
              const code = randomBytes(6).toString('hex').toUpperCase();
              db.prepare('UPDATE participants SET code_hash=? WHERE id=?').run(hashSecret(code), p.id);
              db.prepare("DELETE FROM sessions WHERE participant_id=? AND role='participant'").run(p.id);
              output.push({ id:p.id, name:p.name, code });
            }
            audit(id !== null ? `Código substituído: participante ${id}` : 'Códigos individuais gerados');
            return output;
          });
          return send(200, codes);
        }
        if (path === '/api/admin/start') {
          transaction(() => {
            if (started()) fail(409, 'O sorteio já foi iniciado.');
            const participants = rows();
            if (participants.length < 2) fail(409, 'Inclua pelo menos dois participantes.');
            if (participants.some(p => !p.has_code)) fail(409, 'Gere os códigos individuais antes de começar.');
            const pairs = createDraw(participants.map(p => p.id));
            for (const pair of pairs) db.prepare('INSERT INTO pairs VALUES(?,?)').run(pair.giver, pair.receiver);
            db.prepare('UPDATE settings SET started_at=? WHERE id=1').run(now()); audit('Sorteio global iniciado');
          }); return send(200, { ok:true });
        }
        if (path === '/api/admin/reset') {
          if (input.confirmation !== 'INVALIDAR RESULTADOS' || !verifySecret(input.password, adminHash)) fail(400, 'Digite INVALIDAR RESULTADOS e confirme a senha administrativa.');
          transaction(() => {
            db.exec("DELETE FROM pairs; UPDATE settings SET started_at=NULL WHERE id=1; UPDATE participants SET revealed_at=NULL; DELETE FROM sessions WHERE role='participant'");
            audit('Sorteio reiniciado: resultados e sessões anteriores invalidados');
          }); return send(200, { ok:true });
        }
        if (path === '/api/admin/participants') fail(403, 'A lista é fixa: somente os 12 nomes informados pela família.');
      }
      fail(404, 'Operação não encontrada.');
    } catch (error) {
      if (!error.status) console.error('Falha interna:', error.code || error.name);
      if (!res.headersSent) send(error.status || 500, { error:error.status ? error.message : 'Não foi possível concluir. Tente novamente.' });
      else res.end();
    }
  });
  return { server, db };
}
