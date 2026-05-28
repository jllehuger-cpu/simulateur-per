'use client';

import { useState, useCallback, useRef } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Enfant {
  nom: string;
  age: number | string;
  situation: string;
  allocations: string;
}

interface ContratAV {
  nom: string;
  valeur: number;
  beneficiaires: string;
  dateEffet: string;
}

interface ClientData {
  prenom: string;
  nom: string;
  age: number | string;
  email: string;
  reference: string;
  prenomConjoint: string;
  nomConjoint: string;
  ageConjoint: number | string;
  statutMarital: string;
  enfants: Enfant[];
  objectifs: string[];
  revenuBrutPrincipal: number;
  revenuBrutConjoint: number;
  totalBrut: number;
  rfr: number;
  partsFiscales: number | string;
  tmi: number;
  plafondPER: number;
  plafondPERanterieur: number;
  plafondPERtotal: number;
  residencePrincipale: number;
  autresImmo: number;
  totalImmo: number;
  livrets: number;
  lddsPel: number;
  totalLiquidites: number;
  contratsAV: ContratAV[];
  totalAV: number;
  actions: number;
  autres: number;
  patrimoineTotal: number;
  ageRetraiteVise: number | string;
  ansAvantRetraite: number | string;
  revenuNetMensuel: number;
  revenuSouhaiteRetraite: number;
  epargneRetraite: number;
  rendement: number;
  capitalProjecte: number;
}

interface AuditSections {
  bilan_civil: string;
  bilan_fiscal: string;
  bilan_financier: string;
  zones_risque: string;
  recommandations: string;
  raw: string;
}

// ─── Mini markdown renderer ────────────────────────────────────────────────────

