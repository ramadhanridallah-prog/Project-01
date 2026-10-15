import { BdktRecord } from '../types/bdkt';
import { evaluateSampleStatus } from '../utils/bdkt';

export interface SampleDatasetMeta {
  id: string;
  title: string;
  productName: string;
  batchNo: string;
  nominalWeight: number;
  unit: string;
  description: string;
  scenario: 'PASS' | 'REJECT_T2' | 'HIGH_GIVEAWAY' | 'FAIL_AVG';
}

export const SAMPLE_DATASETS: SampleDatasetMeta[] = [
  {
    id: 'kopi-100g',
    title: 'Kopi Bubuk Arabika 100g (Batch Lolos Standar)',
    productName: 'Kopi Bubuk Spesial 100g',
    batchNo: 'KPB-202610-01',
    nominalWeight: 100,
    unit: 'g',
    description: 'Contoh batch QC produksi yang memenuhi syarat metrologi BDKT. Ada 1 sampel T1 (dalam toleransi 2.5%).',
    scenario: 'PASS',
  },
  {
    id: 'biskuit-250g',
    title: 'Biskuit Cokelat 250g (Batch Ditolak - Fatal T2)',
    productName: 'Biskuit Cokelat Krispi 250g',
    batchNo: 'BCK-202610-09',
    nominalWeight: 250,
    unit: 'g',
    description: 'Contoh batch yang DITOLAK (REJECT) karena terdapat sampel di bawah batas kritis T2 (Zero Tolerance).',
    scenario: 'REJECT_T2',
  },
  {
    id: 'minyak-920g',
    title: 'Minyak Goreng Pouch 1000ml / 920g (Overfill Giveaway)',
    productName: 'Minyak Goreng Sawit 1000ml (920g)',
    batchNo: 'MGS-202610-14',
    nominalWeight: 920,
    unit: 'g',
    description: 'Batch lolos aturan konsumen, namun terjadi overfill berlebih sehingga pabrik menanggung biaya kehilangan bahan baku.',
    scenario: 'HIGH_GIVEAWAY',
  },
  {
    id: 'multi-produk',
    title: 'Multi-Produk Terpadu (Kopi 100g & Biskuit 250g)',
    productName: 'Multi-Produk (2 SKU)',
    batchNo: 'MULTI-LOT-01',
    nominalWeight: 100,
    unit: 'g',
    description: 'Dataset simulasi upload 2 produk sekaligus untuk memvalidasi pemisahan tren run chart dan filter per-produk.',
    scenario: 'PASS',
  },
];

