const notificationService = require('../services/notification.service');
const sseService          = require('../services/sse.service');

function ok(res, data, status = 200) {
  return res.status(status).json({ success: true, data });
}

function fail(res, error, status = 400) {
  return res.status(status).json({ success: false, error });
}

function getUserId(req) {
  return req.user?.id_user ?? req.headers['x-user-id'] ?? null;
}

function connectSSE(req, res) {
  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({ success: false, error: 'Utilisateur non identifié.' });
    return;
  }

  // En-têtes SSE obligatoires
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Désactive le buffering Nginx
  res.flushHeaders();

  // Événement de bienvenue
  res.write(`event: connected\ndata: ${JSON.stringify({
    message:   'Connexion SSE établie.',
    userId,
    timestamp: new Date().toISOString(),
  })}\n\n`);

  // Envoyer le nombre de notifications non lues au moment de la connexion
  notificationService.countNonLues(userId).then((count) => {
    res.write(`event: badge\ndata: ${JSON.stringify({ non_lues: count })}\n\n`);
  }).catch(() => {});

  // Enregistrer le client
  sseService.addClient(userId, res);

  // Nettoyage à la déconnexion
  req.on('close', () => {
    sseService.removeClient(userId, res);
  });
}

async function listNotifications(req, res, next) {
  const userId   = getUserId(req);
  if (!userId) return fail(res, 'Utilisateur non identifié.', 401);

  const limit    = Math.min(Number(req.query.limit)  || 20, 100);
  const offset   = Math.max(Number(req.query.offset) || 0,  0);
  const nonLues  = req.query.non_lues === 'true';

  try {
    const [alertes, total] = await Promise.all([
      notificationService.getAlertesByUser(userId, { limit, offset, nonLues }),
      notificationService.countNonLues(userId),
    ]);
    res.setHeader('X-Total-Count', String(alertes.length));
    return ok(res, { alertes, non_lues: total, limit, offset });
  } catch (err) {
    next(err);
  }
}

async function marquerLue(req, res, next) {
  const userId   = getUserId(req);
  const idAlerte = req.params.id;
  if (!userId) return fail(res, 'Utilisateur non identifié.', 401);

  try {
    await notificationService.marquerEnvoyee(idAlerte);

    // Mettre à jour le badge
    const nonLues = await notificationService.countNonLues(userId);
    sseService.sendToUser(userId, 'badge', { non_lues: nonLues });

    return ok(res, { message: 'Notification marquée comme lue.' });
  } catch (err) {
    next(err);
  }
}

async function marquerToutesLues(req, res, next) {
  const userId = getUserId(req);
  if (!userId) return fail(res, 'Utilisateur non identifié.', 401);

  try {
    const { pool } = require('../config/database');
    await pool.query(
      `UPDATE alerte SET statut_envoi = true
       WHERE id_destinataire = $1 AND type_alerte = 'in_app'`,
      [userId]
    );

    sseService.sendToUser(userId, 'badge', { non_lues: 0 });
    return ok(res, { message: 'Toutes les notifications marquées comme lues.' });
  } catch (err) {
    next(err);
  }
}

function sseStats(req, res) {
  return ok(res, sseService.getStats());
}

module.exports = {
  connectSSE,
  listNotifications,
  marquerLue,
  marquerToutesLues,
  sseStats,
};