function renderMd(text: string) {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let key = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) { elements.push(<br key={key++} />); continue; }

    if (/^#{1,3}\s/.test(line)) {
      const content = line.replace(/^#{1,3}\s/, '');
      elements.push(
        <p key={key++} style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem', marginTop: '0.75rem' }}>
          {inlineMd(content)}
        </p>
      );
      continue;
    }

    if (/^\d+\.\s/.test(line)) {
      elements.push(
        <p key={key++} style={{ paddingLeft: '1rem', marginBottom: '0.2rem', color: 'var(--text-secondary)', display: 'flex', gap: '0.4rem' }}>
          <span style={{ color: 'var(--text-muted)', minWidth: 18 }}>{line.match(/^(\d+)\./)?.[1]}.</span>
          <span>{inlineMd(line.replace(/^\d+\.\s/, ''))}</span>
        </p>
      );
      continue;
    }

    if (/^[-•]\s/.test(line)) {
      elements.push(
        <p key={key++} style={{ paddingLeft: '1rem', marginBottom: '0.2rem', color: 'var(--text-secondary)', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
          <span style={{ color: '#6366F1', marginTop: '0.15rem', flexShrink: 0 }}>▸</span>
          <span>{inlineMd(line.replace(/^[-•]\s/, ''))}</span>
        </p>
      );
      continue;
    }

    elements.push(
      <p key={key++} style={{ marginBottom: '0.35rem', color: 'var(--text-secondary)', lineHeight: 1.65 }}>
        {inlineMd(line)}
      </p>
    );
  }
  return <>{elements}</>;
}

function inlineMd(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((part, i) => {
    if (/^\*\*[^*]+\*\*$/.test(part))
      return <strong key={i} style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{part.slice(2, -2)}</strong>;
    if (/^\*[^*]+\*$/.test(part))
      return <em key={i} style={{ color: '#A78BFA' }}>{part.slice(1, -1)}</em>;
    return part;
  });
}

// ─── Helpers formatage ────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}

function fmtPct(n: number) {
  return `${Math.round(n * 100)} %`;
}

function cellNum(sheet: Record<string, { v?: unknown }>, addr: string): number {
  const c = sheet[addr];
  if (!c) return 0;
  const v = c.v;
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return parseFloat(v.replace(/\s/g, '').replace(',', '.')) || 0;
  return 0;
}

function cellStr(sheet: Record<string, { v?: unknown }>, addr: string): string {
  const c = sheet[addr];
  if (!c) return '';
  return String(c.v ?? '').trim();
}

// ─── Parsing Excel ────────────────────────────────────────────────────────────

async function parseExcel(file: File): Promise<ClientData> {
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });

  const sheetNames = wb.SheetNames.map((n: string) => n.toLowerCase());

  function getSheet(keywords: string[]) {
    const idx = sheetNames.findIndex((n: string) => keywords.some((k) => n.includes(k)));
    return idx >= 0 ? (wb.Sheets[wb.SheetNames[idx]] as Record<string, { v?: unknown }>) : ({} as Record<string, { v?: unknown }>);
  }

  const sClient    = getSheet(['client']);
  const sFiscal    = getSheet(['fisc', 'fiscal', 'impôt', 'impo']);
  const sPatrimoin = getSheet(['patrim']);
  const sRetraite  = getSheet(['retrait']);

  // ── Onglet CLIENT ──
  const prenom    = cellStr(sClient, 'B4');
  const nom       = cellStr(sClient, 'B5');
  const age       = cellNum(sClient, 'B6') || cellStr(sClient, 'B6');
  const email     = cellStr(sClient, 'B7');
  const reference = cellStr(sClient, 'B8');

  const prenomConjoint = cellStr(sClient, 'B10');
  const nomConjoint    = cellStr(sClient, 'B11');
  const ageConjointRaw = cellNum(sClient, 'B12') || cellStr(sClient, 'B12');

  // Statut marital : chercher dans B12 ou lignes suivantes
  let statutMarital = '';
  const STATUTS = ['marié', 'marie', 'pacsé', 'pacs', 'célibataire', 'celibataire', 'divorcé', 'veuf', 'concubin'];
  const b12val = cellStr(sClient, 'B12').toLowerCase();
  if (STATUTS.some((s) => b12val.includes(s))) {
    statutMarital = cellStr(sClient, 'B12');
  } else {
    for (let r = 13; r <= 20; r++) {
      const v = cellStr(sClient, `B${r}`).toLowerCase();
      const a = cellStr(sClient, `A${r}`).toLowerCase();
      if (STATUTS.some((s) => v.includes(s) || a.includes(s))) {
        statutMarital = cellStr(sClient, `B${r}`) || cellStr(sClient, `A${r}`);
        break;
      }
    }
  }

  // Enfants : lignes ~16-26
  const enfants: Enfant[] = [];
  for (let r = 16; r <= 30; r++) {
    const nomEnf = cellStr(sClient, `A${r}`);
    const ageEnf = cellStr(sClient, `B${r}`);
    if (!nomEnf && !ageEnf) continue;
    if (nomEnf.toLowerCase().includes('enfant') || nomEnf.toLowerCase().includes('nom')) continue;
    enfants.push({
      nom:         nomEnf,
      age:         ageEnf,
      situation:   cellStr(sClient, `C${r}`),
      allocations: cellStr(sClient, `D${r}`),
    });
  }

  // Objectifs : lignes ~19-30 (colonne A = label, B = "X" si coché)
  const objectifs: string[] = [];
  for (let r = 19; r <= 32; r++) {
    const label  = cellStr(sClient, `A${r}`);
    const coche  = cellStr(sClient, `B${r}`).toLowerCase();
    if (label && (coche === 'x' || coche === 'oui' || coche === '1' || coche === 'true')) {
      objectifs.push(label);
    }
  }

  // ── Onglet FISCALITÉ ──
  const revenuBrutPrincipal  = cellNum(sFiscal, 'B6');
  const revenuBrutConjoint   = cellNum(sFiscal, 'B7');
  const totalBrut            = cellNum(sFiscal, 'B8') || revenuBrutPrincipal + revenuBrutConjoint;
  const rfr                  = cellNum(sFiscal, 'B10');
  const partsFiscales        = cellNum(sFiscal, 'B11') || cellStr(sFiscal, 'B11');
  const tmiRaw               = cellNum(sFiscal, 'B14');
  const tmi                  = tmiRaw > 1 ? tmiRaw / 100 : tmiRaw;
  const plafondPER           = cellNum(sFiscal, 'B17');
  const plafondPERanterieur  = cellNum(sFiscal, 'B18');
  const plafondPERtotal      = cellNum(sFiscal, 'B20') || plafondPER + plafondPERanterieur;

  // ── Onglet PATRIMOINE ──
  const residencePrincipale = cellNum(sPatrimoin, 'B5');
  const autresImmo          = cellNum(sPatrimoin, 'B6');
  const totalImmo           = cellNum(sPatrimoin, 'B7') || residencePrincipale + autresImmo;
  const livrets             = cellNum(sPatrimoin, 'B9');
  const lddsPel             = cellNum(sPatrimoin, 'B10');
  const totalLiquidites     = cellNum(sPatrimoin, 'B11') || livrets + lddsPel;

  const contratsAV: ContratAV[] = [];
  for (let r = 14; r <= 25; r++) {
    const nomAV  = cellStr(sPatrimoin, `A${r}`);
    const valAV  = cellNum(sPatrimoin, `B${r}`);
    if (!nomAV && !valAV) continue;
    if (nomAV.toLowerCase().includes('total') || nomAV.toLowerCase().includes('contrat')) continue;
    contratsAV.push({
      nom:          nomAV,
      valeur:       valAV,
      beneficiaires: cellStr(sPatrimoin, `C${r}`),
      dateEffet:    cellStr(sPatrimoin, `D${r}`),
    });
  }

  const totalAV       = cellNum(sPatrimoin, 'B18') || contratsAV.reduce((s, c) => s + c.valeur, 0);
  const actions       = cellNum(sPatrimoin, 'B21');
  const autres        = cellNum(sPatrimoin, 'B22');
  const patrimoineTotal = cellNum(sPatrimoin, 'B24') || totalImmo + totalLiquidites + totalAV + actions + autres;

  // ── Onglet RETRAITE ──
  const ageRetraiteVise       = cellNum(sRetraite, 'B6') || cellStr(sRetraite, 'B6');
  const ansAvantRetraite      = cellNum(sRetraite, 'B7') || cellStr(sRetraite, 'B7');
  const revenuNetMensuel      = cellNum(sRetraite, 'B10');
  const revenuSouhaiteRetraite = cellNum(sRetraite, 'B11');
  const epargneRetraite       = cellNum(sRetraite, 'B14');
  const rendement             = cellNum(sRetraite, 'B15');
  const capitalProjecte       = cellNum(sRetraite, 'B16');

  return {
    prenom, nom, age, email, reference,
    prenomConjoint, nomConjoint, ageConjoint: ageConjointRaw, statutMarital,
    enfants, objectifs,
    revenuBrutPrincipal, revenuBrutConjoint, totalBrut, rfr,
    partsFiscales, tmi, plafondPER, plafondPERanterieur, plafondPERtotal,
    residencePrincipale, autresImmo, totalImmo,
    livrets, lddsPel, totalLiquidites,
    contratsAV, totalAV, actions, autres, patrimoineTotal,
    ageRetraiteVise, ansAvantRetraite,
    revenuNetMensuel, revenuSouhaiteRetraite,
    epargneRetraite, rendement, capitalProjecte,
  };
}

