import { createApp } from './app.mjs';
const { server, db } = createApp({
  databasePath: process.env.DATABASE_PATH || './data/familia.sqlite',
  adminHash: process.env.ADMIN_PASSWORD_HASH || '',
  origin: process.env.APP_ORIGIN || 'http://localhost:5173',
  production: process.env.NODE_ENV === 'production'
});
server.listen(Number(process.env.PORT || 3001), '0.0.0.0', () => console.log('Servidor da família pronto.'));
for (const signal of ['SIGTERM','SIGINT']) process.on(signal, () => server.close(() => { db.close(); process.exit(0); }));
