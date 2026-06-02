#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import io, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

import os
import re
import json
import base64
import tempfile
from pathlib import Path
from typing import Optional

# ── Prompts par type de document ──────────────────────────────────────────

PROMPT_DETECTION = """
Analyse ce document et réponds UNIQUEMENT avec un JSON :
{
  "type": "avis_imposition" | "releve_av" | "releve_pea" | "releve_cto" |
          "releve_per" | "epargne_salariale" | "inconnu",
  "assureur": "nom de l'assureur si AV/PER" | null,
  "annee": 2024 | null
}
Ne mets rien d'autre que ce JSON.
"""

PROMPT_AVIS_IMPOSITION = """
Tu es un expert fiscal français. Extrais UNIQUEMENT les données fiscales
de cet avis d'imposition. Ignore complètement :
- Les noms et prénoms
- L'adresse
- Le numéro fiscal
- Le numéro de sécurité sociale
- L'IBAN
- Toute référence permettant d'identifier la personne

Réponds UNIQUEMENT avec ce JSON (null si non trouvé) :
{
  "source": "avis_imposition_anonymise",
  "annee_revenus": null,
  "revenu_fiscal_reference": null,
  "nb_parts": null,
  "ir_paye_n1": null,
  "tmi": null,
  "taux_moyen_imposition": null,
  "ifi_paye_n1": null,
  "deficit_foncier_reportable": null,
  "plafond_per_declarant1": null,
  "plafond_per_declarant2": null,
  "revenus_declares": {
    "salaires_traitements_brut_decl1": null,
    "salaires_traitements_brut_decl2": null,
    "salaires_traitements_net_total": null,
    "revenus_fonciers_nets": null,
    "lmnp_recettes": null,
    "bic_bnc": null,
    "dividendes_rcm": null,
    "plus_values": null
  }
}

Précisions importantes :
- "ir_paye_n1" : montant TOTAL DE L'IMPÔT SUR LE REVENU NET.
  C'est la ligne "Total de l'impôt sur le revenu net" ou "Impôt net"
  dans la section IMPÔT SUR LE REVENU.
  Ce montant est typiquement entre 5 000 et 50 000 EUR.
  NE PAS confondre avec :
  · Le solde restant à payer (beaucoup plus petit, ex : 3 395 EUR)
  · Les prélèvements sociaux (section séparée)
  · Les acomptes déjà versés
- "revenus_fonciers_nets" : UNIQUEMENT revenus fonciers classiques
  (immobilier nu, régime micro-foncier ou réel).
  Ligne "Revenus fonciers nets" dans la section IMPÔT SUR LE REVENU.
  NE PAS inclure les locations meublées.
- "lmnp_recettes" : UNIQUEMENT locations meublées non professionnelles
  (LMNP — lignes "Revenus des locations meublées non professionnelles").
  Séparé des revenus fonciers classiques.

Tous les montants en entiers (euros, sans décimales).
Ne mets rien d'autre que ce JSON.
"""

PROMPT_RELEVE_AV = """
Tu es un expert en assurance vie française. Extrais les données
de ce relevé de contrat d'assurance vie ou de capitalisation.
Ignore les données personnelles (nom, adresse, numéro de contrat complet).

Réponds UNIQUEMENT avec ce JSON (null si non trouvé) :
{
  "source": "releve_av_anonymise",
  "type_contrat": "assurance_vie" | "capitalisation",
  "assureur": null,
  "date_releve": null,
  "date_ouverture": null,
  "valeur_rachat": null,
  "montant_total_verse": null,
  "plus_value_latente": null,
  "frais_gestion_euro_pct": null,
  "frais_gestion_uc_pct": null,
  "allocation": {
    "fonds_euro_pct": null,
    "fonds_euro_valeur": null,
    "uc_pct": null,
    "uc_valeur": null
  },
  "lignes_portefeuille": [
    {
      "isin": null,
      "libelle": null,
      "categorie": "Fonds euros" | "Actions-ETF" | "Obligations" | "SCPI" | "Produit structuré" | "Autre",
      "valeur": null,
      "pct_portefeuille": null,
      "quantite": null,
      "valeur_liquidative": null
    }
  ]
}
Précision ISIN : code de 12 caractères commençant par 2 lettres majuscules
(ex: FR0010315770, LU0996179007, IE00B4L5Y983).
Il figure souvent dans un tableau avec colonnes :
Code ISIN / Libellé / Valeur liquidative / Nombre de parts / Valorisation.
Cherche-le attentivement même s'il est dans une colonne distincte ou
sur la même ligne que le libellé. Si vraiment absent, mettre null.

Tous les montants en entiers. Les pourcentages en nombre décimal (ex: 60.5).
Ne mets rien d'autre que ce JSON.
"""

