#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import io, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

"""
Script d'anonymisation d'avis d'imposition francais
Extrait les donnees fiscales utiles - supprime toutes les donnees personnelles
Usage  : python anonymise_avis_imposition.py mon_avis.pdf
Output : mon_avis_anonymise.json
"""

import sys
import re
import json
from pathlib import Path

# --- Extraction texte PDF ---

def extraire_texte_pdf(chemin_pdf: str) -> str:
    try:
        import pdfplumber
        texte = ""
        with pdfplumber.open(chemin_pdf) as pdf:
            for page in pdf.pages:
                # Extraction standard
                t = page.extract_text(x_tolerance=3, y_tolerance=3)
                if t:
                    texte += t + "\n"
                # Extraction par mots pour recuperer les colonnes
                words = page.extract_words(x_tolerance=5, y_tolerance=5)
                if words:
                    texte += " ".join(w["text"] for w in words) + "\n"
        return texte
    except ImportError:
        print("[X] pdfplumber manquant - executez : pip install pdfplumber")
        sys.exit(1)

# --- Helpers ---

def nettoyer_montant(s: str) -> int | None:
    if not s:
        return None
    s = re.sub(r'[^\d]', '', s.strip())
    try:
        return int(s) if s else None
    except ValueError:
        return None

def chercher(patterns: list, texte: str, groupe: int = 1):
    for p in patterns:
        m = re.search(p, texte, re.IGNORECASE | re.MULTILINE)
        if m:
            try:
                return m.group(groupe).strip()
            except IndexError:
                pass
    return None

def chercher_montant(patterns: list, texte: str) -> int | None:
    v = chercher(patterns, texte)
    return nettoyer_montant(v) if v else None

# --- Extraction ---

