import os
import re
import subprocess

input_folder = "pdfs"
output_folder = "cleaned"
os.makedirs(output_folder, exist_ok=True)


def clean_text(text: str) -> str:
    """Post-traitement du texte extrait par pdftotext."""

    # 1. Supprimer les lignes de table des matières (points de suspension)
    text = re.sub(r'[^\n]*\.{5,}[^\n]*\n', '', text)

    # 2. Supprimer les en-têtes/pieds de page récurrents
    #    (numéros de page seuls, lignes type "2025 - AUREP - ...")
    text = re.sub(r'\n\s*\d{1,3}\s*\n', '\n', text)              # numéro de page isolé
    text = re.sub(r'\n[^\n]{0,80}AUREP[^\n]*\n', '\n', text)     # ligne AUREP

    # 3. Supprimer les sauts de page (caractère ^L / \f)
    text = text.replace('\f', '\n')

    # 4. Réduire les lignes vides multiples (max 2 consécutives)
    text = re.sub(r'\n{3,}', '\n\n', text)

    # 5. Supprimer les espaces en fin de ligne
    text = re.sub(r'[ \t]+\n', '\n', text)

    return text.strip()


for filename in os.listdir(input_folder):
    if not filename.endswith(".pdf"):
        continue

    pdf_path = os.path.join(input_folder, filename)

    # pdftotext -layout : préserve le positionnement spatial (colonnes, indentations)
    # -enc UTF-8 : sortie en UTF-8
    # "-" : sortie sur stdout
    result = subprocess.run(
        ["pdftotext", "-layout", "-enc", "UTF-8", pdf_path, "-"],
        capture_output=True,
        text=True,
        encoding="utf-8"
    )

    if result.returncode != 0:
        print(f"✗ Erreur sur {filename} : {result.stderr.strip()}")
        continue

    full_text = result.stdout
    full_text = clean_text(full_text)

    output_file = os.path.join(output_folder, filename.replace(".pdf", ".txt"))
    with open(output_file, "w", encoding="utf-8") as f:
        f.write(full_text)

    print(f"✔ Nettoyé : {filename}")