PROMPT_RELEVE_PEA = """
Tu es un expert en bourse française. Extrais les données de ce relevé PEA.
Ignore les données personnelles.

Réponds UNIQUEMENT avec ce JSON (null si non trouvé) :
{
  "source": "releve_pea_anonymise",
  "courtier": null,
  "date_releve": null,
  "date_ouverture": null,
  "valorisation_totale": null,
  "montant_total_verse": null,
  "plus_value_latente": null,
  "solde_especes": null,
  "lignes_portefeuille": [
    {
      "isin": null,
      "libelle": null,
      "categorie": "Actions-ETF" | "Obligations" | "SCPI" | "Autre",
      "quantite": null,
      "valeur_liquidative": null,
      "valeur_totale": null,
      "pct_portefeuille": null,
      "plus_value_latente": null
    }
  ]
}
Précision ISIN : code de 12 caractères commençant par 2 lettres majuscules
(ex: FR0010315770, LU0996179007, IE00B4L5Y983).
Il figure souvent dans un tableau avec colonnes :
Code ISIN / Libellé / Valeur liquidative / Nombre de parts / Valorisation.
Cherche-le attentivement même s'il est dans une colonne distincte ou
sur la même ligne que le libellé. Si vraiment absent, mettre null.

Tous les montants en entiers. Ne mets rien d'autre que ce JSON.
"""

PROMPT_RELEVE_PER = """
Tu es un expert en épargne retraite française. Extrais les données
de ce relevé PER (Plan d'Épargne Retraite). Ignore les données personnelles.

Réponds UNIQUEMENT avec ce JSON (null si non trouvé) :
{
  "source": "releve_per_anonymise",
  "assureur": null,
  "date_releve": null,
  "date_ouverture": null,
  "encours_total": null,
  "montant_total_verse": null,
  "versements_annee_en_cours": null,
  "plus_value_latente": null,
  "frais_gestion_pct": null,
  "mode_sortie_prevu": "capital" | "rente" | "mixte" | null,
  "lignes_portefeuille": [
    {
      "isin": null,
      "libelle": null,
      "categorie": "Fonds euros" | "Actions-ETF" | "Obligations" | "SCPI" | "Autre",
      "valeur": null,
      "pct_portefeuille": null
    }
  ]
}
Précision ISIN : code de 12 caractères commençant par 2 lettres majuscules
(ex: FR0010315770, LU0996179007, IE00B4L5Y983).
Il figure souvent dans un tableau avec colonnes :
Code ISIN / Libellé / Valeur liquidative / Nombre de parts / Valorisation.
Cherche-le attentivement même s'il est dans une colonne distincte ou
sur la même ligne que le libellé. Si vraiment absent, mettre null.

Tous les montants en entiers. Ne mets rien d'autre que ce JSON.
"""

