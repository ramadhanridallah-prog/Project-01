import { BatchAnalysis, BatchComplianceStatus, BdktRecord, BdktStatus } from '../types/bdkt';

/**
 * Menghitung Batas Toleransi Kekurangan (T) berdasarkan Regulasi BDKT
 * (Permendag RI No. 31/M-DAG/PER/10/2011 dan OIML R 87)
 * Satuan input: gram (g) atau mililiter (ml)
 */
export function calculateTolerableDeficiency(nominalWeight: number): number {
  const qn = Math.abs(nominalWeight);

  if (qn < 5) {
    return Number((qn * 0.09).toFixed(2));
  } else if (qn <= 50) {
    return Number((qn * 0.09).toFixed(2));
  } else if (qn <= 100) {
    return 4.5;
  } else if (qn <= 200) {
    return Number((qn * 0.045).toFixed(2));
  } else if (qn <= 300) {
    return 9.0;
  } else if (qn <= 500) {
    return Number((qn * 0.03).toFixed(2));
  } else if (qn <= 1000) {
    return 15.0;
  } else if (qn <= 10000) {
    return Number((qn * 0.015).toFixed(2));
  } else if (qn <= 15000) {
    return 150.0;
  } else {
    return Number((qn * 0.01).toFixed(2));
  }
}

/**
 * Menghitung batas T1 (Qn - T)
 */
export function getT1Limit(nominalWeight: number, customT?: number): number {
  const t = customT ?? calculateTolerableDeficiency(nominalWeight);
  return Number((nominalWeight - t).toFixed(2));
}

/**
 * Menghitung batas T2 (Qn - 2*T) - Batas ganda tidak boleh dilanggar (Zero Tolerance)
 */
export function getT2Limit(nominalWeight: number, customT?: number): number {
  const t = customT ?? calculateTolerableDeficiency(nominalWeight);
  return Number((nominalWeight - 2 * t).toFixed(2));
}

/**
 * Evaluasi status satu sampel BDKT
 */
export function evaluateSampleStatus(
  actualWeight: number,
  nominalWeight: number,
  customT?: number
): { status: BdktStatus; gap: number; gapPercent: number; t: number; t1: number; t2: number } {
  const t = customT ?? calculateTolerableDeficiency(nominalWeight);
  const t1 = nominalWeight - t;
  const t2 = nominalWeight - 2 * t;
  const gap = actualWeight - nominalWeight;
  const gapPercent = nominalWeight > 0 ? (gap / nominalWeight) * 100 : 0;

  let status: BdktStatus = 'OK';

  if (actualWeight < t2) {
    status = 'T2_FAIL';
  } else if (actualWeight < t1) {
    status = 'T1_DEFICIENT';
  } else if (gap > 2 * t) {
    status = 'OVERFILL';
  } else {
    status = 'OK';
  }

  return {
    status,
    gap: Number(gap.toFixed(3)),
    gapPercent: Number(gapPercent.toFixed(2)),
    t,
    t1: Number(t1.toFixed(2)),
    t2: Number(t2.toFixed(2)),
  };
}

/**
 * Melakukan evaluasi lengkap terhadap satu kelompok / batch sampel BDKT
 */