def extraire_donnees_fiscales(texte: str) -> dict:
    donnees = {
        "source": "avis_imposition_anonymise",
        "annee_revenus": None,
        "revenu_fiscal_reference": None,
        "nb_parts": None,
        "ir_paye_n1": None,
        "tmi": None,
        "taux_moyen_imposition": None,
        "ifi_paye_n1": None,
        "deficit_foncier_reportable": None,
        "plafond_per_declarant1": None,
        "plafond_per_declarant2": None,
        "revenus_declares": {
            "salaires_traitements_brut": None,
            "salaires_traitements_net": None,
            "revenus_fonciers_nets": None,
            "lmnp_recettes": None,
            "bic_bnc": None,
            "dividendes_rcm": None,
            "plus_values": None,
        }
    }

    # -- Annee des revenus --
    v = chercher([
        r'IMPOT POUR\s+(\d{4})',
        r'revenus de (\d{4})',
        r'revenus\s+de\s+2(\d{3})',
        r'sur les revenus de (\d{4})',
    ], texte)
    if v and len(v) == 4:
        donnees["annee_revenus"] = int(v)

    # -- Revenu fiscal de reference --
    # Sur l'avis : "117 482\n3,00" apres le bloc adresse
    # Ou "Revenu fiscal de reference : 117 482"
    v = chercher([
        r'[Rr]evenu\s+fiscal\s+de\s+r.f.rence\s*:?\s*([\d\s]{4,12})',
        r'R\.?F\.?R\.?\s*:?\s*([\d\s]{4,12})',
        # Pattern specifique avis DGFiP : nombre seul suivi de \n3,xx (nb parts)
        r'([\d]{3}\s[\d]{3})\n\d+[,\.]\d{2}',
        r'(1\d{2}\s?\d{3})\s*\n\s*\d+[,\.]\d{2}',
    ], texte)
    if v:
        donnees["revenu_fiscal_reference"] = nettoyer_montant(v)

    # -- Nombre de parts --
    # Sur l'avis : "3,00" apres le RFR, ou "M\n2 3,00" ou "NOMBRE DE PARTS 3,00"
    # Aussi "2 3,00" signifie "2 enfants, 3,00 parts"
    v = chercher([
        r'[Nn]ombre\s+de\s+parts?\s*:?\s*(\d+[,\.]\d+)',
        r'NOMBRE\s+DE\s+PARTS?\s+(\d+[,\.]\d+)',
        r'\bM\b\n\d\s+(\d+[,\.]\d{2})',
        r'^\s*(\d+[,\.]\d{2})\s*$',
        r'\b(\d+[,\.]\d{2})\b(?=\s*\n?\s*IMPOT)',
        # Chercher "2 3,00" ou "1 3,00" = nb enfants + nb parts
        r'\d\s+(\d+[,\.]\d{2})\s*\n',
    ], texte)
    if v:
        try:
            nb = float(v.replace(',', '.'))
            if 1.0 <= nb <= 10.0:  # sanity check
                donnees["nb_parts"] = nb
        except ValueError:
            pass

    # -- IR net paye --
    v = chercher([
        r'[Tt]otal\s+de\s+l.imp.t\s+sur\s+le\s+revenu\s+net[.\s]*([\d\s]{3,10})',
        r'[Ii]mp.t\s+net\s*[\.:]*\s*([\d\s]{3,10})',
        r'IMPOT\s+NET[^:\d]*([\d\s]{3,10})',
    ], texte)
    if v:
        donnees["ir_paye_n1"] = nettoyer_montant(v)

    # -- TMI --
    v = chercher([
        r'[Tt]aux\s+marginal\s+d.imposition[.\s]*(\d+[,\.]\d+)\s*%',
        r'(\d+[,\.]\d+)\s*%\s*[Ll]e\s+taux\s+marginal',
        r'30[,\.]00\s*%',
        r'TMI[.\s]*(\d+)',
    ], texte)
    if v:
        try:
            tmi_val = float(re.sub(r'[^\d,\.]', '', v).replace(',', '.'))
            for tranche in [0, 11, 30, 41, 45]:
                if abs(tmi_val - tranche) <= 2:
                    donnees["tmi"] = tranche
                    break
        except (ValueError, AttributeError):
            # Si le pattern "30,00 %" est trouve directement
            if '30' in str(v):
                donnees["tmi"] = 30

    # -- Taux moyen --
    v = chercher([
        r'[Tt]aux\s+moyen\s+d.imposition[.\s]*([\d,\.]+)\s*%',
        r'[Tt]aux\s+moyen[.\s]*([\d,\.]+)\s*%',
    ], texte)
    if v:
        try:
            donnees["taux_moyen_imposition"] = round(float(v.replace(',', '.')), 2)
        except ValueError:
            pass

    # -- Salaires nets --
    # "Salaires, pensions, rentes nets....... 84012 31614 115626"
    # pdfplumber lit souvent : "Sal" sur une ligne puis la suite sur la suivante
    # On cherche le TOTAL (derniere colonne) - souvent 6 chiffres
    patterns_sal = [
        r'[Ss]alaires,?\s+pensions?,?\s+rentes?\s+nets?[.\s]*([\d\s]{4,8})\s*([\d\s]{4,8})?\s*([\d\s]{5,8})?',
        r'[Ss]al(?:aires?)?\s*,?\s*pens\w*\s*,?\s*rentes?\s+nets?.*?([\d]{5,6})\s*$',
        r'nets?\s+(\d{4,6})\s+(\d{4,6})\s+(\d{5,6})',
        r'Salaires.*?(\d{5,6})\s*\n',
    ]
    for p in patterns_sal:
        m = re.search(p, texte, re.IGNORECASE | re.MULTILINE)
        if m:
            # Prendre le dernier groupe non null (= colonne Total)
            groupes = [g for g in m.groups() if g]
            if groupes:
                val = nettoyer_montant(groupes[-1])
                if val and 10000 < val < 999999:
                    donnees["revenus_declares"]["salaires_traitements_net"] = val
                    break

    # Salaires bruts (avant deduction 10%)
    # "Salaires 93347 3512"
    m = re.search(
        r'^[Ss]alaires\s+([\d\s]{4,8})\s+([\d\s]{3,8})(?:\s+([\d\s]{4,8}))?',
        texte, re.MULTILINE
    )
    if m:
        groupes = [nettoyer_montant(g) for g in m.groups() if g]
        valides = [v for v in groupes if v and 1000 < v < 999999]
        if valides:
            donnees["revenus_declares"]["salaires_traitements_brut"] = max(valides)

    # -- Revenus fonciers --
    v = chercher([
        r'[Rr]evenus?\s+fonciers?\s+nets?[.\s]*([\d\s]{1,10})\s',
        r'[Rr]evenus?\s+fonciers?[.\s]*([\d\s]{1,8})\s',
    ], texte)
    if v:
        val = nettoyer_montant(v)
        if val and val < 500000:
            donnees["revenus_declares"]["revenus_fonciers_nets"] = val

    # -- LMNP --
    v = chercher([
        r'locations?\s+meubl.es\s+non\s+pro.*?nets?[.\s]*([\d\s]{1,8})\s',
        r'meubl.es?\s+.*?nets?[.\s]*([\d\s]{1,8})\s',
        r'r.gime\s+micro.*?total\s+foyer\s+fiscal[.\s]*([\d\s]{1,8})',
    ], texte)
    if v:
        val = nettoyer_montant(v)
        if val and val < 500000:
            donnees["revenus_declares"]["lmnp_recettes"] = val

    # -- BIC / BNC --
    # Attention : ne pas capturer les credits d'impot
    v = chercher([
        r'professions?\s+non\s+salari.es?\s+\(r.gime\s+r.el\)[.\s]*([\d\s]{3,10})',
        r'\bBNC\b[.\s]*([\d\s]{3,8})',
        r'\bBIC\b[.\s]*([\d\s]{3,8})',
    ], texte)
    if v:
        val = nettoyer_montant(v)
        if val and val > 100:  # Eviter de capturer de petits montants parasites
            donnees["revenus_declares"]["bic_bnc"] = val

    # -- RCM / Dividendes --
    # "RCM deja soumis aux prelevements sociaux avec CSG deductible : 365"
    # "Revenus au taux forfaitaire Taux 12,8% Montant 365"
    v = chercher([
        r'RCM\s+d.j.\s+soumis[.\s]*([\d\s]{1,8})',
        r'[Rr]evenus?\s+de\s+capitaux\s+mobiliers?[.\s]*([\d\s]{3,10})',
        r'[Rr]evenus?\s+au\s+taux\s+forfaitaire.*?[Mm]ontant[.\s]*([\d\s]{1,8})',
        r'taux\s+forfaitaire.*?12[,\.]8.*?[Mm]ontant[.\s]*([\d\s]{1,8})',
        r'12[,\.]8\s*%.*?[Mm]ontant\s+([\d\s]{1,8})',
    ], texte)
    if v:
        val = nettoyer_montant(v)
        if val and val < 500000:
            donnees["revenus_declares"]["dividendes_rcm"] = val

    # -- Plus-values --
    v = chercher([
        r'plus[- ]values?\s+(?:mobili.res?)?[.\s]*([\d\s]{1,10})',
    ], texte)
    if v:
        val = nettoyer_montant(v)
        if val and val < 500000:
            donnees["revenus_declares"]["plus_values"] = val

    # -- Plafond PER --
    m = re.search(
        r'[Pp]lafond\s+(?:total\s+de\s+\d{4}|pour\s+les\s+cotisations)[.\s]*([\d\s]{3,10})\s+([\d\s]{3,10})',
        texte, re.IGNORECASE
    )
    if m:
        donnees["plafond_per_declarant1"] = nettoyer_montant(m.group(1))
        donnees["plafond_per_declarant2"] = nettoyer_montant(m.group(2))
    else:
        v = chercher([r'[Pp]lafond\s+(?:total|PER)[.\s]*([\d\s]{3,10})'], texte)
        if v:
            donnees["plafond_per_declarant1"] = nettoyer_montant(v)

    # -- IFI --
    v = chercher([
        r'[Ii]mp.t\s+sur\s+la\s+fortune\s+immobili.re[.\s]*([\d\s]{3,10})',
        r'\bIFI\b[.\s]*([\d\s]{3,10})',
    ], texte)
    if v:
        donnees["ifi_paye_n1"] = nettoyer_montant(v)

    # -- Deficit foncier --
    v = chercher([
        r'd.ficit\s+foncier[.\s]*([\d\s]{3,10})',
    ], texte)
    if v:
        donnees["deficit_foncier_reportable"] = nettoyer_montant(v)

    return donnees

