const authService = require('../services/auth.service');

function ok(res, data, status = 200) {
  return res.status(status).json({ success: true, data });
}

function fail(res, error, status = 400) {
  return res.status(status).json({ success: false, error });
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function signup(req, res, next) {
  const { email, mot_de_passe, role } = req.body;

  if (!email || !isValidEmail(email))
    return fail(res, 'Email invalide.');
  if (!mot_de_passe || mot_de_passe.length < 8)
    return fail(res, 'Mot de passe trop court (8 caractères minimum).');

  try {
    const { user, accessToken, refreshToken } = await authService.signup({
      email: email.trim().toLowerCase(),
      mot_de_passe,
      role: role || 'Veilleur',
    });

    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge:   7 * 24 * 60 * 60 * 1000,
    });

    return ok(res, { user, accessToken }, 201);
  } catch (err) { next(err); }
}


async function login(req, res, next) {
  const { email, mot_de_passe } = req.body;

  if (!email || !mot_de_passe)
    return fail(res, 'Email et mot de passe requis.');

  try {
    const { user, accessToken, refreshToken } = await authService.login({
      email: email.trim().toLowerCase(),
      mot_de_passe,
    });

    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge:   7 * 24 * 60 * 60 * 1000,
    });

    return ok(res, { user, accessToken });
  } catch (err) { next(err); }
}


async function refresh(req, res, next) {
  // Priorité au cookie httpOnly, fallback sur le body
  const refreshToken = req.cookies?.refresh_token || req.body?.refresh_token;

  try {
    const { accessToken, refreshToken: newRefresh } = await authService.refresh(refreshToken);

    res.cookie('refresh_token', newRefresh, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge:   7 * 24 * 60 * 60 * 1000,
    });

    return ok(res, { accessToken });
  } catch (err) { next(err); }
}


async function logout(req, res, next) {
  const refreshToken = req.cookies?.refresh_token || req.body?.refresh_token;
  try {
    await authService.logout(refreshToken);
    res.clearCookie('refresh_token');
    return ok(res, { message: 'Déconnexion réussie.' });
  } catch (err) { next(err); }
}

async function logoutAll(req, res, next) {
  try {
    await authService.logoutAll(req.user.id_user);
    res.clearCookie('refresh_token');
    return ok(res, { message: 'Toutes les sessions révoquées.' });
  } catch (err) { next(err); }
}


async function getProfile(req, res, next) {
  try {
    const user = await authService.getProfile(req.user.id_user);
    return ok(res, user);
  } catch (err) { next(err); }
}


async function changePassword(req, res, next) {
  const { ancien_mot_de_passe, nouveau_mot_de_passe } = req.body;
  if (!ancien_mot_de_passe || !nouveau_mot_de_passe)
    return fail(res, 'Les deux mots de passe sont requis.');
  if (nouveau_mot_de_passe.length < 8)
    return fail(res, 'Nouveau mot de passe trop court (8 caractères minimum).');

  try {
    await authService.changePassword(req.user.id_user, {
      ancien_mot_de_passe,
      nouveau_mot_de_passe,
    });
    return ok(res, { message: 'Mot de passe modifié. Reconnectez-vous.' });
  } catch (err) { next(err); }
}

module.exports = { signup, login, refresh, logout, logoutAll, getProfile, changePassword };