export function evaluateBatchData(
  records: BdktRecord[],
  productName: string = 'Produk Terpilih',
  batchNo: string = 'All Batches',
  unit: string = 'g',
  customCostPerKg: number = 25000
): BatchAnalysis {
  const productDescription = records.length > 0 ? records[0].productDescription : undefined;
  const skuCode = records.length > 0 ? records[0].skuCode : undefined;
  const category = records.length > 0 ? records[0].category : undefined;

  if (records.length === 0) {
    return {
      productName,
      productDescription,
      skuCode,
      category,
      batchNo,
      unit,
      sampleCount: 0,
      nominalWeight: 0,
      tolerableDeficiency: 0,
      t1Limit: 0,
      t2Limit: 0,
      averageActualWeight: 0,
      averageGap: 0,
      averageGapPercent: 0,
      minActualWeight: 0,
      maxActualWeight: 0,
      range: 0,
      stdDeviation: 0,
      variance: 0,
      cp: null,
      cpk: null,
      t1Count: 0,
      t1Percent: 0,
      t2Count: 0,
      t2Percent: 0,
      okCount: 0,
      okPercent: 0,
      overfillCount: 0,
      overfillPercent: 0,
      isAveragePassed: false,
      isT2Passed: false,
      isT1Passed: false,
      overallStatus: 'FAIL_AVERAGE',
      statusMessage: 'Belum ada data pengujian BDKT.',
      totalGiveawayGrams: 0,
      estimatedCostPerKg: customCostPerKg,
      giveawayFinancialLoss: 0,
    };
  }

  // Nominal weight dari rata-rata atau sampel pertama
  const nominalWeight = records[0].nominalWeight;
  const t = calculateTolerableDeficiency(nominalWeight);
  const t1Limit = Number((nominalWeight - t).toFixed(2));
  const t2Limit = Number((nominalWeight - 2 * t).toFixed(2));

  const sampleCount = records.length;
  const actualWeights = records.map((r) => r.actualWeight);

  const sum = actualWeights.reduce((acc, val) => acc + val, 0);
  const averageActualWeight = sum / sampleCount;

  const averageGap = averageActualWeight - nominalWeight;
  const averageGapPercent = (averageGap / nominalWeight) * 100;

  const minActualWeight = Math.min(...actualWeights);
  const maxActualWeight = Math.max(...actualWeights);
  const range = maxActualWeight - minActualWeight;

  // Standard Deviation
  const variance =
    sampleCount > 1
      ? actualWeights.reduce((acc, val) => acc + Math.pow(val - averageActualWeight, 2), 0) / (sampleCount - 1)
      : 0;
  const stdDeviation = Math.sqrt(variance);

  // Breakdown status
  let t1Count = 0;
  let t2Count = 0;
  let okCount = 0;
  let overfillCount = 0;
  let totalGiveawayGrams = 0;

  records.forEach((r) => {
    if (r.status === 'T2_FAIL') {
      t2Count++;
    } else if (r.status === 'T1_DEFICIENT') {
      t1Count++;
    } else if (r.status === 'OVERFILL') {
      overfillCount++;
    } else {
      okCount++;
    }

    if (r.gap > 0) {
      totalGiveawayGrams += r.gap;
    }
  });

  const t1Percent = Number(((t1Count / sampleCount) * 100).toFixed(2));
  const t2Percent = Number(((t2Count / sampleCount) * 100).toFixed(2));
  const okPercent = Number(((okCount / sampleCount) * 100).toFixed(2));
  const overfillPercent = Number(((overfillCount / sampleCount) * 100).toFixed(2));

  // Compliance rules
  const isAveragePassed = averageActualWeight >= nominalWeight;
  const isT2Passed = t2Count === 0; // Zero tolerance
  const isT1Passed = t1Percent <= 2.5; // Maksimal 2.5%

  // Process Capability Index (USL = nominal + 3*T, LSL = nominal - T)
  let cp: number | null = null;
  let cpk: number | null = null;
  if (stdDeviation > 0.0001) {
    const usl = nominalWeight + 2 * t;
    const lsl = t1Limit;
    cp = Number(((usl - lsl) / (6 * stdDeviation)).toFixed(2));
    const cpu = (usl - averageActualWeight) / (3 * stdDeviation);
    const cpl = (averageActualWeight - lsl) / (3 * stdDeviation);
    cpk = Number(Math.min(cpu, cpl).toFixed(2));
  }

  // Overall Status determination
  let overallStatus: BatchComplianceStatus = 'PASS';
  let statusMessage = 'Batch lolos dan MEMENUHI SYARAT BDKT sesuai regulasi.';

  if (!isT2Passed) {
    overallStatus = 'FAIL_T2';
    statusMessage = `DITOLAK (REJECT): Ditemukan ${t2Count} sampel di bawah batas T2 (${t2Limit} ${unit}). Zero tolerance berlaku!`;
  } else if (!isAveragePassed) {
    overallStatus = 'FAIL_AVERAGE';
    statusMessage = `DITOLAK (REJECT): Rata-rata berat aktual (${averageActualWeight.toFixed(2)} ${unit}) lebih rendah dari standar Qn (${nominalWeight} ${unit}). Terjadi underfill sistematis.`;
  } else if (!isT1Passed) {
    overallStatus = 'FAIL_T1_EXCESS';
    statusMessage = `DITOLAK (REJECT): Jumlah cacat T1 mencapai ${t1Percent}%, melebihi ambang batas maksimal 2.5%.`;
  } else if (averageGap > t * 0.5 || overfillPercent > 40) {
    overallStatus = 'WARNING_GIVEAWAY';
    statusMessage = `MEMENUHI SYARAT BDKT dengan CATATAN: Terjadi overfill tinggi (+${averageGap.toFixed(2)} ${unit}), berpotensi pemborosan material.`;
  }

  // Giveaway financial loss
  const giveawayKg = totalGiveawayGrams / 1000;
  const giveawayFinancialLoss = Math.round(giveawayKg * customCostPerKg);

  return {
    productName,
    productDescription,
    skuCode,
    category,
    batchNo,
    unit,
    sampleCount,
    nominalWeight,
    tolerableDeficiency: t,
    t1Limit,
    t2Limit,
    averageActualWeight: Number(averageActualWeight.toFixed(2)),
    averageGap: Number(averageGap.toFixed(2)),
    averageGapPercent: Number(averageGapPercent.toFixed(2)),
    minActualWeight: Number(minActualWeight.toFixed(2)),
    maxActualWeight: Number(maxActualWeight.toFixed(2)),
    range: Number(range.toFixed(2)),
    stdDeviation: Number(stdDeviation.toFixed(3)),
    variance: Number(variance.toFixed(4)),
    cp,
    cpk,
    t1Count,
    t1Percent,
    t2Count,
    t2Percent,
    okCount,
    okPercent,
    overfillCount,
    overfillPercent,
    isAveragePassed,
    isT2Passed,
    isT1Passed,
    overallStatus,
    statusMessage,
    totalGiveawayGrams: Number(totalGiveawayGrams.toFixed(1)),
    estimatedCostPerKg: customCostPerKg,
    giveawayFinancialLoss,
  };
}

/**
 * Format currency ke IDR Rupiah
 */
export function formatIDR(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);
}