# --- Verification anonymisation ---

def verifier_anonymisation(donnees: dict) -> list:
    alertes = []
    json_str = json.dumps(donnees)
    patterns = [
        (r'\b\d{13}\b',     "Numero de securite sociale (13 chiffres)"),
        (r'\b\d{15}\b',     "Numero fiscal (15 chiffres)"),
        (r'FR\d{2}\s?\d{4}', "IBAN potentiel"),
    ]
    for p, label in patterns:
        if re.search(p, json_str):
            alertes.append(f"[!] Donnee suspecte : {label}")
    return alertes

# --- Resume terminal ---

def afficher_resume(donnees: dict):
    r = donnees["revenus_declares"]
    fmt  = lambda v: f"{v:,} EUR".replace(",", " ") if v else "non trouve"
    fmtp = lambda v: f"{v} %" if v is not None else "non trouve"
    print("\n[=] Donnees extraites :")
    print(f"   Annee des revenus          : {donnees['annee_revenus'] or 'non trouve'}")
    print(f"   Revenu fiscal de reference : {fmt(donnees['revenu_fiscal_reference'])}")
    print(f"   Nombre de parts            : {donnees['nb_parts'] or 'non trouve'}")
    print(f"   IR net paye                : {fmt(donnees['ir_paye_n1'])}")
    print(f"   TMI                        : {fmtp(donnees['tmi'])}")
    print(f"   Taux moyen                 : {fmtp(donnees['taux_moyen_imposition'])}")
    print(f"   Salaires nets declares     : {fmt(r['salaires_traitements_net'])}")
    print(f"   Salaires bruts declares    : {fmt(r['salaires_traitements_brut'])}")
    print(f"   Revenus fonciers nets      : {fmt(r['revenus_fonciers_nets'])}")
    print(f"   LMNP nets                  : {fmt(r['lmnp_recettes'])}")
    print(f"   BIC / BNC                  : {fmt(r['bic_bnc'])}")
    print(f"   RCM / Dividendes           : {fmt(r['dividendes_rcm'])}")
    print(f"   Plus-values                : {fmt(r['plus_values'])}")
    print(f"   Plafond PER decl. 1        : {fmt(donnees['plafond_per_declarant1'])}")
    print(f"   Plafond PER decl. 2        : {fmt(donnees['plafond_per_declarant2'])}")

