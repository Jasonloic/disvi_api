#!/usr/bin/env python3
"""
Script d'analyse NLP — appelé par Node.js via child_process.
Protocol : stdin → JSON {titre, contenu} | stdout → JSON résultat
"""

import sys
import json
import re
import unicodedata
import pickle
from pathlib import Path

import spacy
from sumy.parsers.plaintext import PlaintextParser
from sumy.nlp.tokenizers import Tokenizer
from sumy.summarizers.text_rank import TextRankSummarizer
from sumy.nlp.stemmers import Stemmer
from sumy.utils import get_stop_words

# ─── Chargement modèles (une seule fois) ─────────────────────────────────────

nlp = spacy.load("fr_core_news_lg")

SCRIPT_DIR = Path(__file__).parent
with open(SCRIPT_DIR / "gazetteer.json") as f:
    gazetteer_data = json.load(f)

GAZETTEER_NORM = set(gazetteer_data["cameroun"])
PAYS_NORM      = set(gazetteer_data["pays"])
LANGUAGE       = "french"

LABEL_MAP = {"ORG": "organisations", "PER": "personnes", "LOC": "lieux", "GPE": "lieux", "MISC": "divers"}
BLACKLIST  = {"", "le", "la", "les", "un", "une", "des", "du", "ce", "cette", "ces"}

# ─── Fonctions ───────────────────────────────────────────────────────────────

def normaliser(texte):
    texte = texte.lower().strip()
    texte = unicodedata.normalize("NFD", texte)
    return "".join(c for c in texte if unicodedata.category(c) != "Mn")

def resumer(texte, nb_phrases=3):
    if not texte or len(texte.strip()) < 100:
        return texte.strip()[:500] if texte else ""
    try:
        parser     = PlaintextParser.from_string(texte, Tokenizer(LANGUAGE))
        summarizer = TextRankSummarizer(Stemmer(LANGUAGE))
        summarizer.stop_words = get_stop_words(LANGUAGE)
        return " ".join(str(p) for p in summarizer(parser.document, nb_phrases))
    except:
        sentences = re.split(r"(?<=[.!?])\s+", texte)
        return " ".join(sentences[:nb_phrases])

def extraire_entites(texte):
    doc     = nlp(texte[:5000])
    entites = {"organisations": [], "personnes": [], "lieux": [], "divers": []}
    seen    = set()
    for ent in doc.ents:
        t     = ent.text.strip()
        label = LABEL_MAP.get(ent.label_)
        if not label or t.lower() in BLACKLIST or len(t) < 2:
            continue
        cle = (t.lower(), label)
        if cle in seen:
            continue
        seen.add(cle)
        if label == "lieux":
            entites["lieux"].append({"nom": t, "label": ent.label_})
        else:
            entites[label].append(t)
    return entites

def classifier_zone(entites, titre, contenu):
    texte_complet   = normaliser(f"{titre} {contenu}")
    score_nat       = 0
    score_int       = 0
    pays_detecte    = None
    lieux_enrichis  = []
    for lieu in entites.get("lieux", []):
        nom_norm = normaliser(lieu["nom"])
        if nom_norm in GAZETTEER_NORM or nom_norm in PAYS_NORM:
            score_nat += 2
            pays_detecte = "Cameroun"
            lieux_enrichis.append({**lieu, "zone": "nationale", "pays": "Cameroun"})
        else:
            score_int += 1
            lieux_enrichis.append({**lieu, "zone": "internationale", "pays": None})
    for mot in PAYS_NORM:
        if mot in texte_complet:
            score_nat   += 3
            pays_detecte = "Cameroun"
            break
    if score_nat >= score_int and score_nat > 0:
        zone, pays = "nationale", "Cameroun"
    elif score_int > 0:
        zone, pays = "internationale", pays_detecte
    else:
        zone, pays = None, None
    return {"zone_inferee": zone, "pays_infere": pays, "lieux": lieux_enrichis,
            "score_national": score_nat, "score_international": score_int}

def calculer_score_confiance(texte, resume, entites, classif):
    score    = 0.0
    nb_mots  = len(texte.split())
    if   nb_mots >= 300: score += 0.25
    elif nb_mots >= 100: score += 0.15
    elif nb_mots >= 50:  score += 0.08
    if resume and len(resume) > 50:
        ratio = len(resume) / max(len(texte), 1)
        score += 0.25 if 0.05 <= ratio <= 0.4 else 0.10
    nb_ents = sum(len(entites.get(k, [])) for k in ["organisations", "personnes", "lieux"])
    if   nb_ents >= 5: score += 0.30
    elif nb_ents >= 3: score += 0.20
    elif nb_ents >= 1: score += 0.10
    if classif.get("zone_inferee"):
        diff = abs(classif.get("score_national", 0) - classif.get("score_international", 0))
        if   diff >= 4: score += 0.20
        elif diff >= 2: score += 0.12
        else:           score += 0.06
    return round(min(score, 1.0), 3)

def analyser_article(titre, contenu):
    texte   = f"{titre}. {contenu}".strip()
    resume  = resumer(texte)
    entites = extraire_entites(texte)
    classif = classifier_zone(entites, titre, contenu)
    score   = calculer_score_confiance(texte, resume, entites, classif)
    return {
        "resume_auto":     resume,
        "score_confiance": score,
        "entites_nommees": {
            "organisations": entites.get("organisations", []),
            "personnes":     entites.get("personnes",     []),
            "lieux":         classif.get("lieux",         []),
        },
        "zone_inferee": classif.get("zone_inferee"),
        "pays_infere":  classif.get("pays_infere"),
    }

# ─── Boucle stdin/stdout (worker persistant) ──────────────────────────────────

sys.stderr.write("[NLP WORKER] Prêt.\n")
sys.stderr.flush()

for line in sys.stdin:
    line = line.strip()
    if not line:
        continue
    try:
        payload  = json.loads(line)
        titre    = payload.get("titre",   "")
        contenu  = payload.get("contenu", "")
        resultat = analyser_article(titre, contenu)
        sys.stdout.write(json.dumps(resultat, ensure_ascii=False) + "\n")
        sys.stdout.flush()
    except Exception as e:
        erreur = {"error": str(e)}
        sys.stdout.write(json.dumps(erreur) + "\n")
        sys.stdout.flush()
