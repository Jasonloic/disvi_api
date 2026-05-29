const { pool } = require('../config/database');

const RULES = [
  {
    categorie: 'Politique',
    keywords: [
      'gouvernement', 'parlement', 'ministre', 'president', 'election',
      'vote', 'parti', 'senat', 'depute', 'loi', 'decret', 'biya',
      'opposition', 'republique', 'assemblee', 'politique', 'diplomatique',
      'ambassadeur', 'traite', 'constitution', 'reforme',
    ],
  },
  {
    categorie: 'Securite',
    keywords: [
      'armee', 'militaire', 'police', 'gendarmerie', 'terrorisme', 'boko haram',
      'ambazonie', 'separatiste', 'guerre', 'conflit', 'attentat', 'attaque',
      'securite', 'frontiere', 'soldat', 'crime', 'violence', 'kidnapping',
      'enlevement', 'insecurite', 'mort', 'blessé', 'tir',
    ],
  },
  {
    categorie: 'Economie',
    keywords: [
      'economie', 'croissance', 'pib', 'budget', 'investissement', 'bourse',
      'franc cfa', 'banque', 'dette', 'inflation', 'marche', 'commerce',
      'entreprise', 'societe', 'fmi', 'banque mondiale', 'exportation',
      'importation', 'finances', 'fiscal', 'impot', 'douane', 'petrole',
      'mining', 'minier', 'agriculture', 'cocao', 'cafe',
    ],
  },
  {
    categorie: 'Technologie',
    keywords: [
      'technologie', 'numerique', 'internet', 'mobile', 'telephone', 'mtn',
      'orange', 'camtel', 'startup', 'innovation', 'intelligence artificielle',
      'ia', 'application', 'logiciel', 'data', 'cybersecurite', 'hacker',
      'reseau', '5g', '4g', 'telecoms', 'digital', 'fintech',
    ],
  },
  {
    categorie: 'Sante',
    keywords: [
      'sante', 'hopital', 'medecin', 'maladie', 'epidemie', 'vaccin',
      'covid', 'paludisme', 'cholera', 'ebola', 'vih', 'sida', 'pharmacie',
      'medicament', 'chirurgie', 'urgence', 'deces', 'mortalite',
      'maternite', 'enfant', 'nutrition', 'oms', 'manaouda malachi',
    ],
  },
  {
    categorie: 'Education',
    keywords: [
      'education', 'ecole', 'universite', 'etudiant', 'eleve', 'enseignant',
      'professeur', 'formation', 'diplome', 'baccalaureat', 'concours',
      'bourse', 'alphabetisation', 'pedagogie', 'greve scolaire',
      'minesup', 'minedub', 'recherche', 'scolarite', 'minesec',
    ],
  },
  {
    categorie: 'Sport',
    keywords: [
      'sport', 'football', 'lion indomptable', 'lions indomptables', 'fecafoot', 'coupe',
      'can', 'fifa', 'match', 'equipe', 'joueur', 'entraineur', 'club',
      'athletisme', 'basket', 'natation', 'jeux olympiques', 'medaille',
      'champion', 'victoire', 'defaite', 'score', 'eto\'o', 'milla',
    ],
  },
  {
    categorie: 'Culture',
    keywords: [
      'culture', 'musique', 'cinema', 'theatre', 'festival', 'art',
      'patrimoine', 'tradition', 'coutume', 'religion', 'eglise', 'mosquee',
      'livre', 'litterature', 'peinture', 'sculpture', 'danse', 'artiste',
      'concert', 'spectacle', 'media', 'presse', 'journaliste',
    ],
  },
  {
    categorie: 'Environnement',
    keywords: [
      'environnement', 'foret', 'deforestation', 'climate', 'rechauffement',
      'pollution', 'dechets', 'eau', 'energie', 'solaire', 'renouvelable',
      'biodiversite', 'faune', 'flore', 'reserve', 'parc national',
      'inondation', 'secheresse', 'catastrophe naturelle',
    ],
  },
  {
    categorie: 'Social',
    keywords: [
      'social', 'pauvrete', 'chomage', 'logement', 'famille', 'femme',
      'genre', 'droits', 'humanitaire', 'refugie', 'deplacement', 'ong',
      'solidarite', 'aide', 'population', 'demographie', 'jeunesse',
      'greve', 'manifestation', 'protestation',
    ],
  },
  {
    categorie: 'Justice',
    keywords: [
      'justice', 'tribunal', 'jugement', 'condamnation', 'prison',
      'corruption', 'detournement', 'fraude', 'proces', 'avocat',
      'magistrat', 'cour supreme', 'tcs', 'conac', 'droit', 'loi',
      'arrestation', 'detention', 'liberté', 'droits de l\'homme',
    ],
  },
];

function scoreArticle(titre, contenu) {
  const text = `${titre} ${contenu}`.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const scores = [];

  for (const rule of RULES) {
    let score = 0;
    for (const kw of rule.keywords) {
      const kwNorm = kw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const regex  = new RegExp(`\\b${kwNorm}\\b`, 'g');
      const matches = text.match(regex);
      if (matches) {
        const inTitre = titre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').match(regex);
        score += matches.length + (inTitre ? inTitre.length * 2 : 0);
      }
    }
    if (score > 0) scores.push({ categorie: rule.categorie, score });
  }

  return scores
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .filter((s) => s.score >= 2);
}

async function assignCategories(idArticle, titre, contenu) {
  try {
    const matches = scoreArticle(titre, contenu || '');

    // Fallback : catégorie Général si aucune règle ne matche
    const toAssign = matches.length > 0
        ? matches
        : [{ categorie: 'General', score: 0 }];

    const assigned = [];

    for (const match of toAssign) {
      const { rows } = await pool.query(
          `INSERT INTO categorie (nom_cat)
           VALUES ($1)
             ON CONFLICT (nom_cat) DO UPDATE SET nom_cat = EXCLUDED.nom_cat
                                        RETURNING id_cat, nom_cat`,
          [match.categorie]
      );
      const categorie = rows[0];

      await pool.query(
          `INSERT INTO art_cat (id_article, id_cat)
           VALUES ($1, $2)
             ON CONFLICT DO NOTHING`,
          [idArticle, categorie.id_cat]
      );

      assigned.push({ ...categorie, score: match.score });
    }

    return assigned;
  } catch (err) {
    console.error('[AUTO CATEGORIE] Erreur :', err.message);
    return [];
  }
}

module.exports = { assignCategories, scoreArticle };