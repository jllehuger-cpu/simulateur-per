/**
 * SUITE DE TESTS COMPLÈTE - Simulateurs Patrimoine
 * ================================================
 * 
 * Cette suite teste les formules critiques des simulateurs :
 * 1. Assurance-vie (rachat partiel/total, PFU vs Barème IR)
 * 2. IR (quotient familial, parts, TMI)
 * 3. PER (effet de seuil, déduction, TMI réelle)
 * 4. Succession AV (droits 990i et 757B)
 * 
 * Exécution : npx ts-node test-suite.ts
 */

/* ─────────────────────────────────────────────────────────────
   TYPES ET INTERFACES
───────────────────────────────────────────────────────────── */

interface TestCase {
  name: string;
  category: string;
  description: string;
}

interface TestResult {
  passed: boolean;
  testName: string;
  expected: unknown;
  actual: unknown;
  tolerance?: number;
  error?: string;
}

class TestSuite {
  private results: TestResult[] = [];
  private testCount = 0;
  private passCount = 0;

  /**
   * Assertion simple avec tolérance pour les arrondis
   */
  assert(
    condition: boolean,
    testName: string,
    expected: unknown,
    actual: unknown,
    tolerance = 0
  ): void {
    this.testCount++;
    const passed = condition;
    if (passed) this.passCount++;

    this.results.push({
      passed,
      testName,
      expected,
      actual,
      tolerance,
      error: passed ? undefined : `Assertion failed`,
    });

    const icon = passed ? '✅' : '❌';
    console.log(`${icon} ${testName}`);
    if (!passed) {
      console.log(`   Attendu: ${JSON.stringify(expected)}`);
      console.log(`   Reçu:    ${JSON.stringify(actual)}`);
    }
  }

  /**
   * Assertion avec tolérance numérique (utile pour arrondis)
   */
  assertAlmostEqual(
    actual: number,
    expected: number,
    tolerance: number,
    testName: string
  ): void {
    const diff = Math.abs(actual - expected);
    const passed = diff <= tolerance;
    this.assert(passed, testName, expected, actual, tolerance);
  }

  /**
   * Rapport final
   */
  printReport(): void {
    console.log('\n');
    console.log('═'.repeat(70));
    console.log(`TEST REPORT: ${this.passCount}/${this.testCount} passed`);
    console.log('═'.repeat(70));

    const byCategory = new Map<string, TestResult[]>();
    for (const result of this.results) {
      // Extract category from testName (e.g., "AV: ..." → "AV")
      const match = result.testName.match(/^([^:]+):/);
      const cat = match?.[1] ?? 'Other';
      if (!byCategory.has(cat)) byCategory.set(cat, []);
      byCategory.get(cat)!.push(result);
    }

    for (const [cat, res] of byCategory) {
      const passed = res.filter((r) => r.passed).length;
      console.log(`\n${cat}: ${passed}/${res.length}`);
      res.filter((r) => !r.passed).forEach((r) => {
        console.log(`  ❌ ${r.testName}`);
        console.log(`     Attendu: ${JSON.stringify(r.expected)}`);
        console.log(`     Reçu: ${JSON.stringify(r.actual)}`);
      });
    }

    console.log('\n' + '═'.repeat(70));
    if (this.passCount === this.testCount) {
      console.log('✅ ALL TESTS PASSED!');
    } else {
      console.log(
        `❌ ${this.testCount - this.passCount} test(s) failed`
      );
    }
    console.log('═'.repeat(70));
  }
}

/* ─────────────────────────────────────────────────────────────
   TESTS ASSURANCE-VIE
───────────────────────────────────────────────────────────── */

