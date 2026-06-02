/**
 * SCRIPT D'INTÉGRATION - Validation des APIs réelles
 * ===================================================
 *
 * Teste les endpoints contre des cas concrets issus de la documentation.
 * À exécuter contre le serveur lancé (npm run dev)
 *
 * Usage: npx ts-node test-api.ts
 */

import fetch from 'node-fetch';

/* ─────────────────────────────────────────────────────────────
   CONFIGURATION
───────────────────────────────────────────────────────────── */

const API_BASE = process.env.API_URL || 'http://localhost:3000';
const TIMEOUT = 5000;

interface APITestCase {
  name: string;
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  payload?: unknown;
  expectedFields?: string[];
  assertions?: (result: unknown) => boolean[];
}

interface APITestResult {
  passed: boolean;
  testName: string;
  status?: number;
  error?: string;
  data?: unknown;
}

class APITestRunner {
  private results: APITestResult[] = [];
  private passCount = 0;
  private failCount = 0;

  /**
   * Effectuer une requête HTTP avec timeout
   */
  private async makeRequest(
    endpoint: string,
    method: string,
    payload?: unknown
  ): Promise<{ status: number; data: unknown; error?: string }> {
    const url = `${API_BASE}${endpoint}`;
    const options: RequestInit = {
      method,
      headers: { 'Content-Type': 'application/json' },
      timeout: TIMEOUT,
    };

    if (payload) {
      options.body = JSON.stringify(payload);
    }

    try {
      const res = await fetch(url, options);
      const text = await res.text();
      let data: unknown;

      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }

      return { status: res.status, data };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { status: 0, data: null, error: msg };
    }
  }

  /**
   * Tester un cas d'API
   */
  async runTest(testCase: APITestCase): Promise<void> {
    console.log(`\n  Testing: ${testCase.name}`);
    console.log(`    Endpoint: ${testCase.method} ${testCase.endpoint}`);

    const { status, data, error } = await this.makeRequest(
      testCase.endpoint,
      testCase.method,
      testCase.payload
    );

    let passed = false;
    let failReason = '';

    if (error) {
      failReason = `Network error: ${error}`;
    } else if (status >= 400) {
      failReason = `HTTP ${status}`;
    } else if (testCase.expectedFields) {
      const dataObj = data as Record<string, unknown>;
      const missing = testCase.expectedFields.filter((f) => !(f in dataObj));
      if (missing.length > 0) {
        failReason = `Missing fields: ${missing.join(', ')}`;
      } else {
        passed = true;
      }
    } else if (testCase.assertions) {
      const results = testCase.assertions(data);
      const failed = results.filter((r) => !r).length;
      if (failed > 0) {
        failReason = `${failed} assertion(s) failed`;
      } else {
        passed = true;
      }
    } else {
      passed = status >= 200 && status < 300;
    }

    if (passed) {
      this.passCount++;
      console.log(`    ✅ PASSED`);
    } else {
      this.failCount++;
      console.log(`    ❌ FAILED: ${failReason}`);
      console.log(`    Response: ${JSON.stringify(data).substring(0, 200)}`);
    }

    this.results.push({
      passed,
      testName: testCase.name,
      status,
      error: failReason || undefined,
      data,
    });
  }

  /**
   * Exécuter une suite de tests
   */
  async runSuite(tests: APITestCase[]): Promise<void> {
    for (const test of tests) {
      await this.runTest(test);
    }
  }

  /**
   * Afficher un rapport
   */
  printReport(): void {
    console.log('\n\n' + '═'.repeat(70));
    console.log(`API TEST REPORT: ${this.passCount}/${this.passCount + this.failCount} passed`);
    console.log('═'.repeat(70));

    const failed = this.results.filter((r) => !r.passed);
    if (failed.length > 0) {
      console.log('\nFailed tests:');
      failed.forEach((r) => {
        console.log(`  ❌ ${r.testName} (${r.error || r.status})`);
      });
    }

    console.log('\n' + '═'.repeat(70));
  }
}

/* ─────────────────────────────────────────────────────────────
   TESTS : ASSURANCE-VIE
───────────────────────────────────────────────────────────── */

