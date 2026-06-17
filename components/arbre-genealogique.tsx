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

const C = {
  vivant:    { fill: 'rgba(59,130,246,0.18)',  stroke: 'rgba(59,130,246,0.55)',  text: '#93c5fd' },
  decede:    { fill: 'rgba(100,100,110,0.18)', stroke: 'rgba(120,120,130,0.4)', text: '#9ca3af' },
  client:    { fill: 'rgba(99,102,241,0.22)',  stroke: 'rgba(99,102,241,0.7)',  text: '#c4b5fd' },
  conjoint:  { fill: 'rgba(201,168,76,0.18)',  stroke: 'rgba(201,168,76,0.55)', text: '#fcd34d' },
  commun:    { fill: 'rgba(16,185,129,0.15)',  stroke: 'rgba(16,185,129,0.5)',  text: '#6ee7b7' },
  clientSeul:{ fill: 'rgba(99,102,241,0.12)',  stroke: 'rgba(99,102,241,0.4)',  text: '#a5b4fc' },
  conjSeul:  { fill: 'rgba(201,168,76,0.12)',  stroke: 'rgba(201,168,76,0.38)', text: '#fde68a' },
  sibling:   { fill: 'rgba(244,114,182,0.13)', stroke: 'rgba(244,114,182,0.4)', text: '#f9a8d4' },
  gp:        { fill: 'rgba(20,184,166,0.12)',  stroke: 'rgba(20,184,166,0.38)', text: '#5eead4' },
  gpDecede:  { fill: 'rgba(100,100,110,0.12)', stroke: 'rgba(120,120,130,0.32)', text: '#a1a1aa' },
  line:      'rgba(255,255,255,0.22)',
  lineDash:  'rgba(255,255,255,0.13)',
}

const RW = 90
const RH = 42
const RX = 7
const PAD = 16
const LEVEL_H = 80

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

const GP_LIENS = new Set([
  'gp_paternel_client', 'gm_paternelle_client',
  'gp_maternel_client', 'gm_maternelle_client',
  'gp_paternel_conjoint', 'gm_paternelle_conjoint',
  'gp_maternel_conjoint', 'gm_maternelle_conjoint',
])

// GP paternel = se connecte au père (pere_client / pere_adoptif_client)
const GP_PATERNAL_CLIENT  = new Set(['gp_paternel_client', 'gm_paternelle_client'])
const GP_MATERNAL_CLIENT  = new Set(['gp_maternel_client', 'gm_maternelle_client'])
const GP_PATERNAL_CONJOINT = new Set(['gp_paternel_conjoint', 'gm_paternelle_conjoint'])
const GP_MATERNAL_CONJOINT = new Set(['gp_maternel_conjoint', 'gm_maternelle_conjoint'])

function libelleAscendant(lien: Ascendant['lien']): string {
  const MAP: Record<string, string> = {
    pere_client:            'Père ♂',     mere_client:             'Mère ♀',
    pere_conjoint:          'Père ♂',     mere_conjoint:           'Mère ♀',
    pere_adoptif_client:    'P.adopt ♂',  mere_adoptif_client:     'M.adopt ♀',
    pere_adoptif_conjoint:  'P.adopt ♂',  mere_adoptif_conjoint:   'M.adopt ♀',
    gp_paternel_client:     'G-père ♂',   gm_paternelle_client:    'G-mère ♀',
    gp_maternel_client:     'G-père ♂',   gm_maternelle_client:    'G-mère ♀',
    gp_paternel_conjoint:   'G-père ♂',   gm_paternelle_conjoint:  'G-mère ♀',
    gp_maternel_conjoint:   'G-père ♂',   gm_maternelle_conjoint:  'G-mère ♀',
    autre: 'Autre',
  }
  return MAP[lien] ?? lien
}

function libelleEnfantSituation(s: Enfant['situation']) {
  return { mineur: 'mineur', etudiant: 'étudiant', actif: 'actif', marie: 'marié' }[s] ?? s
}

function spreadX(count: number, center: number): number[] {
  if (count === 0) return []
  const total = count * RW + (count - 1) * PAD
  return Array.from({ length: count }, (_, i) => center - total / 2 + i * (RW + PAD))
}