export function getSampleRecords(datasetId: string): BdktRecord[] {
  const now = '2026-10-14';

  if (datasetId === 'multi-produk') {
    const kopiSamples = getSampleRecords('kopi-100g').slice(0, 20);
    const biskuitSamples = getSampleRecords('biskuit-250g').slice(0, 20);
    return [...kopiSamples, ...biskuitSamples];
  }

  if (datasetId === 'biskuit-250g') {
    const qn = 250;
    const tare = 8.2;
    // T = 9g, T1 = 241, T2 = 232
    const weights = [
      251.2, 252.0, 248.5, 250.3, 249.7, 251.8, 253.1, 246.0, 244.2, 250.8,
      249.1, 252.4, 250.6, 230.2, 248.9, 251.5, 253.0, 249.4, 250.1, 252.8,
      247.3, 250.5, 251.9, 249.0, 253.5, 240.5, 250.7, 252.1, 248.8, 251.4,
      250.2, 249.6, 252.3, 250.9, 251.7
    ];

    return weights.map((w, idx) => {
      const evalRes = evaluateSampleStatus(w, qn);
      return {
        id: `sample-biskuit-${idx + 1}`,
        sampleNo: idx + 1,
        timestamp: `${now} 0${Math.floor(idx / 5) + 8}:${(idx % 5) * 12 + 10}`,
        productName: 'Biskuit Cokelat Krispi 250g',
        productDescription: 'Kemasan bantal pillow pack plastik metalized, isi 12 keping per bungkus',
        skuCode: 'SKU-BCK-250',
        category: 'Biskuit & Snack',
        batchNo: 'BCK-202610-09',
        lineOrShift: idx < 18 ? 'Line 1 - Shift 1' : 'Line 1 - Shift 2',
        nominalWeight: qn,
        actualWeight: w,
        tareWeight: tare,
        grossWeight: Number((w + tare).toFixed(2)),
        unit: 'g',
        gap: evalRes.gap,
        gapPercent: evalRes.gapPercent,
        tolerableDeficiency: evalRes.t,
        t1Limit: evalRes.t1,
        t2Limit: evalRes.t2,
        status: evalRes.status,
      };
    });
  }

  if (datasetId === 'minyak-920g') {
    const qn = 920;
    const tare = 14.5;
    // T = 15g, T1 = 905g, T2 = 890g
    const weights = [
      932.5, 934.1, 930.8, 933.2, 935.0, 931.4, 936.2, 933.7, 929.5, 934.8,
      933.0, 932.1, 935.6, 934.4, 931.9, 937.1, 932.8, 933.9, 930.5, 936.0,
      934.2, 933.5, 931.8, 935.3, 932.4, 934.9, 933.1, 936.5, 932.7, 935.2
    ];

    return weights.map((w, idx) => {
      const evalRes = evaluateSampleStatus(w, qn);
      return {
        id: `sample-minyak-${idx + 1}`,
        sampleNo: idx + 1,
        timestamp: `${now} 0${Math.floor(idx / 5) + 8}:${(idx % 5) * 12 + 10}`,
        productName: 'Minyak Goreng Sawit 1000ml (920g)',
        productDescription: 'Standar density 0.92 g/ml, kemasan pouch standing 1 liter, tara 14.5g',
        skuCode: 'SKU-MGS-920',
        category: 'Minyak & Lemak',
        batchNo: 'MGS-202610-14',
        lineOrShift: idx < 15 ? 'Filling Line 3' : 'Filling Line 4',
        nominalWeight: qn,
        actualWeight: w,
        tareWeight: tare,
        grossWeight: Number((w + tare).toFixed(2)),
        unit: 'g',
        gap: evalRes.gap,
        gapPercent: evalRes.gapPercent,
        tolerableDeficiency: evalRes.t,
        t1Limit: evalRes.t1,
        t2Limit: evalRes.t2,
        status: evalRes.status,
      };
    });
  }

  // Default: Kopi Bubuk 100g (Lolos)
  const qn = 100;
  const tare = 2.5;
  // T = 4.5g, T1 = 95.5g, T2 = 91g
  const weights = [
    100.8, 101.2, 99.8, 100.5, 101.4, 99.5, 100.7, 101.0, 99.2, 101.5,
    95.2, 100.9, 101.3, 100.4, 101.1, 99.9, 100.6, 101.8, 100.2, 100.5,
    101.2, 99.7, 100.8, 101.4, 100.3, 101.0, 99.6, 100.9, 101.3, 100.7,
    100.4, 101.6, 99.8, 100.9, 101.1
  ];

  return weights.map((w, idx) => {
    const evalRes = evaluateSampleStatus(w, qn);
    return {
      id: `sample-kopi-${idx + 1}`,
      sampleNo: idx + 1,
      timestamp: `${now} 0${Math.floor(idx / 5) + 8}:${(idx % 5) * 12 + 10}`,
      productName: 'Kopi Bubuk Spesial 100g',
      productDescription: 'Kemasan sachet aluminium foil 100g, 1 box isi 20 sachet, tara 2.5g',
      skuCode: 'SKU-KPB-100',
      category: 'Minuman Bubuk',
      batchNo: 'KPB-202610-01',
      lineOrShift: idx < 18 ? 'Packaging Line A' : 'Packaging Line B',
      nominalWeight: qn,
      actualWeight: w,
      tareWeight: tare,
      grossWeight: Number((w + tare).toFixed(2)),
      unit: 'g',
      gap: evalRes.gap,
      gapPercent: evalRes.gapPercent,
      tolerableDeficiency: evalRes.t,
      t1Limit: evalRes.t1,
      t2Limit: evalRes.t2,
      status: evalRes.status,
    };
  });
}