const avTests: APITestCase[] = [
  {
    name: 'AV: Rachat partiel <8ans (doc exemple 1)',
    endpoint: '/api/calculate/assurance-vie',
    method: 'POST',
    payload: {
      valeurContrat: 120000,
      primesVersees: 100000,
      typeRachat: 'partiel',
      montantRachat: 30000,
      anciennete: 'moins8ans',
      tmi: 0.30,
      situation: 'celibataire',
    },
    expectedFields: [
      'plusValueTotale',
      'interetsBruts',
      'pfuTotal',
      'baremeTotal',
      'meilleureOption',
    ],
    assertions: (data: unknown) => {
      const d = data as Record<string, unknown>;
      return [
        d.interetsBruts === 5000,
        d.pfuTotal > 800 && d.pfuTotal < 1600,
        ['pfu', 'bareme', 'egal'].includes(d.meilleureOption as string),
      ];
    },
  },

  {
    name: 'AV: Rachat partiel ≥8ans célibataire',
    endpoint: '/api/calculate/assurance-vie',
    method: 'POST',
    payload: {
      valeurContrat: 120000,
      primesVersees: 100000,
      typeRachat: 'partiel',
      montantRachat: 30000,
      anciennete: 'plus8ans',
      tmi: 0.30,
      situation: 'celibataire',
    },
    assertions: (data: unknown) => {
      const d = data as Record<string, unknown>;
      return [
        d.abattement === 4600,
        d.interetsImposables === 400,
      ];
    },
  },

  {
    name: 'AV: Rachat partiel ≥8ans couple',
    endpoint: '/api/calculate/assurance-vie',
    method: 'POST',
    payload: {
      valeurContrat: 120000,
      primesVersees: 100000,
      typeRachat: 'partiel',
      montantRachat: 30000,
      anciennete: 'plus8ans',
      tmi: 0.30,
      situation: 'marie_pacse',
    },
    assertions: (data: unknown) => {
      const d = data as Record<string, unknown>;
      return [
        d.abattement === 5000,
        d.interetsImposables === 0,
        d.pfuTotal < 900,
      ];
    },
  },

  {
    name: 'AV: Rachat total moins-value',
    endpoint: '/api/calculate/assurance-vie',
    method: 'POST',
    payload: {
      valeurContrat: 90000,
      primesVersees: 100000,
      typeRachat: 'total',
      montantRachat: 0,
      anciennete: 'plus8ans',
      tmi: 0.30,
      situation: 'celibataire',
    },
    assertions: (data: unknown) => {
      const d = data as Record<string, unknown>;
      return [
        d.plusValueTotale === -10000,
        d.interetsBruts === 0,
        d.pfuTotal === 0,
        d.baremeTotal === 0,
      ];
    },
  },

  {
    name: 'AV: Rachat partiel primes >150k (taux mixte)',
    endpoint: '/api/calculate/assurance-vie',
    method: 'POST',
    payload: {
      valeurContrat: 220000,
      primesVersees: 200000,
      typeRachat: 'partiel',
      montantRachat: 20000,
      anciennete: 'plus8ans',
      tmi: 0.30,
      situation: 'celibataire',
    },
    expectedFields: ['pfuTauxIR'],
    assertions: (data: unknown) => {
      const d = data as Record<string, unknown>;
      // Taux moyen doit être entre 7.5% et 12.8% (mixte)
      const taux = d.pfuTauxIR as number;
      return [taux > 0.075 && taux < 0.128];
    },
  },

  {
    name: 'AV: Validation - JSON malformé',
    endpoint: '/api/calculate/assurance-vie',
    method: 'POST',
    payload: { invalid: 'data' },
    assertions: (data: unknown) => {
      const d = data as Record<string, unknown>;
      return [typeof d.error === 'string'];
    },
  },
];

/* ─────────────────────────────────────────────────────────────
   TESTS : IMPÔT SUR REVENU
───────────────────────────────────────────────────────────── */

const irTests: APITestCase[] = [
  {
    name: 'IR: Célibataire 50k€',
    endpoint: '/api/calculate/ir',
    method: 'POST',
    payload: {
      annee: '2026',
      situation: 'celibataire',
      revenus: { '1AJ': 50000 },
      enfants: [],
    },
    expectedFields: ['totalBrut', 'revenuNetImposable', 'optionA'],
    assertions: (data: unknown) => {
      const d = data as Record<string, unknown>;
      const optA = d.optionA as Record<string, unknown>;
      return [
        d.totalBrut === 50000,
        typeof optA.impot === 'number',
        optA.impot > 4000 && optA.impot < 6000,
      ];
    },
  },

  {
    name: 'IR: Marié 100k€, 2 enfants',
    endpoint: '/api/calculate/ir',
    method: 'POST',
    payload: {
      annee: '2026',
      situation: 'marie_pacs',
      revenus: { '1AJ': 100000 },
      enfants: [
        { age: 15, estEtudiant: false, gardeAlternee: false },
        { age: 18, estEtudiant: false, gardeAlternee: false },
      ],
    },
    assertions: (data: unknown) => {
      const d = data as Record<string, unknown>;
      const optA = d.optionA as Record<string, unknown>;
      return [
        optA.parts === 3,
        typeof optA.impot === 'number',
        optA.impot > 6000 && optA.impot < 8000,
      ];
    },
  },

  {
    name: 'IR: Comparaison détachement enfant',
    endpoint: '/api/calculate/ir',
    method: 'POST',
    payload: {
      annee: '2026',
      situation: 'marie_pacs',
      revenus: { '1AJ': 120000 },
      enfants: [
        { age: 23, estEtudiant: false, gardeAlternee: false },
      ],
      compareDetachement: true,
    },
    expectedFields: ['optionA', 'optionB', 'gainDetachement'],
    assertions: (data: unknown) => {
      const d = data as Record<string, unknown>;
      return [
        d.optionB !== null,
        typeof d.gainDetachement === 'number',
      ];
    },
  },

  {
    name: 'IR: Enfant en garde alternée',
    endpoint: '/api/calculate/ir',
    method: 'POST',
    payload: {
      annee: '2026',
      situation: 'marie_pacs',
      revenus: { '1AJ': 80000 },
      enfants: [
        { age: 10, estEtudiant: false, gardeAlternee: true },
      ],
    },
    assertions: (data: unknown) => {
      const d = data as Record<string, unknown>;
      const optA = d.optionA as Record<string, unknown>;
      return [
        optA.parts === 2.25, // 2 (marié) + 0.25 (enfant alternée)
      ];
    },
  },
];

