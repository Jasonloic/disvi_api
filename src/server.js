require('dotenv').config();

const app = require('./app');
const { checkDatabaseConnection } = require('./config/database');
const { initScheduler }           = require('./services/scheduler.service');

const PORT = Number(process.env.PORT) || 3000;

async function bootstrap() {
  await checkDatabaseConnection();

  await initScheduler();

  app.listen(PORT, () => {
    console.log(`[SERVER] Démarré sur http://localhost:${PORT}`);
    console.log(`[SERVER] Environnement : ${process.env.NODE_ENV ?? 'development'}`);
    console.log(`[SERVER] Instance      : ${process.env.INSTANCE_ID ?? 'single'}`);
  });
}

bootstrap().catch((err) => {
  console.error('[SERVER] Échec du démarrage :', err.message);
  process.exit(1);
});