# --- Main ---

def main():
    if len(sys.argv) < 2:
        print("Usage : python anonymise_avis_imposition.py <chemin.pdf>")
        sys.exit(1)

    chemin = Path(sys.argv[1])
    if not chemin.exists():
        print(f"[X] Fichier introuvable : {chemin}")
        sys.exit(1)

    print(f"[PDF] Lecture de : {chemin.name}")
    texte = extraire_texte_pdf(str(chemin))

    if "--debug" in sys.argv:
        print("\n--- TEXTE BRUT EXTRAIT ---")
        print(texte[:4000])
        print("-" * 42 + "\n")

    print("[?] Extraction des donnees fiscales...")
    donnees = extraire_donnees_fiscales(texte)

    print("[OK] Verification anonymisation...")
    alertes = verifier_anonymisation(donnees)
    if alertes:
        for a in alertes:
            print(a)
    else:
        print("[OK] Aucune donnee personnelle dans le JSON de sortie")

    afficher_resume(donnees)

    nb_null = sum(1 for v in [
        donnees["annee_revenus"], donnees["revenu_fiscal_reference"],
        donnees["nb_parts"], donnees["ir_paye_n1"], donnees["tmi"]
    ] if v is None)
    if nb_null > 0:
        print(f"\n[!] {nb_null} champ(s) non trouve(s)")

    sortie = chemin.parent / f"{chemin.stem}_anonymise.json"
    with open(sortie, "w", encoding="utf-8") as f:
        json.dump(donnees, f, ensure_ascii=False, indent=2)

    print(f"\n[OK] Fichier sauvegarde : {sortie}")
    print("   -> Importez-le dans la plateforme (etape Revenus)")

if __name__ == "__main__":
    main()
