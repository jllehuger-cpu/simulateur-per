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

const RW = 90    // rect width
const RH = 42    // rect height
const RX = 7     // border radius
const PAD = 16   // horizontal gap between rects
const LEVEL_H = 80  // vertical gap between levels

interface Rect {
  x: number; y: number; w: number; h: number
  label: string; sub?: string
  fill: string; stroke: string; textColor: string
  dash?: boolean; badge?: string
}

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

function libelleAscendant(lien: Ascendant['lien']) {
  const MAP: Record<string, string> = {
    pere_client:           'Père ♂',    mere_client:           'Mère ♀',
    pere_conjoint:         'Père ♂',    mere_conjoint:         'Mère ♀',
    pere_adoptif_client:   'P.adopt ♂', mere_adoptif_client:   'M.adopt ♀',
    pere_adoptif_conjoint: 'P.adopt ♂', mere_adoptif_conjoint: 'M.adopt ♀',
    autre: 'Autre',
  }
  return MAP[lien] ?? lien
}

function libelleEnfantSituation(s: Enfant['situation']) {
  return { mineur: 'mineur', etudiant: 'étudiant', actif: 'actif', marie: 'marié' }[s] ?? s
}

/** Centre `count` rects of width RW+PAD around `center`. Returns left-edge X for each. */
function spreadX(count: number, center: number): number[] {
  if (count === 0) return []
  const total = count * RW + (count - 1) * PAD
  const startX = center - total / 2
  return Array.from({ length: count }, (_, i) => startX + i * (RW + PAD))
}

