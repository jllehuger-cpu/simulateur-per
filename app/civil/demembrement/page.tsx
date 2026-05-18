'use client';
import { AuthGate } from '@/components/auth-gate';
import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';

/* ── INSEE & helpers ── */
const TABLE_INSEE: Record<'H'|'F', Record<number,number>> = {
  H: {0:79.45,10:69.85,20:59.98,30:50.33,40:40.78,50:31.59,60:23.19,61:22.41,62:21.64,63:20.89,64:20.14,65:19.39,66:18.65,67:17.91,68:17.17,69:16.45,70:15.73,75:12.24,80:9.02,85:6.28,90:4.23,95:2.92,100:2.61},
  F: {0:85.40,10:75.76,20:65.83,30:55.97,40:46.20,50:36.68,60:27.63,61:26.75,62:25.88,63:25.01,64:24.14,65:23.28,66:22.42,67:21.57,68:20.72,69:19.87,70:19.02,75:14.93,80:11.10,85:7.76,90:5.16,95:3.40,100:2.34},
};
const getEsperance = (age: number, s: 'H'|'F') => {
  const ages = Object.keys(TABLE_INSEE[s]).map(Number).sort((a,b)=>b-a);
  const found = ages.find(a => a <= age) ?? 0;
  return TABLE_INSEE[s][found] ?? 2;
};
const getFiscalPctU = (a: number) => {
  if (a < 21) return 90; if (a < 31) return 80; if (a < 41) return 70;
  if (a < 51) return 60; if (a < 61) return 50; if (a < 71) return 40;
  if (a < 81) return 30; if (a < 91) return 20; return 10;
};
const getEconoPctU = (a: number, s: 'H'|'F', rend: number, taux: number) => {
  const n = getEsperance(a, s);
  const i = taux / 100;
  const r = rend / 100;
  const pct = i === 0 ? r * n * 100 : r * (1 - Math.pow(1+i,-n)) / i * 100;
  return Math.min(100, Math.max(0, pct));
};
const calculerDroits = (base: number, tranches: {limite:number|null;taux:number}[]) => {
  let droits = 0, reste = base, prev = 0;
  for (const t of tranches) {
    const lim = t.limite === null ? Infinity : t.limite;
    const slice = Math.min(Math.max(0, reste), lim - prev);
    if (slice > 0) { droits += slice * t.taux; reste -= slice; }
    prev = lim;
    if (reste <= 0) break;
  }
  return droits;
};
const fmt = (n: number) => Math.round(n).toLocaleString('fr-FR');

const BAREMES_LD = [
  { limite: 8072, taux: 0.05 }, { limite: 12109, taux: 0.10 },
  { limite: 15932, taux: 0.15 }, { limite: 552324, taux: 0.20 },
  { limite: 902838, taux: 0.30 }, { limite: 1805677, taux: 0.40 },
  { limite: null, taux: 0.45 },
];
const getBareme = (lien: string) => {
  if (lien === 'frere_soeur') return [{ limite: 24430, taux: 0.35 }, { limite: null, taux: 0.45 }];
  if (lien === 'neveu_niece') return [{ limite: null, taux: 0.55 }];
  if (lien === 'tiers') return [{ limite: null, taux: 0.60 }];
  return BAREMES_LD;
};
const ABATTEMENTS: Record<string,number> = {
  enfant: 100000, petit_enfant: 31865, frere_soeur: 15932, neveu_niece: 7967, tiers: 1594,
};

type TabId = 'evaluation'|'comparateur'|'donation'|'successif';
const TABS: {id:TabId;label:string;icon:string}[] = [
  { id:'evaluation',  label:'Évaluation',                      icon:'⚖️' },
  { id:'comparateur', label:'Comparateur fiscal / économique', icon:'📊' },
  { id:'donation',    label:'Donation en démembrement',        icon:'🎁' },
  { id:'successif',   label:'Usufruit successif',              icon:'🔄' },
];

const btnToggle = (active: boolean): React.CSSProperties => ({
  padding:'0.4rem 1.2rem', borderRadius:8, fontSize:'0.75rem', fontWeight:700,
  border:'none', cursor:'pointer', transition:'all 0.2s',
  background: active ? 'rgba(59,130,246,0.25)' : 'transparent',
  color: active ? '#fff' : 'var(--text-muted)',
  outline: active ? '1px solid rgba(59,130,246,0.4)' : '1px solid transparent',
});