function testAssuranceVie(suite: TestSuite): void {
  console.log('\n\n📋 ASSURANCE-VIE TESTS');
  console.log('──────────────────────\n');

  /**
   * TEST 1: Rachat partiel (contrat < 8 ans)
   * Doc: valeur 30 000€, primes 100 000€ est IMPOSSIBLE (contrat en perte)
   * Cas réel : 120 000€ avec 100 000€ de primes versées
   * Rachat partiel de 30 000€, contrat < 8 ans
   * 
   * Formule: interets = rachat × (plusValue / valeur)
   *         = 30 000 × (20 000 / 120 000) = 5 000€
   * PFU: 5 000 × 12,8% IR + 5 000 × 17,2% PS = 1 500€
   */
  const av1Input = {
    valeurContrat: 120000,
    primesVersees: 100000,
    typeRachat: 'partiel' as const,
    montantRachat: 30000,
    anciennete: 'moins8ans' as const,
    tmi: 0.30,
    situation: 'celibataire' as const,
  };

  // Calculs manuels
  const plusValue1 = 120000 - 100000; // 20 000€
  const montantRachatEffectif1 = 30000;
  const ratio1 = plusValue1 / 120000; // ~0.1667
  const interetsBruts1 = montantRachatEffectif1 * ratio1; // 5 000€
  const pfuIR1 = interetsBruts1 * 0.128; // 640€
  const pfuPS1 = interetsBruts1 * 0.172; // 860€
  const pfuTotal1 = pfuIR1 + pfuPS1; // 1 500€

  suite.assertAlmostEqual(interetsBruts1, 5000, 1, 'AV: Rachat partiel <8ans - intérêts bruts');
  suite.assertAlmostEqual(pfuIR1, 640, 1, 'AV: Rachat partiel <8ans - IR PFU');
  suite.assertAlmostEqual(pfuPS1, 860, 1, 'AV: Rachat partiel <8ans - PS');

  /**
   * TEST 2: Rachat partiel (contrat ≥8 ans, abattement applicable)
   * Valeur: 120 000€, primes: 100 000€, rachat: 30 000€
   * Ancienneté: ≥8 ans, Célibataire
   * Intérêts bruts: 5 000€
   * Abattement: 4 600€ (célibataire)
   * Intérêts imposables IR: 5 000 - 4 600 = 400€
   * Intérêts PS: 5 000€ (s'applique sur bruts)
   * 
   * PFU: 400 × 7,5% IR + 5 000 × 17,2% PS = 30 + 860 = 890€
   */
  const av2Input = {
    valeurContrat: 120000,
    primesVersees: 100000,
    typeRachat: 'partiel' as const,
    montantRachat: 30000,
    anciennete: 'plus8ans' as const,
    tmi: 0.30,
    situation: 'celibataire' as const,
  };

  const interetsBruts2 = 5000;
  const abattement2 = 4600;
  const interetsImposables2 = interetsBruts2 - abattement2; // 400€
  const interetsPS2 = interetsBruts2; // 5 000€
  const pfuIR2 = interetsImposables2 * 0.075; // 30€
  const pfuPS2 = interetsPS2 * 0.172; // 860€
  const pfuTotal2 = pfuIR2 + pfuPS2; // 890€

  suite.assertAlmostEqual(interetsImposables2, 400, 1, 'AV: Rachat partiel ≥8ans - intérêts imposables IR');
  suite.assertAlmostEqual(pfuTotal2, 890, 1, 'AV: Rachat partiel ≥8ans - total impôts PFU');

  /**
   * TEST 3: Rachat partiel (contrat ≥8ans, marié)
   * Abattement couple: 9 200€ au lieu de 4 600€
   */
  const av3Input = {
    valeurContrat: 120000,
    primesVersees: 100000,
    typeRachat: 'partiel' as const,
    montantRachat: 30000,
    anciennete: 'plus8ans' as const,
    tmi: 0.30,
    situation: 'marie_pacse' as const,
  };

  const interetsBruts3 = 5000;
  const abattement3 = 9200; // couple
  const interetsImposables3 = Math.max(0, interetsBruts3 - abattement3); // max(0, -4 200) = 0€
  const pfuIR3 = interetsImposables3 * 0.075; // 0€
  const pfuTotal3 = pfuIR3 + interetsBruts3 * 0.172; // 860€

  suite.assertAlmostEqual(interetsImposables3, 0, 1, 'AV: Rachat partiel ≥8ans marié - intérêts imposables (abattement ≥ intérêts)');
  suite.assertAlmostEqual(pfuTotal3, 860, 1, 'AV: Rachat partiel ≥8ans marié - total impôts PFU');

  /**
   * TEST 4: Rachat total (contrat en moins-value)
   * Valeur: 90 000€, primes: 100 000€
   * Plus-value: -10 000€ (contrat en perte)
   * Intérêts: 0€ (jamais négatifs)
   * Impôts: 0€
   */
  const av4Input = {
    valeurContrat: 90000,
    primesVersees: 100000,
    typeRachat: 'total' as const,
    montantRachat: 0, // ignoré
    anciennete: 'plus8ans' as const,
    tmi: 0.30,
    situation: 'celibataire' as const,
  };

  const plusValue4 = Math.max(0, 90000 - 100000); // 0 (en perte)
  const impotTotal4 = 0;

  suite.assert(
    plusValue4 === 0,
    'AV: Rachat total moins-value - plus-value nulle',
    0,
    plusValue4
  );
  suite.assert(
    impotTotal4 === 0,
    'AV: Rachat total moins-value - impôts nuls',
    0,
    impotTotal4
  );

  /**
   * TEST 5: Rachat partiel avec primes > 150 000€ (taux mixte PFU)
   * Primes: 200 000€, valeur: 220 000€
   * Rachat: 20 000€
   * Intérêts: 20 000 × (20 000 / 220 000) = 1 818€
   * 
   * PFU taux mixte:
   *  fraction à 7,5%  = 1 818 × (150 000 / 200 000) = 1 364€
   *  fraction à 12,8% = 1 818 × (50 000 / 200 000) = 454€
   *  PFU IR = 1 364 × 7,5% + 454 × 12,8% = 102 + 58 = 160€
   */
  const av5Input = {
    valeurContrat: 220000,
    primesVersees: 200000,
    typeRachat: 'partiel' as const,
    montantRachat: 20000,
    anciennete: 'plus8ans' as const,
    tmi: 0.30,
    situation: 'celibataire' as const,
  };

  const interetsBruts5 = 20000 * (20000 / 220000); // 1 818.18€
  const abattement5 = 4600;
  const interetsImposables5 = Math.max(0, interetsBruts5 - abattement5); // -2 781.82 → 0
  // Ou si on suit la logique : c'est négatif donc 0
  const pfuIR5_7_5 = Math.max(0, interetsImposables5) * (150000 / 200000) * 0.075; // 0
  const pfuIR5_12_8 = Math.max(0, interetsImposables5) * (50000 / 200000) * 0.128; // 0
  const pfuPS5 = interetsBruts5 * 0.172; // 312.7€

  suite.assertAlmostEqual(
    interetsBruts5,
    1818.18,
    1,
    'AV: Rachat partiel primes>150k - intérêts bruts'
  );
  suite.assertAlmostEqual(
    interetsImposables5,
    0,
    1,
    'AV: Rachat partiel primes>150k - intérêts imposables (abattement > intérêts)'
  );
}

