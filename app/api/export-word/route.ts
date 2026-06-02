import { NextRequest } from 'next/server'
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  BorderStyle, Header, Footer, PageNumber, LevelFormat,
} from 'docx'

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    sections: {
      bilan_civil: string
      bilan_fiscal: string
      bilan_financier: string
      zones_risque: string
      recommandations: string
    }
    alias: string
    nom_prospect?: string
    date?: string
  }

  const { sections, alias, nom_prospect, date } = body
  const dateStr = date ?? new Date().toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric'
  })
  const nomAffiche = nom_prospect?.trim() || alias

  function parseInlineMd(text: string): TextRun[] {
    const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)
    return parts.map(part => {
      if (/^\*\*[^*]+\*\*$/.test(part))
        return new TextRun({ text: part.slice(2, -2), bold: true, font: 'Arial', size: 22 })
      if (/^\*[^*]+\*$/.test(part))
        return new TextRun({ text: part.slice(1, -1), italics: true, font: 'Arial', size: 22 })
      return new TextRun({ text: part, font: 'Arial', size: 22 })
    })
  }

  function parseMdToParagraphs(text: string): Paragraph[] {
    if (!text) return [new Paragraph({ children: [new TextRun('')] })]
    return text.split('\n').map(line => {
      if (!line.trim()) return new Paragraph({ children: [new TextRun('')] })
      if (/^#{1,2}\s/.test(line)) {
        return new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun({
            text: line.replace(/^#{1,2}\s/, '').replace(/<[^>]+>/g, ''),
            bold: true, font: 'Arial', size: 26, color: '1F3864'
          })]
        })
      }
      if (/^#{3}\s/.test(line)) {
        return new Paragraph({
          heading: HeadingLevel.HEADING_3,
          children: [new TextRun({
            text: line.replace(/^#{3}\s/, '').replace(/<[^>]+>/g, ''),
            bold: true, font: 'Arial', size: 24, color: '2E75B6'
          })]
        })
      }
      if (/^[-•▸]\s/.test(line)) {
        const content = line.replace(/^[-•▸]\s/, '').replace(/<[^>]+>/g, '')
        return new Paragraph({
          numbering: { reference: 'bullets', level: 0 },
          children: parseInlineMd(content)
        })
      }
      const content = line.replace(/<[^>]+>/g, '')
      return new Paragraph({ children: parseInlineMd(content), spacing: { after: 80 } })
    })
  }

  const clean = (s: string) => s
    .replace(/<bilan_civil>|<\/bilan_civil>/gi, '')
    .replace(/<bilan_fiscal>|<\/bilan_fiscal>/gi, '')
    .replace(/<bilan_financier>|<\/bilan_financier>/gi, '')
    .replace(/<zones_risque>|<\/zones_risque>/gi, '')
    .replace(/<recommandations>|<\/recommandations>/gi, '')
    .trim()

  const sectionColors: Record<string, string> = {
    bilan_civil:     '2E75B6',
    bilan_fiscal:    'C9A84C',
    bilan_financier: '1D9E75',
    zones_risque:    'C0392B',
    recommandations: '6C3483',
  }

  function sectionHeader(title: string, icon: string, colorKey: string): Paragraph[] {
    return [
      new Paragraph({ pageBreakBefore: true, children: [new TextRun('')] }),
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: sectionColors[colorKey] ?? '1F3864', space: 1 } },
        children: [new TextRun({
          text: `${icon}  ${title}`,
          bold: true, font: 'Arial', size: 32,
          color: sectionColors[colorKey] ?? '1F3864'
        })]
      }),
      new Paragraph({ children: [new TextRun('')] }),
    ]
  }

  const doc = new Document({
    numbering: {
      config: [{
        reference: 'bullets',
        levels: [{ level: 0, format: LevelFormat.BULLET, text: '•',
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } }]
      }]
    },
    styles: {
      default: { document: { run: { font: 'Arial', size: 22 } } },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 32, bold: true, font: 'Arial' },
          paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 0 } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 26, bold: true, font: 'Arial' },
          paragraph: { spacing: { before: 180, after: 80 }, outlineLevel: 1 } },
        { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 24, bold: true, font: 'Arial' },
          paragraph: { spacing: { before: 120, after: 60 }, outlineLevel: 2 } },
      ]
    },
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1800 }
        }
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            border: { bottom: { style: BorderStyle.SINGLE, size: 3, color: '2E75B6', space: 1 } },
            children: [
              new TextRun({ text: 'AUDIT PATRIMONIAL', bold: true, font: 'Arial', size: 18, color: '1F3864' }),
              new TextRun({ text: `  ·  ${nomAffiche}`, font: 'Arial', size: 18, color: '666666' }),
              new TextRun({ text: `  ·  ${dateStr}`, font: 'Arial', size: 18, color: '999999' }),
            ]
          })]
        })
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            border: { top: { style: BorderStyle.SINGLE, size: 3, color: 'CCCCCC', space: 1 } },
            children: [
              new TextRun({ text: 'Document confidentiel — Page ', font: 'Arial', size: 16, color: '999999' }),
              new TextRun({ children: [PageNumber.CURRENT], font: 'Arial', size: 16, color: '999999' }),
            ]
          })]
        })
      },
      children: [
        // Page de garde
        new Paragraph({ children: [new TextRun('')], spacing: { after: 1200 } }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: 'AUDIT PATRIMONIAL', bold: true, font: 'Arial', size: 56, color: '1F3864' })]
        }),
        new Paragraph({ children: [new TextRun('')], spacing: { after: 400 } }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          border: {
            top: { style: BorderStyle.SINGLE, size: 3, color: '2E75B6', space: 4 },
            bottom: { style: BorderStyle.SINGLE, size: 3, color: '2E75B6', space: 4 },
          },
          children: [new TextRun({ text: nomAffiche, bold: true, font: 'Arial', size: 40, color: '2E75B6' })],
          spacing: { before: 160, after: 160 }
        }),
        new Paragraph({ children: [new TextRun('')], spacing: { after: 400 } }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: dateStr, font: 'Arial', size: 24, color: '888888' })]
        }),
        new Paragraph({ children: [new TextRun('')], spacing: { after: 200 } }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: 'Document strictement confidentiel', font: 'Arial', size: 18, italics: true, color: 'AAAAAA' })]
        }),
        new Paragraph({ pageBreakBefore: true, children: [new TextRun('')] }),

        // Sections
        ...sectionHeader('Profil & Situation Civile', '👤', 'bilan_civil'),
        ...parseMdToParagraphs(clean(sections.bilan_civil)),

        ...sectionHeader('Analyse Fiscale & Revenus', '📊', 'bilan_fiscal'),
        ...parseMdToParagraphs(clean(sections.bilan_fiscal)),

        ...sectionHeader('Bilan Patrimonial', '💼', 'bilan_financier'),
        ...parseMdToParagraphs(clean(sections.bilan_financier)),

        ...sectionHeader('Zones de Risque', '⚠️', 'zones_risque'),
        ...parseMdToParagraphs(clean(sections.zones_risque)),

        ...sectionHeader('Préconisations', '🎯', 'recommandations'),
        ...parseMdToParagraphs(clean(sections.recommandations)),

        // Avertissement légal
        new Paragraph({ pageBreakBefore: true, children: [new TextRun('')] }),
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun({ text: 'Avertissement', bold: true, font: 'Arial', size: 24, color: '888888' })]
        }),
        new Paragraph({
          children: [new TextRun({
            text: "Ce document est produit à titre informatif et ne constitue pas un conseil en investissement. " +
                  "Les estimations fiscales sont indicatives et doivent être validées par un professionnel habilité. " +
                  "Document confidentiel — ne pas diffuser.",
            font: 'Arial', size: 18, italics: true, color: '888888'
          })]
        }),
      ]
    }]
  })

  const buffer = await Packer.toBuffer(doc)
  const filename = `Audit_${alias}_${new Date().toISOString().slice(0, 10)}.docx`

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${filename}"`,
    }
  })
}