export default function ArbreGenealogie({
  ageClient, ageConjoint, situationFamiliale, enfants,
  ascendants, freresSoeurs,
}: ArbreGenealogieProps) {

  const hasConjoint = ['marie', 'pacse', 'concubin'].includes(situationFamiliale)

  // ── Séparer les ascendants par branche ──────────────────────
  const gpClient = ascendants.filter(a =>
    (a.lien === 'pere_client' || a.lien === 'mere_client') &&
    a.situation === 'decede' && a.grand_parent_vivant === true
  )
  const gpConjoint = ascendants.filter(a =>
    (a.lien === 'pere_conjoint' || a.lien === 'mere_conjoint') &&
    a.situation === 'decede' && a.grand_parent_vivant === true
  )
  const parentsClient = ascendants.filter(a =>
    a.lien === 'pere_client' || a.lien === 'mere_client' ||
    a.lien === 'pere_adoptif_client' || a.lien === 'mere_adoptif_client'
  )
  const parentsConjoint = ascendants.filter(a =>
    a.lien === 'pere_conjoint' || a.lien === 'mere_conjoint' ||
    a.lien === 'pere_adoptif_conjoint' || a.lien === 'mere_adoptif_conjoint'
  )

  const showGP = gpClient.length > 0 || gpConjoint.length > 0
  const showParentsConj = hasConjoint && parentsConjoint.length > 0

  // ── Layout vertical (Y levels) ───────────────────────────────
  let curY = 20
  const gpLevelY     = showGP ? curY : -1
  if (showGP) curY += LEVEL_H
  const parentLevelY = curY; curY += LEVEL_H
  // Niveau 3 : frères/sœurs + client + conjoint — TOUS au même Y
  const coupleLevelY = curY; curY += LEVEL_H
  const childLevelY  = enfants.length > 0 ? curY : -1
  if (enfants.length > 0) curY += LEVEL_H
  const svgH = curY + 24

  // ── Niveau 3 : disposition horizontale complète ──────────────
  // Ordre dans la rangée : [F/S gauches…, Client, Conjoint?, F/S droits…]
  const coupleCount = hasConjoint ? 2 : 1

  // Séparer les F/S par branche (rétro-compat : lien absent → 'client')
  const sibsClient   = freresSoeurs.filter(fs => (fs.lien ?? 'client') === 'client')
  const sibsConjoint = freresSoeurs.filter(fs => fs.lien === 'conjoint')
  const leftCount    = sibsClient.length
  const rightCount   = hasConjoint ? sibsConjoint.length : 0

  const rowItemCount = leftCount + coupleCount + rightCount
  const rowW         = rowItemCount * RW + Math.max(0, rowItemCount - 1) * PAD
  const svgW         = Math.max(500, rowW + PAD * 8)
  const cx           = svgW / 2
  const rowStartX    = cx - rowW / 2

  // Positions X : [F/S client…, Client, Conjoint?, F/S conjoint…]
  const sibClientXs   = Array.from({ length: leftCount  }, (_, i) => rowStartX + i * (RW + PAD))
  const clientX       = rowStartX + leftCount * (RW + PAD)
  const conjX         = hasConjoint ? clientX + RW + PAD : -1
  const sibConjStartX = hasConjoint ? conjX + RW + PAD : -1
  const sibConjointXs = Array.from({ length: rightCount }, (_, i) => sibConjStartX + i * (RW + PAD))

  // ── Géométrie du couple ──────────────────────────────────────
  const clientCX = clientX + RW / 2
  const clientCY = coupleLevelY + RH / 2
  const conjCX   = hasConjoint ? conjX + RW / 2 : clientCX
  const coupleCX = hasConjoint ? (clientCX + conjCX) / 2 : clientCX

  // ── Positions des parents : au-dessus du centre de leur groupe d'enfants ──
  // Parents du client → au-dessus du groupe {F/S client + client}
  const clientGroupMinX    = sibClientXs.length > 0 ? sibClientXs[0] : clientX
  const clientGroupCenterX = (clientGroupMinX + clientX + RW) / 2
  // Parents du conjoint → au-dessus du groupe {conjoint + F/S conjoint}
  const conjGroupMaxX      = sibConjointXs.length > 0 ? sibConjointXs[sibConjointXs.length - 1] + RW : (hasConjoint ? conjX + RW : cx)
  const conjGroupCenterX   = hasConjoint ? (conjX + conjGroupMaxX) / 2 : cx

  const parClientXs   = spreadX(parentsClient.length,   clientGroupCenterX)
  const parConjointXs = spreadX(parentsConjoint.length, conjGroupCenterX)

  // ── Grands-parents : au-dessus de leurs parents ──────────────
  const parClientCenter = parClientXs.length > 0
    ? (parClientXs[0] + parClientXs[parClientXs.length - 1] + RW) / 2
    : clientGroupCenterX
  const parConjCenter = parConjointXs.length > 0
    ? (parConjointXs[0] + parConjointXs[parConjointXs.length - 1] + RW) / 2
    : conjGroupCenterX

  const gpClientXs   = spreadX(gpClient.length,   parClientCenter)
  const gpConjointXs = spreadX(gpConjoint.length, parConjCenter)

  // ── Construction des tableaux de rects ──────────────────────
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

  const clientRect: Rect = {
    x: clientX, y: coupleLevelY, w: RW, h: RH,
    label: `Client ${ageClient}a`,
    fill: C.client.fill, stroke: C.client.stroke, textColor: C.client.text,
  }
  const conjointRect: Rect | null = hasConjoint ? {
    x: conjX, y: coupleLevelY, w: RW, h: RH,
    label: `Conjoint ${ageConjoint ?? '?'}a`,
    fill: C.conjoint.fill, stroke: C.conjoint.stroke, textColor: C.conjoint.text,
  } : null

  // Frères/sœurs — séparés par branche, même Y que le client (coupleLevelY)
  const sibRects: Rect[] = [
    ...sibsClient.map((fs, i) => ({
      x: sibClientXs[i], y: coupleLevelY, w: RW, h: RH,
      label: fs.alias || `F/S ${i + 1}`,
      sub: `${fs.age} ans`,
      fill: C.sibling.fill, stroke: C.sibling.stroke, textColor: C.sibling.text,
      badge: fs.situation === 'handicape' ? 'H' : undefined,
    })),
    ...sibsConjoint.map((fs, i) => ({
      x: sibConjointXs[i], y: coupleLevelY, w: RW, h: RH,
      label: fs.alias || `F/S ${i + 1}`,
      sub: `${fs.age} ans`,
      fill: C.sibling.fill, stroke: C.sibling.stroke, textColor: C.sibling.text,
      badge: fs.situation === 'handicape' ? 'H' : undefined,
    })),
  ]

  // Enfants
  const childXs    = spreadX(enfants.length, coupleCX)
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

  // ── Bus Y : ligne horizontale de jonction entre parents et enfants (niveau 3) ──
  // Situé à mi-chemin entre le bas du niveau parents et le haut du niveau 3
  const busY = Math.round((parentLevelY + RH + coupleLevelY) / 2)

  // Centres X côté client : F/S client + client
  const clientSideChildCenters = [
    ...sibClientXs.map(x => x + RW / 2),
    clientX + RW / 2,
  ]
  // Centres X des parents côté client
  const parentClientCenters = parClientXs.map(x => x + RW / 2)

  // Centres X côté conjoint : conjoint + F/S conjoint
  const conjChildCenters = hasConjoint
    ? [conjCX, ...sibConjointXs.map(x => x + RW / 2)]
    : []
  const parentConjCenters = parConjointXs.map(x => x + RW / 2)

  const sfLabel: Record<string, string> = { marie: 'Marié·e·s', pacse: 'Pacsé·e·s', concubin: 'Concubins' }
  const liensCouple = sfLabel[situationFamiliale]

  return (
    <svg
      viewBox={`0 0 ${svgW} ${svgH}`}
      style={{ width: '100%', height: 'auto', display: 'block' }}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* ── GP → Parents (lignes directes) ─────────────────────── */}
      {showGP && gpRects.map((gp, i) => {
        const isClientGP = i < gpClient.length
        const targets = isClientGP
          ? parentRects.slice(0, parentsClient.length)
          : parentRects.slice(parentsClient.length)
        return targets.map((par, j) => (
          <line key={`gp-par-${i}-${j}`}
            x1={gp.x + RW / 2} y1={gp.y + RH}
            x2={par.x + RW / 2} y2={par.y}
            stroke={C.line} strokeWidth={1.2} />
        ))
      })}

      {/* ── Bus parents client → frères/sœurs + client ─────────── */}
      {parentsClient.length > 0 && clientSideChildCenters.length > 0 && (() => {
        const all   = [...parentClientCenters, ...clientSideChildCenters]
        const minX  = Math.min(...all)
        const maxX  = Math.max(...all)
        return (
          <>
            {/* Verticales : chaque parent descend jusqu'au bus */}
            {parentClientCenters.map((pcx, i) => (
              <line key={`par-vbus-${i}`}
                x1={pcx} y1={parentLevelY + RH} x2={pcx} y2={busY}
                stroke={parentsClient[i].lien.includes('adoptif') ? C.lineDash : C.line}
                strokeWidth={1.2}
                strokeDasharray={parentsClient[i].lien.includes('adoptif') ? '4 3' : undefined}
              />
            ))}
            {/* Barre horizontale du bus */}
            <line x1={minX} y1={busY} x2={maxX} y2={busY}
              stroke={C.line} strokeWidth={1.2} />
            {/* Verticales : bus descend vers chaque enfant (F/S + client) */}
            {clientSideChildCenters.map((ccx, i) => (
              <line key={`bus-child-${i}`}
                x1={ccx} y1={busY} x2={ccx} y2={coupleLevelY}
                stroke={C.line} strokeWidth={1.2} />
            ))}
          </>
        )
      })()}

      {/* ── Bus parents conjoint → conjoint ────────────────────── */}
      {showParentsConj && conjChildCenters.length > 0 && (() => {
        const all  = [...parentConjCenters, ...conjChildCenters]
        const minX = Math.min(...all)
        const maxX = Math.max(...all)
        return (
          <>
            {parentConjCenters.map((pcx, i) => (
              <line key={`par-conj-vbus-${i}`}
                x1={pcx} y1={parentLevelY + RH} x2={pcx} y2={busY}
                stroke={parentsConjoint[i].lien.includes('adoptif') ? C.lineDash : C.line}
                strokeWidth={1.2}
                strokeDasharray={parentsConjoint[i].lien.includes('adoptif') ? '4 3' : undefined}
              />
            ))}
            <line x1={minX} y1={busY} x2={maxX} y2={busY}
              stroke={C.line} strokeWidth={1.2} />
            {conjChildCenters.map((ccx, i) => (
              <line key={`bus-conj-child-${i}`}
                x1={ccx} y1={busY} x2={ccx} y2={coupleLevelY}
                stroke={C.line} strokeWidth={1.2} />
            ))}
          </>
        )
      })()}

      {/* ── Lien matrimonial ────────────────────────────────────── */}
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

      {/* ── Couple → Enfants (courbes de Bézier) ────────────────── */}
      {childRects.map((cr, i) => {
        const x1 = coupleCX
        const y1 = coupleLevelY + RH
        const x2 = cr.x + RW / 2
        const y2 = cr.y
        const my = (y1 + y2) / 2
        return (
          <path key={`child-line-${i}`}
            d={`M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}`}
            fill="none"
            stroke={cr.dash ? C.lineDash : C.line}
            strokeWidth={1.2}
            strokeDasharray={cr.dash ? '4 3' : undefined}
          />
        )
      })}

      {/* ── Rendu des rects ─────────────────────────────────────── */}
      {gpRects.map((r, i)     => <Rct key={`gp-${i}`}      r={r} />)}
      {parentRects.map((r, i) => <Rct key={`par-${i}`}     r={r} />)}
      <Rct r={clientRect} />
      {conjointRect && <Rct r={conjointRect} />}
      {sibRects.map((r, i)    => <Rct key={`sib-${i}`}     r={r} />)}
      {childRects.map((r, i)  => <Rct key={`child-${i}`}   r={r} />)}

      {/* ── Légende enfants ─────────────────────────────────────── */}
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
