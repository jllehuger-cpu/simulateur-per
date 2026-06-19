import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendShareEmail(
  clientEmail: string,
  url: string,
  alias: string,
  cgpName: string
) {
  const html = `
    <body style="margin:0; padding:0; background-color:#080B14; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <div style="max-width:480px; margin:0 auto; padding:40px 20px;">
        <div style="text-align:center; margin-bottom:28px;">
          <div style="font-size:32px; margin-bottom:8px;">🏛️</div>
          <div style="font-size:18px; font-weight:700; color:#F0F4FF; letter-spacing:-0.02em;">Audit Patrimoine</div>
        </div>

        <div style="background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.14); border-radius:14px; padding:28px;">
          <h2 style="color:#F0F4FF; font-size:17px; font-weight:700; margin:0 0 16px;">Accès à votre dossier patrimonial</h2>
          <p style="color:#94A3B8; font-size:14px; line-height:1.6; margin:0 0 12px;">Bonjour,</p>
          <p style="color:#94A3B8; font-size:14px; line-height:1.6; margin:0 0 20px;">
            <strong style="color:#F0F4FF;">${cgpName}</strong> vous partage l'accès au dossier
            <strong style="color:#C9A84C;">${alias}</strong>.
          </p>

          <p style="color:#94A3B8; font-size:14px; line-height:1.6; margin:0 0 8px;">Pour y accéder :</p>
          <ol style="color:#94A3B8; font-size:14px; line-height:1.8; margin:0 0 24px; padding-left:20px;">
            <li>Cliquez sur le lien ci-dessous</li>
            <li>Entrez la phrase d'accès (reçue par SMS/téléphone)</li>
            <li>Consultez et modifiez vos données patrimoniales</li>
          </ol>

          <div style="text-align:center; margin-bottom:24px;">
            <a href="${url}" style="display:inline-block; background-color:#3B82F6; color:#ffffff; padding:12px 28px; border-radius:10px; text-decoration:none; font-size:14px; font-weight:600;">
              Accéder au dossier
            </a>
          </div>

          <div style="background:rgba(245,158,11,0.08); border:1px solid rgba(245,158,11,0.25); border-radius:10px; padding:12px 14px;">
            <p style="color:#FCD34D; font-size:12px; line-height:1.6; margin:0;">
              ⚠️ Vous recevrez la phrase d'accès par SMS ou téléphone (pas par email).
              Ne la partagez avec personne.
            </p>
          </div>

          <p style="color:#94A3B8; font-size:14px; line-height:1.6; margin:24px 0 0;">
            Cordialement,<br/>${cgpName}
          </p>
        </div>

        <p style="text-align:center; color:#475569; font-size:11px; margin-top:24px;">
          © 2026 Mon Audit Patrimoine — Données chiffrées AES-256
        </p>
      </div>
    </body>
  `

  try {
    const { error } = await resend.emails.send({
      from: 'noreply@mon-audit-patrimoine.fr',
      to: clientEmail,
      subject: `Accès à votre dossier patrimonial ${alias}`,
      html,
    })
    // Resend ne `throw` pas sur les erreurs API (clé invalide, domaine non
    // vérifié...) — il les renvoie dans { error }, donc on le vérifie nous-mêmes.
    if (error) throw new Error(error.message)
    console.log('[EMAIL] Partage envoyé à', clientEmail)
  } catch (err) {
    console.error('[EMAIL] Erreur:', err)
    throw new Error('Impossible d\'envoyer l\'email')
  }
}
