'use client'

import { Ascendant, Enfant, FrereSoeur } from '@/lib/types'

export interface ArbreGenealogieProps {
  ageClient: number
  ageConjoint?: number
  situationFamiliale: string
  enfants: Enfant[]
  ascendants: Ascendant[]
  freresSoeurs: FrereSoeur[]
  enfantsGardeAlternee: string[]
}

// ── Palette ──────────────────────────────────────────────────
const C = {
  vivant:    { fill: 'rgba(59,130,246,0.18)',  stroke: 'rgba(59,130,246,0.55)',  text: '#93c5fd' },
  decede:    { fill: 'rgba(100,100,110,0.18)', stroke: 'rgba(120,120,130,0.4)', text: '#9ca3af' },
  client:    { fill: 'rgba(99,102,241,0.22)',  stroke: 'rgba(99,102,241,0.7)',  text: '#c4b5fd' },
  conjoint:  { fill: 'rgba(201,168,76,0.18)',  stroke: 'rgba(201,168,76,0.55)', text: '#fcd34d' },
  commun:    { fill: 'rgba(16,185,129,0.15)',  stroke: 'rgba(16,185,129,0.5)',  text: '#6ee7b7' },
  clientSeul:{ fill: 'rgba(99,102,241,0.12)',  stroke: 'rgba(99,102,241,0.4)',  text: '#a5b4fc' },
  conjSeul:  { fill: 'rgba(201,168,76,0.12)',  stroke: 'rgba(201,168,76,0.38)', text: '#fde68a' },
  sibling:   { fill: 'rgba(244,114,182,0.13)', stroke: 'rgba(244,114,182,0.4)', text: '#f9a8d4' },
  line:      'rgba(255,255,255,0.22)',
  lineDash:  'rgba(255,255,255,0.13)',
}

const RW = 90   // rect width
const RH = 42   // rect height
const RX = 7    // border radius
const PAD = 16  // horizontal padding between rects

interface Rect { x: number; y: number; w: number; h: number; label: string; sub?: string
  fill: string; stroke: string; textColor: string; dash?: boolean; badge?: string }

function Rct({ r }: { r: Rect }) {
  return (
    <g>
      <rect
        x={r.x} y={r.y} width={r.w} height={r.h} rx={RX}
        fill={r.fill} stroke={r.stroke} strokeWidth={1.5}
        strokeDasharray={r.dash ? '4 3' : undefined}
      />
      <text x={r.x + r.w / 2} y={r.y + (r.sub ? 15 : RH / 2 + 4)}
        textAnchor="middle" fill={r.textColor} fontSize={11} fontWeight={600}
        style={{ fontFamily: 'inherit' }}>
        {r.label}
      </text>
      {r.sub && (
        <text x={r.x + r.w / 2} y={r.y + 28}
          textAnchor="middle" fill={r.textColor} fontSize={9} opacity={0.75}
          style={{ fontFamily: 'inherit' }}>
          {r.sub}
        </text>
      )}
      {r.badge && (
        <g>
          <circle cx={r.x + r.w - 5} cy={r.y + 5} r={7} fill="#f97316" />
          <text x={r.x + r.w - 5} y={r.y + 9} textAnchor="middle" fill="#fff" fontSize={8} fontWeight={700}>
            {r.badge}
          </text>
        </g>
      )}
    </g>
  )
}

function Line({ x1, y1, x2, y2, dash }: { x1:number; y1:number; x2:number; y2:number; dash?: boolean }) {
  const mx = (x1 + x2) / 2
  const my = (y1 + y2) / 2
  return (
    <path
      d={`M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}`}
      fill="none" stroke={dash ? C.lineDash : C.line}
      strokeWidth={1.2} strokeDasharray={dash ? '4 3' : undefined}
    />
  )
}

function libelleAscendant(lien: Ascendant['lien']) {
  const MAP: Record<string, string> = {
    pere_client:           'Père ♂', mere_client:           'Mère ♀',
    pere_conjoint:         'Père ♂', mere_conjoint:         'Mère ♀',
    pere_adoptif_client:   'P.adopt ♂', mere_adoptif_client:   'M.adopt ♀',
    pere_adoptif_conjoint: 'P.adopt ♂', mere_adoptif_conjoint: 'M.adopt ♀',
    autre: 'Autre',
  }
  return MAP[lien] ?? lien
}

