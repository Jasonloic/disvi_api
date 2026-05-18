const NoteModel = require('../models/note.article.model');

function ok(res, data, status = 200) {
  return res.status(status).json({ success: true, data });
}

function fail(res, error, status = 400) {
  return res.status(status).json({ success: false, error });
}

function getUserId(req) {
  return req.user?.id_user ?? req.headers['x-user-id'] ?? null;
}

async function getNote(req, res, next) {
  const idUser    = getUserId(req);
  const idArticle = req.params.id;
  if (!idUser) return fail(res, 'Utilisateur non identifie.', 401);
  try {
    const note = await NoteModel.findNoteByUserAndArticle(idUser, idArticle);
    if (!note) return fail(res, 'Aucune note pour cet article.', 404);
    return ok(res, note);
  } catch (err) { next(err); }
}

async function listNotes(req, res, next) {
  const idUser = getUserId(req);
  if (!idUser) return fail(res, 'Utilisateur non identifie.', 401);
  try {
    const notes = await NoteModel.findNotesByUser(idUser);
    return ok(res, notes);
  } catch (err) { next(err); }
}

async function upsertNote(req, res, next) {
  const idUser    = getUserId(req);
  const idArticle = req.params.id;
  if (!idUser) return fail(res, 'Utilisateur non identifie.', 401);
  const { contenu } = req.body;
  if (!contenu || !String(contenu).trim())
    return fail(res, 'contenu est requis.');
  if (String(contenu).trim().length > 5000)
    return fail(res, 'La note ne peut pas depasser 5000 caracteres.');
  try {
    const note = await NoteModel.upsertNote(idUser, idArticle, String(contenu).trim());
    return ok(res, note, 200);
  } catch (err) { next(err); }
}

async function deleteNote(req, res, next) {
  const idUser    = getUserId(req);
  const idArticle = req.params.id;
  if (!idUser) return fail(res, 'Utilisateur non identifie.', 401);
  try {
    const deleted = await NoteModel.deleteNote(idUser, idArticle);
    if (!deleted) return fail(res, 'Note introuvable.', 404);
    return ok(res, { message: 'Note supprimee.' });
  } catch (err) { next(err); }
}

module.exports = { getNote, listNotes, upsertNote, deleteNote };
