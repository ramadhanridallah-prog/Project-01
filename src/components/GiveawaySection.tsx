import React, { useState } from 'react';
import {
  TrendingUp,
  Package,
  DollarSign,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { BatchAnalysis, BdktRecord } from '../types/bdkt';
import { formatIDR } from '../utils/bdkt';

interface GiveawaySectionProps {
  records: BdktRecord[];
  analysis: BatchAnalysis;
  costPerKg: number;
  onCostPerKgChange: (cost: number) => void;
}

export const GiveawaySection: React.FC<GiveawaySectionProps> = ({
  records,
  analysis,
  costPerKg,
  onCostPerKgChange,
}) => {
  const [dailyProductionUnits, setDailyProductionUnits] = useState<number>(10000);
  const [workingDaysPerMonth, setWorkingDaysPerMonth] = useState<number>(25);
  const [costInput, setCostInput] = useState<string>(String(costPerKg));

  const handleUpdateCost = () => {
    const val = parseFloat(costInput.replace(/[^\d]/g, ''));
    if (!isNaN(val) && val >= 0) {
      onCostPerKgChange(val);
    }
  };

  // 1. QUANTITY ANALYSIS
  const overfillRecords = records.filter((r) => r.gap > 0);
  const overfillCount = overfillRecords.length;
  const overfillPercentage = records.length > 0 ? (overfillCount / records.length) * 100 : 0;

  // Total giveaway in grams & kg
  const totalGiveawayGrams = overfillRecords.reduce((acc, r) => acc + r.gap, 0);
  const totalGiveawayKg = totalGiveawayGrams / 1000;

  // Average giveaway per sample tested
  const avgGiveawayPerUnitGrams = records.length > 0 ? totalGiveawayGrams / records.length : 0;

  // Equivalent lost finished products
  const equivalentLostProducts = analysis.nominalWeight > 0
    ? Number((totalGiveawayGrams / analysis.nominalWeight).toFixed(1))
    : 0;

  // Scale projections (Quantity)
  const monthlyUnits = dailyProductionUnits * workingDaysPerMonth;
  const projectedDailyGiveawayKg = (avgGiveawayPerUnitGrams * dailyProductionUnits) / 1000;
  const projectedMonthlyGiveawayKg = (avgGiveawayPerUnitGrams * monthlyUnits) / 1000;
  const projectedMonthlyLostProducts = analysis.nominalWeight > 0
    ? Math.round((projectedMonthlyGiveawayKg * 1000) / analysis.nominalWeight)
    : 0;

  // 2. FINANCIAL / HARGA ANALYSIS
  const costPerGram = costPerKg / 1000;
  const currentBatchLoss = Math.round(totalGiveawayGrams * costPerGram);
  const costPerUnitGiveaway = avgGiveawayPerUnitGrams * costPerGram;
  const projectedDailyLoss = Math.round(projectedDailyGiveawayKg * costPerKg);
  const projectedMonthlyLoss = Math.round(projectedMonthlyGiveawayKg * costPerKg);
  const projectedYearlyLoss = projectedMonthlyLoss * 12;

  // Optimal Filling Setpoint Recommendation:
  const safeBuffer = Math.max(analysis.stdDeviation * 1.65, analysis.tolerableDeficiency * 0.25);
  const optimalMeanTarget = Number((analysis.nominalWeight + safeBuffer).toFixed(2));
  const currentMean = analysis.averageActualWeight;
  const potentialReductionPerUnitGrams = Math.max(0, currentMean - optimalMeanTarget);
  const potentialMonthlySavings = Math.round(
    ((potentialReductionPerUnitGrams * monthlyUnits) / 1000) * costPerKg
  );

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-xs space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-amber-600" />
            </div>
            <h3 className="text-base font-bold text-slate-900">
              Analisis Giveaway Material (Overfill Produk)
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Mengukur kelebihan berat di atas standar nominal (Qn) dari sisi kuantitas fisik dan kerugian finansial.
          </p>
        </div>

        {/* Dynamic Cost Input Widget */}
        <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200 text-xs">
          <span className="text-slate-600 font-medium pl-1">Harga Bahan:</span>
          <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-slate-300">
            <span className="text-slate-500 font-mono">Rp</span>
            <input
              type="text"
              value={costInput}
              onChange={(e) => setCostInput(e.target.value)}
              onBlur={handleUpdateCost}
              onKeyDown={(e) => e.key === 'Enter' && handleUpdateCost()}
              className="w-20 bg-transparent text-slate-900 font-mono font-bold text-xs focus:outline-none"
            />
            <span className="text-slate-500 font-mono">/kg</span>
          </div>
          <button
            onClick={handleUpdateCost}
            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition shadow-2xs cursor-pointer"
          >
            Update
          </button>
        </div>
      </div>

      {/* Main 2 Sub-Sections Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SUB 1: HASIL GIVEAWAY SECARA QUANTITY */}
        <div className="bg-slate-50/70 rounded-xl border border-slate-200 p-4 sm:p-5 flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-cyan-600" />
              <h4 className="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wide">
                Sub Kuantitas (Quantity Breakdown)
              </h4>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-50 text-cyan-700 font-mono font-bold border border-cyan-200">
              Fisik Material
            </span>
          </div>

          {/* Quantity KPI Highlights */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] text-slate-500 block font-medium">
                Total Kelebihan (Batch Uji)
              </span>
              <div className="text-xl font-black text-cyan-700 mt-0.5">
                {totalGiveawayGrams.toFixed(1)}{' '}
                <span className="text-xs font-normal text-slate-500">g ({totalGiveawayKg.toFixed(3)} kg)</span>
              </div>
              <span className="text-[10px] text-slate-400 block mt-1">
                Dari {records.length} sampel pengujian
              </span>
            </div>

            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] text-slate-500 block font-medium">
                Rata-rata Giveaway / Unit
              </span>
              <div className="text-xl font-black text-slate-900 mt-0.5">
                +{avgGiveawayPerUnitGrams.toFixed(2)}{' '}
                <span className="text-xs font-normal text-slate-500">{analysis.unit}/kemasan</span>
              </div>
              <span className="text-[10px] text-slate-400 block mt-1">
                Target: {analysis.nominalWeight} {analysis.unit}
              </span>
            </div>

            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] text-slate-500 block font-medium">
                Frekuensi Unit Overfill
              </span>
              <div className="text-xl font-black text-amber-600 mt-0.5">
                {overfillCount}{' '}
                <span className="text-xs font-normal text-slate-500">
                  unit ({overfillPercentage.toFixed(1)}%)
                </span>
              </div>
              <span className="text-[10px] text-slate-400 block mt-1">
                Berat aktual &gt; standar nominal
              </span>
            </div>

            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] text-slate-500 block font-medium">
                Ekivalen Produk Hilang
              </span>
              <div className="text-xl font-black text-rose-600 mt-0.5">
                ~{equivalentLostProducts}{' '}
                <span className="text-xs font-normal text-slate-500">kemasan</span>
              </div>
              <span className="text-[10px] text-slate-400 block mt-1">
                Material gratis terbuang
              </span>
            </div>
          </div>

          {/* Scale Projection: Quantity Table */}
          <div className="pt-2">
            <span className="text-[11px] font-bold text-slate-700 block mb-2">
              Proyeksi Akumulasi Kuantitas Produksi:
            </span>
            <div className="space-y-1.5 text-xs text-slate-700 font-mono">
              <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200">
                <span className="text-slate-500">Per 1.000 Kemasan:</span>
                <span className="font-bold text-cyan-700">
                  +{(avgGiveawayPerUnitGrams).toFixed(2)} kg bahan
                </span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200">
                <span className="text-slate-500">
                  Proyeksi Harian ({dailyProductionUnits.toLocaleString()} unit):
                </span>
                <span className="font-bold text-cyan-700">
                  +{projectedDailyGiveawayKg.toFixed(1)} kg / hari
                </span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200">
                <span className="text-slate-500">
                  Proyeksi Bulanan ({workingDaysPerMonth} hari kerja):
                </span>
                <span className="font-bold text-amber-700">
                  +{projectedMonthlyGiveawayKg.toFixed(0)} kg / bulan (~{projectedMonthlyLostProducts.toLocaleString()} pack)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* SUB 2: HASIL GIVEAWAY SECARA HARGA (FINANSIAL) */}
        <div className="bg-slate-50/70 rounded-xl border border-slate-200 p-4 sm:p-5 flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-600" />
              <h4 className="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wide">
                Sub Nilai Finansial (Financial Loss & Savings)
              </h4>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-mono font-bold border border-emerald-200">
              Rupiah (IDR)
            </span>
          </div>

          {/* Financial KPI Highlights */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] text-slate-500 block font-medium">
                Biaya Giveaway (Batch Ini)
              </span>
              <div className="text-xl font-black text-amber-600 mt-0.5">
                {formatIDR(currentBatchLoss)}
              </div>
              <span className="text-[10px] text-slate-400 block mt-1">
                Rp {costPerUnitGiveaway.toFixed(1)} / kemasan
              </span>
            </div>

            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] text-slate-500 block font-medium">
                Proyeksi Kerugian Harian
              </span>
              <div className="text-xl font-black text-rose-600 mt-0.5">
                {formatIDR(projectedDailyLoss)}
              </div>
              <span className="text-[10px] text-slate-400 block mt-1">
                Berdasarkan {dailyProductionUnits.toLocaleString()} unit/hari
              </span>
            </div>

            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] text-slate-500 block font-medium">
                Proyeksi Kerugian Bulanan
              </span>
              <div className="text-xl font-black text-rose-600 mt-0.5">
                {formatIDR(projectedMonthlyLoss)}
              </div>
              <span className="text-[10px] text-slate-400 block mt-1">
                {workingDaysPerMonth} hari kerja / bulan
              </span>
            </div>

            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] text-slate-500 block font-medium">
                Proyeksi Tahunan
              </span>
              <div className="text-xl font-black text-rose-700 mt-0.5">
                {formatIDR(projectedYearlyLoss)}
              </div>
              <span className="text-[10px] text-slate-400 block mt-1">
                Biaya material terbuang
              </span>
            </div>
          </div>

          {/* Cost Savings Opportunity Engine */}
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>Peluang Penghematan Biaya (Cost Savings Opportunity)</span>
            </div>
            <p className="text-[11px] text-slate-700 leading-relaxed">
              Jika setpoint rata-rata mesin pengisi diturunkan dari{' '}
              <strong className="text-slate-900">{currentMean.toFixed(2)} {analysis.unit}</strong> ke setpoint optimal aman{' '}
              <strong className="text-emerald-700 font-bold">{optimalMeanTarget} {analysis.unit}</strong>:
            </p>
            <div className="flex items-center justify-between pt-1 text-xs">
              <span className="text-slate-600 font-medium">Potensi Hemat / Bulan:</span>
              <span className="text-base font-black text-emerald-700 font-mono">
                {formatIDR(potentialMonthlySavings)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Production Scale Configuration Slider */}
      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-2 text-slate-700 font-medium">
          <Calendar className="w-4 h-4 text-slate-500" />
          <span>Simulasi Kapasitas Pabrik untuk Proyeksi Biaya:</span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-600">Target / Hari:</span>
            <input
              type="number"
              step="1000"
              value={dailyProductionUnits}
              onChange={(e) => setDailyProductionUnits(Math.max(100, parseInt(e.target.value) || 0))}
              className="w-24 bg-white text-slate-800 font-mono text-xs px-2 py-1 rounded-lg border border-slate-300"
            />
            <span className="text-slate-500">unit</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-600">Hari / Bulan:</span>
            <input
              type="number"
              min="1"
              max="31"
              value={workingDaysPerMonth}
              onChange={(e) => setWorkingDaysPerMonth(Math.min(31, Math.max(1, parseInt(e.target.value) || 1)))}
              className="w-16 bg-white text-slate-800 font-mono text-xs px-2 py-1 rounded-lg border border-slate-300"
            />
            <span className="text-slate-500">hari</span>
          </div>
        </div>
      </div>
    </div>
  );
};
