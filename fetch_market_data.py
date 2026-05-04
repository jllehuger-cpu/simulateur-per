# -*- coding: utf-8 -*-
# Telecharge les historiques mensuels des principaux indices financiers via yfinance

import json
import sys
from datetime import datetime

sys.stdout.reconfigure(encoding="utf-8")

try:
    import yfinance as yf
except ImportError:
    sys.exit("yfinance non installe. Lancez: pip install yfinance")

INDICES = {
    "actions": {
        "SP500":       {"ticker": "^GSPC",     "nom": "S&P 500",                   "devise": "USD"},
        "MSCI_WORLD":  {"ticker": "URTH",      "nom": "MSCI World (iShares ETF)",   "devise": "USD"},
        "MSCI_ACWI":   {"ticker": "ACWI",      "nom": "MSCI ACWI (iShares ETF)",    "devise": "USD"},
        "MSCI_EM":     {"ticker": "EEM",       "nom": "MSCI Emerging Markets",      "devise": "USD"},
        "NASDAQ100":   {"ticker": "^NDX",      "nom": "Nasdaq 100",                 "devise": "USD"},
        "CAC40":       {"ticker": "^FCHI",     "nom": "CAC 40",                     "devise": "EUR"},
        "EUROSTOXX50": {"ticker": "^STOXX50E", "nom": "Euro Stoxx 50",              "devise": "EUR"},
        "MSCI_EUROPE": {"ticker": "IEUR",      "nom": "MSCI Europe (iShares ETF)",  "devise": "USD"},
    },
    "obligations": {
        "US_TRESOR_LONG":  {"ticker": "TLT",    "nom": "US Tresor 20+ ans (iShares)",          "devise": "USD"},
        "US_TRESOR_MOYEN": {"ticker": "IEF",    "nom": "US Tresor 7-10 ans (iShares)",         "devise": "USD"},
        "US_TRESOR_COURT": {"ticker": "SHY",    "nom": "US Tresor 1-3 ans (iShares)",          "devise": "USD"},
        "US_AGREGAT":      {"ticker": "AGG",    "nom": "US Agregat Obligataire (iShares)",     "devise": "USD"},
        "US_HIGH_YIELD":   {"ticker": "HYG",    "nom": "US High Yield Corporate (iShares)",    "devise": "USD"},
        "US_INV_GRADE":    {"ticker": "LQD",    "nom": "US Investment Grade Corporate",        "devise": "USD"},
        "EUR_AGREGAT":     {"ticker": "IBGL.L",  "nom": "EUR Agregat Global Hedged (iShares)",  "devise": "GBP"},
    },
    "matieres_premieres": {
        "OR":             {"ticker": "GLD",  "nom": "Or (SPDR Gold Shares)",              "devise": "USD"},
        "ARGENT":         {"ticker": "SLV",  "nom": "Argent (iShares Silver Trust)",       "devise": "USD"},
        "PETROLE_WTI":    {"ticker": "USO",  "nom": "Petrole WTI (US Oil Fund)",           "devise": "USD"},
        "COMMODITIES":    {"ticker": "PDBC", "nom": "Matieres premieres diversifiees",     "devise": "USD"},
        "BLOOMBERG_CMDTY":{"ticker": "DJP",  "nom": "Bloomberg Commodity Index",           "devise": "USD"},
    },
    "monetaire": {
        "US_TBILL_3M":  {"ticker": "BIL",     "nom": "T-Bill US 1-3 mois (SPDR)",         "devise": "USD"},
        "US_TBILL_0_3": {"ticker": "SGOV",    "nom": "T-Bill US 0-3 mois (iShares)",       "devise": "USD"},
        "USD_CASH":     {"ticker": "SHV",     "nom": "US Short Treasury (iShares)",        "devise": "USD"},
        "EUR_CASH":     {"ticker": "CSH2.PA", "nom": "Monetaire EUR (Lyxor Overnight)",    "devise": "EUR"},
    },
    "immobilier": {
        "REITS_US":     {"ticker": "VNQ",     "nom": "REITs US (Vanguard)",                "devise": "USD"},
        "REITS_US_2":   {"ticker": "IYR",     "nom": "REITs US (iShares)",                 "devise": "USD"},
        "REITS_GLOBAL": {"ticker": "REET",    "nom": "REITs Mondiaux (iShares)",           "devise": "USD"},
        "REITS_EUROPE": {"ticker": "IQQP.DE", "nom": "EPRA Europe (iShares)",              "devise": "EUR"},
    },
}

START_DATE = "2000-01-01"
END_DATE   = datetime.today().strftime("%Y-%m-%d")


def fetch_ticker(ticker: str, nom: str) -> dict | None:
    print(f"  {nom} ({ticker}) ...", end=" ", flush=True)
    try:
        data = yf.download(
            ticker,
            start=START_DATE,
            end=END_DATE,
            interval="1mo",
            auto_adjust=True,
            progress=False,
        )
        if data.empty:
            print("VIDE - ignore")
            return None

        if hasattr(data.columns, "nlevels") and data.columns.nlevels > 1:
            data.columns = data.columns.get_level_values(0)

        col = "Close" if "Close" in data.columns else data.columns[0]
        series = data[col].dropna()

        historique = {
            str(ts.date()): round(float(v), 6)
            for ts, v in series.items()
        }

        print(f"{len(historique)} mois")
        return {
            "premier": str(series.index[0].date()),
            "dernier": str(series.index[-1].date()),
            "nb_points": len(historique),
            "historique": historique,
        }
    except Exception as exc:
        print(f"ERREUR - {exc}")
        return None


def main():
    print("=== Telechargement des indices financiers (mensuel) ===")
    print(f"Periode : {START_DATE} -> {END_DATE}\n")

    result = {
        "meta": {
            "source": "Yahoo Finance via yfinance",
            "intervalle": "mensuel",
            "date_debut": START_DATE,
            "date_fin": END_DATE,
            "date_telechargement": datetime.today().isoformat(timespec="seconds"),
        },
        "indices": {},
    }

    total_ok = 0
    total_err = 0

    for categorie, tickers in INDICES.items():
        print(f"\n--- {categorie.upper().replace('_', ' ')} ---")
        result["indices"][categorie] = {}
        for cle, info in tickers.items():
            data = fetch_ticker(info["ticker"], info["nom"])
            entry = {
                "ticker": info["ticker"],
                "nom": info["nom"],
                "devise": info["devise"],
            }
            if data:
                entry.update(data)
                total_ok += 1
            else:
                entry["erreur"] = "donnees non disponibles"
                total_err += 1
            result["indices"][categorie][cle] = entry

    output_path = "market_data.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print(f"\n{'='*50}")
    print(f"Resultat : {total_ok} indices OK, {total_err} erreurs")
    print(f"Sauvegarde dans : {output_path}")


if __name__ == "__main__":
    main()
