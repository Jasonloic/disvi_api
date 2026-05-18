function errorMiddleware(err, req, res, next) {
  const statusCode = err.statusCode ?? 500;
  const isDev      = process.env.NODE_ENV === 'development';

  console.error(`[ERROR] ${req.method} ${req.originalUrl} — ${err.message}`);
  if (isDev) console.error(err.stack);

  res.status(statusCode).json({
    success: false,
    error:   statusCode === 500 && !isDev
      ? 'Une erreur interne est survenue.'
      : err.message,
    ...(isDev && { stack: err.stack }),
  });
}

function notFoundMiddleware(req, res) {
  res.status(404).json({
    success: false,
    error:   `Route introuvable : ${req.method} ${req.originalUrl}`,
  });
}

module.exports = { errorMiddleware, notFoundMiddleware };