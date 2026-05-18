'use client';

import { AuthGate } from '@/components/auth-gate';
import { useState, useMemo } from 'react';

/* ── Types ─────────────────────────────────────────────────────── */
type TabId = 'simulateur' | 'partage' | 'generation' | 'dispositifs';
type LienParente =
  | 'enfant' | 'petit_enfant' | 'arriere_petit_enfant'
  | 'conjoint_pacs' | 'frere_soeur' | 'neveu_niece' | 'tiers';

interface Tranche { limite: number | null; taux: number; }
interface TrancheDetail { label: string; assiette: number; taux: string; impot: number; }
interface Enfant { prenom: string; partPct: number; donationsAnterieures: number; handicap: boolean; }

/* ── Constants ──────────────────────────────────────────────────── */
const ABATTEMENTS: Record<LienParente, number> = {
  enfant: 100000, petit_enfant: 31865, arriere_petit_enfant: 5310,
  conjoint_pacs: 80724, frere_soeur: 15932, neveu_niece: 7967, tiers: 1594,
};
const ABATTEMENT_HANDICAP = 159325;
const BAREMES: Record<string, Tranche[]> = {
  ligne_directe: [
    { limite: 8072, taux: 0.05 }, { limite: 12109, taux: 0.10 },
    { limite: 15932, taux: 0.15 }, { limite: 552324, taux: 0.20 },
    { limite: 902838, taux: 0.30 }, { limite: 1805677, taux: 0.40 },
    { limite: null, taux: 0.45 },
  ],
  conjoint_pacs: [
    { limite: 8072, taux: 0.05 }, { limite: 15932, taux: 0.10 },
    { limite: 31865, taux: 0.15 }, { limite: 552324, taux: 0.20 },
    { limite: 902838, taux: 0.30 }, { limite: 1805677, taux: 0.40 },
    { limite: null, taux: 0.45 },
  ],
  frere_soeur: [{ limite: 24430, taux: 0.35 }, { limite: null, taux: 0.45 }],
  neveu_niece: [{ limite: null, taux: 0.55 }],
  tiers: [{ limite: null, taux: 0.60 }],
};

const LIEN_OPTIONS: { value: LienParente; label: string }[] = [
  { value: 'enfant', label: 'Enfant — 100 000 €' },
  { value: 'petit_enfant', label: 'Petit-enfant — 31 865 €' },
  { value: 'arriere_petit_enfant', label: 'Arrière-petit-enfant — 5 310 €' },
  { value: 'conjoint_pacs', label: 'Conjoint / PACS — 80 724 €' },
  { value: 'frere_soeur', label: 'Frère / Sœur — 15 932 €' },
  { value: 'neveu_niece', label: 'Neveu / Nièce — 7 967 €' },
  { value: 'tiers', label: 'Tiers (non parent) — 1 594 €' },
];

/* ── Tax engine ─────────────────────────────────────────────────── */
function getBareme(lien: LienParente): Tranche[] {
  if (['enfant', 'petit_enfant', 'arriere_petit_enfant'].includes(lien)) return BAREMES.ligne_directe;
  return BAREMES[lien] ?? BAREMES.tiers;
}

function computeTax(assiette: number, tranches: Tranche[]): { total: number; detail: TrancheDetail[] } {
  if (assiette <= 0) return { total: 0, detail: [] };
  let droits = 0, reste = assiette, prev = 0;
  const detail: TrancheDetail[] = [];
  for (const t of tranches) {
    const lim = t.limite === null ? Infinity : t.limite;
    const slice = Math.min(Math.max(0, reste), lim - prev);
    if (slice > 0) {
      const impot = slice * t.taux;
      droits += impot;
      detail.push({
        label: t.limite === null ? `Plus de ${prev.toLocaleString('fr-FR')} €` : `Jusqu'à ${t.limite.toLocaleString('fr-FR')} €`,
        assiette: slice, taux: (t.taux * 100).toFixed(0), impot,
      });
      reste -= slice;
    }
    prev = t.limite === null ? prev : (t.limite as number);
    if (reste <= 0) break;
  }
  return { total: droits, detail };
}

function taxWithRappel(montant: number, anterior: number, abattTotal: number, bareme: Tranche[]) {
  const bt = Math.max(0, anterior + montant - abattTotal);
  const ba = Math.max(0, anterior - abattTotal);
  const { total: dt, detail } = computeTax(bt, bareme);
  const { total: da } = computeTax(ba, bareme);
  return { droits: Math.max(0, dt - da), detail };
}

/* ── Helpers ────────────────────────────────────────────────────── */
const fr = (n: number) => Math.round(n).toLocaleString('fr-FR');

function makeDefaultEnfants(n: number): Enfant[] {
  const part = Math.round(100 / n);
  return Array.from({ length: n }, (_, i) => ({
    prenom: `Enfant ${i + 1}`,
    partPct: i === n - 1 ? 100 - part * (n - 1) : part,
    donationsAnterieures: 0,
    handicap: false,
  }));
}

