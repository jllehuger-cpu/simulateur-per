'use client'

import { useState, useRef } from 'react'

interface ImportDocumentProps {
  onSuccess: (data: Record<string, unknown>, type: string) => void
  typeForce?: string
  label?: string
  compact?: boolean
}

export function ImportDocument({
  onSuccess, typeForce, label, compact = false
}: ImportDocumentProps) {
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<{
    ok: boolean; message: string
  } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    if (!file.name.endsWith('.pdf')) {
      setStatus({ ok: false, message: 'Fichier PDF uniquement' })
      return
    }

    setLoading(true)
    setStatus({ ok: true, message: `Analyse de ${file.name}...` })

    try {
      const form = new FormData()
      form.append('pdf', file)
      if (typeForce) form.append('type', typeForce)

      const res = await fetch('/api/extraire-document', {
        method: 'POST',
        body: form
      })

      const result = await res.json()

      if (!res.ok || !result.success) {
        setStatus({ ok: false, message: result.error || 'Erreur extraction' })
        return
      }

      const type = result.data?._meta?.type_detecte ?? 'inconnu'
      const nbChamps = compterChampsRemplis(result.data)

      setStatus({
        ok: true,
        message: `✓ ${nbChamps} champs extraits (${type})`
      })

      onSuccess(result.data, type)

    } catch (err) {
      setStatus({ ok: false, message: `Erreur : ${err}` })
    } finally {
      setLoading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 6 }}>
      <label style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        padding: compact ? '6px 12px' : '10px 16px',
        borderRadius: 10, cursor: loading ? 'wait' : 'pointer',
        border: '1px dashed rgba(201,168,76,0.4)',
        background: 'rgba(201,168,76,0.06)',
        color: 'var(--accent-gold)',
        fontSize: compact ? 12 : 13,
        fontWeight: 500,
        opacity: loading ? 0.7 : 1,
        transition: 'all 0.2s',
      }}>
        {loading ? '⏳' : '📥'}
        {loading ? 'Analyse en cours...' : (label ?? 'Importer PDF')}
        <input
          ref={inputRef}
          type="file"
          accept=".pdf"
          style={{ display: 'none' }}
          disabled={loading}
          onChange={e => {
            const f = e.target.files?.[0]
            if (f) handleFile(f)
          }}
        />
      </label>

      {status && (
        <span style={{
          fontSize: 11,
          color: status.ok ? 'var(--accent-emerald)' : '#EF4444',
          maxWidth: 280,
        }}>
          {status.message}
        </span>
      )}
    </div>
  )
}

function compterChampsRemplis(data: Record<string, unknown>): number {
  let count = 0
  const ignorer = ['source', '_meta', 'lignes_portefeuille']
  const compter = (obj: Record<string, unknown>) => {
    for (const [k, v] of Object.entries(obj)) {
      if (ignorer.includes(k)) continue
      if (v !== null && v !== undefined) {
        if (typeof v === 'object' && !Array.isArray(v)) {
          compter(v as Record<string, unknown>)
        } else {
          count++
        }
      }
    }
  }
  compter(data)
  const lignes = data.lignes_portefeuille as unknown[]
  if (lignes?.length) count += lignes.length
  return count
}
