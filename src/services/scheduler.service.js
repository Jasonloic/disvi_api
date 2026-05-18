const cron = require('node-cron');
const { findAllRSSSources } = require('../models/source.model');
const { crawlSource }       = require('./rss.crawler.service');

const activeJobs = new Map();

function minutesToCron(minutes) {
  const m = Math.max(1, Math.floor(minutes));
  if (m < 60)   return `*/${m} * * * *`;
  if (m < 1440) return `0 */${Math.floor(m / 60)} * * *`;
  return `0 0 */${Math.floor(m / 1440)} * *`;
}

function scheduleSource(source) {
  if (activeJobs.has(source.id_source)) {
    activeJobs.get(source.id_source).stop();
    activeJobs.delete(source.id_source);
  }

  const frequence  = source.frequence_check ?? 60;
  const expression = minutesToCron(frequence);

  if (!cron.validate(expression)) {
    console.error(`[SCHEDULER] Expression invalide pour source ${source.id_source}`);
    return;
  }

  const job = cron.schedule(expression, async () => {
    console.log(`[SCHEDULER] Crawl — ${source.nom_source} (user: ${source.id_user})`);
    try { await crawlSource(source); }
    catch (err) { console.error(`[SCHEDULER] Erreur : ${err.message}`); }
  });

  activeJobs.set(source.id_source, job);
  console.log(`[SCHEDULER] "${source.nom_source}" planifiée — ${expression}`);
}

function unscheduleSource(idSource) {
  if (activeJobs.has(idSource)) {
    activeJobs.get(idSource).stop();
    activeJobs.delete(idSource);
    console.log(`[SCHEDULER] Job source ${idSource} arrêté.`);
  }
}

async function initScheduler() {
  const sources = await findAllRSSSources();

  if (sources.length === 0) {
    console.log('[SCHEDULER] Aucune source RSS à planifier.');
    return;
  }

  for (const source of sources) scheduleSource(source);

  console.log('[SCHEDULER] Crawl initial...');
  for (const source of sources) {
    try { await crawlSource(source); }
    catch (err) { console.error(`[SCHEDULER] Crawl initial échoué : ${err.message}`); }
  }
}

function getSchedulerStatus() {
  const status = [];
  for (const [idSource, job] of activeJobs.entries()) {
    status.push({ id_source: idSource, running: job.getStatus?.() === 'running' });
  }
  return status;
}

module.exports = { initScheduler, scheduleSource, unscheduleSource, getSchedulerStatus };