function libelleEnfantSituation(s: Enfant['situation']) {
  return { mineur: 'mineur', etudiant: 'étudiant', actif: 'actif', marie: 'marié' }[s] ?? s
}

export default function ArbreGenealogie({
  ageClient, ageConjoint, situationFamiliale, enfants,
  ascendants, freresSoeurs, enfantsGardeAlternee,
}: ArbreGenealogieProps) {

  const hasConjoint = ['marie','pacse','concubin'].includes(situationFamiliale)

  // ── Séparer les ascendants par branche ──────────────────
  const gpClient = ascendants.filter(a =>
    (a.lien === 'pere_client' || a.lien === 'mere_client') &&
    a.situation === 'decede' && a.grand_parent_vivant === true
  )
  const gpConjoint = ascendants.filter(a =>
    (a.lien === 'pere_conjoint' || a.lien === 'mere_conjoint') &&
    a.situation === 'decede' && a.grand_parent_vivant === true
  )
  const parentsClient   = ascendants.filter(a => a.lien === 'pere_client' || a.lien === 'mere_client' || a.lien === 'pere_adoptif_client' || a.lien === 'mere_adoptif_client')
  const parentsConjoint = ascendants.filter(a => a.lien === 'pere_conjoint' || a.lien === 'mere_conjoint' || a.lien === 'pere_adoptif_conjoint' || a.lien === 'mere_adoptif_conjoint')

  const showGP = gpClient.length > 0 || gpConjoint.length > 0
  const showParentsConj = hasConjoint && parentsConjoint.length > 0

  // ── Layout vertical ──────────────────────────────────────
  const LEVEL_H = 80  // px entre niveaux
  let currentY = 20
  const levels: number[] = []
  if (showGP)              { levels.push(currentY); currentY += LEVEL_H }
  const parentLevelY = currentY; currentY += LEVEL_H
  const coupleLevelY = currentY; currentY += LEVEL_H
  const siblingLevelY = freresSoeurs.length > 0 ? currentY : -1
  if (freresSoeurs.length > 0) currentY += LEVEL_H
  const childLevelY = enfants.length > 0 ? currentY : -1
  if (enfants.length > 0) currentY += LEVEL_H
  const svgH = currentY + 24
  void levels

  // ── Calcul largeur totale ────────────────────────────────
  const gpCount = gpClient.length + gpConjoint.length
  const parentCount = parentsClient.length + (showParentsConj ? parentsConjoint.length : 0)
  const sibCount = freresSoeurs.length
  const childCount = enfants.length
  // Éléments au couple : client + (conjoint)
  const coupleCount = hasConjoint ? 2 : 1

  const maxItems = Math.max(gpCount, parentCount, coupleCount + sibCount + 2, childCount, 1)
  const svgW = Math.max(500, maxItems * (RW + PAD) + PAD * 4)

  // ── Helpers de positionnement ────────────────────────────
  function spreadX(count: number, center: number): number[] {
    if (count === 0) return []
    const total = count * RW + (count - 1) * PAD
    const startX = center - total / 2
    return Array.from({ length: count }, (_, i) => startX + i * (RW + PAD))
  }

  const cx = svgW / 2  // center X

  // ── Couple ───────────────────────────────────────────────
  const coupleXs = hasConjoint
    ? [cx - RW - PAD / 2, cx + PAD / 2]
    : [cx - RW / 2]

  const clientRect: Rect = {
    x: coupleXs[0], y: coupleLevelY, w: RW, h: RH,
    label: `Client ${ageClient}a`,
    fill: C.client.fill, stroke: C.client.stroke, textColor: C.client.text,
  }
  const conjointRect: Rect | null = hasConjoint ? {
    x: coupleXs[1], y: coupleLevelY, w: RW, h: RH,
    label: `Conjoint ${ageConjoint ?? '?'}a`,
    fill: C.conjoint.fill, stroke: C.conjoint.stroke, textColor: C.conjoint.text,
  } : null

  const clientCX = clientRect.x + RW / 2
  const clientCY = clientRect.y + RH / 2
  const conjCX   = conjointRect ? conjointRect.x + RW / 2 : clientCX
  const coupleCX = hasConjoint ? (clientCX + conjCX) / 2 : clientCX

  // lien entre le couple
  const sfLabel: Record<string,string> = { marie:'Marié·e·s', pacse:'Pacsé·e·s', concubin:'Concubins' }
  const liensCouple = sfLabel[situationFamiliale]

  // ── Grands-parents ───────────────────────────────────────
  const gpLevelY = showGP ? levels[0] : parentLevelY - LEVEL_H
  const gpClientXs  = spreadX(gpClient.length,  cx * 0.45)
  const gpConjointXs = spreadX(gpConjoint.length, cx * 1.55)

  const gpRects: Rect[] = [
    ...gpClient.map((a, i) => ({
      x: gpClientXs[i], y: gpLevelY, w: RW, h: RH,
      label: libelleAscendant(a.lien),
      sub: a.age ? `${a.age} ans` : 'GP',
      fill: C.vivant.fill, stroke: C.vivant.stroke, textColor: C.vivant.text,
    })),
    ...gpConjoint.map((a, i) => ({
      x: gpConjointXs[i], y: gpLevelY, w: RW, h: RH,
      label: libelleAscendant(a.lien),
      sub: a.age ? `${a.age} ans` : 'GP',
      fill: C.vivant.fill, stroke: C.vivant.stroke, textColor: C.vivant.text,
    })),
  ]

  // ── Parents ──────────────────────────────────────────────
  const parClientXs   = spreadX(parentsClient.length,   cx * 0.45)
  const parConjointXs = spreadX(parentsConjoint.length, cx * 1.55)

  const parentRects: Rect[] = [
    ...parentsClient.map((a, i) => ({
      x: parClientXs[i], y: parentLevelY, w: RW, h: RH,
      label: libelleAscendant(a.lien),
      sub: a.situation === 'decede' ? '✝' : (a.age ? `${a.age} ans` : undefined),
      fill: a.situation === 'decede' ? C.decede.fill : C.vivant.fill,
      stroke: a.situation === 'decede' ? C.decede.stroke : C.vivant.stroke,
      textColor: a.situation === 'decede' ? C.decede.text : C.vivant.text,
      dash: a.lien.includes('adoptif'),
    })),
    ...(showParentsConj ? parentsConjoint.map((a, i) => ({
      x: parConjointXs[i], y: parentLevelY, w: RW, h: RH,
      label: libelleAscendant(a.lien),
      sub: a.situation === 'decede' ? '✝' : (a.age ? `${a.age} ans` : undefined),
      fill: a.situation === 'decede' ? C.decede.fill : C.vivant.fill,
      stroke: a.situation === 'decede' ? C.decede.stroke : C.vivant.stroke,
      textColor: a.situation === 'decede' ? C.decede.text : C.vivant.text,
      dash: a.lien.includes('adoptif'),
    })) : []),
  ]

  // ── Frères/sœurs ─────────────────────────────────────────
  const leftSiblings  = freresSoeurs.slice(0, Math.ceil(freresSoeurs.length / 2))
  const rightSiblings = freresSoeurs.slice(Math.ceil(freresSoeurs.length / 2))

  const leftSibXs  = leftSiblings.length > 0
    ? spreadX(leftSiblings.length, clientRect.x - (leftSiblings.length * (RW + PAD)) / 2 - PAD / 2)
    : []
  const rightSibXs = rightSiblings.length > 0
    ? spreadX(rightSiblings.length, (conjointRect?.x ?? clientRect.x + RW + PAD) + RW + (rightSiblings.length * (RW + PAD)) / 2 + PAD / 2)
    : []

  const sibRects: Rect[] = [
    ...leftSiblings.map((fs, i) => ({
      x: leftSibXs[i], y: siblingLevelY, w: RW, h: RH,
      label: fs.alias || `F/S ${i + 1}`,
      sub: `${fs.age} ans`,
      fill: C.sibling.fill, stroke: C.sibling.stroke, textColor: C.sibling.text,
      badge: fs.situation === 'handicape' ? 'H' : undefined,
    })),
    ...rightSiblings.map((fs, i) => ({
      x: rightSibXs[i], y: siblingLevelY, w: RW, h: RH,
      label: fs.alias || `F/S ${leftSiblings.length + i + 1}`,
      sub: `${fs.age} ans`,
      fill: C.sibling.fill, stroke: C.sibling.stroke, textColor: C.sibling.text,
      badge: fs.situation === 'handicape' ? 'H' : undefined,
    })),
  ]

  // ── Enfants ───────────────────────────────────────────────
  const childXs = spreadX(childCount, coupleCX)
  const childRects: Rect[] = enfants.map((e, i) => {
    const col = e.lien === 'client_seul' ? C.clientSeul : e.lien === 'conjoint_seul' ? C.conjSeul : C.commun
    return {
      x: childXs[i], y: childLevelY, w: RW, h: RH,
      label: `Enfant ${i + 1}`,
      sub: `${e.age}a · ${libelleEnfantSituation(e.situation)}`,
      fill: col.fill, stroke: col.stroke, textColor: col.text,
      dash: e.lien === 'conjoint_seul',
    }
  })

  return (
    <svg
      viewBox={`0 0 ${svgW} ${svgH}`}
      style={{ width: '100%', height: 'auto', display: 'block' }}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* ── Lignes GP → Parents ─────────────────── */}
      {showGP && gpRects.map((gp, i) => {
        const targetParents = i < gpClient.length ? parentRects.slice(0, parentsClient.length) : parentRects.slice(parentsClient.length)
        return targetParents.map((par, j) => (
          <Line key={`gp-par-${i}-${j}`}
            x1={gp.x + RW / 2} y1={gp.y + RH}
            x2={par.x + RW / 2} y2={par.y} />
        ))
      })}

      {/* ── Lignes Parents → Client/Conjoint ────── */}
      {parentsClient.map((_, i) => (
        <Line key={`par-cl-${i}`}
          x1={parentRects[i].x + RW / 2} y1={parentRects[i].y + RH}
          x2={clientCX} y2={clientRect.y}
          dash={parentsClient[i].lien.includes('adoptif')} />
      ))}
      {showParentsConj && parentsConjoint.map((a, i) => (
        <Line key={`par-conj-${i}`}
          x1={parentRects[parentsClient.length + i].x + RW / 2}
          y1={parentRects[parentsClient.length + i].y + RH}
          x2={conjCX} y2={conjointRect!.y}
          dash={a.lien.includes('adoptif')} />
      ))}

      {/* ── Lien couple ─────────────────────────── */}
      {hasConjoint && conjointRect && (
        <>
          <line
            x1={clientRect.x + RW} y1={clientCY}
            x2={conjointRect.x}    y2={clientCY}
            stroke={C.line} strokeWidth={1.5} />
          <text x={coupleCX} y={clientCY - 6}
            textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize={9}>
            {liensCouple}
          </text>
        </>
      )}

      {/* ── Lignes couple → Enfants ─────────────── */}
      {childRects.map((cr, i) => (
        <Line key={`couple-child-${i}`}
          x1={coupleCX} y1={coupleLevelY + RH}
          x2={cr.x + RW / 2} y2={cr.y}
          dash={cr.dash} />
      ))}

      {/* ── Lignes client → frères/sœurs ────────── */}
      {sibRects.map((sr, i) => (
        <Line key={`sib-${i}`}
          x1={clientCX} y1={siblingLevelY}
          x2={sr.x + RW / 2} y2={sr.y + RH / 2} />
      ))}

      {/* ── Render rects ────────────────────────── */}
      {gpRects.map((r, i)      => <Rct key={`gp-${i}`}      r={r} />)}
      {parentRects.map((r, i)  => <Rct key={`par-${i}`}     r={r} />)}
      <Rct r={clientRect} />
      {conjointRect && <Rct r={conjointRect} />}
      {sibRects.map((r, i)     => <Rct key={`sib-r-${i}`}   r={r} />)}
      {childRects.map((r, i)   => <Rct key={`child-r-${i}`} r={r} />)}

      {/* ── Légende enfants ─────────────────────── */}
      {enfants.length > 0 && (
        <g transform={`translate(8, ${svgH - 16})`}>
          {[
            { fill: C.commun.fill,     stroke: C.commun.stroke,     label: 'Commun' },
            { fill: C.clientSeul.fill, stroke: C.clientSeul.stroke, label: 'Client seul' },
            { fill: C.conjSeul.fill,   stroke: C.conjSeul.stroke,   label: 'Conjoint seul' },
          ].map((leg, i) => (
            <g key={i} transform={`translate(${i * 110}, 0)`}>
              <rect width={10} height={10} rx={2} fill={leg.fill} stroke={leg.stroke} strokeWidth={1} />
              <text x={14} y={9} fill="rgba(255,255,255,0.45)" fontSize={9}>{leg.label}</text>
            </g>
          ))}
        </g>
      )}
    </svg>
  )
}
