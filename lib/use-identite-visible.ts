import { useState, useCallback, useEffect } from 'react'

let globalVisible = false
const listeners = new Set<(v: boolean) => void>()
let inactivityTimer: ReturnType<typeof setTimeout> | null = null

function resetInactivityTimer() {
  if (inactivityTimer) clearTimeout(inactivityTimer)
  if (globalVisible) {
    inactivityTimer = setTimeout(() => {
      globalVisible = false
      notify()
    }, 5 * 60 * 1000) // 5 minutes
  }
}

function notify() {
  listeners.forEach(fn => fn(globalVisible))
  resetInactivityTimer()
}

export function useIdentiteVisible() {
  const [visible, setVisible] = useState(globalVisible)

  useEffect(() => {
    const handler = (v: boolean) => setVisible(v)
    listeners.add(handler)
    return () => { listeners.delete(handler) }
  }, [])

  useEffect(() => {
    const reset = () => resetInactivityTimer()
    window.addEventListener('mousemove', reset, { passive: true })
    window.addEventListener('keydown', reset, { passive: true })
    return () => {
      window.removeEventListener('mousemove', reset)
      window.removeEventListener('keydown', reset)
    }
  }, [])

  const toggle = useCallback(() => {
    globalVisible = !globalVisible
    notify()
  }, [])

  const masquer = useCallback(() => {
    globalVisible = false
    notify()
  }, [])

  return { visible, toggle, masquer }
}

export function masquerTexte(texte: string, visible: boolean): string {
  if (visible || !texte) return texte
  return '•'.repeat(Math.max(texte.length, 5))
}
