'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

/* ─────────────────────────────────────────────────────────────
   TYPES (miroir de la route API)
───────────────────────────────────────────────────────────── */
type Anciennete = 'moins8ans' | 'plus8ans';
type Situation  = 'celibataire' | 'marie_pacse';
type TypeRachat = 'partiel' | 'total';

interface AVApiInput {
  valeurContrat:  number;
  primesVersees:  number;
  typeRachat:     TypeRachat;
  montantRachat:  number;
  anciennete:     Anciennete;
  tmi:            number;
  situation:      Situation;
}

interface AVResult {
  plusValueTotale:       number;
  montantRachatEffectif: number;
  interetsBruts:         number;
  abattement:            number;
  interetsImposables:    number;
  interetsPS:            number;
  pfuTauxIR:      number;
  pfuIR:          number;
  pfuPS:          number;
  pfuTotal:       number;
  pfuNetPercu:    number;
  baremeTauxIR:   number;
  baremeIR:       number;
  baremePS:       number;
  baremeTotal:    number;
  baremeNetPercu: number;
  meilleureOption: 'pfu' | 'bareme' | 'egal';
  economie:        number;
}

/* ─────────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────────── */
function fmt(v: number): string {
  return Math.round(Math.abs(v)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' €';
}
function fmtDec(v: number): string {
  const [int, dec] = Math.abs(v).toFixed(2).split('.');
  return int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ',' + dec + ' €';
}
function fmtPct(v: number): string {
  return (v * 100).toFixed(1) + ' %';
}

/* ─────────────────────────────────────────────────────────────
   COMPOSANTS UI
───────────────────────────────────────────────────────────── */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '1rem' }}>
      {children}
    </p>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '0.45rem' }}>
      {children}
    </label>
  );
}

function GlassCard({ children, style, className }: { children: React.ReactNode; style?: React.CSSProperties; className?: string }) {
  return (
    <div className={`glass-card ${className ?? ''}`} style={{ padding: '1.25rem', ...style }}>
      {children}
    </div>
  );
}

function Row({ label, value, accent, muted }: { label: string; value: string; accent?: boolean; muted?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.35rem 0' }}>
      <span style={{ fontSize: '0.85rem', color: muted ? 'var(--text-muted)' : 'var(--text-secondary)' }}>{label}</span>
      <span style={{ fontSize: '0.9rem', fontWeight: 600, color: accent ? 'var(--accent-gold)' : muted ? 'var(--text-muted)' : 'var(--text-primary)' }}>
        {value}
      </span>
    </div>
  );
}

function Divider() {
  return <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', margin: '0.6rem 0' }} />;
}

