// =============================================================================
// Service d'export CoNLL-2003 BIO
// =============================================================================
// Format produit :
//   token\tTAG
//   (ligne vide entre les phrases)
//
// Tags utilisés :
//   B-LOC  : premier token d'un lieu
//   I-LOC  : token suivant d'un lieu multi-mots
//   B-PER  : premier token d'une personne
//   I-PER  : token suivant d'une personne multi-mots
//   B-ORG  : premier token d'une organisation
//   I-ORG  : token suivant
//   O      : hors entité
// =============================================================================

// ─── Tokenisation ─────────────────────────────────────────────────────────────
// Tokenisation naïve par espaces et ponctuation.
// Conserve la position caractère de chaque token pour l'alignement NER.

function tokenize(text) {
  const tokens = [];
  // Découpe sur les espaces et conserve la ponctuation comme token séparé
  const regex = /\S+/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const raw   = match[0];
    const start = match.index;

    // Sépare la ponctuation finale du mot (ex: "Yaoundé," → "Yaoundé" + ",")
    const cleaned = raw.replace(/[.,;:!?()"»«\][\-]+$/g, '');
    const punct   = raw.slice(cleaned.length);

    if (cleaned.length > 0) {
      tokens.push({ text: cleaned, start, end: start + cleaned.length });
    }
    if (punct.length > 0) {
      tokens.push({
        text:  punct,
        start: start + cleaned.length,
        end:   start + raw.length,
      });
    }
  }

  return tokens;
}

// ─── Construction des spans d'entités ────────────────────────────────────────
// Convertit entites_nommees en liste de spans avec leur tag BIO.
// { start: int, end: int, tag: 'LOC'|'PER'|'ORG' }

function buildEntitySpans(text, entitesNommees) {
  if (!entitesNommees || typeof entitesNommees !== 'object') return [];

  const spans = [];
  const lowerText = text.toLowerCase();

  const groups = [
    { key: 'lieux',          tag: 'LOC' },
    { key: 'personnes',      tag: 'PER' },
    { key: 'organisations',  tag: 'ORG' },
  ];

  for (const { key, tag } of groups) {
    const entities = entitesNommees[key];
    if (!Array.isArray(entities)) continue;

    for (const entity of entities) {
      const nom = entity.nom;
      if (!nom || typeof nom !== 'string') continue;

      const lowerNom = nom.toLowerCase().trim();
      let searchFrom = 0;

      // Trouve toutes les occurrences dans le texte
      while (searchFrom < lowerText.length) {
        const idx = lowerText.indexOf(lowerNom, searchFrom);
        if (idx === -1) break;

        // Vérifie que c'est une limite de mot (pas au milieu d'un token)
        const before = idx === 0          || /\W/.test(text[idx - 1]);
        const after  = idx + lowerNom.length >= text.length
          || /\W/.test(text[idx + lowerNom.length]);

        if (before && after) {
          spans.push({ start: idx, end: idx + lowerNom.length, tag });
        }

        searchFrom = idx + 1;
      }
    }
  }

  // Trie par position et supprime les chevauchements (priorité au plus long)
  spans.sort((a, b) => a.start - b.start || b.end - a.end);

  const deduplicated = [];
  let lastEnd = -1;
  for (const span of spans) {
    if (span.start >= lastEnd) {
      deduplicated.push(span);
      lastEnd = span.end;
    }
  }

  return deduplicated;
}

// ─── Attribution des tags BIO à chaque token ─────────────────────────────────

function tagTokens(tokens, spans) {
  const tagged = tokens.map((token) => ({ ...token, tag: 'O' }));

  for (const span of spans) {
    let isFirst = true;
    for (const token of tagged) {
      // Un token appartient au span si son début est dans le span
      if (token.start >= span.start && token.end <= span.end) {
        token.tag = isFirst ? `B-${span.tag}` : `I-${span.tag}`;
        isFirst   = false;
      }
    }
  }

  return tagged;
}

// ─── Découpage en phrases ─────────────────────────────────────────────────────
// Découpe la séquence de tokens en phrases de 50 tokens max.
// Les séquences longues dégradent l'entraînement des modèles BERT/RoBERTa.

function splitIntoSentences(taggedTokens, maxLen = 50) {
  const sentences = [];
  let current     = [];

  for (const token of taggedTokens) {
    current.push(token);

    const isPunct = /^[.!?]$/.test(token.text);
    if ((isPunct && current.length > 5) || current.length >= maxLen) {
      sentences.push(current);
      current = [];
    }
  }

  if (current.length > 0) sentences.push(current);
  return sentences;
}

// ─── Formatage CoNLL-2003 ─────────────────────────────────────────────────────

function formatCoNLL(sentences) {
  return sentences
    .map((sentence) =>
      sentence.map((t) => `${t.text}\t${t.tag}`).join('\n')
    )
    .join('\n\n');
}

// ─── Point d'entrée : un article ─────────────────────────────────────────────

function articleToCoNLL(contenuBrut, entitesNommees) {
  if (!contenuBrut) return '';

  const tokens    = tokenize(contenuBrut);
  const spans     = buildEntitySpans(contenuBrut, entitesNommees);
  const tagged    = tagTokens(tokens, spans);
  const sentences = splitIntoSentences(tagged);

  return formatCoNLL(sentences);
}

// ─── Point d'entrée : corpus complet (plusieurs articles) ────────────────────

function corpusToCoNLL(articles) {
  return articles
    .map((art) => {
      const header = `# id=${art.id_article} titre=${art.titre?.replace(/\n/g, ' ') ?? ''}`;
      const conll  = articleToCoNLL(art.contenu_brut, art.entites_nommees);
      return conll ? `${header}\n${conll}` : null;
    })
    .filter(Boolean)
    .join('\n\n');
}

module.exports = { articleToCoNLL, corpusToCoNLL };