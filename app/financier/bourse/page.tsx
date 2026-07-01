'use client';
import { AuthGate } from '@/components/auth-gate';
import { getSupabase } from '@/lib/supabase';

import { useState, useMemo, useEffect, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface IndexEntry {
  key: string;
  categorie: string;
  nom: string;
  ticker: string;
  devise: string;
  historique: Record<string, number>;
  premier: string;
  dernier: string;
}

interface StatResult {
  totalReturn: number;
  cagr: number;
  volatility: number;
  maxDrawdown: number;
  months: number;
}

interface ChartSeries {
  key: string;
  nom: string;
  color: string;
  points: { month: string; value: number }[];
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#A855F7', '#F43F5E', '#14B8A6', '#FB923C', '#22D3EE'];

const CAT_LABELS: Record<string, string> = {
  actions: 'Actions',
  obligations: 'Obligations',
  matieres_premieres: 'Matières premières',
  monetaire: 'Monétaire',
  immobilier: 'Immobilier',
};
const CAT_ORDER = ['actions', 'obligations', 'matieres_premieres', 'monetaire', 'immobilier'];

const PERIODS = ['1A', '3A', '5A', '10A', '20A', 'MAX'] as const;
type Period = (typeof PERIODS)[number];

const MAX_SELECTION = 6;

// ─── Chargement des données (Supabase) ───────────────────────────────────────

// classe_actif (base) -> categorie affichée (page)
const CLASSE_TO_CATEGORIE: Record<string, string> = {
  actions: 'actions',
  obligataire: 'obligations',
  matieres_premieres: 'matieres_premieres',
  monetaire: 'monetaire',
  immobilier: 'immobilier',
};

// ^TNX est un taux (rendement en %), pas un indice de prix : CAGR/volatilité n'auraient pas de sens dessus
const EXCLUDED_SYMBOLS = new Set(['^TNX']);

async function fetchIndicesFromSupabase(): Promise<IndexEntry[]> {
  const supabase = getSupabase();

  const { data: refs, error: refError } = await supabase
    .from('referentiel_indices')
    .select('symbol, nom, classe_actif, devise')
    .eq('actif', true)
    .in('classe_actif', Object.keys(CLASSE_TO_CATEGORIE));
  if (refError) throw refError;

  const symbols = (refs ?? []).map(r => r.symbol).filter(s => !EXCLUDED_SYMBOLS.has(s));
  if (symbols.length === 0) return [];

  // La période "MAX" du graphe démarre de toute façon en 1990 : inutile de charger plus ancien.
  // PostgREST plafonne les résultats (défaut 1000 lignes) : on pagine avec range().
  const rows: { symbol: string; date: string; close: number }[] = [];
  const PAGE_SIZE = 1000;
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('cours_historiques')
      .select('symbol, date, close')
      .in('symbol', symbols)
      .eq('frequence', 'weekly')
      .gte('date', '1990-01-01')
      .order('date', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
  }

  const bySymbol = new Map<string, { date: string; close: number }[]>();
  for (const row of rows) {
    if (!bySymbol.has(row.symbol)) bySymbol.set(row.symbol, []);
    bySymbol.get(row.symbol)!.push(row);
  }

  const entries: IndexEntry[] = [];
  for (const ref of refs ?? []) {
    if (EXCLUDED_SYMBOLS.has(ref.symbol)) continue;
    const points = bySymbol.get(ref.symbol);
    if (!points || points.length === 0) continue;

    const historique: Record<string, number> = {};
    for (const p of points) historique[p.date] = p.close;

    const categorie = CLASSE_TO_CATEGORIE[ref.classe_actif] ?? ref.classe_actif;
    entries.push({
      key: `${categorie}::${ref.symbol}`,
      categorie,
      nom: ref.nom,
      ticker: ref.symbol,
      devise: ref.devise,
      historique,
      premier: points[0].date,
      dernier: points[points.length - 1].date,
    });
  }
  return entries;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toMonthMap(historique: Record<string, number>): Record<string, number> {
  const map: Record<string, number> = {};
  for (const [date, val] of Object.entries(historique)) {
    map[date.slice(0, 7)] = val;
  }
  return map;
}

function periodStartMonth(period: Period, latestMonth: string): string {
  if (period === 'MAX') return '1990-01';
  const years = { '1A': 1, '3A': 3, '5A': 5, '10A': 10, '20A': 20 }[period]!;
  const [y, m] = latestMonth.split('-').map(Number);
  return `${y - years}-${String(m).padStart(2, '0')}`;
}

function computeStats(values: number[]): StatResult {
  if (values.length < 2) return { totalReturn: 0, cagr: 0, volatility: 0, maxDrawdown: 0, months: 0 };
  const first = values[0];
  const last = values[values.length - 1];
  const years = values.length / 12;
  const totalReturn = (last / first - 1) * 100;
  const cagr = (Math.pow(last / first, 1 / Math.max(years, 0.01)) - 1) * 100;

  const logReturns: number[] = [];
  for (let i = 1; i < values.length; i++) {
    if (values[i] > 0 && values[i - 1] > 0) logReturns.push(Math.log(values[i] / values[i - 1]));
  }
  let volatility = 0;
  if (logReturns.length > 1) {
    const mean = logReturns.reduce((a, b) => a + b, 0) / logReturns.length;
    const variance = logReturns.reduce((s, r) => s + (r - mean) ** 2, 0) / (logReturns.length - 1);
    volatility = Math.sqrt(variance * 12) * 100;
  }

  let peak = values[0];
  let maxDD = 0;
  for (const v of values) {
    if (v > peak) peak = v;
    const dd = (v - peak) / peak;
    if (dd < maxDD) maxDD = dd;
  }

  return { totalReturn, cagr, volatility, maxDrawdown: maxDD * 100, months: values.length };
}

const fmtPct = (n: number, dec = 1) => `${n >= 0 ? '+' : ''}${n.toFixed(dec)}%`;

// ─── Graphique SVG ────────────────────────────────────────────────────────────

function BourseChart({ series, months }: { series: ChartSeries[]; months: string[] }) {
  const W = 800, H = 320;
  const PAD = { top: 20, right: 72, bottom: 36, left: 58 };
  const w = W - PAD.left - PAD.right;
  const h = H - PAD.top - PAD.bottom;

  if (months.length === 0 || series.length === 0) {
    return (
      <div style={{ height: 320, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <div style={{ fontSize: 28, opacity: 0.3 }}>📊</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Sélectionnez au moins un indice</div>
      </div>
    );
  }

  const allVals = series.flatMap(s => s.points.map(p => p.value));
  const rawMin = Math.min(...allVals);
  const rawMax = Math.max(...allVals);
  const padding = (rawMax - rawMin) * 0.08;
  const yMin = rawMin - padding;
  const yMax = rawMax + padding;

  const xS = (i: number) => PAD.left + (i / Math.max(1, months.length - 1)) * w;
  const yS = (v: number) => PAD.top + h - ((v - yMin) / (yMax - yMin)) * h;

  // Y ticks: en % de gain/perte depuis base 100
  const range = rawMax - rawMin;
  const yStep = range > 400 ? 100 : range > 200 ? 50 : range > 80 ? 25 : range > 30 ? 10 : 5;
  const yTicks: number[] = [];
  for (let t = Math.ceil(yMin / yStep) * yStep; t <= yMax; t += yStep) yTicks.push(t);

  // X ticks: une par an, espacées
  const xTicks: { i: number; label: string }[] = [];
  let lastTickIdx = -999;
  const minSpacing = Math.max(1, Math.floor(months.length / 9));
  months.forEach((m, i) => {
    if (m.slice(5) === '01' && i - lastTickIdx >= minSpacing) {
      xTicks.push({ i, label: m.slice(0, 4) });
      lastTickIdx = i;
    }
  });

  const buildPath = (s: ChartSeries) => {
    return s.points.reduce((d, p, idx) => {
      const mi = months.indexOf(p.month);
      if (mi < 0) return d;
      const x = xS(mi).toFixed(1);
      const y = yS(p.value).toFixed(1);
      return d + (idx === 0 ? `M${x},${y}` : `L${x},${y}`);
    }, '');
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', overflow: 'visible' }}>
      {/* Grille horizontale */}
      {yTicks.map(t => (
        <g key={t}>
          <line x1={PAD.left} y1={yS(t)} x2={PAD.left + w} y2={yS(t)}
            stroke={t === 100 ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.05)'}
            strokeWidth={t === 100 ? 1.5 : 1}
            strokeDasharray={t === 100 ? '5 4' : undefined}
          />
          <text x={PAD.left - 8} y={yS(t)} textAnchor="end" dominantBaseline="central"
            fill={t === 100 ? 'rgba(255,255,255,0.4)' : 'rgba(148,163,184,0.55)'} fontSize="11">
            {t === 100 ? '0%' : t > 100 ? `+${t - 100}%` : `${t - 100}%`}
          </text>
        </g>
      ))}

      {/* X ticks */}
      {xTicks.map(t => (
        <text key={t.i} x={xS(t.i)} y={H - 6} textAnchor="middle" fill="rgba(148,163,184,0.45)" fontSize="11">
          {t.label}
        </text>
      ))}

      {/* Lignes des séries */}
      {series.map(s => (
        <path key={s.key} d={buildPath(s)} fill="none" stroke={s.color}
          strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      ))}

      {/* Labels de fin de ligne */}
      {series.map(s => {
        const last = s.points[s.points.length - 1];
        if (!last) return null;
        const mi = months.indexOf(last.month);
        if (mi < 0) return null;
        const gain = last.value - 100;
        return (
          <text key={`lbl-${s.key}`} x={xS(mi) + 7} y={yS(last.value)}
            dominantBaseline="central" fill={s.color} fontSize="10.5" fontWeight="700">
            {gain >= 0 ? '+' : ''}{gain.toFixed(0)}%
          </text>
        );
      })}
    </svg>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function BoursePage() {
  const [indices, setIndices] = useState<IndexEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<string[]>(['actions::^GSPC', 'actions::URTH']);
  const [period, setPeriod] = useState<Period>('10A');

  const loadIndices = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const entries = await fetchIndicesFromSupabase();
      setIndices(entries);
    } catch (err) {
      console.error('[Bourse] Erreur de chargement des indices depuis Supabase:', err);
      setLoadError('Impossible de charger les données de marché. Réessayez plus tard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadIndices();
  }, [loadIndices]);

  const colorMap = useMemo(() => {
    const map: Record<string, string> = {};
    selectedKeys.forEach((k, i) => { map[k] = COLORS[i % COLORS.length]; });
    return map;
  }, [selectedKeys]);

  const { chartSeries, months, statsMap } = useMemo(() => {
    const selected = selectedKeys.map(k => indices.find(i => i.key === k)).filter(Boolean) as IndexEntry[];
    if (selected.length === 0) return { chartSeries: [], months: [], statsMap: {} };

    const monthMaps = selected.map(idx => toMonthMap(idx.historique));

    // Borne de fin : date la plus récente parmi tous les indices sélectionnés
    const endMonth = selected.map(idx => {
      const dates = Object.keys(idx.historique).sort();
      return dates[dates.length - 1]?.slice(0, 7) ?? '2000-01';
    }).sort().reverse()[0];

    const start = periodStartMonth(period, endMonth);

    // Union des mois dans la période
    const monthSet = new Set<string>();
    for (const map of monthMaps) {
      for (const m of Object.keys(map)) {
        if (m >= start && m <= endMonth) monthSet.add(m);
      }
    }
    const allMonths = Array.from(monthSet).sort();

    const chartSeries: ChartSeries[] = [];
    const statsMap: Record<string, StatResult> = {};

    selected.forEach((idx, si) => {
      const map = monthMaps[si];
      const myMonths = allMonths.filter(m => map[m] !== undefined);
      if (myMonths.length < 2) return;

      const baseVal = map[myMonths[0]];
      const points = myMonths.map(m => ({ month: m, value: (map[m] / baseVal) * 100 }));

      chartSeries.push({
        key: idx.key, nom: idx.nom,
        color: colorMap[idx.key] ?? COLORS[si],
        points,
      });
      statsMap[idx.key] = computeStats(points.map(p => p.value));
    });

    return { chartSeries, months: allMonths, statsMap };
  }, [indices, selectedKeys, period, colorMap]);

  const toggle = (key: string) => {
    setSelectedKeys(prev =>
      prev.includes(key)
        ? prev.filter(k => k !== key)
        : prev.length >= MAX_SELECTION ? prev : [...prev, key]
    );
  };

  return (
    <AuthGate>
      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '2rem 1.25rem', position: 'relative', zIndex: 1 }}>

      {/* En-tête */}
      <div className="animate-fade-up" style={{ marginBottom: '2rem' }}>
        <p className="section-title">Axe financier</p>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.8rem, 4vw, 2.6rem)', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1.15, margin: 0 }}>
          Performances historiques
        </h1>
        <p style={{ marginTop: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          Comparez jusqu'à {MAX_SELECTION} indices sur les grandes classes d'actifs. Base 100 à la date de départ.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(230px, 265px) 1fr', gap: '1.5rem', alignItems: 'start' }}>

        {/* ── Sélecteur ── */}
        <div className="animate-fade-up delay-1 glass-card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <p className="section-title" style={{ margin: 0 }}>Indices</p>
            <span style={{ fontSize: 11, color: selectedKeys.length >= MAX_SELECTION ? 'var(--accent-amber)' : 'var(--text-muted)' }}>
              {selectedKeys.length}/{MAX_SELECTION}
            </span>
          </div>

          {loading ? (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0' }}>
              Chargement…
            </div>
          ) : loadError ? (
            <div style={{ fontSize: 12, color: '#F87171', textAlign: 'center', padding: '2rem 0' }}>
              {loadError}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              {CAT_ORDER.map(cat => {
                const catIndices = indices.filter(i => i.categorie === cat);
                return (
                  <div key={cat}>
                    <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 5 }}>
                      {CAT_LABELS[cat]}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {catIndices.map(idx => {
                        const isSelected = selectedKeys.includes(idx.key);
                        const color = colorMap[idx.key];
                        const disabled = !isSelected && selectedKeys.length >= MAX_SELECTION;
                        return (
                          <button
                            key={idx.key}
                            onClick={() => toggle(idx.key)}
                            disabled={disabled}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 8,
                              padding: '5px 8px', borderRadius: 7, fontSize: 11.5,
                              textAlign: 'left', width: '100%',
                              cursor: disabled ? 'not-allowed' : 'pointer',
                              border: `1px solid ${isSelected ? color + '55' : 'rgba(255,255,255,0.07)'}`,
                              background: isSelected ? color + '15' : 'rgba(255,255,255,0.025)',
                              color: isSelected ? 'var(--text-primary)' : disabled ? 'var(--text-muted)' : 'var(--text-secondary)',
                              transition: 'all 0.15s',
                              opacity: disabled ? 0.35 : 1,
                            }}
                          >
                            <span style={{
                              width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                              background: isSelected ? color : 'rgba(255,255,255,0.15)',
                              boxShadow: isSelected ? `0 0 5px ${color}` : 'none',
                              transition: 'all 0.15s',
                            }} />
                            <span style={{ flex: 1, lineHeight: 1.35 }}>{idx.nom}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Droite : période + graphe + stats ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* Période */}
          <div className="animate-fade-up delay-2" style={{ display: 'flex', gap: 6 }}>
            {PERIODS.map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                style={{
                  padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', transition: 'all 0.15s',
                  border: `1px solid ${period === p ? 'var(--accent-blue)' : 'rgba(255,255,255,0.1)'}`,
                  background: period === p ? 'rgba(59,130,246,0.18)' : 'rgba(255,255,255,0.04)',
                  color: period === p ? 'var(--accent-blue)' : 'var(--text-secondary)',
                }}
              >
                {p}
              </button>
            ))}
          </div>

          {/* Graphique */}
          <div className="animate-fade-up delay-3 glass-card" style={{ padding: '1.5rem' }}>
            {chartSeries.length > 0 && (
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: '1rem' }}>
                {chartSeries.map(s => (
                  <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                    <div style={{ width: 18, height: 3, background: s.color, borderRadius: 2 }} />
                    <span style={{ color: 'var(--text-secondary)' }}>{s.nom}</span>
                  </div>
                ))}
              </div>
            )}
            <BourseChart series={chartSeries} months={months} />
            {months.length > 0 && (
              <div style={{ marginTop: 8, fontSize: 10, color: 'var(--text-muted)', textAlign: 'right' }}>
                {months[0]} → {months[months.length - 1]} · {months.length} mois
              </div>
            )}
          </div>

          {/* Tableau de statistiques */}
          {chartSeries.length > 0 && (
            <div className="animate-fade-up delay-4 glass-card" style={{ padding: '1.5rem' }}>
              <p className="section-title" style={{ marginBottom: '0.75rem' }}>Statistiques · période {period}</p>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                      {[
                        { label: 'Indice',       align: 'left'  },
                        { label: 'Perf. totale', align: 'right' },
                        { label: 'CAGR',         align: 'right' },
                        { label: 'Volatilité',   align: 'right', title: 'Écart-type annualisé des rendements mensuels' },
                        { label: 'Max drawdown', align: 'right', title: 'Plus forte baisse pic-à-creux' },
                        { label: 'Durée',        align: 'right' },
                      ].map(col => (
                        <th key={col.label} title={col.title} style={{ padding: '8px 12px', textAlign: col.align as 'left' | 'right', fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', whiteSpace: 'nowrap', cursor: col.title ? 'help' : undefined }}>
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {chartSeries.map(s => {
                      const st = statsMap[s.key];
                      if (!st) return null;
                      return (
                        <tr key={s.key} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <td style={{ padding: '10px 12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: s.color, boxShadow: `0 0 6px ${s.color}90` }} />
                              <span style={{ color: 'var(--text-primary)' }}>{s.nom}</span>
                            </div>
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', color: st.totalReturn >= 0 ? 'var(--accent-emerald)' : '#F87171', fontWeight: 700, fontFamily: 'var(--font-display)', fontSize: 14 }}>
                            {fmtPct(st.totalReturn, 0)}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', color: st.cagr >= 0 ? 'var(--accent-emerald)' : '#F87171', fontWeight: 600 }}>
                            {fmtPct(st.cagr)} / an
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--accent-amber)' }}>
                            {st.volatility.toFixed(1)}%
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', color: '#F87171' }}>
                            {fmtPct(st.maxDrawdown, 0)}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-muted)', fontSize: 11 }}>
                            {st.months} mois
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
      </main>
    </AuthGate>
  );
}
