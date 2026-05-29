const rawOrigins     = process.env.CORS_ORIGINS ?? "";
const allowedOrigins = rawOrigins.split(",").map((o) => o.trim()).filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS : origine non autorisée — ${origin}`));
  },
  methods:             ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders:      ["Content-Type", "Authorization", "ngrok-skip-browser-warning"],
  exposedHeaders:      ["X-Total-Count"],
  credentials:         true,
  optionsSuccessStatus: 204,
};

module.exports = { corsOptions };