/* ── Styles ─────────────────────────────────────────────────────── */
const sH3: React.CSSProperties = {
  margin: '0 0 1rem', fontSize: '0.75rem', fontWeight: 700,
  color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em',
};
const sLbl: React.CSSProperties = {
  fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)',
  textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: '0.3rem',
};
const sKpiVal = (color = 'var(--text-primary)'): React.CSSProperties => ({
  margin: '0.25rem 0 0', fontFamily: 'var(--font-display)', fontSize: '1.6rem', fontWeight: 700, color,
});
const sBandeau = (hue: 'blue' | 'amber' | 'green' | 'red'): React.CSSProperties => {
  const map = {
    blue:  { bg: 'rgba(99,102,241,0.08)',  border: 'rgba(99,102,241,0.25)' },
    amber: { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)' },
    green: { bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.25)' },
    red:   { bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.25)'  },
  };
  return {
    padding: '0.75rem 1rem', borderRadius: 10, fontSize: '0.82rem',
    color: 'var(--text-secondary)', lineHeight: 1.6,
    background: map[hue].bg, border: `1px solid ${map[hue].border}`,
  };
};
const sTh: React.CSSProperties = {
  padding: '0.6rem 1rem', textAlign: 'left', fontSize: '0.65rem', fontWeight: 700,
  color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em',
};
const sTd = (align: 'left' | 'right' | 'center' = 'left'): React.CSSProperties => ({
  padding: '0.65rem 1rem', color: 'var(--text-secondary)', textAlign: align,
});
const sCheckLabel: React.CSSProperties = {
  display: 'flex', alignItems: 'flex-start', gap: '0.5rem',
  cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-secondary)',
};

/* ── Tabs ───────────────────────────────────────────────────────── */
const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'simulateur',  label: 'Simulateur de droits', icon: '🧮' },
  { id: 'partage',     label: 'Donation-partage',     icon: '⚖️' },
  { id: 'generation',  label: 'Saut de génération',   icon: '🔁' },
  { id: 'dispositifs', label: 'Dispositifs spéciaux', icon: '📋' },
];

