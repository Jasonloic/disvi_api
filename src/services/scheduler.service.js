const cron = require('node-cron');
const { pool }            = require('../config/database');
const { crawlSource }     = require('./rss.crawler.service');

//  Registre des jobs actifs
// Map<id_source, cron.ScheduledTask>
const activeJobs = new Map();

//  Conversion frequence_check (minutes) → expression cron
function minutesToCron(minutes) {
  const m = Math.max(1, Math.floor(minutes));

  if (m < 60)   return `*/${m} * * * *`;          // toutes les N minutes
  if (m < 1440) return `0 */${Math.floor(m / 60)} * * *`;  // toutes les N heures
  return `0 0 */${Math.floor(m / 1440)} * *`;      // tous les N jours
}

//  Enregistrer un job pour une source 

function scheduleSource(source) {
  // Arrêter l'ancien job si existant
  if (activeJobs.has(source.id_source)) {
    activeJobs.get(source.id_source).stop();
    activeJobs.delete(source.id_source);
  }

  const frequence = source.frequence_check ?? 60;
  const expression = minutesToCron(frequence);

  if (!cron.validate(expression)) {
    console.error(`[SCHEDULER] Expression cron invalide pour source ${source.id_source} : "${expression}"`);
    return;
  }

  const job = cron.schedule(expression, async () => {
    console.log(`[SCHEDULER] Déclenchement crawl — ${source.nom_source} (toutes les ${frequence} min)`);
    try {
      await crawlSource(source);
    } catch (err) {
      console.error(`[SCHEDULER] Erreur crawl ${source.nom_source} : ${err.message}`);
    }
  });

  activeJobs.set(source.id_source, job);
  console.log(`[SCHEDULER] Source "${source.nom_source}" planifiée — ${expression} (${frequence} min)`);
}

//  Arrêter le job d'une source 

function unscheduleSource(idSource) {
  if (activeJobs.has(idSource)) {
    activeJobs.get(idSource).stop();
    activeJobs.delete(idSource);
    console.log(`[SCHEDULER] Job source ${idSource} arrêté.`);
  }
}

// Initialisation au démarrage
// Charge toutes les sources RSS depuis la DB et planifie leurs crawls.
// Déclenche aussi un crawl immédiat pour peupler la base dès le démarrage.

async function initScheduler() {
  const { rows: sources } = await pool.query(
    `SELECT id_source, nom_source, url_source, frequence_check
     FROM source
     WHERE type_source = 'RSS' AND url_source IS NOT NULL`
  );

  if (sources.length === 0) {
    console.log('[SCHEDULER] Aucune source RSS à planifier au démarrage.');
    return;
  }

  for (const source of sources) {
    scheduleSource(source);
  }

  // Crawl immédiat au démarrage pour ne pas attendre le premier tick du cron
  console.log('[SCHEDULER] Crawl initial au démarrage...');
  for (const source of sources) {
    try {
      await crawlSource(source);
    } catch (err) {
      console.error(`[SCHEDULER] Crawl initial échoué pour ${source.nom_source} : ${err.message}`);
    }
  }
}

// État des jobs (pour debug/monitoring) 

function getSchedulerStatus() {
  const status = [];
  for (const [idSource, job] of activeJobs.entries()) {
    status.push({ id_source: idSource, running: job.getStatus() === 'running' });
  }
  return status;
}

module.exports = { initScheduler, scheduleSource, unscheduleSource, getSchedulerStatus };