function Toggle({ value, onChange, options }: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div style={{ display: 'flex', gap: 4, background: 'var(--bg-surface)', border: '1px solid var(--border-glass)', borderRadius: 10, padding: 4 }}>
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          style={{
            flex: 1, padding: '0.45rem 0.75rem', borderRadius: 8, border: 'none', cursor: 'pointer',
            fontSize: '0.8rem', fontWeight: 600, transition: 'all 0.2s',
            background: value === opt.value ? 'rgba(59,130,246,0.2)' : 'transparent',
            color: value === opt.value ? '#fff' : 'var(--text-muted)',
            outline: value === opt.value ? '1px solid rgba(59,130,246,0.4)' : '1px solid transparent',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   PAGE PRINCIPALE
───────────────────────────────────────────────────────────── */
export default function AssuranceViePage() {
  /* ── Inputs ── */
  const [valeurContrat,  setValeurContrat]  = useState<number | ''>(100_000);
  const [primesVersees,  setPrimesVersees]  = useState<number | ''>(80_000);
  const [typeRachat,     setTypeRachat]     = useState<TypeRachat>('partiel');
  const [montantRachat,  setMontantRachat]  = useState<number | ''>(20_000);
  const [anciennete,     setAnciennete]     = useState<Anciennete>('plus8ans');
  const [tmi,            setTmi]            = useState<number>(0.30);
  const [situation,      setSituation]      = useState<Situation>('celibataire');

  /* ── État async ── */
  const [result,  setResult]  = useState<AVResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef    = useRef<AbortController | null>(null);

  /* ── Fetch avec debounce 300 ms ── */
  const fetchResults = useCallback(async (body: AVApiInput, signal: AbortSignal) => {
    const res = await fetch('/api/calculate/assurance-vie', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? 'Erreur serveur');
    }
    return res.json() as Promise<AVResult>;
  }, []);

  useEffect(() => {
    if (
      typeof valeurContrat !== 'number' ||
      typeof primesVersees !== 'number' ||
      (typeRachat === 'partiel' && typeof montantRachat !== 'number')
    ) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current)    abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    debounceRef.current = setTimeout(async () => {
      try {
        const data = await fetchResults(
          {
            valeurContrat,
            primesVersees,
            typeRachat,
            montantRachat: typeRachat === 'total' ? valeurContrat : (montantRachat as number),
            anciennete,
            tmi,
            situation,
          },
          controller.signal,
        );
        setResult(data);
      } catch (e) {
        if ((e as Error).name !== 'AbortError') {
          setError((e as Error).message ?? 'Erreur inconnue');
        }
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      controller.abort();
    };
  }, [valeurContrat, primesVersees, typeRachat, montantRachat, anciennete, tmi, situation, fetchResults]);

  /* ── Valeurs d'affichage (null-safe) ── */
  const r = result;
  const isPFU    = r?.meilleureOption === 'pfu';
  const isBareme = r?.meilleureOption === 'bareme';

  return (
    <main style={{ minHeight: '100vh', padding: '2rem 1rem 4rem', fontFamily: 'var(--font-sans)' }}>
      <div style={{ maxWidth: 780, margin: '0 auto' }}>

        {/* ── Fil d'Ariane ── */}
        <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '0 0 0.75rem', marginBottom: '2rem' }}>
          <Link href="/fiscal" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
            ← Espace fiscal
          </Link>
        </div>

        {/* ── En-tête ── */}
        <div className="animate-fade-up" style={{ marginBottom: '2rem', textAlign: 'center' }}>
          <span className="badge badge-green" style={{ marginBottom: '0.75rem' }}>Fiscal · Épargne</span>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.6rem, 4vw, 2.2rem)', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: '0.5rem' }}>
            Simulateur Assurance-vie
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: 480, margin: '0 auto' }}>
            Comparez PFU et barème IR sur vos rachats partiels ou totaux selon l'ancienneté du contrat.
          </p>
        </div>

        {/* ── Bannière erreur ── */}
        {error && (
          <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', borderRadius: 10, color: '#FCA5A5', fontSize: '0.82rem' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', position: 'relative' }}>

          {/* Indicateur de chargement */}
          {loading && (
            <div style={{ position: 'absolute', top: 0, right: 0, zIndex: 10, pointerEvents: 'none' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>calcul…</span>
            </div>
          )}

          {/* ── Contrat ── */}
          <GlassCard className="animate-fade-up delay-1">
            <SectionTitle>Contrat</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
              <div>
                <FieldLabel>Valeur actuelle du contrat (€)</FieldLabel>
                <input
                  type="number" min={0} step={1000}
                  value={valeurContrat === '' ? '' : valeurContrat}
                  onChange={(e) => setValeurContrat(e.target.value === '' ? '' : Number(e.target.value))}
                  className="glass-input" placeholder="100 000"
                />
              </div>
              <div>
                <FieldLabel>Total primes versées (€)</FieldLabel>
                <input
                  type="number" min={0} step={1000}
                  value={primesVersees === '' ? '' : primesVersees}
                  onChange={(e) => setPrimesVersees(e.target.value === '' ? '' : Number(e.target.value))}
                  className="glass-input" placeholder="80 000"
                />
              </div>
            </div>
            {/* Plus-value latente */}
            {typeof valeurContrat === 'number' && typeof primesVersees === 'number' && (
              <div style={{ marginTop: '1rem', padding: '0.6rem 1rem', background: 'rgba(255,255,255,0.04)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Plus-value latente totale</span>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 600, color: valeurContrat >= primesVersees ? 'var(--accent-emerald)' : '#F87171' }}>
                  {fmt(valeurContrat - primesVersees)}
                </span>
              </div>
            )}
          </GlassCard>

          {/* ── Rachat ── */}
          <GlassCard className="animate-fade-up delay-2">
            <SectionTitle>Rachat</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', alignItems: 'end' }}>
              <div>
                <FieldLabel>Type de rachat</FieldLabel>
                <Toggle
                  value={typeRachat}
                  onChange={(v) => setTypeRachat(v as TypeRachat)}
                  options={[{ value: 'partiel', label: 'Partiel' }, { value: 'total', label: 'Total' }]}
                />
              </div>
              {typeRachat === 'partiel' && (
                <div>
                  <FieldLabel>Montant du rachat (€)</FieldLabel>
                  <input
                    type="number" min={0} step={500}
                    value={montantRachat === '' ? '' : montantRachat}
                    onChange={(e) => setMontantRachat(e.target.value === '' ? '' : Number(e.target.value))}
                    className="glass-input" placeholder="20 000"
                  />
                </div>
              )}
              {typeRachat === 'total' && typeof valeurContrat === 'number' && (
                <div style={{ padding: '0.65rem 0.9rem', background: 'rgba(255,255,255,0.04)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.07)' }}>
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.25rem' }}>Rachat intégral</p>
                  <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>{fmt(valeurContrat)}</p>
                </div>
              )}
            </div>
          </GlassCard>

          {/* ── Situation fiscale ── */}
          <GlassCard className="animate-fade-up delay-2">
            <SectionTitle>Situation fiscale</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', alignItems: 'end' }}>

              <div>
                <FieldLabel>Ancienneté du contrat</FieldLabel>
                <Toggle
                  value={anciennete}
                  onChange={(v) => setAnciennete(v as Anciennete)}
                  options={[{ value: 'moins8ans', label: '< 8 ans' }, { value: 'plus8ans', label: '≥ 8 ans' }]}
                />
              </div>

              <div>
                <FieldLabel>TMI</FieldLabel>
                <select value={tmi} onChange={(e) => setTmi(Number(e.target.value))} className="glass-select">
                  <option value={0}>0 %</option>
                  <option value={0.11}>11 %</option>
                  <option value={0.30}>30 %</option>
                  <option value={0.41}>41 %</option>
                  <option value={0.45}>45 %</option>
                </select>
              </div>

              <div>
                <FieldLabel>Situation maritale</FieldLabel>
                <select value={situation} onChange={(e) => setSituation(e.target.value as Situation)} className="glass-select">
                  <option value="celibataire">Célibataire</option>
                  <option value="marie_pacse">Marié · Pacsé</option>
                </select>
              </div>
            </div>

            {anciennete === 'plus8ans' && (
              <div style={{ marginTop: '1rem', padding: '0.6rem 1rem', background: 'rgba(16,185,129,0.07)', borderRadius: 10, border: '1px solid rgba(16,185,129,0.2)', fontSize: '0.8rem', color: '#6EE7B7' }}>
                Abattement annuel applicable : <strong>{situation === 'marie_pacse' ? '9 200 €' : '4 600 €'}</strong>
              </div>
            )}
          </GlassCard>

          {/* ── Résultats ── */}
          {r && (
            <>
              {/* ── Base imposable ── */}
              <GlassCard
                className="animate-fade-up delay-3"
                style={{ opacity: loading ? 0.6 : 1, transition: 'opacity 0.15s' }}
              >
                <SectionTitle>Base imposable</SectionTitle>
                <Row label="Montant du rachat" value={fmt(r.montantRachatEffectif)} />
                <Row label="Plus-value totale du contrat" value={fmt(r.plusValueTotale)} />
                <Divider />
                <Row label="Intérêts bruts (part du rachat)" value={fmtDec(r.interetsBruts)} />
                {r.abattement > 0 && (
                  <Row label={`Abattement (${situation === 'marie_pacse' ? '9 200' : '4 600'} €)`} value={`− ${fmt(r.abattement)}`} muted />
                )}
                <Divider />
                <Row label="Intérêts imposables (IR)" value={fmtDec(r.interetsImposables)} accent />
                <Row label="Base prélèvements sociaux" value={fmtDec(r.interetsPS)} muted />
              </GlassCard>

              {/* ── Comparatif PFU / Barème ── */}
              <div
                style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem', opacity: loading ? 0.6 : 1, transition: 'opacity 0.15s' }}
                className="animate-fade-up delay-4"
              >
                {/* PFU */}
                <GlassCard style={isPFU ? { borderColor: 'rgba(16,185,129,0.4)', background: 'rgba(16,185,129,0.06)' } : {}}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <SectionTitle>Option PFU</SectionTitle>
                    {isPFU && <span className="badge badge-green">Meilleure option</span>}
                  </div>

                  <div style={{ marginBottom: '0.75rem', padding: '0.5rem 0.75rem', background: 'rgba(255,255,255,0.04)', borderRadius: 8, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {anciennete === 'moins8ans'
                      ? 'IR 12,8 % + PS 17,2 % = 30 %'
                      : typeof primesVersees === 'number' && primesVersees > 150_000
                        ? `IR mixte ${fmtPct(r.pfuTauxIR)} eff. + PS 17,2 %`
                        : 'IR 7,5 % + PS 17,2 % = 24,7 %'
                    }
                  </div>

                  <Row label="Prélèvement IR" value={fmtDec(r.pfuIR)} />
                  <Row label="Prélèvements sociaux (17,2 %)" value={fmtDec(r.pfuPS)} />
                  <Divider />
                  <Row label="Total fiscalité" value={fmtDec(r.pfuTotal)} />
                  <Divider />
                  <div style={{ marginTop: '0.25rem', padding: '0.6rem 0.75rem', background: 'rgba(255,255,255,0.05)', borderRadius: 10 }}>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.3rem' }}>Net perçu</p>
                    <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.35rem', fontWeight: 600, color: isPFU ? '#6EE7B7' : 'var(--text-primary)' }}>
                      {fmt(r.pfuNetPercu)}
                    </p>
                  </div>
                </GlassCard>

                {/* Barème */}
                <GlassCard style={isBareme ? { borderColor: 'rgba(16,185,129,0.4)', background: 'rgba(16,185,129,0.06)' } : {}}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <SectionTitle>Option Barème IR</SectionTitle>
                    {isBareme && <span className="badge badge-green">Meilleure option</span>}
                  </div>

                  <div style={{ marginBottom: '0.75rem', padding: '0.5rem 0.75rem', background: 'rgba(255,255,255,0.04)', borderRadius: 8, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    TMI {fmtPct(r.baremeTauxIR)} + PS 17,2 %
                  </div>

                  <Row label={`IR au barème (TMI ${fmtPct(r.baremeTauxIR)})`} value={fmtDec(r.baremeIR)} />
                  <Row label="Prélèvements sociaux (17,2 %)" value={fmtDec(r.baremePS)} />
                  <Divider />
                  <Row label="Total fiscalité" value={fmtDec(r.baremeTotal)} />
                  <Divider />
                  <div style={{ marginTop: '0.25rem', padding: '0.6rem 0.75rem', background: 'rgba(255,255,255,0.05)', borderRadius: 10 }}>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.3rem' }}>Net perçu</p>
                    <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.35rem', fontWeight: 600, color: isBareme ? '#6EE7B7' : 'var(--text-primary)' }}>
                      {fmt(r.baremeNetPercu)}
                    </p>
                  </div>
                </GlassCard>
              </div>

              {/* ── Verdict ── */}
              <GlassCard
                className="animate-fade-up delay-5"
                style={{
                  opacity: loading ? 0.6 : 1,
                  transition: 'opacity 0.15s',
                  background: r.meilleureOption === 'egal'
                    ? 'rgba(255,255,255,0.03)'
                    : 'rgba(16,185,129,0.06)',
                  borderColor: r.meilleureOption === 'egal'
                    ? 'var(--border-glass)'
                    : 'rgba(16,185,129,0.3)',
                }}
              >
                <SectionTitle>Verdict</SectionTitle>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem', textAlign: 'center' }}>
                  {[
                    {
                      label: 'Meilleure option',
                      value: r.meilleureOption === 'pfu' ? 'PFU' : r.meilleureOption === 'bareme' ? 'Barème IR' : 'Égalité',
                      color: r.meilleureOption === 'egal' ? 'var(--text-secondary)' : '#6EE7B7',
                    },
                    {
                      label: 'Économie réalisée',
                      value: fmtDec(r.economie),
                      color: r.economie > 0 ? 'var(--accent-gold)' : 'var(--text-muted)',
                    },
                    {
                      label: 'Net perçu (opt. retenue)',
                      value: fmt(r.meilleureOption === 'bareme' ? r.baremeNetPercu : r.pfuNetPercu),
                      color: 'var(--text-primary)',
                    },
                  ].map((item) => (
                    <div key={item.label} style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.04)', borderRadius: 10 }}>
                      <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                        {item.label}
                      </p>
                      <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.15rem', fontWeight: 600, color: item.color }}>
                        {item.value}
                      </p>
                    </div>
                  ))}
                </div>

                {r.meilleureOption !== 'egal' && (
                  <p style={{ marginTop: '1rem', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.7, textAlign: 'center' }}>
                    {r.meilleureOption === 'pfu'
                      ? `Le PFU est plus avantageux : il vous fait économiser ${fmtDec(r.economie)} par rapport au barème IR à ${fmtPct(r.baremeTauxIR)}.`
                      : `Le barème IR est plus avantageux : votre TMI de ${fmtPct(r.baremeTauxIR)} est inférieure au taux PFU effectif de ${fmtPct(r.pfuTauxIR + 0 /* already displayed correctly via label*/)}.`
                    }
                    {r.meilleureOption === 'bareme' && (
                      <> Vous économisez <strong style={{ color: 'var(--accent-gold)' }}>{fmtDec(r.economie)}</strong> en optant pour le barème.</>
                    )}
                  </p>
                )}
              </GlassCard>
            </>
          )}

          {/* ── Note légale ── */}
          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.6 }}>
            * Estimation pédagogique — barème 2024 : PFU 12,8 % ou 7,5 % (≥ 8 ans, primes ≤ 150 k€) + PS 17,2 %. Abattements annuels : 4 600 € (célibataire) / 9 200 € (couple). Seuil 150 k€ des Art. 125-0 A et 200 A CGI appliqué aux primes versées du présent contrat. Non contractuel.
          </p>

        </div>
      </div>
    </main>
  );
}