/* ══════════════════════════════════════════════
   ONGLET 1 — Évaluation (contenu d'origine)
══════════════════════════════════════════════ */
function TabEvaluation({ baremes }: { baremes: any }) {
  const [methode, setMethode]         = useState<'fiscal'|'economique'>('fiscal');
  const [typeDossier, setTypeDossier] = useState<'solo'|'couple'>('couple');
  const [prixPP, setPrixPP]           = useState<number>(500000);
  const [repartitionH, setRepartH]    = useState<number>(50);
  const [nbEnfants, setNbEnfants]     = useState<number>(2);
  const [ageH, setAgeH]               = useState<number>(68);
  const [ageF, setAgeF]               = useState<number>(65);
  const [ageSolo, setAgeSolo]         = useState<number>(65);
  const [sexeSolo, setSexeSolo]       = useState<'H'|'F'>('F');
  const [rendement, setRendement]     = useState<number>(4);
  const [tauxAct, setTauxAct]         = useState<number>(3);

  const calculs = useMemo(() => {
    const proc = (val: number, a: number, s: 'H'|'F') => {
      const pct = methode === 'fiscal' ? getFiscalPctU(a) : getEconoPctU(a, s, rendement, tauxAct);
      const u = val * pct / 100;
      return { u, np: val - u, pct };
    };
    if (typeDossier === 'solo') {
      const r = proc(prixPP, ageSolo, sexeSolo);
      return { h:r, f:{u:0,np:0,pct:0}, total:{u:r.u, np:r.np, pp:prixPP} };
    }
    const ppH = prixPP * repartitionH / 100;
    const rH = proc(ppH, ageH, 'H');
    const rF = proc(prixPP - ppH, ageF, 'F');
    return { h:rH, f:rF, total:{u:rH.u+rF.u, np:rH.np+rF.np, pp:prixPP} };
  }, [methode, typeDossier, prixPP, repartitionH, ageH, ageF, ageSolo, sexeSolo, rendement, tauxAct]);

  const abMontant   = baremes?.abattements?.enfant || 100000;
  const abTotal     = abMontant * (typeDossier === 'couple' ? 2 : 1) * nbEnfants;
  const resteTaxable= Math.max(0, calculs.total.np - abTotal);
  const partEnfant  = nbEnfants > 0 ? resteTaxable / nbEnfants : 0;
  const droitsEnfant= baremes ? calculerDroits(partEnfant, baremes.baremes.ligne_directe) : 0;

  return (
    <div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:'0.75rem', marginBottom:'1.5rem' }}>
        <div style={{ display:'flex', gap:4, background:'var(--bg-surface)', border:'1px solid var(--border-glass)', borderRadius:10, padding:4 }}>
          <button onClick={() => setMethode('fiscal')} style={btnToggle(methode==='fiscal')}>FISCAL</button>
          <button onClick={() => setMethode('economique')} style={btnToggle(methode==='economique')}>ÉCONOMIQUE</button>
        </div>
        <div style={{ display:'flex', gap:4, background:'var(--bg-surface)', border:'1px solid var(--border-glass)', borderRadius:10, padding:4 }}>
          <button onClick={() => setTypeDossier('solo')} style={btnToggle(typeDossier==='solo')}>INDIVIDUEL</button>
          <button onClick={() => setTypeDossier('couple')} style={btnToggle(typeDossier==='couple')}>COUPLE</button>
        </div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 2fr', gap:'1.5rem' }}>
        <div className="glass-card" style={{ padding:'1.5rem', display:'flex', flexDirection:'column', gap:'1.25rem' }}>
          <h2 style={{ margin:0, fontSize:'0.9rem', fontWeight:700, color:'var(--text-primary)', textTransform:'uppercase', letterSpacing:'0.06em' }}>Patrimoine & Famille</h2>
          <div>
            <label className="field-label">Valeur Pleine Propriété (€)</label>
            <input type="number" value={prixPP} onChange={e=>setPrixPP(Number(e.target.value))} className="glass-input" style={{ fontWeight:700, fontSize:'1.2rem' }} />
          </div>
          <div>
            <label className="field-label">Nombre d'enfants</label>
            <input type="number" value={nbEnfants} onChange={e=>setNbEnfants(Number(e.target.value))} className="glass-input" min="1" />
          </div>
          {typeDossier === 'couple' && (
            <div>
              <label className="field-label">Répartition (H: {repartitionH}% / F: {100-repartitionH}%)</label>
              <input type="range" min="0" max="100" value={repartitionH} onChange={e=>setRepartH(Number(e.target.value))} className="glass-range" />
            </div>
          )}
          {methode === 'economique' && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.75rem', background:'rgba(59,130,246,0.07)', border:'1px solid rgba(59,130,246,0.2)', borderRadius:12, padding:'1rem' }}>
              <div>
                <label className="field-label" style={{ color:'#93C5FD' }}>Rendement %</label>
                <input type="number" step="0.1" value={rendement} onChange={e=>setRendement(Number(e.target.value))} className="glass-input" />
              </div>
              <div>
                <label className="field-label" style={{ color:'#93C5FD' }}>Actualisation %</label>
                <input type="number" step="0.1" value={tauxAct} onChange={e=>setTauxAct(Number(e.target.value))} className="glass-input" />
              </div>
            </div>
          )}
          <hr style={{ border:'none', borderTop:'1px solid var(--border-subtle)', margin:'0.25rem 0' }} />
          <h2 style={{ margin:0, fontSize:'0.72rem', fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.1em' }}>Âges & Espérance de vie</h2>
          {typeDossier === 'couple' ? (
            <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem' }}>
              <div style={{ background:'rgba(59,130,246,0.07)', border:'1px solid rgba(59,130,246,0.2)', borderRadius:12, padding:'0.75rem' }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'0.5rem' }}>
                  <label style={{ fontSize:'0.72rem', fontWeight:700, color:'#93C5FD', textTransform:'uppercase' }}>Monsieur : {ageH} ans</label>
                  <span style={{ fontSize:'0.72rem', color:'var(--text-muted)' }}>Exp. {getEsperance(ageH,'H')} ans</span>
                </div>
                <input type="range" min="0" max="100" value={ageH} onChange={e=>setAgeH(Number(e.target.value))} className="glass-range" />
              </div>
              <div style={{ background:'rgba(236,72,153,0.07)', border:'1px solid rgba(236,72,153,0.2)', borderRadius:12, padding:'0.75rem' }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'0.5rem' }}>
                  <label style={{ fontSize:'0.72rem', fontWeight:700, color:'#F9A8D4', textTransform:'uppercase' }}>Madame : {ageF} ans</label>
                  <span style={{ fontSize:'0.72rem', color:'var(--text-muted)' }}>Exp. {getEsperance(ageF,'F')} ans</span>
                </div>
                <input type="range" min="0" max="100" value={ageF} onChange={e=>setAgeF(Number(e.target.value))} className="glass-range" style={{ '--thumb-color':'#EC4899' } as any} />
              </div>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem' }}>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={()=>setSexeSolo('H')} style={{ ...btnToggle(sexeSolo==='H'), flex:1 }}>HOMME</button>
                <button onClick={()=>setSexeSolo('F')} style={{ ...btnToggle(sexeSolo==='F'), flex:1 }}>FEMME</button>
              </div>
              <input type="range" min="0" max="100" value={ageSolo} onChange={e=>setAgeSolo(Number(e.target.value))} className="glass-range" />
              <div style={{ display:'flex', justifyContent:'space-between' }}>
                <span style={{ fontWeight:700, color:'var(--text-primary)' }}>{ageSolo} ans</span>
                <span style={{ fontSize:'0.72rem', color:'var(--text-muted)' }}>Espérance : {getEsperance(ageSolo,sexeSolo)} ans</span>
              </div>
            </div>
          )}
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:'1.25rem' }}>
          <div className="glass-card" style={{ overflow:'hidden' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.875rem' }}>
              <thead>
                <tr style={{ background:'var(--bg-surface-md)', borderBottom:'1px solid var(--border-subtle)' }}>
                  <th style={{ padding:'0.75rem 1rem', textAlign:'left', fontSize:'0.7rem', fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em' }}>Origine</th>
                  <th style={{ padding:'0.75rem 1rem', textAlign:'center', fontSize:'0.7rem', fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em' }}>Nue-Propriété (Transmis)</th>
                  <th style={{ padding:'0.75rem 1rem', textAlign:'center', fontSize:'0.7rem', fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em' }}>Usufruit (Retenu)</th>
                </tr>
              </thead>
              <tbody>
                {typeDossier === 'couple' ? (
                  <>
                    <tr style={{ borderBottom:'1px solid var(--border-subtle)' }}>
                      <td style={{ padding:'0.75rem 1rem', fontWeight:700, color:'#93C5FD' }}>Monsieur</td>
                      <td style={{ padding:'0.75rem 1rem', textAlign:'center', fontWeight:700, color:'var(--text-primary)', fontSize:'1.1rem' }}>{fmt(calculs.h.np)} €</td>
                      <td style={{ padding:'0.75rem 1rem', textAlign:'center', color:'var(--text-secondary)' }}>{fmt(calculs.h.u)} € ({Math.round(calculs.h.pct)}%)</td>
                    </tr>
                    <tr style={{ borderBottom:'1px solid var(--border-subtle)' }}>
                      <td style={{ padding:'0.75rem 1rem', fontWeight:700, color:'#F9A8D4' }}>Madame</td>
                      <td style={{ padding:'0.75rem 1rem', textAlign:'center', fontWeight:700, color:'var(--text-primary)', fontSize:'1.1rem' }}>{fmt(calculs.f.np)} €</td>
                      <td style={{ padding:'0.75rem 1rem', textAlign:'center', color:'var(--text-secondary)' }}>{fmt(calculs.f.u)} € ({Math.round(calculs.f.pct)}%)</td>
                    </tr>
                  </>
                ) : (
                  <tr style={{ borderBottom:'1px solid var(--border-subtle)' }}>
                    <td style={{ padding:'0.75rem 1rem', fontWeight:700, fontSize:'0.72rem', textTransform:'uppercase', color:'var(--text-secondary)' }}>Titulaire Unique</td>
                    <td style={{ padding:'0.75rem 1rem', textAlign:'center', fontWeight:700, color:'var(--text-primary)', fontSize:'1.1rem' }}>{fmt(calculs.h.np)} €</td>
                    <td style={{ padding:'0.75rem 1rem', textAlign:'center', color:'var(--text-secondary)' }}>{fmt(calculs.h.u)} € ({Math.round(calculs.h.pct)}%)</td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr style={{ background: methode==='fiscal' ? 'rgba(99,102,241,0.2)' : 'rgba(59,130,246,0.2)', borderTop:'1px solid var(--border-glass)' }}>
                  <td style={{ padding:'0.75rem 1rem', fontWeight:700, fontSize:'0.75rem', textTransform:'uppercase', color:'var(--text-secondary)' }}>Total NP à transmettre</td>
                  <td style={{ padding:'0.75rem 1rem', textAlign:'center', fontWeight:900, fontSize:'1.4rem', color:'var(--accent-emerald)' }}>{fmt(calculs.total.np)} €</td>
                  <td style={{ padding:'0.75rem 1rem', textAlign:'center', color:'var(--text-muted)' }}>{fmt(calculs.total.u)} €</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="glass-card" style={{ padding:'1.5rem', border: resteTaxable===0 ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(245,158,11,0.3)', background: resteTaxable===0 ? 'rgba(16,185,129,0.05)' : 'rgba(245,158,11,0.05)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.5rem' }}>
              <h3 style={{ margin:0, fontWeight:700, color:'var(--text-primary)', fontSize:'1rem' }}>Simulation des Droits de Mutation</h3>
              <span style={{ fontSize:'0.65rem', fontWeight:700, background:'var(--bg-surface-md)', border:'1px solid var(--border-glass)', padding:'0.25rem 0.6rem', borderRadius:999, color:'var(--text-muted)', letterSpacing:'0.06em', textTransform:'uppercase' }}>Art. 779-I et 777 du CGI</span>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'2rem' }}>
              <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem' }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.8rem' }}>
                  <span style={{ color:'var(--text-muted)' }}>Abattement ({typeDossier==='couple'?'2 parents':'1 parent'} × {nbEnfants} enfant{nbEnfants>1?'s':''})</span>
                  <span style={{ fontWeight:700, color:'var(--accent-emerald)' }}>−{fmt(abTotal)} €</span>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.8rem', borderTop:'1px solid var(--border-subtle)', paddingTop:'0.5rem' }}>
                  <span style={{ color:'var(--text-secondary)' }}>Assiette taxable totale</span>
                  <span style={{ fontWeight:700, color:'var(--text-primary)' }}>{fmt(resteTaxable)} €</span>
                </div>
                <div style={{ background:'var(--bg-surface-md)', border:'1px solid var(--border-glass)', borderRadius:10, padding:'0.75rem' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.75rem' }}>
                    <span style={{ color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em' }}>Part taxable / enfant</span>
                    <span style={{ fontWeight:700, color:'var(--text-primary)' }}>{fmt(partEnfant)} €</span>
                  </div>
                </div>
              </div>
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'var(--bg-surface)', border:'1px solid var(--border-glass)', borderRadius:12, padding:'1.25rem' }}>
                <span style={{ fontSize:'0.65rem', fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'0.5rem' }}>Droits à payer / enfant</span>
                <span style={{ fontSize:'2.5rem', fontWeight:900, color: droitsEnfant===0 ? 'var(--accent-emerald)' : 'var(--accent-amber)', fontFamily:'var(--font-display)' }}>
                  {droitsEnfant===0 ? '0 €' : `${fmt(droitsEnfant)} €`}
                </span>
                {droitsEnfant > 0
                  ? <p style={{ fontSize:'0.72rem', color:'var(--text-muted)', marginTop:'0.5rem', textAlign:'center' }}>Soit {fmt(droitsEnfant*nbEnfants)} € au total</p>
                  : <p style={{ fontSize:'0.72rem', color:'var(--accent-emerald)', marginTop:'0.5rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em' }}>Franchise de droits</p>}
              </div>
            </div>
          </div>
          <div style={{ padding:'0.75rem 1rem', border:'1px dashed var(--border-glass)', borderRadius:10, fontSize:'0.78rem', color:'var(--text-muted)', fontStyle:'italic', lineHeight:1.6 }}>
            {methode==='fiscal'
              ? "L'évaluation fiscale (Art. 669 CGI) est obligatoire pour le calcul des droits. Elle suit un barème fixe par tranches d'âge de 10 ans."
              : "L'évaluation économique utilise l'espérance de vie réelle (INSEE 2019) pour estimer la valeur de marché réelle du patrimoine démembré."}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   ONGLET 2 — Comparateur fiscal / économique
══════════════════════════════════════════════ */
function ComparateurChart({ age, sexe, rend, taux }: { age:number; sexe:'H'|'F'; rend:number; taux:number }) {
  const AGES = [20,25,30,35,40,45,50,55,60,65,70,75,80,85,90];
  const W=560, H=180, PL=32, PR=12, PT=10, PB=20;
  const iW = W - PL - PR, iH = H - PT - PB;
  const tx = (a: number) => PL + (a-20)/70*iW;
  const ty = (p: number) => PT + iH - p/100*iH;
  const toPath = (pts:{x:number;y:number}[]) => pts.map((p,i)=>`${i?'L':'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const fPts = AGES.map(a=>({ x:tx(a), y:ty(getFiscalPctU(a)) }));
  const ePts = AGES.map(a=>({ x:tx(a), y:ty(getEconoPctU(a,sexe,rend,taux)) }));
  const cx = tx(age);
  return (
    <div style={{ overflowX:'auto' }}>
      <svg width={W} height={H+4} style={{ display:'block', maxWidth:'100%' }}>
        {[0,25,50,75,100].map(p=>(
          <g key={p}>
            <line x1={PL} x2={W-PR} y1={ty(p)} y2={ty(p)} stroke="rgba(255,255,255,0.06)" strokeWidth={1}/>
            <text x={PL-4} y={ty(p)+4} textAnchor="end" fontSize={9} fill="rgba(255,255,255,0.3)">{p}%</text>
          </g>
        ))}
        {AGES.filter((_,i)=>i%2===0).map(a=>(
          <text key={a} x={tx(a)} y={H+2} textAnchor="middle" fontSize={9} fill="rgba(255,255,255,0.3)">{a}</text>
        ))}
        <line x1={cx} x2={cx} y1={PT} y2={H-PB} stroke="rgba(239,68,68,0.4)" strokeWidth={1} strokeDasharray="3,3"/>
        <path d={toPath(fPts)} fill="none" stroke="#6366F1" strokeWidth={2.5} strokeLinejoin="round"/>
        <path d={toPath(ePts)} fill="none" stroke="#10B981" strokeWidth={2.5} strokeLinejoin="round" strokeDasharray="6,3"/>
        <circle cx={cx} cy={ty(getFiscalPctU(age))} r={5} fill="#6366F1" stroke="white" strokeWidth={1.5}/>
        <circle cx={cx} cy={ty(getEconoPctU(age,sexe,rend,taux))} r={5} fill="#10B981" stroke="white" strokeWidth={1.5}/>
      </svg>
      <div style={{ display:'flex', gap:'1.5rem', marginTop:'0.5rem', flexWrap:'wrap' }}>
        {[['#6366F1','Fiscal (art. 669)',''],['#10B981','Économique (DCF)','dashed'],['#EF4444',`Âge actuel (${age} ans)`,'dot']].map(([c,l,t],i)=>(
          <div key={i} style={{ display:'flex', alignItems:'center', gap:'0.4rem', fontSize:'0.72rem', color:'var(--text-muted)' }}>
            {t==='dot'
              ? <span style={{ display:'inline-block', width:8, height:8, borderRadius:'50%', background:c }}/>
              : <span style={{ display:'inline-block', width:20, height:0, border:`2px ${t||'solid'} ${c}` }}/>}
            {l}
          </div>
        ))}
      </div>
    </div>
  );
}

function TabComparateur() {
  const [prixPP, setPrixPP] = useState<number>(500000);
  const [age, setAge]       = useState<number>(65);
  const [sexe, setSexe]     = useState<'H'|'F'>('H');
  const [rend, setRend]     = useState<number>(4);
  const [taux, setTaux]     = useState<number>(3);

  const c = useMemo(() => {
    const fPct = getFiscalPctU(age);
    const ePct = getEconoPctU(age, sexe, rend, taux);
    const fU = prixPP * fPct / 100;
    const eU = prixPP * ePct / 100;
    return { fPct, ePct, fU, fNP: prixPP-fU, eU, eNP: prixPP-eU, ecart: eU-fU };
  }, [prixPP, age, sexe, rend, taux]);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'1.5rem' }}>
      <div className="glass-card" style={{ padding:'1.25rem' }}>
        <h3 style={{ margin:'0 0 1rem', fontSize:'0.75rem', fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em' }}>Paramètres</h3>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', gap:'1rem' }}>
          <div>
            <label className="field-label">Valeur pleine propriété (€)</label>
            <input type="number" value={prixPP} onChange={e=>setPrixPP(Number(e.target.value))} className="glass-input" />
          </div>
          <div>
            <label className="field-label">Âge de l'usufruitier : {age} ans</label>
            <input type="range" min="20" max="95" value={age} onChange={e=>setAge(Number(e.target.value))} className="glass-range" />
            <div style={{ fontSize:'0.72rem', color:'var(--text-muted)', marginTop:'0.25rem' }}>Espérance : {getEsperance(age,sexe)} ans</div>
          </div>
          <div>
            <label className="field-label">Sexe</label>
            <div style={{ display:'flex', gap:4, background:'var(--bg-surface)', border:'1px solid var(--border-glass)', borderRadius:10, padding:4 }}>
              <button onClick={()=>setSexe('H')} style={btnToggle(sexe==='H')}>HOMME</button>
              <button onClick={()=>setSexe('F')} style={btnToggle(sexe==='F')}>FEMME</button>
            </div>
          </div>
          <div>
            <label className="field-label">Rendement net — {rend}%</label>
            <input type="range" min="0" max="10" step="0.5" value={rend} onChange={e=>setRend(Number(e.target.value))} className="glass-range" />
          </div>
          <div>
            <label className="field-label">Taux actualisation — {taux}%</label>
            <input type="range" min="0" max="8" step="0.5" value={taux} onChange={e=>setTaux(Number(e.target.value))} className="glass-range" />
          </div>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
        <div className="glass-card" style={{ padding:'1.5rem', border:'1px solid rgba(99,102,241,0.3)', background:'rgba(99,102,241,0.05)' }}>
          <div style={{ fontSize:'0.65rem', fontWeight:700, color:'#A5B4FC', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:'1rem' }}>Méthode fiscale — Art. 669 CGI</div>
          <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem' }}>
            <div>
              <div style={{ fontSize:'0.72rem', color:'var(--text-muted)' }}>Usufruit</div>
              <div style={{ fontSize:'2rem', fontWeight:900, color:'#6366F1', fontFamily:'var(--font-display)' }}>{Math.round(c.fPct)}%</div>
              <div style={{ fontWeight:700, color:'var(--text-primary)' }}>{fmt(c.fU)} €</div>
            </div>
            <hr style={{ border:'none', borderTop:'1px solid var(--border-subtle)' }}/>
            <div>
              <div style={{ fontSize:'0.72rem', color:'var(--text-muted)' }}>Nue-propriété</div>
              <div style={{ fontSize:'2rem', fontWeight:900, color:'var(--accent-emerald)', fontFamily:'var(--font-display)' }}>{100-Math.round(c.fPct)}%</div>
              <div style={{ fontWeight:700, color:'var(--text-primary)' }}>{fmt(c.fNP)} €</div>
            </div>
          </div>
        </div>
        <div className="glass-card" style={{ padding:'1.5rem', border:'1px solid rgba(16,185,129,0.3)', background:'rgba(16,185,129,0.05)' }}>
          <div style={{ fontSize:'0.65rem', fontWeight:700, color:'#6EE7B7', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:'1rem' }}>Méthode économique — DCF / Aulagnier</div>
          <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem' }}>
            <div>
              <div style={{ fontSize:'0.72rem', color:'var(--text-muted)' }}>Usufruit</div>
              <div style={{ fontSize:'2rem', fontWeight:900, color:'#10B981', fontFamily:'var(--font-display)' }}>{c.ePct.toFixed(1)}%</div>
              <div style={{ fontWeight:700, color:'var(--text-primary)' }}>{fmt(c.eU)} €</div>
            </div>
            <hr style={{ border:'none', borderTop:'1px solid var(--border-subtle)'}}/>
            <div>
              <div style={{ fontSize:'0.72rem', color:'var(--text-muted)' }}>Nue-propriété</div>
              <div style={{ fontSize:'2rem', fontWeight:900, color:'var(--accent-emerald)', fontFamily:'var(--font-display)' }}>{(100-c.ePct).toFixed(1)}%</div>
              <div style={{ fontWeight:700, color:'var(--text-primary)' }}>{fmt(c.eNP)} €</div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding:'1rem 1.25rem', background: c.ecart > 0 ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.08)', border:`1px solid ${c.ecart>0?'rgba(16,185,129,0.25)':'rgba(245,158,11,0.25)'}`, borderRadius:12, display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'1rem' }}>
        <div>
          <div style={{ fontSize:'0.72rem', fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'0.25rem' }}>Écart usufruit (éco − fiscal)</div>
          <div style={{ fontSize:'1.8rem', fontWeight:900, fontFamily:'var(--font-display)', color: c.ecart>0?'#10B981':'#F59E0B' }}>
            {c.ecart>=0?'+':''}{fmt(c.ecart)} €
          </div>
        </div>
        <div style={{ fontSize:'0.85rem', color:'var(--text-secondary)' }}>
          Méthode la + favorable pour l'UF :&nbsp;
          <strong style={{ color: c.ecart>0?'#10B981':'#6366F1' }}>{c.ecart>0?'ÉCONOMIQUE':'FISCALE'}</strong>
        </div>
      </div>

      <div className="glass-card" style={{ padding:'1.5rem' }}>
        <h3 style={{ margin:'0 0 1rem', fontSize:'0.75rem', fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em' }}>Évolution du % usufruit selon l'âge (20 → 90 ans)</h3>
        <ComparateurChart age={age} sexe={sexe} rend={rend} taux={taux}/>
      </div>

      <div style={{ padding:'1rem 1.25rem', background:'rgba(99,102,241,0.06)', border:'1px solid rgba(99,102,241,0.2)', borderRadius:12, fontSize:'0.82rem', color:'var(--text-secondary)', lineHeight:1.7 }}>
        <strong style={{ color:'#A5B4FC' }}>Note pédagogique — </strong>
        La méthode fiscale (art. 669 CGI) applique des forfaits par tranche d'âge de 10 ans. La méthode économique (DCF, J. Aulagnier) actualise les flux futurs selon le rendement et l'espérance de vie réelle (tables INSEE). L'écart peut être significatif selon le rendement du bien et l'âge de l'usufruitier.
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   ONGLET 3 — Donation en démembrement
══════════════════════════════════════════════ */
function TabDonation() {
  const [valeur, setValeur]       = useState<number>(500000);
  const [ageDon, setAgeDon]       = useState<number>(65);
  const [sexeDon, setSexeDon]     = useState<'H'|'F'>('H');
  const [methode, setMethode]     = useState<'fiscal'|'economique'>('fiscal');
  const [lien, setLien]           = useState<string>('enfant');
  const [nbDon, setNbDon]         = useState<number>(1);
  const [antMontant, setAntMontant] = useState<number>(0);
  const [rend, setRend]           = useState<number>(4);
  const [taux, setTaux]           = useState<number>(3);

  const c = useMemo(() => {
    const pctUF = methode === 'fiscal' ? getFiscalPctU(ageDon) : getEconoPctU(ageDon, sexeDon, rend, taux);
    const pctNP = (100 - pctUF) / 100;
    const valNP = valeur * pctNP;
    const ab = Math.max(0, (ABATTEMENTS[lien] || 0) * nbDon - antMontant);
    const bar = getBareme(lien);
    const droitsA = calculerDroits(Math.max(0, valeur - ab), bar);
    const droitsB = calculerDroits(Math.max(0, valNP   - ab), bar);
    return { pctNP: pctNP*100, valNP, ab, droitsA, droitsB, economie: droitsA-droitsB };
  }, [valeur, ageDon, sexeDon, methode, lien, nbDon, antMontant, rend, taux]);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'1.5rem' }}>
      <div className="glass-card" style={{ padding:'1.25rem' }}>
        <h3 style={{ margin:'0 0 1rem', fontSize:'0.75rem', fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em' }}>Paramètres</h3>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(195px, 1fr))', gap:'1rem' }}>
          <div>
            <label className="field-label">Valeur du bien (€)</label>
            <input type="number" value={valeur} onChange={e=>setValeur(Number(e.target.value))} className="glass-input" style={{ fontWeight:700, fontSize:'1.1rem' }}/>
          </div>
          <div>
            <label className="field-label">Âge du donateur : {ageDon} ans</label>
            <input type="range" min="20" max="95" value={ageDon} onChange={e=>setAgeDon(Number(e.target.value))} className="glass-range"/>
            <div style={{ fontSize:'0.72rem', color:'var(--text-muted)', marginTop:'0.25rem' }}>Espérance : {getEsperance(ageDon,sexeDon)} ans</div>
          </div>
          <div>
            <label className="field-label">Sexe du donateur</label>
            <div style={{ display:'flex', gap:4, background:'var(--bg-surface)', border:'1px solid var(--border-glass)', borderRadius:10, padding:4 }}>
              <button onClick={()=>setSexeDon('H')} style={btnToggle(sexeDon==='H')}>HOMME</button>
              <button onClick={()=>setSexeDon('F')} style={btnToggle(sexeDon==='F')}>FEMME</button>
            </div>
          </div>
          <div>
            <label className="field-label">Méthode NP</label>
            <div style={{ display:'flex', gap:4, background:'var(--bg-surface)', border:'1px solid var(--border-glass)', borderRadius:10, padding:4 }}>
              <button onClick={()=>setMethode('fiscal')} style={btnToggle(methode==='fiscal')}>FISCAL</button>
              <button onClick={()=>setMethode('economique')} style={btnToggle(methode==='economique')}>ÉCONOMIQUE</button>
            </div>
          </div>
          <div>
            <label className="field-label">Lien de parenté du donataire</label>
            <select value={lien} onChange={e=>setLien(e.target.value)} className="glass-select">
              <option value="enfant">Enfant — 100 000 €</option>
              <option value="petit_enfant">Petit-enfant — 31 865 €</option>
              <option value="frere_soeur">Frère/Sœur — 15 932 €</option>
              <option value="neveu_niece">Neveu/Nièce — 7 967 €</option>
              <option value="tiers">Tiers — 1 594 €</option>
            </select>
          </div>
          <div>
            <label className="field-label">Nombre de donateurs</label>
            <div style={{ display:'flex', gap:4, background:'var(--bg-surface)', border:'1px solid var(--border-glass)', borderRadius:10, padding:4 }}>
              <button onClick={()=>setNbDon(1)} style={btnToggle(nbDon===1)}>1 PARENT</button>
              <button onClick={()=>setNbDon(2)} style={btnToggle(nbDon===2)}>2 PARENTS</button>
            </div>
          </div>
          <div>
            <label className="field-label">Donation antérieure &lt; 15 ans (€)</label>
            <input type="number" value={antMontant} min="0" onChange={e=>setAntMontant(Number(e.target.value))} className="glass-input"/>
          </div>
          {methode === 'economique' && (
            <>
              <div>
                <label className="field-label">Rendement net — {rend}%</label>
                <input type="range" min="0" max="10" step="0.5" value={rend} onChange={e=>setRend(Number(e.target.value))} className="glass-range"/>
              </div>
              <div>
                <label className="field-label">Taux actualisation — {taux}%</label>
                <input type="range" min="0" max="8" step="0.5" value={taux} onChange={e=>setTaux(Number(e.target.value))} className="glass-range"/>
              </div>
            </>
          )}
        </div>
      </div>

      <div style={{ padding:'0.6rem 1rem', background:'rgba(99,102,241,0.07)', border:'1px solid rgba(99,102,241,0.2)', borderRadius:10, fontSize:'0.82rem', color:'var(--text-secondary)', display:'flex', gap:'2rem', flexWrap:'wrap' }}>
        <span>% Nue-propriété : <strong style={{ color:'#A5B4FC' }}>{c.pctNP.toFixed(1)}%</strong></span>
        <span>Valeur NP : <strong style={{ color:'#A5B4FC' }}>{fmt(c.valNP)} €</strong></span>
        <span>Abattement applicable : <strong style={{ color:'#10B981' }}>{fmt(c.ab)} €</strong></span>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
        <div className="glass-card" style={{ padding:'1.5rem', border:'1px solid rgba(245,158,11,0.3)', background:'rgba(245,158,11,0.04)' }}>
          <div style={{ fontSize:'0.65rem', fontWeight:700, color:'#FCD34D', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:'1rem' }}>Option A — Pleine propriété</div>
          <div style={{ display:'flex', flexDirection:'column', gap:'0.6rem', fontSize:'0.85rem' }}>
            {[['Assiette',fmt(valeur)+' €'],['Abattement','−'+fmt(c.ab)+' €'],['Base taxable',fmt(Math.max(0,valeur-c.ab))+' €'],['Droits DMTG',fmt(c.droitsA)+' €']].map(([k,v],i)=>(
              <div key={i} style={{ display:'flex', justifyContent:'space-between', ...(i===2?{borderTop:'1px solid var(--border-subtle)',paddingTop:'0.5rem'}:{}) }}>
                <span style={{ color:'var(--text-muted)' }}>{k}</span>
                <span style={{ fontWeight:700, color: i===1?'#10B981':i===3?'#F59E0B':'inherit' }}>{v}</span>
              </div>
            ))}
            <div style={{ display:'flex', justifyContent:'space-between', borderTop:'1px solid var(--border-subtle)', paddingTop:'0.5rem' }}>
              <span style={{ color:'var(--text-muted)', fontSize:'0.78rem' }}>Net transmis</span>
              <span style={{ fontWeight:900, fontSize:'1.3rem', color:'var(--text-primary)', fontFamily:'var(--font-display)' }}>{fmt(valeur-c.droitsA)} €</span>
            </div>
          </div>
        </div>
        <div className="glass-card" style={{ padding:'1.5rem', border:'1px solid rgba(16,185,129,0.35)', background:'rgba(16,185,129,0.05)' }}>
          <div style={{ fontSize:'0.65rem', fontWeight:700, color:'#6EE7B7', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:'1rem' }}>Option B — Nue-propriété</div>
          <div style={{ display:'flex', flexDirection:'column', gap:'0.6rem', fontSize:'0.85rem' }}>
            {[['Assiette (NP)',fmt(c.valNP)+' €'],['Abattement','−'+fmt(c.ab)+' €'],['Base taxable',fmt(Math.max(0,c.valNP-c.ab))+' €'],['Droits DMTG',fmt(c.droitsB)+' €']].map(([k,v],i)=>(
              <div key={i} style={{ display:'flex', justifyContent:'space-between', ...(i===2?{borderTop:'1px solid var(--border-subtle)',paddingTop:'0.5rem'}:{}) }}>
                <span style={{ color:'var(--text-muted)' }}>{k}</span>
                <span style={{ fontWeight:700, color: i===1?'#10B981':i===3?'#10B981':'inherit' }}>{v}</span>
              </div>
            ))}
            <div style={{ display:'flex', justifyContent:'space-between', borderTop:'1px solid var(--border-subtle)', paddingTop:'0.5rem' }}>
              <span style={{ color:'var(--text-muted)', fontSize:'0.78rem' }}>Net transmis (à terme)</span>
              <span style={{ fontWeight:900, fontSize:'1.3rem', color:'#10B981', fontFamily:'var(--font-display)' }}>{fmt(valeur)} €</span>
            </div>
          </div>
        </div>
      </div>

      {c.economie > 0 && (
        <div style={{ padding:'1rem 1.5rem', background:'rgba(16,185,129,0.08)', border:'1px solid rgba(16,185,129,0.3)', borderRadius:12, display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'1rem' }}>
          <div>
            <div style={{ fontSize:'0.72rem', color:'#6EE7B7', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'0.25rem' }}>Économie en choisissant la nue-propriété</div>
            <div style={{ fontSize:'2rem', fontWeight:900, color:'#10B981', fontFamily:'var(--font-display)' }}>{fmt(c.economie)} €</div>
          </div>
          <div style={{ fontSize:'0.82rem', color:'var(--text-secondary)' }}>
            Valeur transmise au décès : <strong style={{ color:'#10B981' }}>{fmt(valeur)} €</strong><br/>
            <span style={{ fontSize:'0.72rem', color:'var(--text-muted)' }}>sans droits supplémentaires (extinction usufruit)</span>
          </div>
        </div>
      )}

      <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
        {[
          ['⚠️','rgba(239,68,68,0.07)','rgba(239,68,68,0.2)','#F87171','Art. 751 CGI : si le donateur décède dans les 3 mois → présomption de fictivité (réintégration dans la succession)'],
          ['✅','rgba(16,185,129,0.07)','rgba(16,185,129,0.2)','','Donation effectuée > 3 mois avant le décès → donation sécurisée'],
          ['💡','rgba(99,102,241,0.07)','rgba(99,102,241,0.2)','','Le donateur conserve les revenus (loyers, dividendes) pendant toute la durée de l\'usufruit'],
          ['💡','rgba(99,102,241,0.07)','rgba(99,102,241,0.2)','','La nue-propriété s\'apprécie sans fiscalité — extinction de l\'usufruit = consolidation hors droits de succession'],
        ].map(([ico,bg,bdr,c2,txt],i)=>(
          <div key={i} style={{ padding:'0.6rem 0.875rem', background:bg, border:`1px solid ${bdr}`, borderRadius:8, fontSize:'0.82rem', color:'var(--text-secondary)' }}>
            {ico} {c2 ? <strong style={{ color:c2 }}>{txt}</strong> : txt}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   ONGLET 4 — Usufruit successif
══════════════════════════════════════════════ */
function TabSuccessif() {
  const [valeur, setValeur]     = useState<number>(500000);
  const [agePere, setAgePere]   = useState<number>(68);
  const [sexePere, setSexePere] = useState<'H'|'F'>('H');
  const [ageConj, setAgeConj]   = useState<number>(65);
  const [sexeConj, setSexeConj] = useState<'H'|'F'>('F');
  const [nbEnf, setNbEnf]       = useState<number>(2);
  const [methode, setMethode]   = useState<'fiscal'|'economique'>('fiscal');
  const [rend, setRend]         = useState<number>(4);
  const [taux, setTaux]         = useState<number>(3);

  const c = useMemo(() => {
    const pctUF1 = (methode === 'fiscal' ? getFiscalPctU(agePere) : getEconoPctU(agePere, sexePere, rend, taux)) / 100;
    const UF1 = valeur * pctUF1;
    let UFsucc: number;
    if (methode === 'fiscal') {
      const pctConj = getFiscalPctU(ageConj) / 100;
      UFsucc = Math.max(0, valeur * pctConj - UF1);
    } else {
      const i = taux / 100;
      const r = rend / 100;
      const espP = getEsperance(agePere, sexePere);
      const espC = getEsperance(ageConj, sexeConj);
      const flux = valeur * r;
      UFsucc = i === 0
        ? Math.max(0, flux * (espC - espP))
        : Math.max(0, flux * (Math.pow(1+i,-espP) - Math.pow(1+i,-espC)) / i);
    }
    const NP = Math.max(0, valeur - UF1 - UFsucc);
    const partEnf = nbEnf > 0 ? NP / nbEnf : NP;
    const droitsEnf = calculerDroits(Math.max(0, partEnf - 100000), BAREMES_LD);
    return {
      pctUF1: pctUF1*100, UF1,
      pctUFsucc: UFsucc/valeur*100, UFsucc,
      pctNP: NP/valeur*100, NP, partEnf, droitsEnf,
    };
  }, [valeur, agePere, sexePere, ageConj, sexeConj, nbEnf, methode, rend, taux]);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'1.5rem' }}>
      <div style={{ padding:'1rem 1.25rem', background:'rgba(99,102,241,0.07)', border:'1px solid rgba(99,102,241,0.25)', borderRadius:12, fontSize:'0.85rem', color:'var(--text-secondary)', lineHeight:1.7 }}>
        <strong style={{ color:'#A5B4FC' }}>Usufruit successif — </strong>
        Permet de constituer un 2ème usufruit qui s'exercera après l'extinction du 1er. Fréquemment utilisé pour protéger le conjoint du donateur tout en transmettant la nue-propriété aux enfants.
      </div>

      <div className="glass-card" style={{ padding:'1.25rem' }}>
        <h3 style={{ margin:'0 0 1rem', fontSize:'0.75rem', fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em' }}>Paramètres</h3>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(195px, 1fr))', gap:'1rem', marginBottom:'1rem' }}>
          <div>
            <label className="field-label">Valeur pleine propriété (€)</label>
            <input type="number" value={valeur} onChange={e=>setValeur(Number(e.target.value))} className="glass-input" style={{ fontWeight:700, fontSize:'1.1rem' }}/>
          </div>
          <div>
            <label className="field-label">Méthode</label>
            <div style={{ display:'flex', gap:4, background:'var(--bg-surface)', border:'1px solid var(--border-glass)', borderRadius:10, padding:4 }}>
              <button onClick={()=>setMethode('fiscal')} style={btnToggle(methode==='fiscal')}>FISCAL</button>
              <button onClick={()=>setMethode('economique')} style={btnToggle(methode==='economique')}>ÉCONOMIQUE</button>
            </div>
          </div>
          <div>
            <label className="field-label">Nombre d'enfants (NP)</label>
            <input type="number" value={nbEnf} min="1" onChange={e=>setNbEnf(Math.max(1,Number(e.target.value)))} className="glass-input"/>
          </div>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
          <div style={{ background:'rgba(59,130,246,0.07)', border:'1px solid rgba(59,130,246,0.2)', borderRadius:12, padding:'1rem' }}>
            <div style={{ fontSize:'0.72rem', fontWeight:700, color:'#93C5FD', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'0.75rem' }}>Donateur — UF 1er rang</div>
            <label className="field-label">Âge : {agePere} ans</label>
            <input type="range" min="20" max="95" value={agePere} onChange={e=>setAgePere(Number(e.target.value))} className="glass-range"/>
            <div style={{ display:'flex', gap:4, marginTop:'0.5rem', background:'var(--bg-surface)', border:'1px solid var(--border-glass)', borderRadius:10, padding:4 }}>
              <button onClick={()=>setSexePere('H')} style={btnToggle(sexePere==='H')}>HOMME</button>
              <button onClick={()=>setSexePere('F')} style={btnToggle(sexePere==='F')}>FEMME</button>
            </div>
            <div style={{ fontSize:'0.72rem', color:'var(--text-muted)', marginTop:'0.5rem' }}>Espérance : {getEsperance(agePere,sexePere)} ans</div>
          </div>
          <div style={{ background:'rgba(236,72,153,0.07)', border:'1px solid rgba(236,72,153,0.2)', borderRadius:12, padding:'1rem' }}>
            <div style={{ fontSize:'0.72rem', fontWeight:700, color:'#F9A8D4', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'0.75rem' }}>Conjoint — UF successif</div>
            <label className="field-label">Âge : {ageConj} ans</label>
            <input type="range" min="20" max="95" value={ageConj} onChange={e=>setAgeConj(Number(e.target.value))} className="glass-range" style={{ '--thumb-color':'#EC4899' } as any}/>
            <div style={{ display:'flex', gap:4, marginTop:'0.5rem', background:'var(--bg-surface)', border:'1px solid var(--border-glass)', borderRadius:10, padding:4 }}>
              <button onClick={()=>setSexeConj('H')} style={btnToggle(sexeConj==='H')}>HOMME</button>
              <button onClick={()=>setSexeConj('F')} style={btnToggle(sexeConj==='F')}>FEMME</button>
            </div>
            <div style={{ fontSize:'0.72rem', color:'var(--text-muted)', marginTop:'0.5rem' }}>Espérance : {getEsperance(ageConj,sexeConj)} ans</div>
          </div>
        </div>
        {methode === 'economique' && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem', marginTop:'1rem', background:'rgba(59,130,246,0.07)', border:'1px solid rgba(59,130,246,0.2)', borderRadius:12, padding:'1rem' }}>
            <div>
              <label className="field-label" style={{ color:'#93C5FD' }}>Rendement net — {rend}%</label>
              <input type="range" min="0" max="10" step="0.5" value={rend} onChange={e=>setRend(Number(e.target.value))} className="glass-range"/>
            </div>
            <div>
              <label className="field-label" style={{ color:'#93C5FD' }}>Taux actualisation — {taux}%</label>
              <input type="range" min="0" max="8" step="0.5" value={taux} onChange={e=>setTaux(Number(e.target.value))} className="glass-range"/>
            </div>
          </div>
        )}
      </div>

      <div className="glass-card" style={{ padding:'1.5rem' }}>
        <h3 style={{ margin:'0 0 1.25rem', fontSize:'0.75rem', fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em' }}>Répartition des droits</h3>
        <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem' }}>
          {[
            { label:'Donateur — Usufruit 1er rang', sub:`${agePere} ans · ${sexePere==='H'?'Homme':'Femme'}`, pct:c.pctUF1, val:c.UF1, clr:'#6366F1', bg:'rgba(59,130,246,0.07)', bdr:'rgba(59,130,246,0.2)' },
            { label:'Conjoint — Usufruit successif', sub:`${ageConj} ans · ${sexeConj==='H'?'Homme':'Femme'}`, pct:c.pctUFsucc, val:c.UFsucc, clr:'#EC4899', bg:'rgba(236,72,153,0.07)', bdr:'rgba(236,72,153,0.2)' },
            { label:'Enfants — Nue-propriété', sub:`${nbEnf} enfant${nbEnf>1?'s':''} · ${fmt(c.partEnf)} € / enfant`, pct:c.pctNP, val:c.NP, clr:'#10B981', bg:'rgba(16,185,129,0.07)', bdr:'rgba(16,185,129,0.2)' },
          ].map((row,i)=>(
            <div key={i} style={{ background:row.bg, border:`1px solid ${row.bdr}`, borderRadius:12, padding:'1rem', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'0.5rem' }}>
              <div>
                <div style={{ fontSize:'0.72rem', fontWeight:700, color:row.clr, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'0.2rem' }}>{row.label}</div>
                <div style={{ fontSize:'0.82rem', color:'var(--text-muted)' }}>{row.sub}</div>
                {i===1 && c.UFsucc===0 && <div style={{ fontSize:'0.72rem', color:'#F87171', marginTop:'0.2rem' }}>⚠️ UF successif = 0 (méthode fiscale : conjoint plus âgé que le donateur)</div>}
              </div>
              <div style={{ textAlign:'right' }}>
                <div style={{ fontSize:'1.8rem', fontWeight:900, color:row.clr, fontFamily:'var(--font-display)' }}>{row.pct.toFixed(1)}%</div>
                <div style={{ fontWeight:700, color:'var(--text-primary)' }}>{fmt(row.val)} €</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop:'1rem', height:12, borderRadius:999, overflow:'hidden', display:'flex', background:'var(--bg-surface)' }}>
          <div style={{ width:`${c.pctUF1}%`, background:'#6366F1', transition:'width 0.3s' }}/>
          <div style={{ width:`${c.pctUFsucc}%`, background:'#EC4899', transition:'width 0.3s' }}/>
          <div style={{ flex:1, background:'#10B981' }}/>
        </div>
      </div>

      <div className="glass-card" style={{ padding:'1.5rem' }}>
        <h3 style={{ margin:'0 0 1rem', fontSize:'0.75rem', fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em' }}>Fiscalité de la donation</h3>
        <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem', fontSize:'0.85rem', color:'var(--text-secondary)' }}>
          <div style={{ padding:'0.6rem 0.875rem', background:'rgba(16,185,129,0.07)', border:'1px solid rgba(16,185,129,0.2)', borderRadius:8 }}>
            ✅ <strong>Droits sur la nue-propriété uniquement</strong> — abattement 100 000 € / enfant<br/>
            <span style={{ fontSize:'0.78rem', color:'var(--text-muted)' }}>
              Droits estimés / enfant : <strong style={{ color:'#F59E0B' }}>{fmt(c.droitsEnf)} €</strong>{' '}
              (part NP {fmt(c.partEnf)} € · abattement 100 000 €)
            </span>
          </div>
          <div style={{ padding:'0.6rem 0.875rem', background:'rgba(16,185,129,0.07)', border:'1px solid rgba(16,185,129,0.2)', borderRadius:8 }}>
            ✅ <strong>UF successif au conjoint → exonération totale DMTG</strong><br/>
            <span style={{ fontSize:'0.78rem', color:'var(--text-muted)' }}>Donation entre époux exonérée (art. 790E CGI · Ch. mixte Cass. 8 juin 2007)</span>
          </div>
        </div>
      </div>

      <div className="glass-card" style={{ padding:'1.5rem' }}>
        <h3 style={{ margin:'0 0 1.25rem', fontSize:'0.75rem', fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em' }}>Schéma chronologique</h3>
        <div style={{ display:'flex', alignItems:'flex-start', overflowX:'auto', paddingBottom:'0.5rem' }}>
          {[
            { t:'Aujourd\'hui', sub:'Donateur jouit du bien (UF 1er rang)', c:'#6366F1' },
            { t:'Décès donateur', sub:'Conjoint entre en jouissance (UF successif)', c:'#EC4899' },
            { t:'Décès conjoint', sub:'Enfants → Pleine propriété (consolidation)', c:'#10B981' },
          ].map((s,i,arr)=>(
            <div key={i} style={{ display:'flex', alignItems:'flex-start', flex: i<arr.length-1?1:'none' }}>
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', minWidth:130 }}>
                <div style={{ width:12, height:12, borderRadius:'50%', background:s.c, marginBottom:'0.5rem', flexShrink:0 }}/>
                <div style={{ fontSize:'0.78rem', fontWeight:700, color:s.c, textAlign:'center' }}>{s.t}</div>
                <div style={{ fontSize:'0.68rem', color:'var(--text-muted)', textAlign:'center', marginTop:'0.25rem', maxWidth:110, lineHeight:1.4 }}>{s.sub}</div>
              </div>
              {i<arr.length-1 && (
                <div style={{ flex:1, height:2, background:`linear-gradient(to right,${s.c},${arr[i+1].c})`, margin:'5px 4px 0', minWidth:24 }}/>
              )}
            </div>
          ))}
        </div>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
        {[
          ['⚠️','rgba(239,68,68,0.07)','rgba(239,68,68,0.2)','L\'UF successif est une donation → acte authentique obligatoire (C. civ. art. 931)'],
          ['⚠️','rgba(239,68,68,0.07)','rgba(239,68,68,0.2)','Entre époux : librement révocable (art. 1096 c.civ.) · Entre autres personnes : irrévocable (art. 894 c.civ.)'],
          ['⚠️','rgba(239,68,68,0.07)','rgba(239,68,68,0.2)','En cas de cession : les 3 parties (UF1 + UF successif + NP) doivent consentir et ont droit à une fraction du prix'],
          ['💡','rgba(99,102,241,0.07)','rgba(99,102,241,0.2)','Fiscalité entre époux : donation conjoint exonérée DMTG (art. 790E CGI)'],
        ].map(([ico,bg,bdr,txt],i)=>(
          <div key={i} style={{ padding:'0.6rem 0.875rem', background:bg, border:`1px solid ${bdr}`, borderRadius:8, fontSize:'0.82rem', color:'var(--text-secondary)' }}>
            {ico} {txt}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   PAGE PRINCIPALE
══════════════════════════════════════════════ */
export default function DemembrementPage() {
  const [tab, setTab]         = useState<TabId>('evaluation');
  const [baremes, setBaremes] = useState<any>(null);

  useEffect(() => {
    fetch('/baremes.json').then(r=>r.json()).then(setBaremes);
  }, []);

  return (
    <AuthGate>
      <main style={{ maxWidth:1100, margin:'0 auto', padding:'0 1.25rem 3rem' }}>
        <div style={{ marginBottom:'2rem' }}>
          <Link href="/civil" style={{ fontSize:'0.85rem', color:'var(--text-muted)', textDecoration:'none' }}>← Pôle civil</Link>
          <h1 style={{ fontFamily:'var(--font-display)', fontSize:'clamp(1.8rem, 4vw, 2.8rem)', fontWeight:600, color:'var(--text-primary)', letterSpacing:'-0.02em', lineHeight:1.1, margin:'0.5rem 0 0.25rem' }}>
            Démembrement de propriété
          </h1>
          <p style={{ color:'var(--text-secondary)', fontSize:'1rem', maxWidth:560, margin:0 }}>
            Évaluation · Comparateur fiscal/économique · Donation · Usufruit successif
          </p>
        </div>

        <div style={{ display:'flex', gap:2, marginBottom:'1.75rem', borderBottom:'1px solid rgba(255,255,255,0.08)', overflowX:'auto' }}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{
              padding:'0.625rem 1.125rem', background:'transparent', border:'none', cursor:'pointer',
              fontSize:'0.875rem', fontWeight: tab===t.id?700:400, whiteSpace:'nowrap',
              color: tab===t.id ? '#6366F1' : 'var(--text-secondary)',
              borderBottom:`2px solid ${tab===t.id?'#6366F1':'transparent'}`,
              marginBottom:-1, transition:'color 0.15s',
            }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        <div className="glass-card" style={{ padding:'1.75rem' }}>
          {tab==='evaluation'  && <TabEvaluation baremes={baremes}/>}
          {tab==='comparateur' && <TabComparateur/>}
          {tab==='donation'    && <TabDonation/>}
          {tab==='successif'   && <TabSuccessif/>}
        </div>
      </main>
    </AuthGate>
  );
}