/* ─────────────────────────────────────────────────────────────
   TESTS : PER
───────────────────────────────────────────────────────────── */

const perTests: APITestCase[] = [
  {
    name: 'PER: Versement 3k€ à TMI 30%',
    endpoint: '/api/calculate/per',
    method: 'POST',
    payload: {
      revenuBrutGlobal: 50000,
      versementPER: 3000,
      situation: 'celibataire',
      enfants: [],
    },
    expectedFields: ['economieIRReelle', 'tmiAvant', 'tmiApres'],
    assertions: (data: unknown) => {
      const d = data as Record<string, unknown>;
      return [
        typeof d.economieIRReelle === 'number',
        d.economieIRReelle > 800 && d.economieIRReelle < 1000,
      ];
    },
  },

  {
    name: 'PER: Versement 10k€ à TMI 45%',
    endpoint: '/api/calculate/per',
    method: 'POST',
    payload: {
      revenuBrutGlobal: 150000,
      versementPER: 10000,
      situation: 'marie_pacs',
      enfants: [
        { age: 12, estEtudiant: false, gardeAlternee: false },
      ],
    },
    assertions: (data: unknown) => {
      const d = data as Record<string, unknown>;
      return [
        typeof d.economieIRReelle === 'number',
        d.economieIRReelle > 4000,
      ];
    },
  },

  {
    name: 'PER: Effet de seuil',
    endpoint: '/api/calculate/per',
    method: 'POST',
    payload: {
      revenuBrutGlobal: 80000,
      versementPER: 5000,
      situation: 'celibataire',
      enfants: [],
    },
    expectedFields: ['tmiBaisse'],
    assertions: (data: unknown) => {
      const d = data as Record<string, unknown>;
      return [typeof d.tmiBaisse === 'boolean'];
    },
  },
];

/* ─────────────────────────────────────────────────────────────
   TESTS : SUCCESSION AV
───────────────────────────────────────────────────────────── */

const successionAVTests: APITestCase[] = [
  {
    name: 'Succession AV: Droits 990i (doc exemple)',
    endpoint: '/api/calculate/succession-av',
    method: 'POST',
    payload: {
      contrats: [
        {
          id: 'c1',
          nom: 'Contrat 1',
          capitalDecès: 84000,
          primesAvant70: 80000,
          primesApres70: 0,
          dateVersement: '2010-01-01',
        },
      ],
      beneficiaires: [
        {
          id: 'b1',
          nom: 'Pierre',
          lienParente: 'enfant',
          repartition: { c1: 100 },
        },
      ],
    },
    expectedFields: ['totalDroits', 'detailBeneficiaires'],
    assertions: (data: unknown) => {
      const d = data as Record<string, unknown>;
      return [
        typeof d.totalDroits === 'number',
        d.totalDroits > 0,
      ];
    },
  },

  {
    name: 'Succession AV: Représentation (petit-enfant)',
    endpoint: '/api/calculate/succession-av',
    method: 'POST',
    payload: {
      contrats: [
        {
          id: 'c1',
          nom: 'Contrat',
          capitalDecès: 130000,
          primesAvant70: 80000,
          primesApres70: 0,
          dateVersement: '2010-01-01',
        },
      ],
      beneficiaires: [
        {
          id: 'b1',
          nom: 'Pierre',
          lienParente: 'enfant',
          repartition: { c1: 50 },
        },
        {
          id: 'b2',
          nom: 'Camille',
          lienParente: 'petit_enfant',
          repartition: { c1: 50 },
        },
      ],
    },
    assertions: (data: unknown) => {
      const d = data as Record<string, unknown>;
      return [typeof d.totalDroits === 'number'];
    },
  },
];

/* ─────────────────────────────────────────────────────────────
   MAIN
───────────────────────────────────────────────────────────── */

async function main(): Promise<void> {
  const runner = new APITestRunner();

  console.log('\n' + '═'.repeat(70));
  console.log('API INTEGRATION TEST SUITE');
  console.log('═'.repeat(70));

  console.log('\n📋 ASSURANCE-VIE TESTS');
  console.log('──────────────────────');
  await runner.runSuite(avTests);

  console.log('\n🧮 IMPÔT SUR REVENU TESTS');
  console.log('─────────────────────────');
  await runner.runSuite(irTests);

  console.log('\n💰 PER TESTS');
  console.log('────────────');
  await runner.runSuite(perTests);

  console.log('\n⚖️ SUCCESSION AV TESTS');
  console.log('─────────────────────');
  await runner.runSuite(successionAVTests);

  runner.printReport();
}

main().catch(console.error);