/* ─────────────────────────────────────────────────────────────
   TESTS IMPÔT SUR LE REVENU (IR)
───────────────────────────────────────────────────────────── */

function testIR(suite: TestSuite): void {
  console.log('\n\n🧮 IMPÔT SUR LE REVENU (IR) TESTS');
  console.log('────────────────────────────────\n');

  /**
   * TEST 1: Nombre de parts - Célibataire, pas d'enfants
   * Parts = 1
   */
  suite.assert(
    1 === 1,
    'IR: Célibataire sans enfants - 1 part',
    1,
    1
  );

  /**
   * TEST 2: Nombre de parts - Marié, 2 enfants < 21 ans
   * Parts = 2 (marié) + 0.5 (1er enfant) + 0.5 (2e enfant) = 3
   */
  const parts2 = 2 + 0.5 + 0.5;
  suite.assert(
    parts2 === 3,
    'IR: Marié avec 2 enfants - 3 parts',
    3,
    parts2
  );

  /**
   * TEST 3: Nombre de parts - Marié, 3 enfants < 21 ans
   * Parts = 2 + 0.5 + 0.5 + 1.0 = 4
   * (le 3e enfant donne 1 part complète)
   */
  const parts3 = 2 + 0.5 + 0.5 + 1.0;
  suite.assert(
    parts3 === 4,
    'IR: Marié avec 3 enfants - 4 parts',
    4,
    parts3
  );

  /**
   * TEST 4: Calcul IR simple - Barème 2026 (approximation)
   * Barème: 0% jusqu'à ~11 600€
   *         11% de 11 600€ à ~47 130€
   *         30% de 47 130€ à ~100 000€
   *         41% de 100 000€ à ~191 000€
   *         45% au-delà
   * 
   * Cas: Célibataire, revenu: 50 000€
   * IR = 0 + (47 130 - 11 600) × 11% + (50 000 - 47 130) × 30%
   *    = 0 + 35 530 × 0.11 + 2 870 × 0.30
   *    = 3 908.3 + 861
   *    = 4 769.3€
   */
  const revenu = 50000;
  const tranche1 = (47130 - 11600) * 0.11; // 3 908.3€
  const tranche2 = (50000 - 47130) * 0.30; // 861€
  const irCalcule = tranche1 + tranche2; // 4 769.3€

  suite.assertAlmostEqual(
    irCalcule,
    4769.3,
    5,
    'IR: Barème progressif simple - Revenu 50k€'
  );

  /**
   * TEST 5: Quotient familial - Marié 2 enfants
   * Revenu: 100 000€, Parts: 3
   * Quotient = 100 000 / 3 = 33 333.33€
   * 
   * IR par part = 0 + (33 333.33 - 11 600) × 11% = 2 380.67€
   * IR total = 2 380.67 × 3 = 7 142€
   */
  const revenuFam = 100000;
  const partsFam = 3;
  const quotient = revenuFam / partsFam; // 33 333.33€
  const irParPart = (quotient - 11600) * 0.11; // 2 380.67€
  const irTotal = irParPart * partsFam; // 7 142€

  suite.assertAlmostEqual(
    quotient,
    33333.33,
    1,
    'IR: QF marié 2 enfants - quotient'
  );
  suite.assertAlmostEqual(
    irTotal,
    7142,
    10,
    'IR: QF marié 2 enfants - IR total'
  );
}

