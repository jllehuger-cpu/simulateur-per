import { NextRequest } from 'next/server'
import { writeFile, unlink, readFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { spawn } from 'child_process'
import { randomUUID } from 'crypto'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

const MAX_FILE_SIZE = 5 * 1024 * 1024  // 5 MB
const MAX_RETRIES = 3
const SCRIPT_PATH = join(process.cwd(), 'extraire_document_patrimonial.py')

async function runExtraction(tmpPdf: string, tmpJson: string, typeForce?: string): Promise<{ output: string; error: string }> {
  return new Promise((resolve, reject) => {
    const args = [SCRIPT_PATH, tmpPdf, '--output', tmpJson]
    if (typeForce) args.push('--type', typeForce)

    const proc = spawn('python', args, {
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
    })
    let output = ''
    let error = ''
    proc.stdout.on('data', (d: Buffer) => { output += d.toString() })
    proc.stderr.on('data', (d: Buffer) => { error += d.toString() })
    proc.on('close', (code) => {
      if (code === 0) resolve({ output, error })
      else reject(Object.assign(new Error(error || 'Script exited with code ' + code), { code: 'EXTRACT_FAILED', details: error }))
    })
    proc.on('error', (err) => reject(Object.assign(err, { code: 'SPAWN_ERROR' })))
    setTimeout(() => {
      proc.kill()
      reject(Object.assign(new Error('Timeout 60s dépassé'), { code: 'TIMEOUT' }))
    }, 60000)
  })
}

async function extractWithRetry(tmpPdf: string, tmpJson: string, typeForce?: string, attempt = 0): Promise<{ output: string; error: string }> {
  try {
    return await runExtraction(tmpPdf, tmpJson, typeForce)
  } catch (err) {
    const e = err as Error & { code?: string }
    if (e.code === 'TIMEOUT' || attempt >= MAX_RETRIES - 1) throw err
    const delay = Math.min(1000 * Math.pow(2, attempt), 4000)
    await new Promise(r => setTimeout(r, delay))
    return extractWithRetry(tmpPdf, tmpJson, typeForce, attempt + 1)
  }
}

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('pdf') as File
  const typeForce = formData.get('type') as string | null

  if (!file) {
    return Response.json({ error: 'Fichier PDF manquant', code: 'MISSING_FILE' }, { status: 400 })
  }

  if (!file.name.toLowerCase().endsWith('.pdf')) {
    return Response.json({ error: 'Seuls les fichiers PDF sont acceptés', code: 'INVALID_FORMAT' }, { status: 400 })
  }

  if (file.size > MAX_FILE_SIZE) {
    return Response.json(
      { error: `Fichier trop volumineux (${(file.size / 1024 / 1024).toFixed(1)} MB > 5 MB)`, code: 'FILE_TOO_LARGE' },
      { status: 413 }
    )
  }

  const tmpId = randomUUID()
  const tmpPdf = join(tmpdir(), `${tmpId}.pdf`)
  const tmpJson = join(tmpdir(), `${tmpId}_extrait.json`)

  try {
    const bytes = await file.arrayBuffer()
    await writeFile(tmpPdf, Buffer.from(bytes))

    const { output } = await extractWithRetry(tmpPdf, tmpJson, typeForce ?? undefined)

    const jsonContent = await readFile(tmpJson, 'utf-8')
    const donnees = JSON.parse(jsonContent)

    return Response.json({ success: true, data: donnees, log: output })

  } catch (err) {
    const e = err as Error & { code?: string; details?: string }
    console.error('[EXTRAIRE-DOC]', e.code, e.message)

    if (e.code === 'TIMEOUT') {
      return Response.json({ error: 'Extraction trop longue (>60s). Essayez un fichier plus petit.', code: 'TIMEOUT' }, { status: 504 })
    }
    return Response.json(
      { error: 'Erreur lors de l\'extraction', code: e.code ?? 'UNKNOWN', details: e.details },
      { status: 500 }
    )
  } finally {
    try { await unlink(tmpPdf) } catch {}
    try { await unlink(tmpJson) } catch {}
  }
}