PROMPT_EPARGNE_SALARIALE = """
Tu es un expert en épargne salariale française. Extrais les données
de ce relevé PEE/PERCO/PERCOL. Ignore les données personnelles.

Réponds UNIQUEMENT avec ce JSON (null si non trouvé) :
{
  "source": "releve_epargne_salariale_anonymise",
  "gestionnaire": null,
  "date_releve": null,
  "valorisation_totale": null,
  "dont_pee": null,
  "dont_perco": null,
  "abondement_annee": null,
  "lignes_portefeuille": [
    {
      "isin": null,
      "libelle": null,
      "categorie": "Monétaire" | "Obligataire" | "Actions-ETF" | "Diversifié" | "Autre",
      "valeur": null,
      "pct_portefeuille": null
    }
  ]
}
Précision ISIN : code de 12 caractères commençant par 2 lettres majuscules
(ex: FR0010315770, LU0996179007, IE00B4L5Y983).
Il figure souvent dans un tableau avec colonnes :
Code ISIN / Libellé / Valeur liquidative / Nombre de parts / Valorisation.
Cherche-le attentivement même s'il est dans une colonne distincte ou
sur la même ligne que le libellé. Si vraiment absent, mettre null.

Tous les montants en entiers. Ne mets rien d'autre que ce JSON.
"""

PROMPTS = {
  "avis_imposition":   PROMPT_AVIS_IMPOSITION,
  "releve_av":         PROMPT_RELEVE_AV,
  "releve_pea":        PROMPT_RELEVE_PEA,
  "releve_per":        PROMPT_RELEVE_PER,
  "epargne_salariale": PROMPT_EPARGNE_SALARIALE,
}

# ── Conversion PDF → images ───────────────────────────────────────────────

def pdf_vers_images(chemin_pdf: str, dpi: int = 150) -> list:
    """Convertit chaque page en image PIL"""
    try:
        from pdf2image import convert_from_path
        images = convert_from_path(chemin_pdf, dpi=dpi)
        print(f"[OK] {len(images)} page(s) converties")
        return images
    except ImportError:
        print("[X] pdf2image manquant : pip install pdf2image")
        sys.exit(1)
    except Exception as e:
        print(f"[X] Erreur conversion : {e}")
        print("    Verifiez que poppler est installe et dans le PATH")
        sys.exit(1)

def image_vers_base64(image) -> str:
    """Convertit une image PIL en base64 JPEG"""
    from PIL import Image
    max_size = (1600, 2200)
    image.thumbnail(max_size, Image.LANCZOS)
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=85)
    return base64.standard_b64encode(buffer.getvalue()).decode("utf-8")

# ── Appel Claude Vision ───────────────────────────────────────────────────

def appeler_claude_vision(
    images_b64: list,
    prompt: str,
    model: str = "claude-haiku-4-5-20251001",
    max_tokens: int = 2000
) -> str:
    """Envoie les images à Claude et retourne la réponse texte"""
    import anthropic
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        env_path = Path(__file__).parent / ".env.local"
        if env_path.exists():
            for line in env_path.read_text().splitlines():
                if line.startswith("ANTHROPIC_API_KEY="):
                    api_key = line.split("=", 1)[1].strip()
                    break
    if not api_key:
        print("[X] ANTHROPIC_API_KEY manquante")
        sys.exit(1)

    client = anthropic.Anthropic(api_key=api_key)

    content = []
    for img_b64 in images_b64:
        content.append({
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": "image/jpeg",
                "data": img_b64
            }
        })
    content.append({"type": "text", "text": prompt})

    response = client.messages.create(
        model=model,
        max_tokens=max_tokens,
        messages=[{"role": "user", "content": content}]
    )
    return response.content[0].text

# ── Parsing JSON réponse ──────────────────────────────────────────────────

def parser_json_reponse(texte: str) -> dict:
    """Extrait le JSON de la réponse Claude"""
    texte = re.sub(r'```json\s*', '', texte)
    texte = re.sub(r'```\s*', '', texte)
    texte = texte.strip()
    try:
        return json.loads(texte)
    except json.JSONDecodeError:
        m = re.search(r'\{[\s\S]+\}', texte)
        if m:
            try:
                return json.loads(m.group(0))
            except json.JSONDecodeError:
                pass
    return {"erreur": "JSON invalide", "brut": texte[:500]}

