import React, { useRef, useState } from 'react';
import {
  X,
  Database,
  Upload,
  FileDown,
  Search,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Plus,
  Trash2,
  Edit2,
  Cloud,
  Save,
  Check,
} from 'lucide-react';
import { SkuMasterItem } from '../types/masterData';
import {
  parseMasterDataBuffer,
  downloadMasterDataTemplate,
  DEFAULT_MASTER_DATA,
  autoSaveMasterDataToGoogleDrive,
} from '../services/masterDataService';
import { calculateTolerableDeficiency, getT1Limit, getT2Limit } from '../utils/bdkt';

interface MasterDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  masterDataList: SkuMasterItem[];
  onUpdateMasterData: (newItems: SkuMasterItem[]) => void;
  accessToken?: string | null;
}

export const MasterDataModal: React.FC<MasterDataModalProps> = ({
  isOpen,
  onClose,
  masterDataList,
  onUpdateMasterData,
  accessToken,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [lastAutoSavedTime, setLastAutoSavedTime] = useState<string>(
    new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Add SKU Form state
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newSkuCode, setNewSkuCode] = useState('');
  const [newProductName, setNewProductName] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newNominalWeight, setNewNominalWeight] = useState<number | ''>('');
  const [newUnit, setNewUnit] = useState<'g' | 'ml'>('g');
  const [newTareWeight, setNewTareWeight] = useState<number | ''>('');
  const [newNotes, setNewNotes] = useState('');

  // Edit SKU state
  const [editingItem, setEditingItem] = useState<SkuMasterItem | null>(null);

  if (!isOpen) return null;

  const filteredItems = masterDataList.filter((item) => {
    const q = searchTerm.toLowerCase();
    return (
      item.skuCode.toLowerCase().includes(q) ||
      item.productName.toLowerCase().includes(q) ||
      (item.category && item.category.toLowerCase().includes(q))
    );
  });

  // Calculate live preview for new SKU
  const parsedNewWeight = typeof newNominalWeight === 'number' && newNominalWeight > 0 ? newNominalWeight : 0;
  const liveT = parsedNewWeight > 0 ? calculateTolerableDeficiency(parsedNewWeight) : 0;
  const liveT1 = parsedNewWeight > 0 ? getT1Limit(parsedNewWeight, liveT) : 0;
  const liveT2 = parsedNewWeight > 0 ? getT2Limit(parsedNewWeight, liveT) : 0;

  // Handle Auto-Save Trigger for list modifications
  const triggerAutoSave = (newItems: SkuMasterItem[], customMsg?: string) => {
    onUpdateMasterData(newItems);
    const timeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLastAutoSavedTime(timeStr);
    setSuccessMessage(customMsg || `Tersimpan otomatis pada ${timeStr} (${newItems.length} SKU).`);

    // Cloud auto-save if Drive is connected
    if (accessToken) {
      autoSaveMasterDataToGoogleDrive(accessToken, newItems).catch((err) =>
        console.warn('Background Drive sync error:', err)
      );
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    setSuccessMessage(null);
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const reader = new FileReader();

    setIsUploading(true);
    reader.onload = (evt) => {
      try {
        const buffer = evt.target?.result as ArrayBuffer;
        const newItems = parseMasterDataBuffer(buffer);
        triggerAutoSave(newItems, `Auto-Save Berhasil! ${newItems.length} SKU terdaftar & disimpan.`);
        setIsUploading(false);
      } catch (err: any) {
        console.error(err);
        setUploadError(err.message || 'Gagal memproses file Master Data.');
        setIsUploading(false);
      }
    };
    reader.onerror = () => {
      setUploadError('Gagal membaca file dari perangkat.');
      setIsUploading(false);
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const handleResetToDefault = () => {
    if (window.confirm('Reset Master Data ke daftar SKU bawaan pabrik? Data akan otomatis disimpan.')) {
      triggerAutoSave(DEFAULT_MASTER_DATA, 'Master Data di-reset ke pengaturan standar pabrik & tersimpan otomatis.');
    }
  };

  const handleSaveNewSku = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSkuCode.trim()) {
      setUploadError('Kode SKU tidak boleh kosong.');
      return;
    }
    if (!newProductName.trim()) {
      setUploadError('Nama Produk tidak boleh kosong.');
      return;
    }
    if (!newNominalWeight || newNominalWeight <= 0) {
      setUploadError('Standar Berat Qn harus berupa angka positif.');
      return;
    }

    // Check duplicate SKU
    const isDup = masterDataList.some(
      (m) => m.skuCode.toLowerCase() === newSkuCode.trim().toLowerCase()
    );
    if (isDup) {
      setUploadError(`Kode SKU "${newSkuCode}" sudah terdaftar. Gunakan kode lain.`);
      return;
    }

    const t = calculateTolerableDeficiency(newNominalWeight);
    const newItem: SkuMasterItem = {
      id: `master-${Date.now()}`,
      skuCode: newSkuCode.trim().toUpperCase(),
      productName: newProductName.trim(),
      category: newCategory.trim() || 'Umum',
      nominalWeight: newNominalWeight,
      unit: newUnit,
      tareWeight: typeof newTareWeight === 'number' ? newTareWeight : 0,
      tolerableDeficiency: t,
      t1Limit: getT1Limit(newNominalWeight, t),
      t2Limit: getT2Limit(newNominalWeight, t),
      notes: newNotes.trim(),
      updatedAt: new Date().toISOString().split('T')[0],
    };

    const updated = [newItem, ...masterDataList];
    triggerAutoSave(updated, `SKU "${newItem.skuCode}" berhasil ditambahkan & otomatis tersimpan!`);

    // Reset Form
    setNewSkuCode('');
    setNewProductName('');
    setNewCategory('');
    setNewNominalWeight('');
    setNewTareWeight('');
    setNewNotes('');
    setIsAddingNew(false);
    setUploadError(null);
  };

  const handleDeleteItem = (id: string, skuCode: string) => {
    if (window.confirm(`Hapus SKU "${skuCode}" dari Master Data? Perubahan akan otomatis tersimpan.`)) {
      const updated = masterDataList.filter((m) => m.id !== id);
      triggerAutoSave(updated, `SKU "${skuCode}" telah dihapus & perubahan tersimpan otomatis.`);
    }
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    if (!editingItem.skuCode.trim() || !editingItem.productName.trim() || editingItem.nominalWeight <= 0) {
      setUploadError('Kode SKU, Nama Produk, dan Standar Qn wajib diisi dengan benar.');
      return;
    }

    const t = calculateTolerableDeficiency(editingItem.nominalWeight);
    const updatedItem: SkuMasterItem = {
      ...editingItem,
      tolerableDeficiency: t,
      t1Limit: getT1Limit(editingItem.nominalWeight, t),
      t2Limit: getT2Limit(editingItem.nominalWeight, t),
      updatedAt: new Date().toISOString().split('T')[0],
    };

    const updated = masterDataList.map((m) => (m.id === updatedItem.id ? updatedItem : m));
    triggerAutoSave(updated, `Perubahan pada SKU "${updatedItem.skuCode}" berhasil disimpan otomatis.`);
    setEditingItem(null);
    setUploadError(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  Master Data SKU & Standar Berat BDKT
                </h2>
                <span className="text-xs px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 font-bold">
                  {masterDataList.length} SKU Terdaftar
                </span>
                {/* Auto-Save Active Indicator */}
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  Auto-Save Aktif
                </span>
                {/* Real-time Multi-User sync indicator */}
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                  Real-Time Multi-User
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Setiap perubahan disimpan otomatis & disinkronkan secara langsung (real-time) ke seluruh perangkat pengguna lain
                {accessToken ? ' serta Google Drive Cloud.' : '.'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar: Upload, Download Template, Add SKU, Reset, Search */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-white space-y-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => {
                  setIsAddingNew(!isAddingNew);
                  setEditingItem(null);
                  setUploadError(null);
                }}
                className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl transition cursor-pointer shadow-2xs ${
                  isAddingNew
                    ? 'bg-slate-200 text-slate-800'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isAddingNew ? 'Batal Tambah' : 'Tambah SKU Baru'}</span>
              </button>

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".xlsx,.xls,.csv"
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="flex items-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{isUploading ? 'Memproses...' : 'Upload File Master Data'}</span>
              </button>

              <button
                onClick={downloadMasterDataTemplate}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl border border-slate-300 transition cursor-pointer"
              >
                <FileDown className="w-3.5 h-3.5 text-blue-600" />
                <span className="hidden sm:inline">Template Excel</span>
              </button>

              <button
                onClick={handleResetToDefault}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-rose-600 text-xs font-semibold rounded-xl border border-slate-200 transition cursor-pointer"
                title="Kembalikan ke master data bawaan"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Reset Standar</span>
              </button>
            </div>

            {/* Search Input */}
            <div className="relative sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari kode SKU atau nama..."
                className="w-full bg-slate-50 text-xs text-slate-800 pl-8 pr-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              />
            </div>
          </div>

          {/* Alert Messages */}
          {uploadError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{uploadError}</span>
              </div>
              <button onClick={() => setUploadError(null)} className="text-rose-600 font-bold hover:underline">
                ✕
              </button>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{successMessage}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-emerald-600 font-mono">Tersimpan Otomatis ({lastAutoSavedTime})</span>
                <button
                  onClick={() => setSuccessMessage(null)}
                  className="text-emerald-700 hover:text-emerald-900 font-bold"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {/* Add New SKU Form Drawer / Panel */}
          {isAddingNew && (
            <form onSubmit={handleSaveNewSku} className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-2xl space-y-3 animate-in fade-in duration-200">
              <div className="flex items-center justify-between border-b border-emerald-200/60 pb-2">
                <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5 text-emerald-600" />
                  Tambah Item SKU & Standar Baru (Auto-Save Langsung)
                </span>
                <span className="text-[11px] text-emerald-700">Toleransi (T), T1, & T2 dihitung otomatis sesuai Permendag 31/2011</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kode SKU *</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: SKU-KPB-100"
                    value={newSkuCode}
                    onChange={(e) => setNewSkuCode(e.target.value)}
                    className="w-full bg-white px-3 py-1.5 rounded-lg border border-slate-300 font-mono font-bold text-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nama Produk Resmi *</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Kopi Bubuk 100g"
                    value={newProductName}
                    onChange={(e) => setNewProductName(e.target.value)}
                    className="w-full bg-white px-3 py-1.5 rounded-lg border border-slate-300 font-medium text-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kategori Produk</label>
                  <input
                    type="text"
                    placeholder="Contoh: Minuman Bubuk"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full bg-white px-3 py-1.5 rounded-lg border border-slate-300 font-medium text-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Standar Berat Qn *</label>
                  <div className="flex gap-1.5">
                    <input
                      type="number"
                      step="any"
                      required
                      placeholder="100"
                      value={newNominalWeight}
                      onChange={(e) => setNewNominalWeight(e.target.value === '' ? '' : parseFloat(e.target.value))}
                      className="w-full bg-white px-3 py-1.5 rounded-lg border border-emerald-500 font-mono font-black text-slate-900"
                    />
                    <select
                      value={newUnit}
                      onChange={(e) => setNewUnit(e.target.value as any)}
                      className="bg-white px-2 py-1.5 rounded-lg border border-slate-300 font-bold text-slate-700"
                    >
                      <option value="g">g</option>
                      <option value="ml">ml</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Berat Tara Kemasan (g)</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="2.5"
                    value={newTareWeight}
                    onChange={(e) => setNewTareWeight(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    className="w-full bg-white px-3 py-1.5 rounded-lg border border-slate-300 font-mono text-slate-800"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Catatan / Deskripsi Kemasan</label>
                  <input
                    type="text"
                    placeholder="Sachet foil, botol kaca, standing pouch..."
                    value={newNotes}
                    onChange={(e) => setNewNotes(e.target.value)}
                    className="w-full bg-white px-3 py-1.5 rounded-lg border border-slate-300 text-slate-800"
                  />
                </div>

                <div className="flex items-end">
                  <button
                    type="submit"
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Simpan & Auto-Save</span>
                  </button>
                </div>
              </div>

              {parsedNewWeight > 0 && (
                <div className="pt-2 border-t border-emerald-200/50 flex flex-wrap items-center gap-3 text-[11px] text-emerald-900 font-medium">
                  <span>Hasil Kalkulasi Regulasi:</span>
                  <span className="font-mono bg-white px-2 py-0.5 rounded border border-emerald-300">
                    Toleransi T: <strong>±{liveT} {newUnit}</strong>
                  </span>
                  <span className="font-mono bg-white px-2 py-0.5 rounded border border-amber-300 text-amber-800">
                    Batas T1: <strong>{liveT1} {newUnit}</strong>
                  </span>
                  <span className="font-mono bg-white px-2 py-0.5 rounded border border-rose-300 text-rose-800">
                    Batas T2 (Fatal): <strong>{liveT2} {newUnit}</strong>
                  </span>
                </div>
              )}
            </form>
          )}

          {/* Edit SKU Modal / Drawer */}
          {editingItem && (
            <form onSubmit={handleSaveEdit} className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-2xl space-y-3 animate-in fade-in duration-200">
              <div className="flex items-center justify-between border-b border-indigo-200/60 pb-2">
                <span className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                  <Edit2 className="w-3.5 h-3.5 text-indigo-600" />
                  Edit SKU: {editingItem.skuCode} (Auto-Save saat disimpan)
                </span>
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="text-xs text-slate-500 hover:text-slate-800"
                >
                  Batal
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kode SKU</label>
                  <input
                    type="text"
                    required
                    value={editingItem.skuCode}
                    onChange={(e) => setEditingItem({ ...editingItem, skuCode: e.target.value.toUpperCase() })}
                    className="w-full bg-white px-3 py-1.5 rounded-lg border border-slate-300 font-mono font-bold text-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nama Produk</label>
                  <input
                    type="text"
                    required
                    value={editingItem.productName}
                    onChange={(e) => setEditingItem({ ...editingItem, productName: e.target.value })}
                    className="w-full bg-white px-3 py-1.5 rounded-lg border border-slate-300 font-medium text-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Standar Berat Qn ({editingItem.unit})</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={editingItem.nominalWeight}
                    onChange={(e) => setEditingItem({ ...editingItem, nominalWeight: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-white px-3 py-1.5 rounded-lg border border-indigo-400 font-mono font-black text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tara (g)</label>
                  <input
                    type="number"
                    step="any"
                    value={editingItem.tareWeight ?? 0}
                    onChange={(e) => setEditingItem({ ...editingItem, tareWeight: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-white px-3 py-1.5 rounded-lg border border-slate-300 font-mono text-slate-800"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="block font-semibold text-slate-700 mb-1">Catatan</label>
                  <input
                    type="text"
                    value={editingItem.notes || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, notes: e.target.value })}
                    className="w-full bg-white px-3 py-1.5 rounded-lg border border-slate-300 text-slate-800"
                  />
                </div>

                <div className="flex items-end">
                  <button
                    type="submit"
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Terapkan & Simpan</span>
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>

        {/* Master Data Table */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-2.5 px-3">Kode SKU</th>
                  <th className="py-2.5 px-3">Nama Produk Resmi</th>
                  <th className="py-2.5 px-3">Kategori</th>
                  <th className="py-2.5 px-3 text-right">Standar Qn</th>
                  <th className="py-2.5 px-3 text-right">Toleransi (T)</th>
                  <th className="py-2.5 px-3 text-center">Batas T1 / T2</th>
                  <th className="py-2.5 px-3 text-right">Tara</th>
                  <th className="py-2.5 px-3">Catatan</th>
                  <th className="py-2.5 px-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400">
                      Tidak ada data SKU yang cocok dengan pencarian.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-bold text-indigo-700">
                        {item.skuCode}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">
                        {item.productName}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500">
                        {item.category || '-'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-black text-slate-900">
                        {item.nominalWeight} {item.unit}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-amber-700 font-bold">
                        ±{item.tolerableDeficiency} {item.unit}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono text-[11px] text-slate-600">
                        <span className="text-amber-700 font-bold">{item.t1Limit}</span> /{' '}
                        <span className="text-rose-700 font-bold">{item.t2Limit} {item.unit}</span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-500">
                        {item.tareWeight ? `${item.tareWeight} g` : '-'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 text-[11px] max-w-xs truncate">
                        {item.notes || '-'}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => {
                              setEditingItem(item);
                              setIsAddingNew(false);
                            }}
                            className="p-1 text-slate-500 hover:text-indigo-600 rounded hover:bg-slate-100 transition cursor-pointer"
                            title="Edit SKU"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteItem(item.id, item.skuCode)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition cursor-pointer"
                            title="Hapus SKU"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Fitur Auto-Save aktif: Perubahan otomatis diperbarui seketika.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl transition cursor-pointer"
          >
            Selesai & Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
