import React, { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  ShieldAlert,
  Info,
} from 'lucide-react';
import { BatchAnalysis } from '../types/bdkt';
import { formatIDR } from '../utils/bdkt';

interface MetricsCardsProps {
  analysis: BatchAnalysis;
  onCostPerKgChange: (cost: number) => void;
}

export const MetricsCards: React.FC<MetricsCardsProps> = ({
  analysis,
  onCostPerKgChange,
}) => {
  const [isEditingCost, setIsEditingCost] = useState(false);
  const [costInput, setCostInput] = useState(String(analysis.estimatedCostPerKg));

  const handleSaveCost = () => {
    const parsed = parseFloat(costInput.replace(/[^\d]/g, ''));
    if (!isNaN(parsed) && parsed >= 0) {
      onCostPerKgChange(parsed);
    }
    setIsEditingCost(false);
  };

  // Status Styling Configuration for Light Theme
  const getStatusBadge = () => {
    switch (analysis.overallStatus) {
      case 'PASS':
        return {
          bg: 'bg-emerald-50/80 border-emerald-300 text-emerald-900',
          badgeBg: 'bg-emerald-600 text-white',
          icon: <ShieldCheck className="w-6 h-6 text-emerald-600" />,
          title: 'MEMENUHI SYARAT BDKT (LOLOS UJI METROLOGI)',
          desc: 'Rata-rata berat aktual di atas standar Qn, tidak ada sampel cacat fatal T2, dan cacat T1 dalam batas izin toleransi.',
        };
      case 'WARNING_GIVEAWAY':
        return {
          bg: 'bg-amber-50/80 border-amber-300 text-amber-950',
          badgeBg: 'bg-amber-500 text-slate-950',
          icon: <AlertTriangle className="w-6 h-6 text-amber-600" />,
          title: 'MEMENUHI SYARAT BDKT - DENGAN CATATAN OVERFILL',
          desc: 'Secara legal metrologi lolos, namun rata-rata pengisian berlebih signifikan (potensi pemborosan biaya bahan baku pabrik).',
        };
      case 'FAIL_T2':
        return {
          bg: 'bg-rose-50/90 border-rose-300 text-rose-950',
          badgeBg: 'bg-rose-600 text-white',
          icon: <ShieldAlert className="w-6 h-6 text-rose-600" />,
          title: 'DITOLAK: PELANGGARAN KRITIS T2 (ZERO TOLERANCE)',
          desc: `Ditemukan ${analysis.t2Count} sampel di bawah batas kritis T2 (${analysis.t2Limit} ${analysis.unit}). Sesuai regulasi, seluruh batch harus dikarantina/ditolak.`,
        };
      case 'FAIL_AVERAGE':
        return {
          bg: 'bg-rose-50/90 border-rose-300 text-rose-950',
          badgeBg: 'bg-rose-600 text-white',
          icon: <XCircle className="w-6 h-6 text-rose-600" />,
          title: 'DITOLAK: RATA-RATA BERAT DI BAWAH STANDAR',
          desc: `Rata-rata aktual (${analysis.averageActualWeight} ${analysis.unit}) lebih kecil dari standar nominal (${analysis.nominalWeight} ${analysis.unit}). Terindikasi underfill sistematis.`,
        };
      case 'FAIL_T1_EXCESS':
        return {
          bg: 'bg-orange-50/90 border-orange-300 text-orange-950',
          badgeBg: 'bg-orange-600 text-white',
          icon: <AlertTriangle className="w-6 h-6 text-orange-600" />,
          title: 'DITOLAK: CACAT T1 MELEBIHI 2.5%',
          desc: `Persentase produk defisien T1 (${analysis.t1Percent}%) melebihi ambang batas toleransi maksimal yang diizinkan (2.5%).`,
        };
      default:
        return {
          bg: 'bg-slate-50 border-slate-300 text-slate-800',
          badgeBg: 'bg-slate-600 text-white',
          icon: <Info className="w-6 h-6 text-slate-600" />,
          title: 'STATUS PENGUJIAN BDKT',
          desc: analysis.statusMessage,
        };
    }
  };

  const statusConfig = getStatusBadge();

  return (
    <div className="space-y-4">
      {/* Master Compliance Banner */}
      <div
        className={`p-4 sm:p-5 rounded-2xl border ${statusConfig.bg} shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4`}
      >
        <div className="flex items-start gap-3.5">
          <div className="p-2.5 rounded-xl bg-white border border-slate-200/80 shadow-2xs">
            {statusConfig.icon}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-black tracking-wide ${statusConfig.badgeBg}`}>
                {analysis.overallStatus}
              </span>
              <h2 className="text-sm sm:text-base font-extrabold tracking-tight">
                {statusConfig.title}
              </h2>
            </div>
            <p className="text-xs sm:text-sm mt-1 text-slate-700 max-w-3xl leading-relaxed">
              {statusConfig.desc}
            </p>
          </div>
        </div>

        {/* Quick Product Metadata Summary */}
        <div className="w-full md:w-auto flex items-center justify-between md:justify-end gap-3 sm:gap-4 pt-3 md:pt-0 border-t md:border-t-0 border-slate-200 text-xs">
          <div className="bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">Produk / SKU</span>
            <span className="font-bold text-slate-800">{analysis.productName}</span>
          </div>
          <div className="bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">Batch No</span>
            <span className="font-mono font-bold text-emerald-700">{analysis.batchNo}</span>
          </div>
          <div className="bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">Total Sampel</span>
            <span className="font-bold text-slate-800">{analysis.sampleCount} unit</span>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Rata-rata Aktual vs Qn (The GAP) */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold mb-1">
              <span>Rata-rata Berat Aktual</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono font-bold">
                Qn: {analysis.nominalWeight} {analysis.unit}
              </span>
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                {analysis.averageActualWeight.toFixed(2)}
              </span>
              <span className="text-xs text-slate-500 font-bold">{analysis.unit}</span>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Gap Rata-rata:</span>
            <div
              className={`flex items-center gap-1 font-bold ${
                analysis.averageGap >= 0 ? 'text-emerald-600' : 'text-rose-600'
              }`}
            >
              {analysis.averageGap >= 0 ? (
                <TrendingUp className="w-3.5 h-3.5" />
              ) : (
                <TrendingDown className="w-3.5 h-3.5" />
              )}
              <span>
                {analysis.averageGap >= 0 ? '+' : ''}
                {analysis.averageGap.toFixed(2)} {analysis.unit} ({analysis.averageGapPercent >= 0 ? '+' : ''}
                {analysis.averageGapPercent.toFixed(2)}%)
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Toleransi BDKT T1 (Defisien) */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold mb-1">
              <span>Cacat Toleransi T1</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 font-bold">
                Batas T1: {analysis.t1Limit} {analysis.unit}
              </span>
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span
                className={`text-2xl sm:text-3xl font-black tracking-tight ${
                  analysis.isT1Passed ? 'text-slate-900' : 'text-orange-600'
                }`}
              >
                {analysis.t1Count}
              </span>
              <span className="text-xs font-semibold text-slate-500">
                dari {analysis.sampleCount} ({analysis.t1Percent}%)
              </span>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Batas Max Diizinkan:</span>
            <span className={`font-bold ${analysis.isT1Passed ? 'text-emerald-600' : 'text-rose-600'}`}>
              Maks 2.5% ({analysis.isT1Passed ? 'Lolos' : 'Melebihi'})
            </span>
          </div>
        </div>

        {/* Card 3: Pelanggaran Kritis T2 (Fatal) */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold mb-1">
              <span>Pelanggaran Kritis T2</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 font-bold">
                Batas T2: &lt; {analysis.t2Limit} {analysis.unit}
              </span>
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span
                className={`text-2xl sm:text-3xl font-black tracking-tight ${
                  analysis.t2Count === 0 ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                {analysis.t2Count}
              </span>
              <span className="text-xs font-semibold text-slate-500">
                unit ({analysis.t2Percent}%)
              </span>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Aturan Hukum:</span>
            <span
              className={`font-bold flex items-center gap-1 ${
                analysis.isT2Passed ? 'text-emerald-600' : 'text-rose-600'
              }`}
            >
              {analysis.isT2Passed ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Nol (Zero Tolerance)
                </>
              ) : (
                <>
                  <XCircle className="w-3.5 h-3.5" />
                  GAGAL KRITIS
                </>
              )}
            </span>
          </div>
        </div>

        {/* Card 4: Kerugian Giveaway & Kapabilitas Proses */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold mb-1">
              <span>Kerugian Giveaway Material</span>
              <button
                onClick={() => setIsEditingCost(!isEditingCost)}
                className="text-[10px] text-emerald-600 font-bold hover:underline"
              >
                {isEditingCost ? 'Tutup' : 'Ubah Harga'}
              </button>
            </div>

            {isEditingCost ? (
              <div className="mt-1 flex items-center gap-1.5">
                <input
                  type="text"
                  value={costInput}
                  onChange={(e) => setCostInput(e.target.value)}
                  placeholder="Rp/kg"
                  className="w-24 bg-slate-50 text-xs text-slate-900 px-2 py-1 rounded border border-slate-300 font-bold"
                />
                <button
                  onClick={handleSaveCost}
                  className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] rounded font-bold"
                >
                  Simpan
                </button>
              </div>
            ) : (
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-xl sm:text-2xl font-black text-amber-600 tracking-tight">
                  {formatIDR(analysis.giveawayFinancialLoss)}
                </span>
              </div>
            )}
            <p className="text-[11px] text-slate-500 mt-1">
              Kelebihan: +{(analysis.totalGiveawayGrams / 1000).toFixed(2)} kg bahan
            </p>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Kapabilitas (Cpk):</span>
            <span
              className={`font-bold ${
                analysis.cpk && analysis.cpk >= 1.33
                  ? 'text-emerald-600'
                  : analysis.cpk && analysis.cpk >= 1.0
                  ? 'text-amber-600'
                  : 'text-rose-600'
              }`}
            >
              {analysis.cpk !== null ? `${analysis.cpk} (σ: ${analysis.stdDeviation})` : 'N/A'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