# ── Détection type document ───────────────────────────────────────────────

def detecter_type(images_b64: list) -> dict:
    """Détecte automatiquement le type de document"""
    print("[?] Detection du type de document...")
    reponse = appeler_claude_vision(
        [images_b64[0]],
        PROMPT_DETECTION,
        max_tokens=200
    )
    result = parser_json_reponse(reponse)
    type_doc = result.get("type", "inconnu")
    print(f"[OK] Type detecté : {type_doc}")
    if result.get("assureur"):
        print(f"     Assureur : {result['assureur']}")
    return result

# ── Extraction principale ─────────────────────────────────────────────────

def extraire_document(
    chemin_pdf: str,
    type_force: Optional[str] = None,
    pages_max: int = 6
) -> dict:
    """
    Fonction principale : PDF → JSON anonymisé
    type_force : forcer le type si détection incorrecte
    pages_max  : limiter le nombre de pages (coût API)
    """
    chemin = Path(chemin_pdf)
    if not chemin.exists():
        print(f"[X] Fichier introuvable : {chemin}")
        sys.exit(1)

    print(f"\n[PDF] Traitement de : {chemin.name}")

    images = pdf_vers_images(str(chemin))
    images = images[:pages_max]
    print(f"[OK] {len(images)} page(s) a traiter")

    print("[?] Encodage des images...")
    images_b64 = [image_vers_base64(img) for img in images]

    if type_force:
        type_doc = type_force
        meta = {"type": type_force}
        print(f"[OK] Type force : {type_doc}")
    else:
        meta = detecter_type(images_b64)
        type_doc = meta.get("type", "inconnu")

    if type_doc == "inconnu":
        print("[!] Type de document non reconnu")
        print("    Types supportes : avis_imposition, releve_av, releve_pea, releve_per, epargne_salariale")
        print("    Utilisez --type <type> pour forcer")
        sys.exit(1)

    if type_doc not in PROMPTS:
        print(f"[!] Type '{type_doc}' non encore supporte")
        sys.exit(1)

    print(f"[?] Extraction des données ({type_doc})...")
    prompt = PROMPTS[type_doc]

    model = "claude-haiku-4-5-20251001"
    if type_doc in ["releve_av", "releve_pea"] and len(images) > 3:
        model = "claude-sonnet-4-6"
        print(f"[OK] Modele : Sonnet (document complexe)")
    else:
        print(f"[OK] Modele : Haiku")

    reponse_brute = appeler_claude_vision(images_b64, prompt, model=model, max_tokens=4000)
    donnees = parser_json_reponse(reponse_brute)

    donnees["_meta"] = {
        "fichier_source": chemin.name,
        "type_detecte": type_doc,
        "nb_pages_traitees": len(images),
        "modele_utilise": model,
    }
    if meta.get("assureur"):
        donnees["assureur"] = donnees.get("assureur") or meta["assureur"]

    return donnees

# ── Affichage résumé ──────────────────────────────────────────────────────

