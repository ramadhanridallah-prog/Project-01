import React, { useState, useMemo } from 'react';
import {
  Search,
  CheckCircle,
  AlertTriangle,
  XCircle,
  TrendingUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { BdktRecord, BdktStatus } from '../types/bdkt';

interface DataTableProps {
  records: BdktRecord[];
}

export const DataTable: React.FC<DataTableProps> = ({ records }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'SESUAI' | 'TIDAK_SESUAI' | BdktStatus>('ALL');
  const [sortField, setSortField] = useState<'sampleNo' | 'actualWeight' | 'gap'>('sampleNo');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(50); // Default to 50 to fit most batches on 1 page

  const filteredAndSortedRecords = useMemo(() => {
    let result = [...records];

    // Status filter
    if (statusFilter === 'SESUAI') {
      result = result.filter((r) => r.status === 'OK' || r.status === 'OVERFILL');
    } else if (statusFilter === 'TIDAK_SESUAI') {
      result = result.filter((r) => r.status === 'T1_DEFICIENT' || r.status === 'T2_FAIL');
    } else if (statusFilter !== 'ALL') {
      result = result.filter((r) => r.status === statusFilter);
    }

    // Search filter
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(
        (r) =>
          String(r.sampleNo).includes(q) ||
          r.productName.toLowerCase().includes(q) ||
          r.batchNo.toLowerCase().includes(q) ||
          (r.skuCode && r.skuCode.toLowerCase().includes(q)) ||
          (r.lineOrShift && r.lineOrShift.toLowerCase().includes(q))
      );
    }

    // Sort
    result.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [records, statusFilter, searchTerm, sortField, sortOrder]);

  const effectivePageSize = pageSize === 0 ? filteredAndSortedRecords.length : pageSize;
  const totalPages = Math.ceil(filteredAndSortedRecords.length / (effectivePageSize || 1)) || 1;
  const paginatedRecords = pageSize === 0
    ? filteredAndSortedRecords
    : filteredAndSortedRecords.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const toggleSort = (field: 'sampleNo' | 'actualWeight' | 'gap') => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const getStatusBadge = (status: BdktStatus) => {
    switch (status) {
      case 'OK':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle className="w-2.5 h-2.5 text-emerald-600" />
            Sesuai
          </span>
        );
      case 'OVERFILL':
        return (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-cyan-50 text-cyan-700 border border-cyan-200"
            title="Sesuai standar BDKT (Overfill)"
          >
            <CheckCircle className="w-2.5 h-2.5 text-cyan-600" />
            Sesuai (Overfill)
          </span>
        );
      case 'T1_DEFICIENT':
        return (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200"
            title="Tidak Sesuai: Cacat defisiensi toleransi T1"
          >
            <AlertTriangle className="w-2.5 h-2.5 text-amber-600" />
            Tidak Sesuai (T1)
          </span>
        );
      case 'T2_FAIL':
        return (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200"
            title="Tidak Sesuai: Pelanggaran fatal batas kritis T2"
          >
            <XCircle className="w-2.5 h-2.5 text-rose-600" />
            Tidak Sesuai (T2 Fatal)
          </span>
        );
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
      {/* Table Toolbar - Compact & Simple */}
      <div className="p-3 sm:p-4 border-b border-slate-200 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-extrabold text-slate-800">
            Tabel Data Sampel BDKT
          </h3>
          <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
            {filteredAndSortedRecords.length} / {records.length} sampel
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Search Input */}
          <div className="relative flex-1 sm:w-48">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Cari sampel / SKU..."
              className="w-full bg-slate-50 text-xs text-slate-800 pl-7 pr-2.5 py-1.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
            <button
              onClick={() => {
                setStatusFilter('ALL');
                setCurrentPage(1);
              }}
              className={`px-2 py-1 rounded-md text-[11px] transition font-medium cursor-pointer ${
                statusFilter === 'ALL'
                  ? 'bg-white text-slate-900 font-bold shadow-2xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semua
            </button>
            <button
              onClick={() => {
                setStatusFilter('SESUAI');
                setCurrentPage(1);
              }}
              className={`px-2 py-1 rounded-md text-[11px] transition font-medium cursor-pointer ${
                statusFilter === 'SESUAI'
                  ? 'bg-emerald-600 text-white font-bold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sesuai
            </button>
            <button
              onClick={() => {
                setStatusFilter('TIDAK_SESUAI');
                setCurrentPage(1);
              }}
              className={`px-2 py-1 rounded-md text-[11px] transition font-medium cursor-pointer ${
                statusFilter === 'TIDAK_SESUAI'
                  ? 'bg-rose-600 text-white font-bold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tidak Sesuai
            </button>
          </div>

          {/* Quick Page Size Switcher - To avoid lots of pages */}
          <div className="flex items-center gap-1 text-[11px] text-slate-600 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200">
            <span className="font-semibold text-slate-500 hidden sm:inline">Tampil:</span>
            {[25, 50, 100, 0].map((sz) => (
              <button
                key={sz}
                onClick={() => {
                  setPageSize(sz);
                  setCurrentPage(1);
                }}
                className={`px-1.5 py-0.5 rounded text-[11px] font-semibold transition cursor-pointer ${
                  pageSize === sz
                    ? 'bg-emerald-600 text-white font-bold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                }`}
                title={sz === 0 ? 'Tampilkan semua sampel dalam 1 halaman' : `${sz} sampel per halaman`}
              >
                {sz === 0 ? 'Semua' : sz}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Compact Table View */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-700">
          <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
            <tr>
              <th
                onClick={() => toggleSort('sampleNo')}
                className="py-2 px-3 cursor-pointer hover:text-slate-900 select-none w-12"
              >
                <div className="flex items-center gap-1">
                  <span>No</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th className="py-2 px-3">Waktu / Line</th>
              <th className="py-2 px-3">Produk / SKU</th>
              <th className="py-2 px-3 text-right bg-purple-50/50 text-purple-900">
                <div className="flex items-center justify-end gap-1" title="Berat Bruto = Berat Aktual + Tara Kemasan">
                  <span>Berat Bruto</span>
                  <span className="text-[9px] px-1 py-0.2 rounded bg-purple-200/60 font-mono">Gross</span>
                </div>
              </th>
              <th
                onClick={() => toggleSort('actualWeight')}
                className="py-2 px-3 text-right cursor-pointer hover:text-slate-900 select-none"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Berat Netto</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th className="py-2 px-3 text-right">Standar Qn</th>
              <th
                onClick={() => toggleSort('gap')}
                className="py-2 px-3 text-right cursor-pointer hover:text-slate-900 select-none"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Gap (Netto - Qn)</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th className="py-2 px-3 text-right">% Deviasi</th>
              <th className="py-2 px-3 text-center">Batas (T1 / T2)</th>
              <th className="py-2 px-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginatedRecords.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-6 text-center text-slate-400 text-xs">
                  Tidak ada data sampel yang cocok dengan kriteria filter.
                </td>
              </tr>
            ) : (
              paginatedRecords.map((record) => {
                const effectiveGross =
                  record.grossWeight ??
                  Number((record.actualWeight + (record.tareWeight ?? 0)).toFixed(2));

                return (
                  <tr
                    key={record.id}
                    className={`hover:bg-slate-50 transition-colors ${
                      record.status === 'T2_FAIL'
                        ? 'bg-rose-50/40'
                        : record.status === 'T1_DEFICIENT'
                        ? 'bg-amber-50/30'
                        : ''
                    }`}
                  >
                    <td className="py-2 px-3 font-mono font-bold text-slate-900 text-xs">
                      #{record.sampleNo}
                    </td>
                    <td className="py-2 px-3 text-[11px]">
                      <div className="text-slate-900 font-medium">
                        {record.sampleDate || record.timestamp ? (
                          <div className="flex items-center gap-1.5 font-mono">
                            <span className="text-slate-900 font-semibold">
                              {record.sampleDate || record.timestamp?.split(' ')[0]}
                            </span>
                            {(record.sampleTime || (record.timestamp && record.timestamp.includes(' ') ? record.timestamp.split(' ')[1] : '')) && (
                              <span className="text-slate-600 text-[10px] bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200 font-normal">
                                {record.sampleTime || record.timestamp?.split(' ')[1]}
                              </span>
                            )}
                          </div>
                        ) : (
                          '-'
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400">{record.lineOrShift || 'Line 1'}</div>
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-slate-900 text-xs">{record.productName}</span>
                        {record.skuCode && (
                          <span className="font-mono text-[9px] px-1 py-0.2 bg-slate-100 border border-slate-200 rounded text-slate-600">
                            {record.skuCode}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400">
                        <span className="font-mono text-emerald-700 font-semibold">{record.batchNo}</span>
                        {record.tareWeight && (
                          <span className="text-slate-400">Tara: {record.tareWeight}g</span>
                        )}
                      </div>
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-purple-900 bg-purple-50/30 text-xs">
                      {effectiveGross} {record.unit}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 text-xs">
                      {record.actualWeight} {record.unit}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-slate-500 text-xs">
                      {record.nominalWeight} {record.unit}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-xs">
                      <span
                        className={
                          record.gap >= 0 ? 'text-emerald-700' : 'text-rose-600'
                        }
                      >
                        {record.gap >= 0 ? '+' : ''}
                        {record.gap} {record.unit}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-[11px]">
                      <span
                        className={`font-bold ${
                          record.gapPercent >= 0 ? 'text-emerald-700' : 'text-rose-600'
                        }`}
                      >
                        {record.gapPercent >= 0 ? '+' : ''}
                        {record.gapPercent}%
                      </span>
                    </td>
                    <td className="py-2 px-3 text-center font-mono text-[10px] text-slate-500">
                      <span className="text-amber-700 font-medium">{record.t1Limit}</span> /{' '}
                      <span className="text-rose-700 font-medium">{record.t2Limit}</span>
                    </td>
                    <td className="py-2 px-3 text-center">
                      {getStatusBadge(record.status)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer - Only shown if more than 1 page and not in 'Semua' mode */}
      {pageSize > 0 && totalPages > 1 && (
        <div className="p-2.5 sm:p-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 bg-slate-50/50">
          <span className="text-[11px]">
            Halaman <strong className="text-slate-800">{currentPage}</strong> dari {totalPages} ({paginatedRecords.length} dari {filteredAndSortedRecords.length} data)
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className="p-1 rounded-md border border-slate-300 bg-white text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 transition shadow-2xs cursor-pointer text-xs"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="px-1.5 font-mono text-slate-800 font-bold text-xs">{currentPage}</span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="p-1 rounded-md border border-slate-300 bg-white text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 transition shadow-2xs cursor-pointer text-xs"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
