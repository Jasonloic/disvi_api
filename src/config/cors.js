const rawOrigins = process.env.CORS_ORIGINS;
const allowedOrigins = rawOrigins.split(',').map((o) => o.trim());

const corsOptions = {
  origin(origin, callback) {
    // Autoriser les requêtes sans origin (Postman, appels serveur-à-serveur)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS : origine non autorisée — ${origin}`));
  },
  methods:             ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders:      ['Content-Type', 'Authorization'],
  exposedHeaders:      ['X-Total-Count'],
  credentials:         true,
  optionsSuccessStatus: 204,
};

module.exports = { corsOptions };