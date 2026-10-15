import React, { useState } from 'react';
import { X, Calculator, ShieldCheck, BookOpen } from 'lucide-react';
import { calculateTolerableDeficiency } from '../utils/bdkt';

interface BdktCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BdktCalculatorModal: React.FC<BdktCalculatorModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [qnInput, setQnInput] = useState<number>(250);
  const [unit, setUnit] = useState<string>('g');

  if (!isOpen) return null;

  const t = calculateTolerableDeficiency(qnInput);
  const t1 = Number((qnInput - t).toFixed(2));
  const t2 = Number((qnInput - 2 * t).toFixed(2));
  const tPercent = qnInput > 0 ? ((t / qnInput) * 100).toFixed(2) : '0';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center">
              <Calculator className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>Kalkulator & Regulasi BDKT</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 font-bold">
                  Permendag 31/2011 & OIML R 87
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Hitung otomatis batas toleransi T1, T2, dan kriteria kelulusan metrologi
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto">
          {/* Interactive Input Section */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <label className="block text-xs font-bold text-slate-700 mb-2">
              Masukkan Kuantitas Nominal (Qn) Tercantum pada Kemasan:
            </label>
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <input
                  type="number"
                  min="1"
                  step="0.1"
                  value={qnInput}
                  onChange={(e) => setQnInput(parseFloat(e.target.value) || 0)}
                  className="w-full bg-white text-lg font-bold text-slate-900 px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  placeholder="250"
                />
              </div>
              <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 text-xs font-bold shadow-2xs">
                <button
                  onClick={() => setUnit('g')}
                  className={`px-3 py-2 rounded-lg transition cursor-pointer ${
                    unit === 'g'
                      ? 'bg-emerald-600 text-white font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Gram (g)
                </button>
                <button
                  onClick={() => setUnit('ml')}
                  className={`px-3 py-2 rounded-lg transition cursor-pointer ${
                    unit === 'ml'
                      ? 'bg-emerald-600 text-white font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Mililiter (ml)
                </button>
              </div>
            </div>
          </div>

          {/* Calculated Output Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Toleransi T */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <span className="text-[11px] font-bold text-slate-500 block">
                Toleransi Kekurangan (T)
              </span>
              <div className="text-xl font-black text-amber-600 mt-1">
                {t} <span className="text-xs text-slate-500 font-normal">{unit} ({tPercent}%)</span>
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                Maksimal kekurangan per kemasan
              </p>
            </div>

            {/* Batas T1 */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <span className="text-[11px] font-bold text-slate-500 block">
                Batas Toleransi T1 (Qn - T)
              </span>
              <div className="text-xl font-black text-amber-700 mt-1">
                {t1} <span className="text-xs text-slate-500 font-normal">{unit}</span>
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                Maksimal 2.5% sampel diizinkan
              </p>
            </div>

            {/* Batas T2 */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <span className="text-[11px] font-bold text-slate-500 block">
                Batas Kritis T2 (Qn - 2T)
              </span>
              <div className="text-xl font-black text-rose-600 mt-1">
                {t2} <span className="text-xs text-slate-500 font-normal">{unit}</span>
              </div>
              <p className="text-[10px] text-rose-600 mt-1 font-semibold">
                Nol sampel diizinkan (Zero Tolerance)
              </p>
            </div>
          </div>

          {/* 3 Kriteria Kelulusan Pengujian BDKT */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2.5">
            <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>3 Syarat Mutlak Kelulusan Batch BDKT</span>
            </h4>
            <div className="space-y-2 text-xs text-slate-700">
              <div className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                  1
                </span>
                <div>
                  <strong className="text-slate-900">Syarat Rata-rata Netto:</strong> Rata-rata berat aktual sampel (X̄) harus lebih besar atau sama dengan nominal ({qnInput} {unit}).
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                  2
                </span>
                <div>
                  <strong className="text-slate-900">Syarat Cacat T1:</strong> Jumlah sampel yang beratnya berada di antara T1 ({t1} {unit}) dan T2 ({t2} {unit}) tidak boleh melebihi 2.5% dari total sampel yang diuji.
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                  3
                </span>
                <div>
                  <strong className="text-slate-900">Syarat Cacat Fatal T2:</strong> Tidak boleh ada SATUPUN sampel (0 unit) yang beratnya kurang dari T2 ({t2} {unit}). Jika ditemukan 1 saja, batch langsung DITOLAK (REJECT).
                </div>
              </div>
            </div>
          </div>

          {/* Official Reference Table Permendag */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
              <BookOpen className="w-3.5 h-3.5 text-slate-500" />
              <span>Tabel Batas Kesalahan Kekurangan (Permendag RI No. 31/2011)</span>
            </div>
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-[11px] text-slate-600">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3">Kuantitas Nominal (Qn)</th>
                    <th className="py-2 px-3 text-right">Toleransi (T) %</th>
                    <th className="py-2 px-3 text-right">Toleransi (T) g / ml</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  <tr className={qnInput >= 5 && qnInput <= 50 ? 'bg-emerald-50 text-emerald-800 font-bold' : ''}>
                    <td className="py-1.5 px-3">5 s.d. 50</td>
                    <td className="py-1.5 px-3 text-right">9 %</td>
                    <td className="py-1.5 px-3 text-right">-</td>
                  </tr>
                  <tr className={qnInput > 50 && qnInput <= 100 ? 'bg-emerald-50 text-emerald-800 font-bold' : ''}>
                    <td className="py-1.5 px-3">50 s.d. 100</td>
                    <td className="py-1.5 px-3 text-right">-</td>
                    <td className="py-1.5 px-3 text-right">4.5 g / ml</td>
                  </tr>
                  <tr className={qnInput > 100 && qnInput <= 200 ? 'bg-emerald-50 text-emerald-800 font-bold' : ''}>
                    <td className="py-1.5 px-3">100 s.d. 200</td>
                    <td className="py-1.5 px-3 text-right">4.5 %</td>
                    <td className="py-1.5 px-3 text-right">-</td>
                  </tr>
                  <tr className={qnInput > 200 && qnInput <= 300 ? 'bg-emerald-50 text-emerald-800 font-bold' : ''}>
                    <td className="py-1.5 px-3">200 s.d. 300</td>
                    <td className="py-1.5 px-3 text-right">-</td>
                    <td className="py-1.5 px-3 text-right">9.0 g / ml</td>
                  </tr>
                  <tr className={qnInput > 300 && qnInput <= 500 ? 'bg-emerald-50 text-emerald-800 font-bold' : ''}>
                    <td className="py-1.5 px-3">300 s.d. 500</td>
                    <td className="py-1.5 px-3 text-right">3 %</td>
                    <td className="py-1.5 px-3 text-right">-</td>
                  </tr>
                  <tr className={qnInput > 500 && qnInput <= 1000 ? 'bg-emerald-50 text-emerald-800 font-bold' : ''}>
                    <td className="py-1.5 px-3">500 s.d. 1.000</td>
                    <td className="py-1.5 px-3 text-right">-</td>
                    <td className="py-1.5 px-3 text-right">15.0 g / ml</td>
                  </tr>
                  <tr className={qnInput > 1000 && qnInput <= 10000 ? 'bg-emerald-50 text-emerald-800 font-bold' : ''}>
                    <td className="py-1.5 px-3">1.000 s.d. 10.000</td>
                    <td className="py-1.5 px-3 text-right">1.5 %</td>
                    <td className="py-1.5 px-3 text-right">-</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
