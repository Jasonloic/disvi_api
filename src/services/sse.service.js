/**
 * Service SSE — Server-Sent Events
 * Gère les connexions temps réel des clients connectés.
 * Pas de dépendance externe — natif Node.js/Express.
 */

// Map<userId, Response[]> — un utilisateur peut avoir plusieurs onglets ouverts
const clients = new Map();

// ─── Enregistrer un client ────────────────────────────────────────────────────

function addClient(userId, res) {
  if (!clients.has(userId)) clients.set(userId, []);
  clients.get(userId).push(res);
  console.log(`[SSE] Client connecté — userId: ${userId} (${clients.get(userId).length} connexion(s))`);
}

// ─── Supprimer un client ──────────────────────────────────────────────────────

function removeClient(userId, res) {
  if (!clients.has(userId)) return;
  const filtered = clients.get(userId).filter((r) => r !== res);
  if (filtered.length === 0) {
    clients.delete(userId);
  } else {
    clients.set(userId, filtered);
  }
  console.log(`[SSE] Client déconnecté — userId: ${userId}`);
}

// ─── Envoyer un événement à un utilisateur ────────────────────────────────────

function sendToUser(userId, event, data) {
  if (!clients.has(userId)) return 0;
  const connections = clients.get(userId);
  const payload     = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  let   sent        = 0;

  for (const res of connections) {
    try {
      res.write(payload);
      sent++;
    } catch (err) {
      console.error(`[SSE] Erreur envoi userId ${userId} :`, err.message);
    }
  }
  return sent;
}

// ─── Broadcast à tous les clients connectés ───────────────────────────────────

function broadcast(event, data) {
  let total = 0;
  for (const [userId] of clients) {
    total += sendToUser(userId, event, data);
  }
  if (total > 0) console.log(`[SSE] Broadcast "${event}" → ${total} client(s)`);
  return total;
}

// ─── Envoyer un ping keepalive ────────────────────────────────────────────────

function ping() {
  const payload = ': ping\n\n';
  for (const connections of clients.values()) {
    for (const res of connections) {
      try { res.write(payload); } catch { /* client déconnecté */ }
    }
  }
}

// ─── Statistiques ─────────────────────────────────────────────────────────────

function getStats() {
  let total = 0;
  for (const connections of clients.values()) total += connections.length;
  return { users: clients.size, connections: total };
}

// Keepalive toutes les 30 secondes pour éviter les timeouts proxy/nginx
setInterval(ping, 30_000);

module.exports = { addClient, removeClient, sendToUser, broadcast, getStats };