/* ═══════════════════════════════════════════════════════════════════
   ONGLET 1 — Simulateur de droits
═══════════════════════════════════════════════════════════════════ */
function TabSimulateur() {
  const [montant, setMontant]                   = useState<number>(150000);
  const [lien, setLien]                         = useState<LienParente>('enfant');
  const [nbDonateurs, setNbDonateurs]           = useState<1 | 2>(1);
  const [handicap, setHandicap]                 = useState(false);
  const [rappelFiscal, setRappelFiscal]         = useState(false);
  const [donationsAnt, setDonationsAnt]         = useState<number>(0);
  const [dateAnt, setDateAnt]                   = useState<string>('');

  const calculs = useMemo(() => {
    const bareme = getBareme(lien);
    const abattBase = ABATTEMENTS[lien] * nbDonateurs;
    const abattHandicap = handicap ? ABATTEMENT_HANDICAP : 0;
    const abattTotal = abattBase + abattHandicap;
    const anterior = rappelFiscal ? donationsAnt : 0;
    const abattResiduel = Math.max(0, abattTotal - anterior);
    const { droits, detail } = taxWithRappel(montant, anterior, abattTotal, bareme);
    const baseTaxable = Math.max(0, montant - abattResiduel);
    return { abattBase, abattHandicap, abattTotal, abattResiduel, baseTaxable, droits, detail, anterior };
  }, [montant, lien, nbDonateurs, handicap, rappelFiscal, donationsAnt]);

  const prochainRenouvellement = useMemo(() => {
    if (!dateAnt) return null;
    const d = new Date(dateAnt);
    d.setFullYear(d.getFullYear() + 15);
    return d.toLocaleDateString('fr-FR');
  }, [dateAnt]);

  const tauxEffectif = montant > 0 ? (calculs.droits / montant * 100).toFixed(1) : '0.0';

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '1.5rem', alignItems: 'start' }}>
      {/* COLONNE GAUCHE */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <p style={sH3}>Paramètres</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

            {/* Slider + montant */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <span style={sLbl}>Montant de la donation</span>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700, color: 'var(--accent-emerald)' }}>
                  {fr(montant)} €
                </span>
              </div>
              <input
                type="range" min={0} max={2000000} step={5000} value={montant}
                onChange={e => setMontant(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--accent-emerald)', marginBottom: '0.5rem' }}
              />
              <input
                type="number" value={montant}
                onChange={e => setMontant(Math.max(0, Math.min(2000000, Number(e.target.value))))}
                className="glass-input" style={{ fontSize: '0.9rem' }}
              />
            </div>

            {/* Lien parenté */}
            <div>
              <span style={sLbl}>Lien de parenté</span>
              <select value={lien} onChange={e => setLien(e.target.value as LienParente)} className="glass-select">
                {LIEN_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            {/* Nb donateurs */}
            <div>
              <span style={sLbl}>Nombre de donateurs</span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {([1, 2] as const).map(n => (
                  <button key={n} onClick={() => setNbDonateurs(n)}
                    style={{
                      flex: 1, padding: '0.5rem', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem',
                      background: nbDonateurs === n ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)',
                      border: `1px solid ${nbDonateurs === n ? 'rgba(99,102,241,0.5)' : 'var(--border-glass)'}`,
                      color: nbDonateurs === n ? '#A5B4FC' : 'var(--text-secondary)',
                    }}
                  >{n} parent{n === 2 ? 's' : ''}</button>
                ))}
              </div>
            </div>

            {/* Handicap */}
            <label style={sCheckLabel}>
              <input type="checkbox" checked={handicap} onChange={e => setHandicap(e.target.checked)} style={{ marginTop: 2 }} />
              <span>Donataire en situation de handicap<br /><small style={{ color: 'var(--text-muted)' }}>+ 159 325 € (art. 779 II CGI)</small></span>
            </label>

            {/* Rappel fiscal */}
            <label style={sCheckLabel}>
              <input type="checkbox" checked={rappelFiscal} onChange={e => setRappelFiscal(e.target.checked)} style={{ marginTop: 2 }} />
              <span>Rappel fiscal (15 ans)</span>
            </label>
            {rappelFiscal && (
              <div style={{ paddingLeft: '1.25rem', borderLeft: '2px solid rgba(245,158,11,0.3)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div>
                  <span style={sLbl}>Donations antérieures (même donataire)</span>
                  <input type="number" value={donationsAnt} onChange={e => setDonationsAnt(Math.max(0, Number(e.target.value)))}
                    className="glass-input" />
                </div>
                <div>
                  <span style={sLbl}>Date de la donation antérieure</span>
                  <input type="date" value={dateAnt} onChange={e => setDateAnt(e.target.value)}
                    className="glass-input" />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* COLONNE DROITE */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

        {/* KPI bandeau */}
        <div className="glass-card-hi" style={{ padding: '1.25rem 1.5rem', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
          {[
            { label: 'Abattement résiduel', val: fr(calculs.abattResiduel) + ' €', color: 'var(--accent-emerald)' },
            { label: 'Base taxable', val: fr(calculs.baseTaxable) + ' €', color: 'var(--text-primary)' },
            { label: 'Droits à payer', val: fr(calculs.droits) + ' €', color: calculs.droits > 0 ? 'var(--accent-amber)' : 'var(--accent-emerald)' },
            { label: 'Net transmis', val: fr(montant - calculs.droits) + ' €', color: 'var(--text-primary)' },
          ].map(k => (
            <div key={k.label}>
              <span style={{ ...sLbl }}>{k.label}</span>
              <p style={sKpiVal(k.color)}>{k.val}</p>
            </div>
          ))}
        </div>

        {/* Tableau tranches */}
        <div className="glass-card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-surface-md)' }}>
            <h3 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Décomposition du barème progressif
            </h3>
            <span style={{ fontSize: '0.7rem', fontWeight: 600, background: 'var(--bg-surface)', border: '1px solid var(--border-glass)', padding: '0.2rem 0.6rem', borderRadius: 999, color: 'var(--text-muted)' }}>
              Taux effectif : {tauxEffectif}%
            </span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg-surface-md)', borderBottom: '1px solid var(--border-subtle)' }}>
                  <th style={sTh}>Tranche</th>
                  <th style={{ ...sTh, textAlign: 'right' }}>Assiette</th>
                  <th style={{ ...sTh, textAlign: 'center' }}>Taux</th>
                  <th style={{ ...sTh, textAlign: 'right' }}>Impôt</th>
                </tr>
              </thead>
              <tbody>
                {calculs.detail.map((t, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={sTd()}>{t.label}</td>
                    <td style={{ ...sTd('right'), fontWeight: 700, color: 'var(--text-primary)' }}>{fr(t.assiette)} €</td>
                    <td style={{ ...sTd('center') }}><span className="badge badge-amber">{t.taux}%</span></td>
                    <td style={{ ...sTd('right'), fontWeight: 700, color: 'var(--text-primary)' }}>{fr(t.impot)} €</td>
                  </tr>
                ))}
                {calculs.detail.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ padding: '2.5rem', textAlign: 'center' }}>
                      <p style={{ color: 'var(--accent-emerald)', fontWeight: 700, fontSize: '0.85rem', textTransform: 'uppercase', margin: 0 }}>
                        ✓ Exonération totale
                      </p>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.25rem', marginBottom: 0 }}>
                        Le montant est couvert par l'abattement légal.
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
              {calculs.detail.length > 0 && (
                <tfoot>
                  <tr style={{ background: 'var(--bg-surface-md)', borderTop: '2px solid var(--border-subtle)' }}>
                    <td colSpan={3} style={{ ...sTd(), fontWeight: 700, color: 'var(--text-primary)' }}>Total droits</td>
                    <td style={{ ...sTd('right'), fontWeight: 700, color: 'var(--accent-amber)', fontSize: '1rem' }}>{fr(calculs.droits)} €</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {/* Rappel fiscal détail */}
        {rappelFiscal && calculs.anterior > 0 && (
          <div style={sBandeau('amber')}>
            <strong>Rappel fiscal</strong><br />
            Abattement total : {fr(calculs.abattTotal)} € — déjà consommé : {fr(Math.min(calculs.anterior, calculs.abattTotal))} € — résiduel : {fr(calculs.abattResiduel)} €
            {prochainRenouvellement && (
              <span> · Prochain renouvellement : <strong>{prochainRenouvellement}</strong></span>
            )}
          </div>
        )}

        {/* Abattement cumulé handicap */}
        {handicap && (
          <div style={sBandeau('green')}>
            ✅ Abattement cumulé : {fr(calculs.abattBase)} € + {fr(ABATTEMENT_HANDICAP)} € (handicap) = <strong>{fr(calculs.abattTotal)} €</strong>
          </div>
        )}

        {/* Points d'attention */}
        {lien === 'tiers' && (
          <div style={sBandeau('red')}>
            ⚠️ <strong>Taux de 60%</strong> — Envisager l'assurance-vie (art. 990i : abattement 152 500 € par bénéficiaire).
          </div>
        )}
        {montant > 100000 && lien === 'enfant' && (
          <div style={sBandeau('blue')}>
            💡 Pensez à étaler la donation sur plusieurs années pour bénéficier plusieurs fois de l'abattement (renouvellement tous les <strong>15 ans</strong>).
          </div>
        )}
        {(lien === 'frere_soeur' || lien === 'neveu_niece') && calculs.droits > 0 && (
          <div style={sBandeau('amber')}>
            ⚠️ Taux élevé ({lien === 'frere_soeur' ? '35–45%' : '55%'}) — une donation à un enfant puis retransmission peut être plus efficace fiscalement.
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   ONGLET 2 — Donation-partage
═══════════════════════════════════════════════════════════════════ */
function TabPartage() {
  const [patrimoine, setPatrimoine]   = useState<number>(600000);
  const [nbEnfants, setNbEnfants]     = useState<number>(3);
  const [nbDonateurs, setNbDonateurs] = useState<1 | 2>(2);
  const [enfants, setEnfants]         = useState<Enfant[]>(() => makeDefaultEnfants(3));

  const updateNbEnfants = (n: number) => {
    setNbEnfants(n);
    setEnfants(makeDefaultEnfants(n));
  };

  const updateEnfant = (i: number, field: keyof Enfant, val: string | number | boolean) => {
    setEnfants(prev => prev.map((e, idx) => idx === i ? { ...e, [field]: val } : e));
  };

  const totalPct = enfants.reduce((s, e) => s + e.partPct, 0);
  const pctOk = Math.abs(totalPct - 100) < 0.5;

  const calculs = useMemo(() => {
    if (!pctOk) return null;
    const resultats = enfants.map(e => {
      const part = patrimoine * (e.partPct / 100);
      const abattBase = 100000 * nbDonateurs;
      const abattHandicap = e.handicap ? ABATTEMENT_HANDICAP : 0;
      const abattTotal = abattBase + abattHandicap;
      const abattResiduel = Math.max(0, abattTotal - e.donationsAnterieures);
      const { droits } = taxWithRappel(part, e.donationsAnterieures, abattTotal, BAREMES.ligne_directe);
      return { part, abattResiduel, baseTaxable: Math.max(0, part - abattResiduel), droits, netRecu: part - droits };
    });
    const totalDroits = resultats.reduce((s, r) => s + r.droits, 0);
    const totalNet = resultats.reduce((s, r) => s + r.netRecu, 0);

    // Comparaison vs donations simples successives (ordre d'attribution quelconque)
    const totalDroitsSimples = resultats.reduce((s, r) => s + r.droits, 0); // identique fiscalement
    const avantageDonPartage = totalDroitsSimples - totalDroits; // 0€ fiscal, avantage = gel des valeurs

    return { resultats, totalDroits, totalNet, avantageDonPartage };
  }, [enfants, patrimoine, nbDonateurs, pctOk]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '1.5rem', alignItems: 'start' }}>
      {/* GAUCHE */}
      <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <p style={sH3}>Paramètres</p>

        <div>
          <span style={sLbl}>Patrimoine à transmettre</span>
          <input type="number" value={patrimoine} onChange={e => setPatrimoine(Math.max(0, Number(e.target.value)))}
            className="glass-input" />
        </div>

        <div>
          <span style={sLbl}>Nombre d'enfants</span>
          <select value={nbEnfants} onChange={e => updateNbEnfants(Number(e.target.value))} className="glass-select">
            {[1,2,3,4,5,6].map(n => <option key={n} value={n}>{n} enfant{n > 1 ? 's' : ''}</option>)}
          </select>
        </div>

        <div>
          <span style={sLbl}>Donateurs</span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {([1, 2] as const).map(n => (
              <button key={n} onClick={() => setNbDonateurs(n)}
                style={{
                  flex: 1, padding: '0.5rem', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem',
                  background: nbDonateurs === n ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${nbDonateurs === n ? 'rgba(99,102,241,0.5)' : 'var(--border-glass)'}`,
                  color: nbDonateurs === n ? '#A5B4FC' : 'var(--text-secondary)',
                }}
              >{n}</button>
            ))}
          </div>
        </div>

        {/* Détails enfants */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <span style={sLbl}>Répartition par enfant</span>
          {enfants.map((e, i) => (
            <div key={i} style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.04)', borderRadius: 10, border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <input
                type="text" value={e.prenom} placeholder={`Enfant ${i + 1}`}
                onChange={ev => updateEnfant(i, 'prenom', ev.target.value)}
                className="glass-input" style={{ fontSize: '0.85rem', padding: '0.4rem 0.7rem' }}
              />
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  type="number" value={e.partPct} min={0} max={100}
                  onChange={ev => updateEnfant(i, 'partPct', Number(ev.target.value))}
                  className="glass-input" style={{ fontSize: '0.85rem', padding: '0.4rem 0.7rem', width: 70 }}
                />
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>%</span>
              </div>
              <input
                type="number" value={e.donationsAnterieures} placeholder="Donations antérieures"
                onChange={ev => updateEnfant(i, 'donationsAnterieures', Math.max(0, Number(ev.target.value)))}
                className="glass-input" style={{ fontSize: '0.8rem', padding: '0.4rem 0.7rem' }}
              />
              <label style={{ ...sCheckLabel, fontSize: '0.78rem' }}>
                <input type="checkbox" checked={e.handicap} onChange={ev => updateEnfant(i, 'handicap', ev.target.checked)} />
                <span>Situation de handicap</span>
              </label>
            </div>
          ))}
          {!pctOk && (
            <div style={{ ...sBandeau('red'), fontSize: '0.78rem' }}>
              ⚠️ Total des parts : {totalPct}% — doit être 100%
            </div>
          )}
        </div>
      </div>

      {/* DROITE */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {calculs ? (
          <>
            {/* KPI */}
            <div className="glass-card-hi" style={{ padding: '1.25rem 1.5rem', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
              <div>
                <span style={sLbl}>Total transmis</span>
                <p style={sKpiVal()}>{fr(patrimoine)} €</p>
              </div>
              <div>
                <span style={sLbl}>Droits totaux famille</span>
                <p style={sKpiVal(calculs.totalDroits > 0 ? 'var(--accent-amber)' : 'var(--accent-emerald)')}>{fr(calculs.totalDroits)} €</p>
              </div>
              <div>
                <span style={sLbl}>Net reçu famille</span>
                <p style={sKpiVal('var(--accent-emerald)')}>{fr(calculs.totalNet)} €</p>
              </div>
            </div>

            {/* Tableau enfants */}
            <div className="glass-card" style={{ overflow: 'hidden' }}>
              <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface-md)' }}>
                <h3 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Répartition par enfant
                </h3>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-surface-md)', borderBottom: '1px solid var(--border-subtle)' }}>
                      {['Enfant', 'Part reçue', 'Abattement', 'Base taxable', 'Droits', 'Net reçu'].map(h => (
                        <th key={h} style={{ ...sTh, textAlign: h === 'Enfant' ? 'left' : 'right' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {calculs.resultats.map((r, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={sTd()}><strong style={{ color: 'var(--text-primary)' }}>{enfants[i]?.prenom || `Enfant ${i+1}`}</strong><br /><small>{enfants[i]?.partPct}%</small></td>
                        <td style={{ ...sTd('right'), fontWeight: 600, color: 'var(--text-primary)' }}>{fr(r.part)} €</td>
                        <td style={{ ...sTd('right'), color: 'var(--accent-emerald)' }}>{fr(r.abattResiduel)} €</td>
                        <td style={{ ...sTd('right') }}>{fr(r.baseTaxable)} €</td>
                        <td style={{ ...sTd('right'), color: r.droits > 0 ? 'var(--accent-amber)' : 'var(--accent-emerald)', fontWeight: 700 }}>{fr(r.droits)} €</td>
                        <td style={{ ...sTd('right'), fontWeight: 700, color: 'var(--text-primary)' }}>{fr(r.netRecu)} €</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: 'var(--bg-surface-md)', borderTop: '2px solid var(--border-subtle)' }}>
                      <td style={{ ...sTd(), fontWeight: 700, color: 'var(--text-primary)' }}>Total</td>
                      <td style={{ ...sTd('right'), fontWeight: 700, color: 'var(--text-primary)' }}>{fr(patrimoine)} €</td>
                      <td />
                      <td />
                      <td style={{ ...sTd('right'), fontWeight: 700, color: 'var(--accent-amber)', fontSize: '1rem' }}>{fr(calculs.totalDroits)} €</td>
                      <td style={{ ...sTd('right'), fontWeight: 700, color: 'var(--accent-emerald)', fontSize: '1rem' }}>{fr(calculs.totalNet)} €</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Avantage donation-partage */}
            <div style={sBandeau('blue')}>
              <strong>Avantage de la donation-partage (art. 1078 C. civ.)</strong><br />
              Les biens sont évalués au jour de la donation-partage et non au décès. Si les biens s'apprécient, les héritiers ne devront pas de rapport successoral — c'est l'avantage clé par rapport à des donations simples séparées.
            </div>
          </>
        ) : (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            Ajustez les parts pour que le total soit 100%.
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   ONGLET 3 — Saut de génération
═══════════════════════════════════════════════════════════════════ */
function TabGeneration() {
  const [montant, setMontant]         = useState<number>(500000);
  const [nbEnfants, setNbEnfants]     = useState<number>(2);
  const [nbPEtParEnfant, setNbPEt]    = useState<number>(2);
  const [nbDonateurs, setNbDonateurs] = useState<1 | 2>(2);
  const [donAnt_E, setDonAntE]        = useState<number>(0);
  const [donAnt_PE, setDonAntPE]      = useState<number>(0);

  const calculs = useMemo(() => {
    const nbPEtTotal = nbEnfants * nbPEtParEnfant;
    const ld = BAREMES.ligne_directe;
    const abattEnfant = 100000 * nbDonateurs;
    const abattPEtDirect = 31865 * nbDonateurs;

    const taxUnit = (part: number, ant: number, abatt: number) => {
      const { droits } = taxWithRappel(part, ant, abatt, ld);
      return droits;
    };

    const partEnfant = montant / nbEnfants;
    const partPEt = montant / nbPEtTotal;

    let droitsA = 0, droitsB = 0, droitsC = 0;
    for (let i = 0; i < nbEnfants; i++) {
      droitsA += taxUnit(partEnfant, donAnt_E, abattEnfant);
      for (let j = 0; j < nbPEtParEnfant; j++) {
        droitsB += taxUnit(partPEt, donAnt_PE, abattPEtDirect);
        const abattCParPEt = (100000 * nbDonateurs) / nbPEtParEnfant;
        droitsC += taxUnit(partPEt, donAnt_PE, abattCParPEt);
      }
    }

    const A = { droits: droitsA, net: montant - droitsA };
    const B = { droits: droitsB, net: montant - droitsB };
    const C = { droits: droitsC, net: montant - droitsC };
    const best = [A, B, C].reduce((a, b) => a.droits <= b.droits ? a : b);
    const bestIdx = [droitsA, droitsB, droitsC].indexOf(best.droits);

    return { A, B, C, bestIdx, abattEnfant, abattPEtDirect, abattCParPEt: (100000 * nbDonateurs) / nbPEtParEnfant, nbPEtTotal };
  }, [montant, nbEnfants, nbPEtParEnfant, nbDonateurs, donAnt_E, donAnt_PE]);

  const strategies = [
    { id: 'A', label: 'Stratégie A', sub: 'Donation à l\'enfant', abatt: `${fr(calculs.abattEnfant)} € × ${nbEnfants}`, data: calculs.A },
    { id: 'B', label: 'Stratégie B', sub: `Don direct aux ${calculs.nbPEtTotal} petits-enfants`, abatt: `${fr(calculs.abattPEtDirect)} € × ${calculs.nbPEtTotal}`, data: calculs.B },
    { id: 'C', label: 'Stratégie C', sub: 'Représentation par renonciation', abatt: `${fr(calculs.abattCParPEt)} € × ${calculs.nbPEtTotal}`, data: calculs.C },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Paramètres */}
      <div className="glass-card" style={{ padding: '1.5rem' }}>
        <p style={sH3}>Paramètres de comparaison</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1.25rem' }}>
          <div>
            <span style={sLbl}>Montant à transmettre</span>
            <input type="number" value={montant} onChange={e => setMontant(Math.max(0, Number(e.target.value)))}
              className="glass-input" />
          </div>
          <div>
            <span style={sLbl}>Nombre d'enfants</span>
            <select value={nbEnfants} onChange={e => setNbEnfants(Number(e.target.value))} className="glass-select">
              {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div>
            <span style={sLbl}>Petits-enfants par enfant</span>
            <select value={nbPEtParEnfant} onChange={e => setNbPEt(Number(e.target.value))} className="glass-select">
              {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div>
            <span style={sLbl}>Donateurs</span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {([1, 2] as const).map(n => (
                <button key={n} onClick={() => setNbDonateurs(n)}
                  style={{
                    flex: 1, padding: '0.5rem', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem',
                    background: nbDonateurs === n ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${nbDonateurs === n ? 'rgba(99,102,241,0.5)' : 'var(--border-glass)'}`,
                    color: nbDonateurs === n ? '#A5B4FC' : 'var(--text-secondary)',
                  }}
                >{n}</button>
              ))}
            </div>
          </div>
          <div>
            <span style={sLbl}>Donations antérieures (enfants)</span>
            <input type="number" value={donAnt_E} onChange={e => setDonAntE(Math.max(0, Number(e.target.value)))}
              className="glass-input" />
          </div>
          <div>
            <span style={sLbl}>Donations antérieures (petits-enfants)</span>
            <input type="number" value={donAnt_PE} onChange={e => setDonAntPE(Math.max(0, Number(e.target.value)))}
              className="glass-input" />
          </div>
        </div>
      </div>

      {/* Comparatif 3 stratégies */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
        {strategies.map((s, idx) => {
          const isBest = idx === calculs.bestIdx;
          return (
            <div key={s.id} className="glass-card" style={{
              padding: '1.5rem',
              border: isBest ? '1px solid rgba(16,185,129,0.5)' : undefined,
              background: isBest ? 'rgba(16,185,129,0.05)' : undefined,
              position: 'relative',
            }}>
              {isBest && (
                <div style={{
                  position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)',
                  background: 'var(--accent-emerald)', color: '#fff',
                  fontSize: '0.65rem', fontWeight: 700, padding: '0.15rem 0.6rem', borderRadius: 999,
                  textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap',
                }}>
                  Meilleure option
                </div>
              )}
              <div style={{ marginBottom: '0.25rem' }}>
                <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{s.label}</span>
              </div>
              <p style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{s.sub}</p>
              <div style={{ padding: '0.5rem 0.75rem', background: 'rgba(255,255,255,0.04)', borderRadius: 8, marginBottom: '1rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Abattement : {s.abatt}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div>
                  <span style={sLbl}>Droits totaux</span>
                  <p style={{ ...sKpiVal(s.data.droits === 0 ? 'var(--accent-emerald)' : 'var(--accent-amber)'), fontSize: '1.4rem' }}>
                    {fr(s.data.droits)} €
                  </p>
                </div>
                <div>
                  <span style={sLbl}>Net transmis</span>
                  <p style={{ ...sKpiVal('var(--text-primary)'), fontSize: '1.2rem' }}>
                    {fr(s.data.net)} €
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Économie */}
      {(() => {
        const minDroits = Math.min(calculs.A.droits, calculs.B.droits, calculs.C.droits);
        const maxDroits = Math.max(calculs.A.droits, calculs.B.droits, calculs.C.droits);
        const economie = maxDroits - minDroits;
        return economie > 0 ? (
          <div style={sBandeau('green')}>
            💡 La meilleure stratégie permet d'économiser <strong>{fr(economie)} €</strong> de droits par rapport à la moins optimale.
          </div>
        ) : null;
      })()}

      {/* Points d'attention */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div style={sBandeau('amber')}>
          ⚠️ <strong>Renonciation irrévocable</strong> — L'enfant renonçant doit le faire avant tout acte d'acceptation tacite (ex. percevoir des loyers sur les biens).
        </div>
        <div style={sBandeau('blue')}>
          ✅ Peut se combiner avec un <strong>usufruit conservé</strong> par les grands-parents — les petits-enfants reçoivent la nue-propriété, limitant encore la base taxable.
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   ONGLET 4 — Dispositifs spéciaux
═══════════════════════════════════════════════════════════════════ */
function TabDispositifs() {
  const [donNum, setDonNum]         = useState<number>(25000);
  const [valEntreprise, setValEnt]  = useState<number>(800000);
  const [nbDonateursD, setNbD]      = useState<1 | 2>(1);

  const resNum = useMemo(() => {
    const max = 31865 * nbDonateursD;
    const exonere = Math.min(donNum, max);
    const taxable = Math.max(0, donNum - max);
    return { exonere, taxable, max };
  }, [donNum, nbDonateursD]);

  const resDutreil = useMemo(() => {
    const baseApresAbatt = valEntreprise * 0.25;
    const abattEnfant = 100000;
    const baseTaxable = Math.max(0, baseApresAbatt - abattEnfant);
    const { total: droits } = computeTax(baseTaxable, BAREMES.ligne_directe);
    return { baseApresAbatt, baseTaxable, droits };
  }, [valEntreprise]);

  const tableAbattements = [
    { lien: 'Enfant',            donation: '100 000 €',  succession: '100 000 €'  },
    { lien: 'Petit-enfant',      donation: '31 865 €',   succession: '31 865 €'   },
    { lien: 'Arrière-pet.',      donation: '5 310 €',    succession: '5 310 €'    },
    { lien: 'Conjoint / PACS',   donation: '80 724 €',   succession: 'Exonéré'    },
    { lien: 'Frère / Sœur',      donation: '15 932 €',   succession: '15 932 €'   },
    { lien: 'Neveu / Nièce',     donation: '7 967 €',    succession: '7 967 €'    },
    { lien: 'Tiers',             donation: '1 594 €',    succession: '1 594 €'    },
    { lien: '+ Handicap',        donation: '+ 159 325 €', succession: '+ 159 325 €'},
    { lien: 'AV art. 990i',      donation: '—',          succession: '152 500 € / bénéf.' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>

        {/* Card 1 — Don en numéraire art. 790G */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: 20 }}>💶</span>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>Don en numéraire</h3>
            <span className="badge badge-blue" style={{ fontSize: '0.65rem' }}>Art. 790G CGI</span>
          </div>
          <p style={{ margin: '0 0 1rem', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Exonération jusqu'à <strong>31 865 € par donateur/donataire</strong> pour les dons de sommes d'argent.
            Conditions : donataire majeur, lien en ligne directe ou neveu/nièce. Déclaration formulaire 2735.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
            <div>
              <span style={sLbl}>Montant du don</span>
              <input type="number" value={donNum} onChange={e => setDonNum(Math.max(0, Number(e.target.value)))}
                className="glass-input" />
            </div>
            <div>
              <span style={sLbl}>Donateurs</span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {([1, 2] as const).map(n => (
                  <button key={n} onClick={() => setNbD(n)}
                    style={{
                      flex: 1, padding: '0.4rem', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem',
                      background: nbDonateursD === n ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)',
                      border: `1px solid ${nbDonateursD === n ? 'rgba(99,102,241,0.5)' : 'var(--border-glass)'}`,
                      color: nbDonateursD === n ? '#A5B4FC' : 'var(--text-secondary)',
                    }}
                  >{n}</button>
                ))}
              </div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div style={{ padding: '0.75rem', background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8 }}>
              <span style={{ ...sLbl, color: 'var(--accent-emerald)' }}>Part exonérée</span>
              <p style={{ margin: '0.2rem 0 0', fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 700, color: 'var(--accent-emerald)' }}>{fr(resNum.exonere)} €</p>
            </div>
            <div style={{ padding: '0.75rem', background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8 }}>
              <span style={{ ...sLbl, color: 'var(--accent-amber)' }}>Part taxable</span>
              <p style={{ margin: '0.2rem 0 0', fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 700, color: 'var(--accent-amber)' }}>{fr(resNum.taxable)} €</p>
            </div>
          </div>
          {resNum.taxable === 0 && (
            <div style={{ ...sBandeau('green'), marginTop: '0.75rem', fontSize: '0.78rem' }}>
              ✅ Don entièrement exonéré (plafond : {fr(resNum.max)} €)
            </div>
          )}
        </div>

        {/* Card 2 — Don résidence art. 790A bis */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: 20 }}>🏠</span>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>Don pour résidence principale</h3>
            <span className="badge badge-amber" style={{ fontSize: '0.65rem' }}>LFI 2025 — Temporaire</span>
          </div>
          <div style={{ ...sBandeau('amber'), marginBottom: '1rem', fontSize: '0.78rem' }}>
            ⚠️ Dispositif actif du 15/02/2025 au 31/12/2026 (art. 790A bis CGI)
          </div>
          <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.8, display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
            <li>Exonération jusqu'à <strong>100 000 € par donateur/donataire</strong> (plafond global 300 000 €)</li>
            <li>Affectation à l'achat d'un <strong>logement neuf / VEFA</strong> ou travaux de rénovation énergétique</li>
            <li>Affectation dans les <strong>6 mois</strong> suivant le versement</li>
            <li>Conservation <strong>5 ans</strong> comme résidence principale</li>
            <li><span style={{ color: 'var(--accent-emerald)' }}>✅ Cumulable</span> avec l'abattement classique (ex. 100 000 € enfant + 100 000 € résidence = 200 000 € exonérés)</li>
          </ul>
          <div style={{ ...sBandeau('red'), marginTop: '1rem', fontSize: '0.78rem' }}>
            ⚠️ Remise en cause si les conditions ne sont pas respectées (délai, affectation, conservation).
          </div>
        </div>

        {/* Card 3 — Pacte Dutreil */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: 20 }}>🏭</span>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>Pacte Dutreil</h3>
            <span className="badge badge-blue" style={{ fontSize: '0.65rem' }}>Art. 787B CGI</span>
          </div>
          <p style={{ margin: '0 0 0.75rem', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Exonération <strong>75%</strong> de la valeur des titres transmis. Conditions : engagement collectif de conservation 2 ans (17% droits financiers / 34% droits de vote si non coté), puis engagement individuel 4 ans, poursuite de l'activité dirigeante.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
            <div>
              <span style={sLbl}>Valeur de l'entreprise</span>
              <input type="number" value={valEntreprise} onChange={e => setValEnt(Math.max(0, Number(e.target.value)))}
                className="glass-input" />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.6rem' }}>
            {[
              { label: 'Abattement 75%', val: fr(valEntreprise * 0.75) + ' €', color: 'var(--accent-emerald)' },
              { label: 'Base 25%', val: fr(resDutreil.baseApresAbatt) + ' €', color: 'var(--text-secondary)' },
              { label: 'Droits estimés (enfant)', val: fr(resDutreil.droits) + ' €', color: 'var(--accent-amber)' },
            ].map(k => (
              <div key={k.label} style={{ padding: '0.6rem', background: 'rgba(255,255,255,0.04)', borderRadius: 8 }}>
                <span style={{ ...sLbl, fontSize: '0.6rem' }}>{k.label}</span>
                <p style={{ margin: '0.15rem 0 0', fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700, color: k.color }}>{k.val}</p>
              </div>
            ))}
          </div>
          <div style={{ ...sBandeau('amber'), marginTop: '1rem', fontSize: '0.78rem' }}>
            ⚠️ Ce simulateur donne une estimation. Le pacte Dutreil requiert l'intervention d'un notaire.
          </div>
        </div>

        {/* Card 4 — Tableau abattements */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <span style={{ fontSize: 20 }}>📊</span>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>Récapitulatif des abattements</h3>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-subtle)' }}>
                  <th style={{ ...sTh, paddingLeft: 0 }}>Lien de parenté</th>
                  <th style={{ ...sTh, textAlign: 'right' }}>Donation</th>
                  <th style={{ ...sTh, textAlign: 'right' }}>Succession</th>
                </tr>
              </thead>
              <tbody>
                {tableAbattements.map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)', background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : undefined }}>
                    <td style={{ ...sTd(), paddingLeft: 0, fontWeight: row.lien.startsWith('+') ? 600 : 400 }}>{row.lien}</td>
                    <td style={{ ...sTd('right'), color: row.donation === '—' ? 'var(--text-muted)' : 'var(--accent-emerald)', fontWeight: 600 }}>{row.donation}</td>
                    <td style={{ ...sTd('right'), color: row.succession === 'Exonéré' ? 'var(--accent-emerald)' : row.succession === '—' ? 'var(--text-muted)' : 'var(--text-secondary)', fontWeight: row.succession === 'Exonéré' ? 700 : 400 }}>{row.succession}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ margin: '0.75rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Renouvellement tous les 15 ans. Sources : art. 779, 777, 788 CGI.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   PAGE PRINCIPALE
═══════════════════════════════════════════════════════════════════ */
export default function DonationPage() {
  const [tab, setTab] = useState<TabId>('simulateur');

  return (
    <AuthGate>
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '0 1.25rem 3rem' }}>

        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <p style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
            Pôle Civil
          </p>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.6rem, 3vw, 2.4rem)', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1.1, margin: '0 0 0.5rem' }}>
            🎁 Simulateur de Donations
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>
            Droits de mutation, donation-partage, saut de génération et dispositifs d'exonération.
          </p>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0.25rem', borderBottom: '1px solid var(--border-subtle)', marginBottom: '2rem', overflowX: 'auto' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{
                padding: '0.75rem 1.1rem', background: 'none', border: 'none', cursor: 'pointer',
                fontSize: '0.85rem', fontWeight: tab === t.id ? 700 : 500, whiteSpace: 'nowrap',
                color: tab === t.id ? 'var(--text-primary)' : 'var(--text-muted)',
                borderBottom: tab === t.id ? '2px solid #6366F1' : '2px solid transparent',
                marginBottom: -1, transition: 'color 0.2s',
              }}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {tab === 'simulateur'  && <TabSimulateur />}
        {tab === 'partage'     && <TabPartage />}
        {tab === 'generation'  && <TabGeneration />}
        {tab === 'dispositifs' && <TabDispositifs />}
      </main>
    </AuthGate>
  );
}
