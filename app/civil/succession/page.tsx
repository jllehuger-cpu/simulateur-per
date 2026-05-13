'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';

/* ─── Types ─── */
type TabId = 'simulateur' | 'devolution' | 'particuliers' | 'delais';

interface Bareme { limite: number | null; taux: number; }
interface BaremesData {
  abattements: Record<string, number>;
  baremes: Record<string, Bareme[]>;
}

/* ─── Tabs config ─── */
const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'simulateur',   label: 'Simulateur de droits', icon: '🧮' },
  { id: 'devolution',   label: 'Dévolution légale',    icon: '⚖️' },
  { id: 'particuliers', label: 'Cas particuliers',     icon: '📋' },
  { id: 'delais',       label: 'Délais & obligations', icon: '🗓️' },
];

/* ─── Tax engine ─── */
function computeTax(
  assiette: number,
  tranches: Bareme[]
): { total: number; detail: { label: string; assiette: number; taux: string; impot: number }[] } {
  let droits = 0;
  let reste = assiette;
  let prev = 0;
  const detail: { label: string; assiette: number; taux: string; impot: number }[] = [];
  for (const t of tranches) {
    const lim = t.limite === null ? Infinity : t.limite;
    const slice = Math.min(Math.max(0, reste), lim - prev);
    if (slice > 0) {
      const impot = slice * t.taux;
      droits += impot;
      detail.push({
        label: t.limite === null
          ? `Plus de ${prev.toLocaleString('fr-FR')} €`
          : `Jusqu’à ${t.limite.toLocaleString('fr-FR')} €`,
        assiette: slice,
        taux: (t.taux * 100).toFixed(0),
        impot,
      });
      reste -= slice;
    }
    prev = lim;
    if (reste <= 0) break;
  }
  return { total: droits, detail };
}

/* ─── Shared micro-styles ─── */
const sH3: React.CSSProperties = {
  margin: '0 0 1rem', fontSize: '0.75rem', fontWeight: 700,
  color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em',
};
const sKpi: React.CSSProperties = {
  fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)',
  textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block',
};
const sKpiVal: React.CSSProperties = {
  margin: '0.25rem 0 0', fontFamily: 'var(--font-display)', fontSize: '1.6rem', fontWeight: 700,
};
const sBadgeGray: React.CSSProperties = {
  fontSize: '0.7rem', fontWeight: 600, background: 'var(--bg-surface)',
  border: '1px solid var(--border-glass)', padding: '0.2rem 0.6rem', borderRadius: 999, color: 'var(--text-muted)',
};
const sBadgeBlue: React.CSSProperties = {
  fontSize: '0.65rem', fontWeight: 700, background: 'rgba(99,102,241,0.15)', color: '#A5B4FC',
  border: '1px solid rgba(99,102,241,0.3)', padding: '0.1rem 0.4rem', borderRadius: 999, marginLeft: '0.4rem',
};
const sCheckLabel: React.CSSProperties = {
  display: 'flex', alignItems: 'flex-start', gap: '0.25rem',
  cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-secondary)',
};
const sBandeauInfo: React.CSSProperties = {
  padding: '0.75rem 1rem', background: 'rgba(99,102,241,0.08)',
  border: '1px solid rgba(99,102,241,0.25)', borderRadius: 10,
  fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.6,
};
const sWizardSection: React.CSSProperties = { marginBottom: '1.5rem' };
const sWizardQ: React.CSSProperties = {
  fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)',
  textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem',
};
function sCasRow(color: 'green' | 'amber' | 'red'): React.CSSProperties {
  const map = {
    green: { bg: 'rgba(16,185,129,0.07)', border: 'rgba(16,185,129,0.2)' },
    amber: { bg: 'rgba(245,158,11,0.07)',  border: 'rgba(245,158,11,0.2)'  },
    red:   { bg: 'rgba(239,68,68,0.07)',   border: 'rgba(239,68,68,0.2)'   },
  };
  return {
    background: map[color].bg, border: `1px solid ${map[color].border}`,
    borderRadius: 8, padding: '0.6rem 0.75rem',
    display: 'flex', flexDirection: 'column', gap: '0.2rem',
  };
}

