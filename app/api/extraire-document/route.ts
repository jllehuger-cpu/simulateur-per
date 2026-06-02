import { NextRequest } from 'next/server'
import { writeFile, unlink, readFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { spawn } from 'child_process'
import { randomUUID } from 'crypto'

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('pdf') as File
  const typeForce = formData.get('type') as string | null

  if (!file) {
    return Response.json({ error: 'Fichier PDF manquant' }, { status: 400 })
  }

  const tmpId = randomUUID()
  const tmpPdf = join(tmpdir(), `${tmpId}.pdf`)
  const tmpJson = join(tmpdir(), `${tmpId}_extrait.json`)

  try {
    const bytes = await file.arrayBuffer()
    await writeFile(tmpPdf, Buffer.from(bytes))

    const scriptPath = join(process.cwd(), 'extraire_document_patrimonial.py')
    const args = [scriptPath, tmpPdf, '--output', tmpJson]
    if (typeForce) args.push('--type', typeForce)

    const result = await new Promise<{ success: boolean; output: string; error: string }>(
      (resolve) => {
        const proc = spawn('python', args, {
          env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
        })
        let output = ''
        let error = ''
        proc.stdout.on('data', (d) => { output += d.toString() })
        proc.stderr.on('data', (d) => { error += d.toString() })
        proc.on('close', (code) => {
          resolve({ success: code === 0, output, error })
        })
        setTimeout(() => {
          proc.kill()
          resolve({ success: false, output, error: 'Timeout 60s dépassé' })
        }, 60000)
      }
    )

    if (!result.success) {
      return Response.json(
        { error: 'Erreur extraction', details: result.error },
        { status: 500 }
      )
    }

    const jsonContent = await readFile(tmpJson, 'utf-8')
    const donnees = JSON.parse(jsonContent)

    return Response.json({ success: true, data: donnees, log: result.output })

  } finally {
    try { await unlink(tmpPdf) } catch {}
    try { await unlink(tmpJson) } catch {}
  }
}

export const config = {
  api: { bodyParser: false }
}