// ─── Composants UI ────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 12,
      padding: '0.75rem 1rem',
    }}>
      <div style={{ fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
        {label}
      </div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.35rem', fontWeight: 600, color: color ?? 'var(--text-primary)' }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{sub}</div>}
    </div>
  );
}

function SectionCard({ icon, title, color, content, id }: {
  icon: string; title: string; color: string; content: string; id: string;
}) {
  return (
    <div
      id={id}
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 20,
        overflow: 'hidden',
        scrollMarginTop: 80,
      }}
    >
      <div style={{ height: 3, background: `linear-gradient(90deg, ${color}, transparent)` }} />
      <div style={{ padding: '1.5rem 1.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <span style={{
            width: 38, height: 38, borderRadius: 10,
            background: `${color}18`,
            border: `1px solid ${color}35`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.1rem',
          }}>{icon}</span>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
            {title}
          </h2>
        </div>
        <div style={{ fontSize: '0.875rem', lineHeight: 1.7 }}>
          {renderMd(content)}
        </div>
      </div>
    </div>
  );
}

// ─── Stepper ──────────────────────────────────────────────────────────────────

function Stepper({ step }: { step: number }) {
  const steps = ['Import', 'Vérification', 'Résultats'];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: '2.5rem' }}>
      {steps.map((label, i) => {
        const idx = i + 1;
        const done = step > idx;
        const active = step === idx;
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', flex: i < steps.length - 1 ? 1 : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.8rem', fontWeight: 700,
                background: done ? '#6366F1' : active ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)',
                border: `2px solid ${done || active ? '#6366F1' : 'rgba(255,255,255,0.12)'}`,
                color: done ? '#fff' : active ? '#A78BFA' : 'var(--text-muted)',
                transition: 'all 0.3s',
              }}>
                {done ? '✓' : idx}
              </div>
              <span style={{
                fontSize: '0.8rem', fontWeight: 500,
                color: active ? 'var(--text-primary)' : done ? '#A78BFA' : 'var(--text-muted)',
              }}>{label}</span>
            </div>
            {i < steps.length - 1 && (
              <div style={{ flex: 1, height: 1, background: done ? '#6366F1' : 'rgba(255,255,255,0.1)', margin: '0 0.75rem', transition: 'background 0.3s' }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function AuditPage() {
  const [step, setStep] = useState(1);
  const [dragging, setDragging] = useState(false);
  const [clientData, setClientData] = useState<ClientData | null>(null);
  const [parseError, setParseError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingDot, setLoadingDot] = useState(0);
  const [sections, setSections] = useState<AuditSections | null>(null);
  const [apiError, setApiError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const loadingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      setParseError('Fichier invalide. Veuillez importer un fichier .xlsx ou .xls.');
      return;
    }
    setParseError('');
    try {
      const data = await parseExcel(file);
      setClientData(data);
      setStep(2);
    } catch (e) {
      setParseError(`Erreur de parsing : ${String(e)}`);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleLaunch = async () => {
    if (!clientData) return;
    setLoading(true);
    setApiError('');
    setSections(null);
    setStep(3);

    let dot = 0;
    loadingRef.current = setInterval(() => {
      dot = (dot + 1) % 4;
      setLoadingDot(dot);
    }, 500);

    try {
      const res = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ clientData }),
      });
      const json = await res.json() as { success?: boolean; sections?: AuditSections; error?: string };
      if (!json.success || !json.sections) {
        setApiError(json.error ?? 'Erreur inconnue.');
        setStep(2);
      } else {
        setSections(json.sections);
      }
    } catch (e) {
      setApiError(String(e));
      setStep(2);
    } finally {
      setLoading(false);
      if (loadingRef.current) clearInterval(loadingRef.current);
    }
  };

  const reset = () => {
    setStep(1);
    setClientData(null);
    setSections(null);
    setParseError('');
    setApiError('');
  };

  const tmiColor = clientData ? (clientData.tmi >= 0.41 ? '#F87171' : '#FBBF24') : '#94A3B8';

  // ── ÉTAPE 1 : Import ──────────────────────────────────────────────────────

  const step1 = (
    <div style={{ maxWidth: 560, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>📋</div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
          Audit Patrimonial IA
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6 }}>
          Importez le fichier Excel "Mon Audit Patrimoine" pour générer<br />une analyse patrimoniale complète par intelligence artificielle.
        </p>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        style={{
          border: `2px dashed ${dragging ? '#6366F1' : 'rgba(255,255,255,0.14)'}`,
          borderRadius: 20,
          padding: '3rem 2rem',
          textAlign: 'center',
          cursor: 'pointer',
          background: dragging ? 'rgba(99,102,241,0.07)' : 'rgba(255,255,255,0.02)',
          transition: 'all 0.2s',
        }}
      >
        <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>📂</div>
        <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
          Glissez votre fichier Excel ici
        </p>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          ou cliquez pour sélectionner — formats .xlsx, .xls
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls"
          style={{ display: 'none' }}
          onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
        />
      </div>

      {parseError && (
        <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', borderRadius: 10, background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#F87171', fontSize: '0.875rem' }}>
          ⚠️ {parseError}
        </div>
      )}

      <div style={{ marginTop: '1.5rem', padding: '1rem 1.25rem', borderRadius: 12, background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)' }}>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: 600 }}>
          📌 Onglets attendus dans le fichier :
        </p>
        {['Client', 'Fiscalité', 'Patrimoine', 'Retraite'].map((t) => (
          <span key={t} style={{ display: 'inline-block', marginRight: '0.5rem', marginBottom: '0.25rem', padding: '0.15rem 0.5rem', borderRadius: 6, background: 'rgba(99,102,241,0.15)', color: '#A78BFA', fontSize: '0.78rem', fontWeight: 600 }}>
            {t}
          </span>
        ))}
      </div>
    </div>
  );

  // ── ÉTAPE 2 : Aperçu ─────────────────────────────────────────────────────

  const step2 = clientData && (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
            Vérification des données
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Vérifiez que les informations extraites du fichier sont correctes.
          </p>
        </div>
        <button className="btn-ghost" onClick={reset}>← Changer de fichier</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>

        {/* Carte Client */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem' }}>
            <span style={{ fontSize: '1.1rem' }}>👤</span>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#A78BFA' }}>Client</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <StatCard label="Prénom" value={clientData.prenom || '—'} />
            <StatCard label="Nom" value={clientData.nom || '—'} />
            <StatCard label="Âge" value={clientData.age ? `${clientData.age} ans` : '—'} />
            <StatCard label="Statut" value={clientData.statutMarital || '—'} />
          </div>
          {clientData.prenomConjoint && (
            <div style={{ marginTop: '0.75rem', padding: '0.6rem 0.9rem', borderRadius: 10, background: 'rgba(167,139,250,0.07)', border: '1px solid rgba(167,139,250,0.2)' }}>
              <span style={{ fontSize: '0.78rem', color: '#A78BFA', fontWeight: 600 }}>Conjoint : </span>
              <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                {clientData.prenomConjoint} {clientData.nomConjoint}{clientData.ageConjoint ? ` · ${clientData.ageConjoint} ans` : ''}
              </span>
            </div>
          )}
          {clientData.enfants.length > 0 && (
            <div style={{ marginTop: '0.75rem' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                Enfants ({clientData.enfants.length})
              </div>
              {clientData.enfants.map((e, i) => (
                <div key={i} style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', padding: '0.2rem 0' }}>
                  {e.nom}{e.age ? ` · ${e.age} ans` : ''}{e.situation ? ` · ${e.situation}` : ''}
                </div>
              ))}
            </div>
          )}
          {clientData.objectifs.length > 0 && (
            <div style={{ marginTop: '0.75rem' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                Objectifs
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                {clientData.objectifs.map((o, i) => (
                  <span key={i} style={{ fontSize: '0.72rem', padding: '0.15rem 0.5rem', borderRadius: 6, background: 'rgba(99,102,241,0.12)', color: '#A78BFA', border: '1px solid rgba(99,102,241,0.25)' }}>
                    {o}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Carte Patrimoine */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem' }}>
            <span style={{ fontSize: '1.1rem' }}>🏛️</span>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#34D399' }}>Patrimoine</span>
          </div>
          <StatCard label="Total patrimoine" value={fmt(clientData.patrimoineTotal)} color="#34D399" />
          <div style={{ marginTop: '0.75rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
            <StatCard label="Immobilier" value={fmt(clientData.totalImmo)} sub={clientData.patrimoineTotal ? `${Math.round(clientData.totalImmo / clientData.patrimoineTotal * 100)} %` : ''} />
            <StatCard label="Assurance-vie" value={fmt(clientData.totalAV)} sub={clientData.patrimoineTotal ? `${Math.round(clientData.totalAV / clientData.patrimoineTotal * 100)} %` : ''} />
            <StatCard label="Liquidités" value={fmt(clientData.totalLiquidites)} />
            <StatCard label="Actions" value={fmt(clientData.actions)} />
          </div>
          {clientData.contratsAV.length > 0 && (
            <div style={{ marginTop: '0.75rem' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                Contrats AV ({clientData.contratsAV.length})
              </div>
              {clientData.contratsAV.map((c, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.3rem 0', borderBottom: i < clientData.contratsAV.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{c.nom || `Contrat ${i + 1}`}</span>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#34D399' }}>{fmt(c.valeur)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Carte Fiscale */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem' }}>
            <span style={{ fontSize: '1.1rem' }}>📊</span>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#60A5FA' }}>Situation fiscale</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <StatCard label="Revenu brut" value={fmt(clientData.totalBrut)} />
            <StatCard label="RFR" value={fmt(clientData.rfr)} />
            <StatCard label="Parts fiscales" value={String(clientData.partsFiscales) || '—'} />
            <StatCard label="TMI" value={fmtPct(clientData.tmi)} color={tmiColor} />
          </div>
          <div style={{ marginTop: '0.75rem', padding: '0.75rem', borderRadius: 10, background: clientData.tmi >= 0.41 ? 'rgba(248,113,113,0.08)' : 'rgba(251,191,36,0.08)', border: `1px solid ${clientData.tmi >= 0.41 ? 'rgba(248,113,113,0.25)' : 'rgba(251,191,36,0.25)'}` }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Plafond PER disponible</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 600, color: '#FBBF24' }}>
              {fmt(clientData.plafondPERtotal)}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              Dont reports N-3 : {fmt(clientData.plafondPERanterieur)}
            </div>
          </div>
        </div>

        {/* Carte Retraite */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem' }}>
            <span style={{ fontSize: '1.1rem' }}>🎯</span>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#FBBF24' }}>Retraite</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <StatCard label="Âge retraite visé" value={clientData.ageRetraiteVise ? `${clientData.ageRetraiteVise} ans` : '—'} />
            <StatCard label="Horizon" value={clientData.ansAvantRetraite ? `${clientData.ansAvantRetraite} ans` : '—'} />
            <StatCard label="Revenu actuel" value={fmt(clientData.revenuNetMensuel)} sub="/ mois" />
            <StatCard label="Objectif retraite" value={fmt(clientData.revenuSouhaiteRetraite)} sub="/ mois" />
          </div>
          <div style={{ marginTop: '0.75rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
            <StatCard label="Épargne retraite" value={fmt(clientData.epargneRetraite)} />
            <StatCard label="Capital projeté" value={fmt(clientData.capitalProjecte)} color="#FBBF24" />
          </div>
        </div>
      </div>

      {apiError && (
        <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', borderRadius: 10, background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#F87171', fontSize: '0.875rem' }}>
          ⚠️ {apiError}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <button
          onClick={handleLaunch}
          style={{
            padding: '0.9rem 2.5rem',
            borderRadius: 12,
            border: 'none',
            background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
            color: '#fff',
            fontFamily: 'var(--font-sans)',
            fontSize: '1rem',
            fontWeight: 700,
            letterSpacing: '0.03em',
            cursor: 'pointer',
            boxShadow: '0 4px 24px rgba(139,92,246,0.45)',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)';
            (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 32px rgba(139,92,246,0.6)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = '';
            (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 24px rgba(139,92,246,0.45)';
          }}
        >
          <span>✨</span> Lancer l&apos;Audit IA
        </button>
      </div>
    </div>
  );

  // ── ÉTAPE 3 : Résultats ───────────────────────────────────────────────────

  const SECTIONS_META = [
    { id: 'civil',      icon: '⚖️',  title: 'Bilan Civil',       color: '#A78BFA', key: 'bilan_civil' as const },
    { id: 'fiscal',     icon: '📊',  title: 'Bilan Fiscal',      color: '#60A5FA', key: 'bilan_fiscal' as const },
    { id: 'financier',  icon: '💼',  title: 'Bilan Financier',   color: '#34D399', key: 'bilan_financier' as const },
    { id: 'risques',    icon: '⚠️',  title: 'Zones de Risque',   color: '#F87171', key: 'zones_risque' as const },
    { id: 'reco',       icon: '🎯',  title: 'Recommandations',   color: '#FBBF24', key: 'recommandations' as const },
  ];

  const loadingMessages = [
    'Analyse de la situation civile…',
    'Calcul de la pression fiscale…',
    'Évaluation de l\'allocation patrimoniale…',
    'Identification des zones de risque…',
    'Rédaction des recommandations…',
  ];

  const step3 = (
    <div>
      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1.5rem', animation: 'orb-drift 2s ease-in-out infinite alternate' }}>🧠</div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.35rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
            Audit en cours{'.'.repeat(loadingDot + 1)}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '2rem' }}>
            {loadingMessages[loadingDot % loadingMessages.length]}
          </p>
          <div style={{ maxWidth: 400, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {SECTIONS_META.map((s, i) => (
              <div key={s.id} style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                padding: '0.6rem 1rem', borderRadius: 10,
                background: i <= loadingDot ? `${s.color}12` : 'rgba(255,255,255,0.02)',
                border: `1px solid ${i <= loadingDot ? `${s.color}30` : 'rgba(255,255,255,0.06)'}`,
                transition: 'all 0.4s',
              }}>
                <span style={{ fontSize: '0.9rem' }}>{s.icon}</span>
                <span style={{ fontSize: '0.82rem', color: i <= loadingDot ? 'var(--text-primary)' : 'var(--text-muted)', flex: 1 }}>{s.title}</span>
                {i < loadingDot && <span style={{ color: s.color, fontSize: '0.85rem' }}>✓</span>}
                {i === loadingDot && <span style={{ color: s.color, fontSize: '0.75rem' }}>en cours…</span>}
              </div>
            ))}
          </div>
        </div>
      ) : sections ? (
        <div>
          {/* Barre de résumé */}
          <div style={{
            background: 'rgba(99,102,241,0.08)',
            border: '1px solid rgba(99,102,241,0.22)',
            borderRadius: 16,
            padding: '1.25rem 1.75rem',
            marginBottom: '2rem',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '1.5rem',
            justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {clientData?.prenom} {clientData?.nom}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Audit généré le {new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
            </div>
            <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)' }}>Patrimoine</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.15rem', fontWeight: 600, color: '#34D399' }}>{fmt(clientData?.patrimoineTotal ?? 0)}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)' }}>TMI</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.15rem', fontWeight: 600, color: tmiColor }}>{fmtPct(clientData?.tmi ?? 0)}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)' }}>Statut</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>{clientData?.statutMarital || '—'}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.6rem' }}>
              <button className="btn-ghost" onClick={reset}>+ Nouvel audit</button>
              <button className="btn-ghost" onClick={() => window.print()}>🖨️ Imprimer</button>
            </div>
          </div>

          {/* Navigation rapide */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
            {SECTIONS_META.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                  padding: '0.35rem 0.85rem', borderRadius: 8,
                  fontSize: '0.8rem', fontWeight: 500,
                  color: s.color,
                  background: `${s.color}10`,
                  border: `1px solid ${s.color}28`,
                  textDecoration: 'none',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = `${s.color}20`; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = `${s.color}10`; }}
              >
                <span>{s.icon}</span>{s.title}
              </a>
            ))}
          </div>

          {/* Sections */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {SECTIONS_META.map((s) => (
              <SectionCard
                key={s.id}
                id={s.id}
                icon={s.icon}
                title={s.title}
                color={s.color}
                content={sections[s.key]}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );

  return (
    <main style={{ minHeight: '100vh', padding: '2.5rem 1.25rem', position: 'relative', zIndex: 1 }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <Stepper step={step} />
        {step === 1 && step1}
        {step === 2 && step2}
        {step === 3 && step3}
      </div>
    </main>
  );
}