/** Pousse deux groupes de positions X pour qu'ils ne se chevauchent pas. */
function enforceGap(leftXs: number[], rightXs: number[]): [number[], number[]] {
  if (leftXs.length === 0 || rightXs.length === 0) return [leftXs, rightXs]
  const rightEdge = leftXs[leftXs.length - 1] + RW
  const leftEdge  = rightXs[0]
  if (rightEdge + PAD > leftEdge) {
    const push = Math.ceil((rightEdge + PAD - leftEdge) / 2)
    return [leftXs.map(x => x - push), rightXs.map(x => x + push)]
  }
  return [leftXs, rightXs]
}

export default function ArbreGenealogie({
  ageClient, ageConjoint, situationFamiliale, enfants,
  ascendants, freresSoeurs,
}: ArbreGenealogieProps) {

  const hasConjoint = ['marie', 'pacse', 'concubin'].includes(situationFamiliale)

  // ── Séparer parents et grands-parents ───────────────────────
  const parentsClient = ascendants.filter(a => !GP_LIENS.has(a.lien) && (
    a.lien === 'pere_client' || a.lien === 'mere_client' ||
    a.lien === 'pere_adoptif_client' || a.lien === 'mere_adoptif_client'
  ))
  const parentsConjoint = ascendants.filter(a => !GP_LIENS.has(a.lien) && (
    a.lien === 'pere_conjoint' || a.lien === 'mere_conjoint' ||
    a.lien === 'pere_adoptif_conjoint' || a.lien === 'mere_adoptif_conjoint'
  ))

  const gpPatClient   = ascendants.filter(a => GP_PATERNAL_CLIENT.has(a.lien))
  const gpMatClient   = ascendants.filter(a => GP_MATERNAL_CLIENT.has(a.lien))
  const gpPatConjoint = ascendants.filter(a => GP_PATERNAL_CONJOINT.has(a.lien))
  const gpMatConjoint = ascendants.filter(a => GP_MATERNAL_CONJOINT.has(a.lien))

  const showGP          = gpPatClient.length + gpMatClient.length + gpPatConjoint.length + gpMatConjoint.length > 0
  const showParentsConj = hasConjoint && parentsConjoint.length > 0

  // ── Y levels ─────────────────────────────────────────────────
  let curY = 20
  const gpLevelY     = showGP ? curY : -1
  if (showGP) curY += LEVEL_H
  const gpBusY       = showGP ? Math.round(curY - LEVEL_H * 0.45) : -1
  const parentLevelY = curY; curY += LEVEL_H
  const parentBusY   = Math.round(curY - LEVEL_H * 0.45)
  const coupleLevelY = curY; curY += LEVEL_H
  const childLevelY  = enfants.length > 0 ? curY : -1
  if (enfants.length > 0) curY += LEVEL_H
  const svgH = curY + 24

  // ── Couple row layout ────────────────────────────────────────
  const sibsClient    = freresSoeurs.filter(fs => (fs.lien ?? 'client') === 'client')
  const sibsConjoint  = freresSoeurs.filter(fs => fs.lien === 'conjoint')
  const leftCount     = sibsClient.length
  const rightCount    = hasConjoint ? sibsConjoint.length : 0
  const coupleCount   = hasConjoint ? 2 : 1

  const rowItemCount  = leftCount + coupleCount + rightCount
  const rowW          = rowItemCount * RW + Math.max(0, rowItemCount - 1) * PAD
  const cx            = Math.max(500, rowW + PAD * 8) / 2
  const rowStartX     = cx - rowW / 2

  const sibClientXs   = Array.from({ length: leftCount  }, (_, i) => rowStartX + i * (RW + PAD))
  const clientX       = rowStartX + leftCount * (RW + PAD)
  const conjX         = hasConjoint ? clientX + RW + PAD : -1
  const sibConjStartX = hasConjoint ? conjX + RW + PAD : -1
  const sibConjointXs = Array.from({ length: rightCount }, (_, i) => sibConjStartX + i * (RW + PAD))

  const clientCX = clientX + RW / 2
  const clientCY = coupleLevelY + RH / 2
  const conjCX   = hasConjoint ? conjX + RW / 2 : clientCX
  const coupleCX = hasConjoint ? (clientCX + conjCX) / 2 : clientCX

  // ── Positions parents ────────────────────────────────────────
  const clientGroupMinX    = sibClientXs.length > 0 ? sibClientXs[0] : clientX
  const clientGroupCenterX = (clientGroupMinX + clientX + RW) / 2
  const conjGroupMaxX      = sibConjointXs.length > 0 ? sibConjointXs[sibConjointXs.length - 1] + RW : (hasConjoint ? conjX + RW : cx)
  const conjGroupCenterX   = hasConjoint ? (conjX + conjGroupMaxX) / 2 : cx

  let parClientXs   = spreadX(parentsClient.length,   clientGroupCenterX)
  let parConjointXs = spreadX(parentsConjoint.length, conjGroupCenterX)
  ;[parClientXs, parConjointXs] = enforceGap(parClientXs, parConjointXs)

  // ── Positions grands-parents ─────────────────────────────────
  // Chaque groupe GP se positionne au-dessus du parent auquel il se rattache.
  // Paternel → père (lien pere_*), Maternel → mère (lien mere_*)
  const pereClientIdx  = parentsClient.findIndex(a => a.lien === 'pere_client'   || a.lien === 'pere_adoptif_client')
  const mereClientIdx  = parentsClient.findIndex(a => a.lien === 'mere_client'   || a.lien === 'mere_adoptif_client')
  const pereConjIdx    = parentsConjoint.findIndex(a => a.lien === 'pere_conjoint'  || a.lien === 'pere_adoptif_conjoint')
  const mereConjIdx    = parentsConjoint.findIndex(a => a.lien === 'mere_conjoint'  || a.lien === 'mere_adoptif_conjoint')

  const pereClientCX  = pereClientIdx >= 0 ? parClientXs[pereClientIdx]  + RW / 2 : clientGroupCenterX - (RW + PAD) / 2
  const mereClientCX  = mereClientIdx >= 0 ? parClientXs[mereClientIdx]  + RW / 2 : clientGroupCenterX + (RW + PAD) / 2
  const pereConjCX    = pereConjIdx   >= 0 ? parConjointXs[pereConjIdx]  + RW / 2 : conjGroupCenterX   - (RW + PAD) / 2
  const mereConjCX    = mereConjIdx   >= 0 ? parConjointXs[mereConjIdx]  + RW / 2 : conjGroupCenterX   + (RW + PAD) / 2

  let gpPatClientXs   = spreadX(gpPatClient.length,   pereClientCX)
  let gpMatClientXs   = spreadX(gpMatClient.length,   mereClientCX)
  let gpPatConjointXs = spreadX(gpPatConjoint.length, pereConjCX)
  let gpMatConjointXs = spreadX(gpMatConjoint.length, mereConjCX)

  // Anti-chevauchement dans chaque côté, puis entre les deux côtés
  ;[gpPatClientXs,   gpMatClientXs]   = enforceGap(gpPatClientXs,   gpMatClientXs)
  ;[gpPatConjointXs, gpMatConjointXs] = enforceGap(gpPatConjointXs, gpMatConjointXs)
  const allClientGpRight   = [...gpPatClientXs,   ...gpMatClientXs].map(x => x + RW)
  const allConjointGpLeft  = [...gpPatConjointXs, ...gpMatConjointXs]
  if (allClientGpRight.length > 0 && allConjointGpLeft.length > 0) {
    const rightEdge = Math.max(...allClientGpRight)
    const leftEdge  = Math.min(...allConjointGpLeft)
    if (rightEdge + PAD > leftEdge) {
      const push = Math.ceil((rightEdge + PAD - leftEdge) / 2)
      gpPatClientXs   = gpPatClientXs.map(x => x - push)
      gpMatClientXs   = gpMatClientXs.map(x => x - push)
      gpPatConjointXs = gpPatConjointXs.map(x => x + push)
      gpMatConjointXs = gpMatConjointXs.map(x => x + push)
    }
  }

  // ── Enfants : triés [client seul | commun | conjoint seul] ───
  const enfantsClientSeul  = enfants.filter(e => e.lien === 'client_seul')
  const enfantsCommuns     = enfants.filter(e => e.lien === 'commun')
  const enfantsConjSeul    = enfants.filter(e => e.lien === 'conjoint_seul')
  const orderedEnfants     = [...enfantsClientSeul, ...enfantsCommuns, ...enfantsConjSeul]
  const childXs            = spreadX(orderedEnfants.length, coupleCX)

  function lineOriginX(e: Enfant): number {
    if (e.lien === 'client_seul') return clientCX
    if (e.lien === 'conjoint_seul' && hasConjoint) return conjCX
    return coupleCX
  }

  // ── Construction des rects ───────────────────────────────────
  const gpColor = (a: Ascendant) => a.situation === 'decede' ? C.gpDecede : C.gp

  const gpRects: Rect[] = [
    ...gpPatClient.map((a, i) => ({
      x: gpPatClientXs[i], y: gpLevelY, w: RW, h: RH,
      label: libelleAscendant(a.lien),
      sub: a.situation === 'decede' ? '✝' : (a.age ? `${a.age} ans` : undefined),
      fill: gpColor(a).fill, stroke: gpColor(a).stroke, textColor: gpColor(a).text,
    })),
    ...gpMatClient.map((a, i) => ({
      x: gpMatClientXs[i], y: gpLevelY, w: RW, h: RH,
      label: libelleAscendant(a.lien),
      sub: a.situation === 'decede' ? '✝' : (a.age ? `${a.age} ans` : undefined),
      fill: gpColor(a).fill, stroke: gpColor(a).stroke, textColor: gpColor(a).text,
    })),
    ...gpPatConjoint.map((a, i) => ({
      x: gpPatConjointXs[i], y: gpLevelY, w: RW, h: RH,
      label: libelleAscendant(a.lien),
      sub: a.situation === 'decede' ? '✝' : (a.age ? `${a.age} ans` : undefined),
      fill: gpColor(a).fill, stroke: gpColor(a).stroke, textColor: gpColor(a).text,
    })),
    ...gpMatConjoint.map((a, i) => ({
      x: gpMatConjointXs[i], y: gpLevelY, w: RW, h: RH,
      label: libelleAscendant(a.lien),
      sub: a.situation === 'decede' ? '✝' : (a.age ? `${a.age} ans` : undefined),
      fill: gpColor(a).fill, stroke: gpColor(a).stroke, textColor: gpColor(a).text,
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

  const sibRects: Rect[] = [
    ...sibsClient.map((fs, i) => ({
      x: sibClientXs[i], y: coupleLevelY, w: RW, h: RH,
      label: fs.alias || `F/S ${i + 1}`, sub: `${fs.age} ans`,
      fill: C.sibling.fill, stroke: C.sibling.stroke, textColor: C.sibling.text,
      badge: fs.situation === 'handicape' ? 'H' : undefined,
    })),
    ...sibsConjoint.map((fs, i) => ({
      x: sibConjointXs[i], y: coupleLevelY, w: RW, h: RH,
      label: fs.alias || `F/S ${i + 1}`, sub: `${fs.age} ans`,
      fill: C.sibling.fill, stroke: C.sibling.stroke, textColor: C.sibling.text,
      badge: fs.situation === 'handicape' ? 'H' : undefined,
    })),
  ]

  const childRects: Rect[] = orderedEnfants.map((e, i) => {
    const col = e.lien === 'client_seul' ? C.clientSeul : e.lien === 'conjoint_seul' ? C.conjSeul : C.commun
    return {
      x: childXs[i], y: childLevelY, w: RW, h: RH,
      label: `Enfant ${i + 1}`,
      sub: `${e.age}a · ${libelleEnfantSituation(e.situation)}`,
      fill: col.fill, stroke: col.stroke, textColor: col.text,
      dash: e.lien === 'conjoint_seul',
    }
  })

  // ── ViewBox dynamique pour tout contenir ─────────────────────
  const allLeftEdges = [
    rowStartX,
    ...parClientXs, ...parConjointXs,
    ...gpPatClientXs, ...gpMatClientXs, ...gpPatConjointXs, ...gpMatConjointXs,
    ...childXs,
  ]
  const allRightEdges = allLeftEdges.map(x => x + RW)
  const vbX  = Math.floor(Math.min(...allLeftEdges, 0)) - PAD * 2
  const vbW  = Math.ceil(Math.max(...allRightEdges))    - vbX + PAD * 2

  const sfLabel: Record<string, string> = { marie: 'Marié·e·s', pacse: 'Pacsé·e·s', concubin: 'Concubins' }

  // ── Bus GP → parents ─────────────────────────────────────────
  // Pour chaque groupe GP, le bus descend vers son parent de rattachement.
  const gpBusGroups = [
    { gps: gpPatClient,   xs: gpPatClientXs,   parentCX: pereClientCX },
    { gps: gpMatClient,   xs: gpMatClientXs,   parentCX: mereClientCX },
    { gps: gpPatConjoint, xs: gpPatConjointXs, parentCX: pereConjCX   },
    { gps: gpMatConjoint, xs: gpMatConjointXs, parentCX: mereConjCX   },
  ].filter(g => g.gps.length > 0)

  // ── Bus parents → couple+frères ───────────────────────────────
  const clientSideChildCenters = [...sibClientXs.map(x => x + RW / 2), clientCX]
  const parentClientCenters    = parClientXs.map(x => x + RW / 2)
  const conjChildCenters       = hasConjoint ? [conjCX, ...sibConjointXs.map(x => x + RW / 2)] : []
  const parentConjCenters      = parConjointXs.map(x => x + RW / 2)

  return (
    <svg
      viewBox={`${vbX} 0 ${vbW} ${svgH}`}
      style={{ width: '100%', height: 'auto', display: 'block' }}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* ── Bus grands-parents → parents ──────────────────────── */}
      {showGP && gpBusGroups.map(({ xs, parentCX: pCX }, gi) => {
        const centers = xs.map(x => x + RW / 2)
        const busMinX = Math.min(...centers, pCX)
        const busMaxX = Math.max(...centers, pCX)
        return (
          <g key={`gp-bus-${gi}`}>
            {centers.map((gcx, i) => (
              <line key={i}
                x1={gcx} y1={gpLevelY + RH} x2={gcx} y2={gpBusY}
                stroke={C.line} strokeWidth={1.2} />
            ))}
            <line x1={busMinX} y1={gpBusY} x2={busMaxX} y2={gpBusY} stroke={C.line} strokeWidth={1.2} />
            <line x1={pCX} y1={gpBusY} x2={pCX} y2={parentLevelY} stroke={C.line} strokeWidth={1.2} />
          </g>
        )
      })}

      {/* ── Bus parents client → frères/sœurs + client ────────── */}
      {parentsClient.length > 0 && clientSideChildCenters.length > 0 && (() => {
        const all  = [...parentClientCenters, ...clientSideChildCenters]
        const minX = Math.min(...all)
        const maxX = Math.max(...all)
        return (
          <>
            {parentClientCenters.map((pcx, i) => (
              <line key={`par-vbus-${i}`}
                x1={pcx} y1={parentLevelY + RH} x2={pcx} y2={parentBusY}
                stroke={parentsClient[i].lien.includes('adoptif') ? C.lineDash : C.line}
                strokeWidth={1.2}
                strokeDasharray={parentsClient[i].lien.includes('adoptif') ? '4 3' : undefined}
              />
            ))}
            <line x1={minX} y1={parentBusY} x2={maxX} y2={parentBusY} stroke={C.line} strokeWidth={1.2} />
            {clientSideChildCenters.map((ccx, i) => (
              <line key={`bus-child-${i}`}
                x1={ccx} y1={parentBusY} x2={ccx} y2={coupleLevelY}
                stroke={C.line} strokeWidth={1.2} />
            ))}
          </>
        )
      })()}

      {/* ── Bus parents conjoint → conjoint + frères/sœurs ─────── */}
      {showParentsConj && conjChildCenters.length > 0 && (() => {
        const all  = [...parentConjCenters, ...conjChildCenters]
        const minX = Math.min(...all)
        const maxX = Math.max(...all)
        return (
          <>
            {parentConjCenters.map((pcx, i) => (
              <line key={`par-conj-vbus-${i}`}
                x1={pcx} y1={parentLevelY + RH} x2={pcx} y2={parentBusY}
                stroke={parentsConjoint[i].lien.includes('adoptif') ? C.lineDash : C.line}
                strokeWidth={1.2}
                strokeDasharray={parentsConjoint[i].lien.includes('adoptif') ? '4 3' : undefined}
              />
            ))}
            <line x1={minX} y1={parentBusY} x2={maxX} y2={parentBusY} stroke={C.line} strokeWidth={1.2} />
            {conjChildCenters.map((ccx, i) => (
              <line key={`bus-conj-child-${i}`}
                x1={ccx} y1={parentBusY} x2={ccx} y2={coupleLevelY}
                stroke={C.line} strokeWidth={1.2} />
            ))}
          </>
        )
      })()}

      {/* ── Lien matrimonial ───────────────────────────────────── */}
      {hasConjoint && conjointRect && (
        <>
          <line
            x1={clientRect.x + RW} y1={clientCY}
            x2={conjointRect.x}    y2={clientCY}
            stroke={C.line} strokeWidth={1.5} />
          <text x={coupleCX} y={clientCY - 6}
            textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize={9}>
            {sfLabel[situationFamiliale]}
          </text>
        </>
      )}

      {/* ── Enfants : courbes depuis le bon parent ─────────────── */}
      {orderedEnfants.map((e, i) => {
        const x1 = lineOriginX(e)
        const y1 = coupleLevelY + RH
        const x2 = childRects[i].x + RW / 2
        const y2 = childLevelY
        const my = (y1 + y2) / 2
        return (
          <path key={`child-line-${i}`}
            d={`M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}`}
            fill="none"
            stroke={e.lien === 'conjoint_seul' ? C.lineDash : C.line}
            strokeWidth={1.2}
            strokeDasharray={e.lien === 'conjoint_seul' ? '4 3' : undefined}
          />
        )
      })}

      {/* ── Rendu des rects ────────────────────────────────────── */}
      {gpRects.map((r, i)     => <Rct key={`gp-${i}`}    r={r} />)}
      {parentRects.map((r, i) => <Rct key={`par-${i}`}   r={r} />)}
      <Rct r={clientRect} />
      {conjointRect && <Rct r={conjointRect} />}
      {sibRects.map((r, i)    => <Rct key={`sib-${i}`}   r={r} />)}
      {childRects.map((r, i)  => <Rct key={`child-${i}`} r={r} />)}

      {/* ── Légende ────────────────────────────────────────────── */}
      <g transform={`translate(${vbX + 8}, ${svgH - 16})`}>
        {showGP && (
          <g transform="translate(0, 0)">
            <rect width={10} height={10} rx={2} fill={C.gp.fill} stroke={C.gp.stroke} strokeWidth={1} />
            <text x={14} y={9} fill="rgba(255,255,255,0.45)" fontSize={9}>Grand-parent</text>
          </g>
        )}
        {enfants.length > 0 && (
          <>
            {[
              { fill: C.commun.fill,     stroke: C.commun.stroke,     label: 'Commun',        off: showGP ? 110 : 0 },
              { fill: C.clientSeul.fill, stroke: C.clientSeul.stroke, label: 'Client seul',   off: showGP ? 220 : 110 },
              { fill: C.conjSeul.fill,   stroke: C.conjSeul.stroke,   label: 'Conjoint seul', off: showGP ? 330 : 220 },
            ].map((leg, i) => (
              <g key={i} transform={`translate(${leg.off}, 0)`}>
                <rect width={10} height={10} rx={2} fill={leg.fill} stroke={leg.stroke} strokeWidth={1} />
                <text x={14} y={9} fill="rgba(255,255,255,0.45)" fontSize={9}>{leg.label}</text>
              </g>
            ))}
          </>
        )}
      </g>
    </svg>
  )
}