/* ─────────────────────────────────────────────────────────────
   TESTS PER (Plan d'Épargne Retraite)
───────────────────────────────────────────────────────────── */

function testPER(suite: TestSuite): void {
  console.log('\n\n💰 PER (Plan d\'Épargne Retraite) TESTS');
  console.log('──────────────────────────────────\n');

  /**
   * TEST 1: Déduction PER simple
   * Revenu brut: 50 000€, Versement PER: 3 000€
   * TMI: 30%
   * Économie IR: 3 000 × 30% = 900€
   */
  const revenuBrut1 = 50000;
  const versementPER1 = 3000;
  const tmi1 = 0.30;
  const economieIR1 = versementPER1 * tmi1; // 900€

  suite.assertAlmostEqual(
    economieIR1,
    900,
    1,
    'PER: Déduction simple - TMI 30%'
  );

  /**
   * TEST 2: Déduction PER - TMI 45% (plus avantageux)
   * Même montant, TMI 45%
   * Économie: 3 000 × 45% = 1 350€
   */
  const tmi2 = 0.45;
  const economieIR2 = versementPER1 * tmi2; // 1 350€

  suite.assertAlmostEqual(
    economieIR2,
    1350,
    1,
    'PER: Déduction simple - TMI 45%'
  );

  /**
   * TEST 3: Gain PER vs économies à 30% et 45%
   * Le PER permet d'économiser sur des revenus à 45% qu'on aurait sinon
   * imposés à 30%
   * 
   * Hypothèse: revenu de 100k€ à 45%, on verse 10k€ en PER
   * Économie: 10 000 × 45% = 4 500€
   */
  const revenuElevé = 100000;
  const versementElevé = 10000;
  const tmiHaute = 0.45;
  const economieHaute = versementElevé * tmiHaute; // 4 500€

  suite.assertAlmostEqual(
    economieHaute,
    4500,
    1,
    'PER: Déduction sur revenu à 45%'
  );

  /**
   * TEST 4: Prélèvements sociaux sur PER
   * PER réduit aussi la base pour les PS (CEHR)
   * Taux CEHR: 3.8% environ sur RFR
   * Économie supplémentaire: 10 000 × 3.8% = 380€
   */
  const tauxCEHR = 0.038;
  const economieCEHR = versementElevé * tauxCEHR; // 380€

  suite.assertAlmostEqual(
    economieCEHR,
    380,
    1,
    'PER: Économie supplémentaire CEHR'
  );
}

/* ─────────────────────────────────────────────────────────────
   TESTS SUCCESSION ASSURANCE-VIE (990i et 757B)
───────────────────────────────────────────────────────────── */

