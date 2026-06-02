export async function GET() {
  const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:x="urn:schemas-microsoft-com:office:excel">
<Styles>
  <Style ss:ID="header">
    <Font ss:Bold="1" ss:Color="#FFFFFF" ss:Size="11"/>
    <Interior ss:Color="#1F3864" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="example">
    <Font ss:Italic="1" ss:Color="#888888" ss:Size="10"/>
    <Interior ss:Color="#F5F5F5" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="warning">
    <Font ss:Bold="1" ss:Color="#E65100" ss:Size="10"/>
  </Style>
</Styles>
<Worksheet ss:Name="Portefeuille">
<Table>
  <Column ss:Width="140"/>
  <Column ss:Width="220"/>
  <Column ss:Width="160"/>
  <Column ss:Width="90"/>
  <Row>
    <Cell ss:StyleID="header"><Data ss:Type="String">ISIN</Data></Cell>
    <Cell ss:StyleID="header"><Data ss:Type="String">Nom / Libellé</Data></Cell>
    <Cell ss:StyleID="header"><Data ss:Type="String">Catégorie</Data></Cell>
    <Cell ss:StyleID="header"><Data ss:Type="String">Poids (%)</Data></Cell>
  </Row>
  <Row>
    <Cell ss:StyleID="example"><Data ss:Type="String">FR0010315770</Data></Cell>
    <Cell ss:StyleID="example"><Data ss:Type="String">Lyxor CAC 40 ETF</Data></Cell>
    <Cell ss:StyleID="example"><Data ss:Type="String">Actions-ETF</Data></Cell>
    <Cell ss:StyleID="example"><Data ss:Type="Number">25</Data></Cell>
  </Row>
  <Row>
    <Cell ss:StyleID="example"><Data ss:Type="String">FR0000447066</Data></Cell>
    <Cell ss:StyleID="example"><Data ss:Type="String">Fonds Euros Sécurité</Data></Cell>
    <Cell ss:StyleID="example"><Data ss:Type="String">Fonds euros</Data></Cell>
    <Cell ss:StyleID="example"><Data ss:Type="Number">40</Data></Cell>
  </Row>
  <Row>
    <Cell ss:StyleID="example"><Data ss:Type="String">FR0010959676</Data></Cell>
    <Cell ss:StyleID="example"><Data ss:Type="String">AXA WF Global Strategic Bonds</Data></Cell>
    <Cell ss:StyleID="example"><Data ss:Type="String">Obligations</Data></Cell>
    <Cell ss:StyleID="example"><Data ss:Type="Number">15</Data></Cell>
  </Row>
  <Row>
    <Cell ss:StyleID="example"><Data ss:Type="String"></Data></Cell>
    <Cell ss:StyleID="example"><Data ss:Type="String">SCPI Pierre Papier</Data></Cell>
    <Cell ss:StyleID="example"><Data ss:Type="String">SCPI</Data></Cell>
    <Cell ss:StyleID="example"><Data ss:Type="Number">20</Data></Cell>
  </Row>
  <Row></Row>
  <Row>
    <Cell ss:MergeAcross="3" ss:StyleID="warning">
      <Data ss:Type="String">&#9888;&#65039; Remplacez les exemples. Total poids = 100%. Catégories valides : Fonds euros / Actions-ETF / Obligations / SCPI / Produit structuré / Private Equity / Autre</Data>
    </Cell>
  </Row>
</Table>
</Worksheet>
</Workbook>`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/vnd.ms-excel',
      'Content-Disposition': 'attachment; filename="template_portefeuille.xls"',
    }
  })
}
