const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const AuthModel = require('../models/auth.model');

const JWT_SECRET         = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const ACCESS_EXPIRY      = process.env.JWT_ACCESS_EXPIRY  || '15m';
const REFRESH_EXPIRY     = process.env.JWT_REFRESH_EXPIRY || '7d';
const BCRYPT_ROUNDS      = 12;


function generateAccessToken(user) {
  return jwt.sign(
    { id_user: user.id_user, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: ACCESS_EXPIRY }
  );
}

function generateRefreshToken(user) {
  return jwt.sign(
    { id_user: user.id_user },
    JWT_REFRESH_SECRET,
    { expiresIn: REFRESH_EXPIRY }
  );
}

function refreshExpiresAt() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d;
}

async function signup({ email, mot_de_passe, role = 'Veilleur' }) {
  const existing = await AuthModel.findUserByEmail(email);
  if (existing) throw Object.assign(new Error('Email déjà utilisé.'), { statusCode: 409 });

  const VALID_ROLES = ['Admin', 'Veilleur'];
  if (!VALID_ROLES.includes(role))
    throw Object.assign(new Error('Rôle invalide.'), { statusCode: 400 });

  const hash = await bcrypt.hash(mot_de_passe, BCRYPT_ROUNDS);
  const user  = await AuthModel.createUser({ email, mot_de_passe: hash, role });

  const accessToken  = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);
  await AuthModel.saveRefreshToken(user.id_user, refreshToken, refreshExpiresAt());

  return { user, accessToken, refreshToken };
}

async function login({ email, mot_de_passe }) {
  const user = await AuthModel.findUserByEmail(email);
  if (!user) throw Object.assign(new Error('Email ou mot de passe incorrect.'), { statusCode: 401 });

  const valid = await bcrypt.compare(mot_de_passe, user.mot_de_passe);
  if (!valid) throw Object.assign(new Error('Email ou mot de passe incorrect.'), { statusCode: 401 });

  const accessToken  = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);
  await AuthModel.saveRefreshToken(user.id_user, refreshToken, refreshExpiresAt());

  const { mot_de_passe: _, ...safeUser } = user;
  return { user: safeUser, accessToken, refreshToken };
}

async function refresh(refreshToken) {
  if (!refreshToken)
    throw Object.assign(new Error('Refresh token manquant.'), { statusCode: 401 });
  const stored = await AuthModel.findRefreshToken(refreshToken);
  if (!stored || stored.revoked)
    throw Object.assign(new Error('Refresh token invalide ou révoqué.'), { statusCode: 401 });

  if (new Date(stored.expires_at) < new Date())
    throw Object.assign(new Error('Refresh token expiré.'), { statusCode: 401 });
  let payload;
  try {
    payload = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
  } catch {
    throw Object.assign(new Error('Refresh token invalide.'), { statusCode: 401 });
  }

  const user = await AuthModel.findUserById(payload.id_user);
  if (!user) throw Object.assign(new Error('Utilisateur introuvable.'), { statusCode: 401 });
  await AuthModel.revokeRefreshToken(refreshToken);
  const newAccessToken  = generateAccessToken(user);
  const newRefreshToken = generateRefreshToken(user);
  await AuthModel.saveRefreshToken(user.id_user, newRefreshToken, refreshExpiresAt());

  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
}

async function logout(refreshToken) {
  if (refreshToken) await AuthModel.revokeRefreshToken(refreshToken);
}

async function logoutAll(idUser) {
  await AuthModel.revokeAllUserTokens(idUser);
}

async function getProfile(idUser) {
  const user = await AuthModel.findUserById(idUser);
  if (!user) throw Object.assign(new Error('Utilisateur introuvable.'), { statusCode: 404 });
  return user;
}

async function changePassword(idUser, { ancien_mot_de_passe, nouveau_mot_de_passe }) {
  const user = await AuthModel.findUserByEmail(
    (await AuthModel.findUserById(idUser)).email
  );

  const valid = await bcrypt.compare(ancien_mot_de_passe, user.mot_de_passe);
  if (!valid)
    throw Object.assign(new Error('Ancien mot de passe incorrect.'), { statusCode: 401 });

  const hash = await bcrypt.hash(nouveau_mot_de_passe, BCRYPT_ROUNDS);
  await AuthModel.updatePassword(idUser, hash);
  await AuthModel.revokeAllUserTokens(idUser);
}

module.exports = { signup, login, refresh, logout, logoutAll, getProfile, changePassword };