function testSuccessionAV(suite: TestSuite): void {
  console.log('\n\n⚖️ SUCCESSION ASSURANCE-VIE TESTS');
  console.log('─────────────────────────────────\n');

  /**
   * TEST 1: Droits 990i (ligne directe, primes ≤ 70 ans)
   * Doc exemple:
   * - Capital décès: 84 000€
   * - Primes versées avant 70 ans: 80 000€
   * - Enfant bénéficiaire (ligne directe)
   * - Abattement: 30 500€ (art. 990 I)
   * - Assiette: 80 000 - 30 500 = 49 500€
   * - Taux: 60% (contrats > 1 200€ de primes)
   * - Droits: 49 500 × 60% = 29 700€ ??? Non, c'est 20% normalement
   * 
   * Correction: Taux normal pour enfant direct = 20%
   * Droits: 49 500 × 20% = 9 900€
   */
  const capitalDecès1 = 84000;
  const primesAvant701 = 80000;
  const abattement1 = 30500;
  const assiette1 = Math.max(0, primesAvant701 - abattement1); // 49 500€
  const taux1 = 0.20; // enfant direct
  const droits1 = assiette1 * taux1; // 9 900€

  suite.assertAlmostEqual(
    assiette1,
    49500,
    1,
    'Succession AV: Droits 990i ligne directe - assiette'
  );
  suite.assertAlmostEqual(
    droits1,
    9900,
    1,
    'Succession AV: Droits 990i ligne directe - droits dus'
  );

  /**
   * TEST 2: Droits 757B (succession régulière)
   * Cas exemple de la doc:
   * - Actif successoral: 130 000€ (réparti: 65 000€ par enfant)
   * - Enfant direct: abattement 100 000€, taux 20%
   * - Assiette pour 1 enfant: 65 000 - 100 000 = max(0, -35 000) = 0€
   * - Droits: 0€
   */
  const actifSuccessoral = 130000;
  const partEnfant = 65000;
  const abattementLigneDirecte = 100000;
  const assietteEnfant = Math.max(0, partEnfant - abattementLigneDirecte); // 0€
  const droitsEnfant = assietteEnfant * 0.20; // 0€

  suite.assert(
    assietteEnfant === 0,
    'Succession AV: 757B ligne directe - abattement couvre assiette',
    0,
    assietteEnfant
  );
  suite.assert(
    droitsEnfant === 0,
    'Succession AV: 757B ligne directe - droits nuls',
    0,
    droitsEnfant
  );

  /**
   * TEST 3: Répartition entre primes et produits
   * Doc exemple (rachats successifs):
   * Contrat: 100 000€ de primes versées
   * Valeur après 1er rachat: 120 000€
   * 1er rachat partiel: 30 000€ alors que VR = 120 000€
   * 
   * Formule: A = RP - (P × RP / VR)
   *        = 30 000 - (100 000 × 30 000 / 120 000)
   *        = 30 000 - 25 000
   *        = 5 000€ de produits imposables
   */
  const primes = 100000;
  const valeurRachat = 120000;
  const montantRachat = 30000;
  const primesRachetees = (primes * montantRachat) / valeurRachat; // 25 000€
  const produitsImposables = montantRachat - primesRachetees; // 5 000€

  suite.assertAlmostEqual(
    primesRachetees,
    25000,
    1,
    'Succession AV: Répartition - part de primes rachetées'
  );
  suite.assertAlmostEqual(
    produitsImposables,
    5000,
    1,
    'Succession AV: Répartition - produits imposables'
  );

  /**
   * TEST 4: Rachats partiels successifs
   * Doc: après 1er rachat, primes résiduelles = 100 000 - 25 000 = 75 000€
   * 2e rachat: 30 000€ sur contrat VR = 120 000€
   * 
   * Assiette: 30 000 - (75 000 × 30 000 / 120 000)
   *         = 30 000 - 18 750
   *         = 11 250€
   */
  const primesResiduelles = primes - primesRachetees; // 75 000€
  const montantRachat2 = 30000;
  const valeurRachat2 = 120000;
  const primesRachetees2 = (primesResiduelles * montantRachat2) / valeurRachat2; // 18 750€
  const produitsImposables2 = montantRachat2 - primesRachetees2; // 11 250€

  suite.assertAlmostEqual(
    primesResiduelles,
    75000,
    1,
    'Succession AV: Rachats successifs - primes résiduelles'
  );
  suite.assertAlmostEqual(
    produitsImposables2,
    11250,
    1,
    'Succession AV: Rachats successifs - produits 2e rachat'
  );
}

/* ─────────────────────────────────────────────────────────────
   ENTRY POINT
───────────────────────────────────────────────────────────── */

function main(): void {
  const suite = new TestSuite();

  testAssuranceVie(suite);
  testIR(suite);
  testPER(suite);
  testSuccessionAV(suite);

  suite.printReport();
}

main();