def afficher_resume(donnees: dict):
    type_doc = donnees.get("_meta", {}).get("type_detecte", "?")
    print(f"\n[=] Résumé — {type_doc} :")

    if type_doc == "avis_imposition":
        r = donnees.get("revenus_declares", {})
        items = [
            ("Annee revenus",     donnees.get("annee_revenus")),
            ("RFR",               donnees.get("revenu_fiscal_reference")),
            ("Nb parts",          donnees.get("nb_parts")),
            ("IR net paye",       donnees.get("ir_paye_n1")),
            ("TMI",               f"{donnees.get('tmi')} %" if donnees.get('tmi') else None),
            ("Taux moyen",        f"{donnees.get('taux_moyen_imposition')} %" if donnees.get('taux_moyen_imposition') else None),
            ("Salaires nets",     r.get("salaires_traitements_net_total")),
            ("Revenus fonciers",  r.get("revenus_fonciers_nets")),
            ("LMNP",              r.get("lmnp_recettes")),
            ("RCM/Dividendes",    r.get("dividendes_rcm")),
            ("Plafond PER decl1", donnees.get("plafond_per_declarant1")),
            ("Plafond PER decl2", donnees.get("plafond_per_declarant2")),
        ]
    elif type_doc in ["releve_av", "releve_per"]:
        lignes = donnees.get("lignes_portefeuille", [])
        items = [
            ("Assureur",          donnees.get("assureur")),
            ("Date releve",       donnees.get("date_releve")),
            ("Valeur rachat",     donnees.get("valeur_rachat") or donnees.get("encours_total")),
            ("Montant verse",     donnees.get("montant_total_verse")),
            ("Plus-value",        donnees.get("plus_value_latente")),
            ("Nb lignes portef.", len(lignes) if lignes else 0),
        ]
    elif type_doc == "releve_pea":
        lignes = donnees.get("lignes_portefeuille", [])
        items = [
            ("Courtier",          donnees.get("courtier")),
            ("Valorisation",      donnees.get("valorisation_totale")),
            ("Montant verse",     donnees.get("montant_total_verse")),
            ("Plus-value",        donnees.get("plus_value_latente")),
            ("Nb lignes portef.", len(lignes) if lignes else 0),
        ]
    else:
        items = [(k, v) for k, v in donnees.items() if k not in ["_meta", "lignes_portefeuille", "source"]]

    for label, val in items:
        if val is not None and val != 0:
            if isinstance(val, int) and val > 1000:
                val_fmt = f"{val:,}".replace(",", " ") + " EUR"
            else:
                val_fmt = str(val)
            print(f"   {label:<25} : {val_fmt}")

    lignes = donnees.get("lignes_portefeuille", [])
    if lignes:
        print(f"\n   Portefeuille ({len(lignes)} lignes) :")
        for l in lignes[:8]:
            isin  = l.get("isin") or "—"
            lib   = (l.get("libelle") or "")[:35]
            pct   = l.get("pct_portefeuille") or 0
            val   = l.get("valeur") or l.get("valeur_totale") or 0
            print(f"     {isin:<14} {lib:<36} {pct:>6.1f}%  {val:>10,} EUR".replace(",", " "))
        if len(lignes) > 8:
            print(f"     ... et {len(lignes) - 8} autres lignes")

# ── Main ──────────────────────────────────────────────────────────────────

def main():
    import argparse
    parser = argparse.ArgumentParser(
        description="Extraction données patrimoniales PDF via Claude Vision"
    )
    parser.add_argument("pdf", help="Chemin vers le fichier PDF")
    parser.add_argument("--type", help="Forcer le type : avis_imposition | releve_av | releve_pea | releve_per | epargne_salariale")
    parser.add_argument("--pages", type=int, default=6, help="Nombre max de pages (defaut: 6)")
    parser.add_argument("--output", help="Chemin du fichier JSON de sortie (defaut: <nom>_extrait.json)")
    args = parser.parse_args()

    donnees = extraire_document(args.pdf, type_force=args.type, pages_max=args.pages)

    afficher_resume(donnees)

    chemin_pdf = Path(args.pdf)
    sortie = Path(args.output) if args.output else chemin_pdf.parent / f"{chemin_pdf.stem}_extrait.json"
    with open(sortie, "w", encoding="utf-8") as f:
        json.dump(donnees, f, ensure_ascii=False, indent=2)

    print(f"\n[OK] Fichier sauvegarde : {sortie}")
    print("     -> Importez-le dans la plateforme")

if __name__ == "__main__":
    main()