/* ═══════════════════════════════════════════════════════
   ONGLET 1 — Simulateur de droits
═══════════════════════════════════════════════════════ */
function TabSimulateur({ baremes }: { baremes: BaremesData }) {
  const [actifNet, setActifNet]             = useState<number>(500000);
  const [lienParente, setLienParente]       = useState<string>('ligne_directe');
  const [nbHeritiers, setNbHeritiers]       = useState<number>(1);
  const [handicap, setHandicap]             = useState<boolean>(false);
  const [representation, setRepresentation] = useState<boolean>(false);
  const [donationRappel, setDonationRappel] = useState<boolean>(false);
  const [abattementDeja, setAbattementDeja] = useState<number>(0);

  const calculs = useMemo(() => {
    if (lienParente === 'conjoint') {
      const part = actifNet / Math.max(1, nbHeritiers);
      return { exonere: true, partParHeritier: part, abattementTotal: 0, abBase: 0, abHandicap: 0, assietteTaxable: 0, droitsParHeritier: 0, netParHeritier: part, detail: [] };
    }
    const cleAb      = lienParente === 'ligne_directe' ? 'enfant' : lienParente;
    const abBase     = baremes.abattements[cleAb] || 0;
    const abHandicap = handicap ? (baremes.abattements['handicap'] || 159325) : 0;
    const abTotal    = Math.max(0, abBase + abHandicap - (donationRappel ? abattementDeja : 0));

    const partParHeritier = actifNet / Math.max(1, nbHeritiers);
    const assietteTaxable = Math.max(0, partParHeritier - abTotal);
    const tranches        = baremes.baremes[lienParente] || [];
    const { total: droitsParHeritier, detail } = computeTax(assietteTaxable, tranches);
    const netParHeritier  = partParHeritier - droitsParHeritier;

    return { exonere: false, partParHeritier, abattementTotal: abTotal, abBase, abHandicap, assietteTaxable, droitsParHeritier, netParHeritier, detail };
  }, [actifNet, lienParente, nbHeritiers, handicap, donationRappel, abattementDeja, baremes]);

  const fmt = (n: number) => Math.round(n).toLocaleString('fr-FR');

  const ABATTEMENTS_TABLE = [
    { lien: 'Enfant (ligne directe)',   ab: '100 000 €', exo: false, spec: false },
    { lien: 'Conjoint / PACS',          ab: 'Exénération', exo: true,  spec: false },
    { lien: 'Petit-enfant',             ab: '31 865 €',  exo: false, spec: false },
    { lien: 'Frère / Sœur',  ab: '15 932 €',  exo: false, spec: false },
    { lien: 'Neveu / Nièce',       ab: '7 967 €',   exo: false, spec: false },
    { lien: 'Tiers (non parent)',        ab: '1 594 €',   exo: false, spec: false },
    { lien: '+ Handicap (cumulable)',    ab: '+ 159 325 €', exo: false, spec: true  },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '1.5rem', alignItems: 'start' }}>

      {/* Colonne paramètres */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <h3 style={sH3}>Paramètres</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

            <div>
              <label className="field-label">Lien de parenté</label>
              <select value={lienParente} onChange={e => setLienParente(e.target.value)} className="glass-select">
                <option value="ligne_directe">Enfant (ligne directe)</option>
                <option value="conjoint">Conjoint / PACS</option>
                <option value="frere_soeur">Frère / Sœur</option>
                <option value="neveu_niece">Neveu / Nièce</option>
                <option value="tiers">Tiers (non parent)</option>
              </select>
            </div>

            <div>
              <label className="field-label">Actif net taxable total (€)</label>
              <input type="number" value={actifNet} min={0}
                onChange={e => setActifNet(Number(e.target.value))}
                className="glass-input" style={{ fontWeight: 700, fontSize: '1.2rem' }} />
            </div>

            <div>
              <label className="field-label">Nombre d’héritiers du même rang</label>
              <input type="number" value={nbHeritiers} min={1} max={20}
                onChange={e => setNbHeritiers(Math.max(1, Number(e.target.value)))}
                className="glass-input" />
            </div>

            <label style={sCheckLabel}>
              <input type="checkbox" checked={handicap} onChange={e => setHandicap(e.target.checked)}
                style={{ marginRight: '0.5rem', accentColor: '#6366F1' }} />
              <span>
                <strong>Héritier handicapé</strong>
                <span style={sBadgeBlue}>+ 159 325 €</span>
                <br />
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  Cumulable avec abattement principal (art. 779 II CGI)
                </span>
              </span>
            </label>

            <label style={sCheckLabel}>
              <input type="checkbox" checked={representation} onChange={e => setRepresentation(e.target.checked)}
                style={{ marginRight: '0.5rem', accentColor: '#6366F1' }} />
              <span>
                <strong>Représentation successorale</strong>
                <br />
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  Enfant prédécédé ou renonçant — partage par souche
                </span>
              </span>
            </label>

            <label style={sCheckLabel}>
              <input type="checkbox" checked={donationRappel} onChange={e => setDonationRappel(e.target.checked)}
                style={{ marginRight: '0.5rem', accentColor: '#6366F1' }} />
              <span>
                <strong>Donation antérieure à rappeler</strong>
                <br />
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  Rappel fiscal 15 ans — abattement déjà consommé
                </span>
              </span>
            </label>

            {donationRappel && (
              <div>
                <label className="field-label">
                  Abattement déjà utilisé lors de la donation (€)
                </label>
                <input type="number" value={abattementDeja} min={0}
                  onChange={e => setAbattementDeja(Number(e.target.value))}
                  className="glass-input" />
              </div>
            )}
          </div>
        </div>

        {/* Tableau abattements légaux */}
        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <h3 style={sH3}>Abattements légaux</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
            <tbody>
              {ABATTEMENTS_TABLE.map((row, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '0.45rem 0.25rem', color: 'var(--text-secondary)' }}>{row.lien}</td>
                  <td style={{ padding: '0.45rem 0.25rem', textAlign: 'right', fontWeight: 700,
                    color: row.exo ? '#10B981' : row.spec ? '#6366F1' : 'var(--text-primary)' }}>
                    {row.ab}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Colonne résultats */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

        {representation && (
          <div style={sBandeauInfo}>
            <strong>Représentation successorale</strong> — Les petits-enfants viennent en représentation de leur parent prédécédé ou renonçant. Le calcul s’applique à chaque représentant sur sa quote-part. Le partage se fait par souche et non par tête.
          </div>
        )}

        {/* KPIs récap */}
        <div className="glass-card-hi" style={{ padding: '1.5rem', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '1rem', alignItems: 'center' }}>
          <div>
            <span style={sKpi}>Abattement / héritier</span>
            <p style={{ ...sKpiVal, color: '#10B981' }}>
              {calculs.exonere ? 'ILLIMITÉ' : `${fmt(calculs.abattementTotal)} €`}
            </p>
            {!calculs.exonere && handicap && (
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                ({fmt(calculs.abBase)} + {fmt(calculs.abHandicap)} handicap{donationRappel ? ` − ${fmt(abattementDeja)} déjà utilisé` : ''})
              </span>
            )}
          </div>
          <div>
            <span style={sKpi}>Part brute / héritier</span>
            <p style={{ ...sKpiVal, color: 'var(--text-secondary)' }}>{fmt(calculs.partParHeritier)} €</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={sKpi}>Droits / héritier</span>
            <p style={{ ...sKpiVal, color: 'var(--text-primary)' }}>{fmt(calculs.droitsParHeritier)} €</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={sKpi}>Net reçu / héritier</span>
            <p style={{ ...sKpiVal, color: '#6366F1', fontSize: '2rem' }}>{fmt(calculs.netParHeritier)} €</p>
          </div>
        </div>

        {/* Répartition par héritier */}
        {!calculs.exonere && nbHeritiers > 1 && (
          <div className="glass-card" style={{ padding: '1.25rem' }}>
            <h3 style={sH3}>
              Répartition — {nbHeritiers} héritier{nbHeritiers > 1 ? 's' : ''}
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '0.75rem' }}>
              {Array.from({ length: Math.min(nbHeritiers, 8) }).map((_, i) => (
                <div key={i} style={{ background: 'var(--bg-surface-md)', borderRadius: 10, padding: '0.75rem', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                    {representation ? `Souche ${i + 1}` : `Héritier ${i + 1}`}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Part brute&nbsp;: <strong style={{ color: 'var(--text-primary)' }}>{fmt(calculs.partParHeritier)} €</strong>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Droits&nbsp;: <strong style={{ color: '#F59E0B' }}>{fmt(calculs.droitsParHeritier)} €</strong>
                  </div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#6366F1', marginTop: '0.3rem' }}>
                    Net&nbsp;: {fmt(calculs.netParHeritier)} €
                  </div>
                </div>
              ))}
              {nbHeritiers > 8 && (
                <div style={{ background: 'var(--bg-surface-md)', borderRadius: 10, padding: '0.75rem', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    + {nbHeritiers - 8} autres (même calcul)
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Résultat fiscal */}
        {calculs.exonere ? (
          <div style={{ padding: '2rem', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 14, textAlign: 'center' }}>
            <p style={{ color: '#6EE7B7', fontWeight: 600, fontSize: '0.9rem', fontStyle: 'italic', lineHeight: 1.6 }}>
              {'"Le conjoint survivant et le partenaire lié par un PACS sont totalement exonérés de droits de succession."'}
              <br />
              <span style={{ fontSize: '0.72rem', fontWeight: 400, textTransform: 'uppercase', display: 'block', marginTop: '0.5rem', opacity: 0.7 }}>
                (Art. 796-0 bis du CGI)
              </span>
            </p>
          </div>
        ) : (
          <div className="glass-card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-surface-md)' }}>
              <h3 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Barème d’imposition par héritier
              </h3>
              <span style={sBadgeGray}>Part taxable&nbsp;: {fmt(calculs.assietteTaxable)} €</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-surface-md)', borderBottom: '1px solid var(--border-subtle)' }}>
                    {['Tranche', 'Assiette', 'Taux', 'Impôt'].map(h => (
                      <th key={h} style={{ padding: '0.7rem 1.25rem', textAlign: h === 'Tranche' ? 'left' : h === 'Impôt' ? 'right' : 'center', fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {calculs.detail.map((t, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '0.7rem 1.25rem', color: 'var(--text-secondary)' }}>{t.label}</td>
                      <td style={{ padding: '0.7rem 1.25rem', textAlign: 'center', fontWeight: 700, color: 'var(--text-primary)' }}>{fmt(t.assiette)} €</td>
                      <td style={{ padding: '0.7rem 1.25rem', textAlign: 'center' }}><span className="badge badge-amber">{t.taux}%</span></td>
                      <td style={{ padding: '0.7rem 1.25rem', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>{fmt(t.impot)} €</td>
                    </tr>
                  ))}
                  {calculs.detail.length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ padding: '3rem', textAlign: 'center' }}>
                        <p style={{ color: 'var(--accent-emerald)', fontWeight: 700, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                          Aucun droit à payer
                        </p>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                          L’abattement couvre l’intégralité de la part.
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   ONGLET 2 — Dévolution légale
═══════════════════════════════════════════════════════ */
type DevLine = { icon: string; text: string; sub?: string };
type DevCase = { title: string; color: string; bg: string; border: string; lines: DevLine[]; warning?: string };

function buildCase(q1: string, q2: string, q3: string): DevCase | null {
  const hasDescendants = q2 === 'enfants_communs' || q2 === 'enfants_mixtes';

  if (q1 === 'pacs') return {
    title: 'Partenaire PACS — aucun droit légal',
    color: '#EF4444', bg: 'rgba(239,68,68,0.07)', border: 'rgba(239,68,68,0.25)',
    lines: [
      { icon: '❌', text: 'Le partenaire PACS n’hérite pas en l’absence de testament.' },
      { icon: '⚠️', text: 'La succession revient aux héritiers légaux (enfants, parents, collatéraux).' },
      { icon: '\u{1F4A1}', text: 'Solution : rédiger un testament ou souscrire une assurance-vie.' },
    ],
  };

  if (q2 === 'aucun') return {
    title: 'Aucun héritier — succession dévolue à l’État',
    color: '#EF4444', bg: 'rgba(239,68,68,0.07)', border: 'rgba(239,68,68,0.25)',
    lines: [
      { icon: '\u{1F3DB}️', text: 'La succession est recueillie par l’État (art. 539 c.civ.).' },
      { icon: '⚠️', text: 'Les créanciers du défunt sont payés en priorité.' },
    ],
  };

  if (q1 === 'conjoint' && q2 === 'enfants_communs') return {
    title: 'Conjoint + enfants communs uniquement',
    color: '#6366F1', bg: 'rgba(99,102,241,0.07)', border: 'rgba(99,102,241,0.25)',
    lines: [
      { icon: '✅', text: 'Option A — Usufruit de la totalité', sub: 'Le conjoint dispose de tous les biens. Les enfants sont nus-propriétaires. Au décès du conjoint, les enfants récupèrent la pleine propriété sans droits supplémentaires.' },
      { icon: '✅', text: 'Option B — Quart en pleine propriété', sub: 'Le conjoint reçoit 1/4 des biens en PP. Les 3/4 restants sont partagés également entre les enfants.' },
      { icon: '⚠️', text: q3 === 'representation' ? 'Représentation active — partage par souche pour les branches avec représentation.' : 'Sans demande dans les 3 mois suivant le décès, l’usufruit est présumé.' },
    ],
    warning: 'Le conjoint doit exprimer son choix dans les 3 mois — passé ce délai, l’usufruit est présumé (art. 758-3 c.civ.).',
  };

  if (q1 === 'conjoint' && q2 === 'enfants_mixtes') return {
    title: 'Conjoint + enfant(s) non commun(s)',
    color: '#F59E0B', bg: 'rgba(245,158,11,0.07)', border: 'rgba(245,158,11,0.25)',
    lines: [
      { icon: '✅', text: 'Le conjoint reçoit obligatoirement le quart en pleine propriété (1/4).' },
      { icon: '✅', text: 'Les enfants se partagent les 3/4 restants à parts égales.' },
      { icon: '❌', text: 'L’option usufruit est EXCLUE lorsqu’il existe un enfant non commun au couple (art. 757 c.civ.).' },
      ...(q3 === 'representation' ? [{ icon: '\u{1F4CC}', text: 'Représentation active — les 3/4 sont partagés par souche.' }] : []),
    ],
  };

  if (q1 === 'conjoint' && q2 === 'ascendants') return {
    title: 'Conjoint + parents (sans descendants)',
    color: '#10B981', bg: 'rgba(16,185,129,0.07)', border: 'rgba(16,185,129,0.25)',
    lines: [
      { icon: '✅', text: 'Le conjoint reçoit la moitié (1/2) de la succession.' },
      { icon: '✅', text: 'Chaque parent vivant reçoit 1/4 de la succession.' },
      { icon: '\u{1F4CC}', text: 'Si un seul parent est vivant : conjoint 3/4, parent survivant 1/4 (art. 757-2 c.civ.).' },
      { icon: '\u{1F4CC}', text: 'Si aucun parent n’est vivant : le conjoint recueille la totalité.' },
    ],
  };

  if (q1 === 'aucun' && hasDescendants) return {
    title: 'Descendants uniquement (sans conjoint)',
    color: '#10B981', bg: 'rgba(16,185,129,0.07)', border: 'rgba(16,185,129,0.25)',
    lines: [
      {
        icon: '✅',
        text: q3 === 'representation'
          ? 'Partage par souche — chaque souche reçoit une part égale.'
          : 'Partage en parts égales entre tous les enfants.',
      },
      ...(q3 === 'representation' ? [
        { icon: '\u{1F4CC}', text: 'Exemple : 2 enfants dont 1 prédécédé laissant 2 petits-enfants → chaque souche = 1/2 → chaque petit-enfant = 1/4.' },
      ] : []),
    ],
  };

  if ((q1 === 'aucun' || q1 === 'conjoint') && q2 === 'collateraux') return {
    title: `${q1 === 'conjoint' ? 'Conjoint + c' : 'C'}ollatéraux (frères/sœurs)`,
    color: '#F59E0B', bg: 'rgba(245,158,11,0.07)', border: 'rgba(245,158,11,0.25)',
    lines: q1 === 'conjoint' ? [
      { icon: '✅', text: 'Le conjoint recueille la totalité si les collatéraux sont au 3ᵉ degré ou plus.' },
      { icon: '⚠️', text: 'Droit de retour légal des frères/sœurs sur les biens reçus des ascendants communs (art. 757-3 c.civ.) — 50 % de ces biens.' },
    ] : [
      { icon: '✅', text: 'Les frères et sœurs se partagent la succession à parts égales.' },
      { icon: '\u{1F4CC}', text: 'Si l’un est prédécédé, ses descendants (neveux, nièces) viennent en représentation.' },
      { icon: '\u{1F4CC}', text: 'Partage par souche entre les différentes branches.' },
    ],
  };

  if (q1 === 'aucun' && q2 === 'ascendants') return {
    title: 'Ascendants uniquement (sans conjoint, sans descendants)',
    color: '#10B981', bg: 'rgba(16,185,129,0.07)', border: 'rgba(16,185,129,0.25)',
    lines: [
      { icon: '✅', text: 'Les parents (père et mère) héritent chacun de la moitié.' },
      { icon: '\u{1F4CC}', text: 'Si un seul parent : il hérite de tout. L’autre moitié remonte aux grands-parents de la branche manquante (fente successorale).' },
    ],
  };

  return null;
}

function TabDevolution() {
  const [q1, setQ1] = useState('');
  const [q2, setQ2] = useState('');
  const [q3, setQ3] = useState('');

  const reset = () => { setQ1(''); setQ2(''); setQ3(''); };
  const hasDescendants = q2 === 'enfants_communs' || q2 === 'enfants_mixtes';
  const showQ3     = hasDescendants;
  const showResult = q1 === 'pacs' || (q1 !== '' && q2 !== '' && (!showQ3 || q3 !== ''));
  const cas        = showResult && q1 !== 'pacs' ? buildCase(q1, q2, q3) : null;

  const optionStyle = (selected: boolean): React.CSSProperties => ({
    display: 'block', width: '100%', textAlign: 'left',
    padding: '0.75rem 1rem', marginBottom: '0.4rem',
    border: `1.5px solid ${selected ? '#6366F1' : 'var(--border-glass)'}`,
    borderRadius: 10, cursor: 'pointer',
    background: selected ? 'rgba(99,102,241,0.12)' : 'var(--bg-surface-md)',
    color: selected ? '#A5B4FC' : 'var(--text-secondary)',
    fontWeight: selected ? 700 : 400, fontSize: '0.875rem',
    transition: 'all 0.15s',
  });

  const Q1_OPTS = [
    { v: 'conjoint', l: 'Conjoint survivant (marié, non divorcé)' },
    { v: 'pacs',     l: 'Partenaire PACS uniquement (pas de droits légaux)' },
    { v: 'aucun',    l: 'Aucun conjoint ni partenaire' },
  ];
  const Q2_OPTS = [
    { v: 'enfants_communs', l: 'Oui — enfants communs uniquement' },
    { v: 'enfants_mixtes',  l: 'Oui — dont au moins un enfant non commun' },
    { v: 'ascendants',      l: 'Non, mais des ascendants (parents, grands-parents)' },
    { v: 'collateraux',     l: 'Non — des collatéraux (frères/sœurs, neveux/nièces)' },
    { v: 'aucun',           l: 'Aucun héritier proche' },
  ];
  const Q3_OPTS = [
    { v: 'representation',     l: 'Oui — la représentation s’applique (partage par souche)' },
    { v: 'pas_representation', l: 'Non — partage par tête uniquement' },
  ];

  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
        Répondez aux questions pour connaître la dévolution légale de la succession en l’absence de testament.
      </p>

      <div style={sWizardSection}>
        <div style={sWizardQ}>Question 1 — Situation conjugale du défunt</div>
        {Q1_OPTS.map(o => (
          <button key={o.v} style={optionStyle(q1 === o.v)} onClick={() => { setQ1(o.v); setQ2(''); setQ3(''); }}>
            {o.l}
          </button>
        ))}
      </div>

      {q1 !== '' && q1 !== 'pacs' && (
        <div style={sWizardSection}>
          <div style={sWizardQ}>Question 2 — Le défunt a-t-il des descendants ?</div>
          {Q2_OPTS.map(o => (
            <button key={o.v} style={optionStyle(q2 === o.v)} onClick={() => { setQ2(o.v); setQ3(''); }}>
              {o.l}
            </button>
          ))}
        </div>
      )}

      {showQ3 && (
        <div style={sWizardSection}>
          <div style={sWizardQ}>Question 3 — Représentation successorale</div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
            Y a-t-il des enfants prédécédés ou renonçants qui laissent eux-mêmes des descendants ?
          </p>
          {Q3_OPTS.map(o => (
            <button key={o.v} style={optionStyle(q3 === o.v)} onClick={() => setQ3(o.v)}>
              {o.l}
            </button>
          ))}
        </div>
      )}

      {q1 === 'pacs' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.85rem', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.35)', borderRadius: 999, width: 'fit-content' }}>
            <span>⚠️</span>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#F59E0B' }}>Partenaire PACS : aucun droit successoral légal</span>
          </div>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            Le partenaire de PACS ne bénéficie d'aucune vocation successorale légale. Il ne peut hériter que par testament.
            Sans testament, la succession est dévolue aux héritiers légaux du défunt (descendants, ascendants, collatéraux).
          </div>
          <div style={{ padding: '1rem 1.25rem', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 10 }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#A5B4FC', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.6rem' }}>Que faire ?</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 2 }}>
              ✅ Rédiger un testament en faveur du partenaire<br />
              ✅ Souscrire une assurance-vie avec clause bénéficiaire<br />
              ✅ Envisager une donation entre partenaires<br />
              ⚠️ Sans ces dispositions, le partenaire ne reçoit rien
            </div>
          </div>
          <div style={{ padding: '1rem 1.25rem', background: 'var(--bg-surface-md)', border: '1px solid var(--border-glass)', borderRadius: 10 }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.6rem' }}>Le partenaire bénéficie malgré tout de :</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 2 }}>
              • Droit temporaire au logement (1 an) — art. 763 c.civ.<br />
              • Attribution préférentielle possible du logement<br />
              • Exonération totale de droits de succession si testament
            </div>
          </div>
        </div>
      )}

      {cas && (
        <div style={{ background: cas.bg, border: `1.5px solid ${cas.border}`, borderRadius: 14, padding: '1.5rem', marginTop: '0.5rem' }}>
          <h3 style={{ margin: '0 0 1rem', fontSize: '0.95rem', fontWeight: 700, color: cas.color }}>{cas.title}</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {cas.lines.map((l, i) => (
              <div key={i}>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                  <span style={{ marginRight: '0.5rem' }}>{l.icon}</span>{l.text}
                </div>
                {l.sub && (
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginLeft: '1.5rem', marginTop: '0.2rem', lineHeight: 1.5 }}>
                    {l.sub}
                  </div>
                )}
              </div>
            ))}
          </div>
          {cas.warning && (
            <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, fontSize: '0.78rem', color: '#FCD34D', lineHeight: 1.5 }}>
              ⚠️ {cas.warning}
            </div>
          )}
        </div>
      )}

      {(q1 !== '' || q2 !== '') && (
        <button onClick={reset} style={{ marginTop: '1rem', background: 'transparent', border: '1px solid var(--border-glass)', borderRadius: 8, padding: '0.45rem 1rem', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
          Recommencer
        </button>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   ONGLET 3 — Cas particuliers
═══════════════════════════════════════════════════════ */
function CasCard({ title, badge, badgeColor, defaultOpen = false, children }: {
  title: string; badge: string; badgeColor: string; defaultOpen?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ border: '1px solid var(--border-glass)', borderRadius: 12, overflow: 'hidden', background: 'var(--bg-surface-md)' }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.25rem', background: 'transparent', border: 'none', cursor: 'pointer', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{title}</span>
          <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '0.2rem 0.55rem', borderRadius: 999, background: `${badgeColor}22`, color: badgeColor, border: `1px solid ${badgeColor}44`, whiteSpace: 'nowrap' }}>
            {badge}
          </span>
        </div>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem', flexShrink: 0 }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && <div style={{ padding: '0 1.25rem 1.25rem' }}>{children}</div>}
    </div>
  );
}

function TabParticuliers() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

      <CasCard title="Handicap et succession" badge="art. 779 II CGI" badgeColor="#6366F1" defaultOpen>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          <div style={sCasRow('green')}>
            <strong style={{ color: '#10B981' }}>Abattement spécifique : 159 325 €</strong>
            <span>
              Cumulable avec l’abattement principal (100 000 € pour un enfant) → total possible : <strong>259 325 €</strong>.
            </span>
          </div>
          <div>
            <strong style={{ color: 'var(--text-primary)' }}>Conditions :</strong> infirmité physique ou mentale empêchant de travailler dans des conditions normales de rentabilité (art. 779 II CGI). Applicable aux droits de succession et de donation.
          </div>
          <div style={sCasRow('amber')}>
            <strong style={{ color: '#F59E0B' }}>Mandat à effet posthume</strong>
            <span>Permet de désigner un mandataire chargé de gérer les biens reçus par un héritier vulnérable après le décès du mandant. Outil de protection complémentaire.</span>
          </div>
          <Link href="/civil/personnes-protegees" style={{ color: '#6366F1', fontSize: '0.8rem', textDecoration: 'none', fontWeight: 600 }}>
            → Voir la page Personnes protégées
          </Link>
        </div>
      </CasCard>

      <CasCard title="Représentation successorale" badge="art. 751-754 c.civ." badgeColor="#10B981">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          <div>
            <strong style={{ color: 'var(--text-primary)' }}>Définition :</strong> fiction juridique permettant aux descendants d’un héritier empêché de succéder en son lieu et place, recueillant la part qui lui aurait été dévolue.
          </div>
          <div>
            <strong style={{ color: 'var(--text-primary)' }}>3 cas déclencheurs :</strong>
            <ol style={{ margin: '0.25rem 0 0 1.2rem', paddingLeft: 0 }}>
              <li>Prédécès de l’héritier</li>
              <li>Indignité successorale (art. 729-1 c.civ.)</li>
              <li>Renonciation à la succession (art. 754 c.civ.)</li>
            </ol>
          </div>
          <div style={sCasRow('amber')}>
            <strong style={{ color: '#F59E0B' }}>Domaine :</strong>
            <span>1ᵉʳ ordre (descendants) + collatéraux privilégiés (frères/sœurs). Le partage se fait <strong>par souche</strong>, pas par tête.</span>
          </div>
          <div style={{ background: 'var(--bg-surface-md)', borderRadius: 8, padding: '0.75rem', border: '1px solid var(--border-subtle)', fontFamily: 'monospace', fontSize: '0.8rem' }}>
            Défunt → Enfant A (décédé) + Enfant B<br />
            Enfant A laisse 2 enfants (petits-enfants)<br />
            <span style={{ color: '#10B981' }}>→ Enfant B : 1/2 — Chaque petit-enfant : 1/4</span>
          </div>
          <div style={sCasRow('red')}>
            <strong style={{ color: '#EF4444' }}>Optimisation :</strong>
            <span>Renonciation + représentation = saut de génération volontaire (voir card suivante).</span>
          </div>
        </div>
      </CasCard>

      <CasCard title="Renonciation comme outil patrimonial" badge="Saut de génération" badgeColor="#F59E0B">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          <div>
            La renonciation d’un enfant à la succession permet à ses propres enfants (petits-enfants du défunt) de venir en représentation, chacun bénéficiant de son propre abattement.
          </div>
          <div style={{ background: 'var(--bg-surface-md)', borderRadius: 8, padding: '0.75rem', border: '1px solid var(--border-subtle)', fontFamily: 'monospace', fontSize: '0.8rem' }}>
            Enfant renonce → 2 petits-enfants héritent<br />
            <span style={{ color: '#10B981' }}>Chacun : abattement 31 865 € × 2 = 63 730 €</span><br />
            <span style={{ color: '#F59E0B' }}>vs abattement 100 000 € si l’enfant acceptait</span><br />
            <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>→ À comparer selon les montants et le nombre de petits-enfants</span>
          </div>
          <div style={sCasRow('red')}>
            <strong style={{ color: '#EF4444' }}>Irréversibilité :</strong>
            <span>La renonciation est irrévocable sauf vices du consentement. L’héritier renonçant est réputé n’avoir jamais hérité.</span>
          </div>
          <div style={sCasRow('red')}>
            <strong style={{ color: '#EF4444' }}>Attention :</strong>
            <span>L’enfant renonçant reste tenu au rapport des donations antérieures en cas d’action en réduction par les cohéritiers.</span>
          </div>
        </div>
      </CasCard>

      <CasCard title="Droits de retour légaux" badge="art. 738-2 & 757-3 c.civ." badgeColor="#EF4444">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          <div style={sCasRow('red')}>
            <strong style={{ color: '#EF4444' }}>Droit de retour des parents (art. 738-2 c.civ.)</strong>
            <ul style={{ margin: '0.25rem 0 0 1.2rem', paddingLeft: 0 }}>
              <li><strong>Condition :</strong> enfant décédé sans descendance</li>
              <li><strong>Objet :</strong> biens donnés par le(s) parent(s) concerné(s)</li>
              <li><strong>D’ordre public</strong> — ne peut pas être écarté par testament</li>
              <li>Opposable au conjoint survivant</li>
            </ul>
          </div>
          <div style={sCasRow('amber')}>
            <strong style={{ color: '#F59E0B' }}>Droit de retour des frères/sœurs (art. 757-3 c.civ.)</strong>
            <ul style={{ margin: '0.25rem 0 0 1.2rem', paddingLeft: 0 }}>
              <li><strong>Condition :</strong> succession dévolue au conjoint, sans descendant ni parent</li>
              <li><strong>Objet :</strong> biens reçus des ascendants communs — 50 % reviennent aux frères/sœurs</li>
              <li><strong>NON d’ordre public</strong> — peut être écarté par testament</li>
            </ul>
          </div>
        </div>
      </CasCard>

      <CasCard title="Comourants" badge="art. 725-1 c.civ." badgeColor="#94A3B8">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          <div>
            Lorsque l’ordre des décès est inconnu (accident commun, catastrophe), <strong>chaque succession est réglée indépendamment</strong>, comme si l’un avait survécu à l’autre — aucun n’hérite de l’autre.
          </div>
          <div style={sCasRow('amber')}>
            <strong style={{ color: '#F59E0B' }}>Représentation possible :</strong>
            <span>Si le comourant avait des descendants, ceux-ci peuvent venir en représentation dans la succession.</span>
          </div>
          <div style={sCasRow('red')}>
            <strong style={{ color: '#EF4444' }}>Impact assurance-vie :</strong>
            <span>Si le bénéficiaire est décédé avant ou simultanément à l’assuré et qu’aucune clause de représentation n’est prévue, le capital tombe dans la succession. Anticiper dans la clause bénéficiaire.</span>
          </div>
          <Link href="/civil/clause-beneficiaire" style={{ color: '#6366F1', fontSize: '0.8rem', textDecoration: 'none', fontWeight: 600 }}>
            → Voir l’outil Clause bénéficiaire
          </Link>
        </div>
      </CasCard>

    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   ONGLET 4 — Délais & obligations
═══════════════════════════════════════════════════════ */
type DelaiLine = { icon: string; text: string };

function DelaiCard({ title, badge, badgeColor, lines }: { title: string; badge: string; badgeColor: string; lines: DelaiLine[] }) {
  return (
    <div style={{ background: 'var(--bg-surface-md)', border: '1px solid var(--border-glass)', borderRadius: 12, padding: '1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>{title}</h3>
        <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '0.2rem 0.55rem', borderRadius: 999, background: `${badgeColor}22`, color: badgeColor, border: `1px solid ${badgeColor}44`, whiteSpace: 'nowrap', flexShrink: 0 }}>
          {badge}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {lines.map((l, i) => (
          <div key={i} style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            <span style={{ flexShrink: 0 }}>{l.icon}</span>
            <span>{l.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TabDelais() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <DelaiCard
        title="Déclaration de succession — délai de droit commun"
        badge="art. 641 CGI"
        badgeColor="#EF4444"
        lines={[
          { icon: '🇫🇷', text: '6 mois à compter du décès pour un décès survenu en France.' },
          { icon: '🌍', text: '12 mois pour un décès survenu à l’étranger.' },
          { icon: '⚠️', text: 'Le défaut de dépôt dans les délais entraîne des intérêts de retard (0,20 %/mois) et majoration (10 % puis 40 % après mise en demeure).' },
        ]}
      />
      <DelaiCard
        title="Dispenses de déclaration"
        badge="art. 800 CGI"
        badgeColor="#10B981"
        lines={[
          { icon: '✅', text: 'Actif brut < 50 000 € : héritiers en ligne directe ou conjoint/PACS → pas de déclaration obligatoire.' },
          { icon: '✅', text: 'Actif brut < 3 000 € : tous héritiers → dispense de déclaration.' },
          { icon: '📌', text: 'La dispense ne s’applique pas si une donation a été consentie dans les 15 ans précédant le décès (rappel fiscal).' },
        ]}
      />
      <DelaiCard
        title="Option successorale — délai d’exercice"
        badge="art. 780 c.civ."
        badgeColor="#6366F1"
        lines={[
          { icon: '⏳', text: '10 ans à compter de l’ouverture de la succession pour accepter ou renoncer.' },
          { icon: '⚠️', text: 'Passé ce délai, l’héritier est réputé renonçant.' },
          { icon: '📌', text: 'Mise en demeure d’opter (art. 771 c.civ.) : après 4 mois, créanciers ou cohéritiers peuvent forcer le choix dans un délai de 2 mois.' },
          { icon: '📌', text: 'L’acceptation à concurrence de l’actif net (ACAN) protège l’héritier des dettes dépassant l’actif successoral.' },
        ]}
      />
      <DelaiCard
        title="Certificat successoral bancaire"
        badge="art. L312-1-4 CMF"
        badgeColor="#F59E0B"
        lines={[
          { icon: '💶', text: 'Jusqu’à 5 000 € sur les comptes du défunt : déblocage sans notaire possible sur présentation d’un certificat successoral.' },
          { icon: '✅', text: 'Réservé aux héritiers en ligne directe et au conjoint/PACS.' },
          { icon: '📌', text: 'Permet la clôture des comptes si le total des avoirs est inférieur à 5 000 €.' },
          { icon: '⚠️', text: 'Au-delà de ce seuil ou en présence d’un testament, l’intervention d’un notaire est obligatoire.' },
        ]}
      />
      <DelaiCard
        title="Paiement fractionné ou différé des droits"
        badge="art. 1717 CGI"
        badgeColor="#10B981"
        lines={[
          { icon: '📅', text: 'En présence d’actifs non liquides (immobilier, parts sociales) : possibilité de fractionner le paiement sur 5 ans (10 versements semestriels).' },
          { icon: '📅', text: 'Pour une entreprise familiale : report de 5 ans puis paiement fractionné sur 10 ans.' },
          { icon: '💡', text: 'Un intérêt légal s’applique sur les sommes différées — comparer avec le coût d’un financement alternatif.' },
        ]}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   PAGE PRINCIPALE
═══════════════════════════════════════════════════════ */
export default function SuccessionPage() {
  const [tab, setTab]         = useState<TabId>('simulateur');
  const [baremes, setBaremes] = useState<BaremesData | null>(null);

  useEffect(() => {
    fetch('/baremes.json')
      .then(r => r.json())
      .then(setBaremes)
      .catch(err => console.error('Erreur baremes:', err));
  }, []);

  if (!baremes) return (
    <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
      Chargement du moteur fiscal…
    </div>
  );

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '3rem 1.25rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <p style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
          Audit Patrimoine · Axe civil
        </p>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1.1, margin: 0 }}>
          Succession
        </h1>
        <p style={{ marginTop: '0.5rem', color: 'var(--text-secondary)', fontSize: '1rem', maxWidth: 560 }}>
          Droits de succession · Dévolution légale · Cas particuliers · Délais
        </p>
      </div>

      <div style={{ display: 'flex', gap: 2, marginBottom: '1.75rem', borderBottom: '1px solid rgba(255,255,255,0.08)', overflowX: 'auto' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '0.625rem 1.125rem', background: 'transparent', border: 'none', cursor: 'pointer',
            fontSize: '0.875rem', fontWeight: tab === t.id ? 700 : 400, whiteSpace: 'nowrap',
            color: tab === t.id ? '#6366F1' : 'var(--text-secondary)',
            borderBottom: `2px solid ${tab === t.id ? '#6366F1' : 'transparent'}`,
            marginBottom: -1, transition: 'color 0.15s',
          }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <div className="glass-card" style={{ padding: '1.75rem' }}>
        {tab === 'simulateur'   && <TabSimulateur baremes={baremes} />}
        {tab === 'devolution'   && <TabDevolution />}
        {tab === 'particuliers' && <TabParticuliers />}
        {tab === 'delais'       && <TabDelais />}
      </div>
    </div>
  );
}
