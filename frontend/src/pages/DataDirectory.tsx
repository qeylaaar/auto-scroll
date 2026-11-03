import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Database, 
  Upload, 
  Search, 
  Eye, 
  FileSpreadsheet, 
  Building2, 
  Calendar, 
  CheckCircle2, 
  X, 
  Loader2,
  Files,
  Pencil,
  Trash2,
  Save,
  CheckSquare,
  Square,
  ShieldAlert,
} from 'lucide-react';

interface Task {
  id: string;
  name: string;
  category_group: string;
  successful: number;
  created_at: string;
  status: string;
}

const CATEGORY_GROUPS = [
  'Semua Kategori',
  'F&B (Kuliner & Minuman)',
  'Retail Khusus',
  'Retail Modern (Minimarket/Supermarket)',
  'Industri & Pabrik',
  'Kesehatan',
  'Jasa & Perawatan',
  'Transportasi',
  'Pendidikan & Fasilitas Umum',
  'Tempat Ibadah',
  'Instansi Pemerintahan',
  'Keuangan',
  'Pariwisata & Perhotelan',
  'Pertanian & Peternakan',
  'Properti & Bangunan',
  'Lainnya',
];

export function DataDirectory() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Semua Kategori');

  // State Modal Batch Import
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [importCategory, setImportCategory] = useState(CATEGORY_GROUPS[1]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  // State Modal Edit
  const [editTarget, setEditTarget] = useState<Task | null>(null);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState('');

  // State Modal Delete (single)
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState(false);

  // State Batch Select & Delete
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);
  const [batchDeleting, setBatchDeleting] = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);
  const [batchTotal, setBatchTotal] = useState(0);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/tasks');
      const data = await res.json();
      setTasks(data.tasks || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  // Reset selection ketika filter berubah
  useEffect(() => {
    setSelectedIds(new Set());
  }, [search, selectedCategory]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles(Array.from(e.target.files));
    }
  };

  const handleBatchImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedFiles.length === 0) {
      setUploadError('Pilih minimal 1 file .xlsx untuk diimpor.');
      return;
    }
    try {
      setUploading(true);
      setUploadError('');
      const formData = new FormData();
      selectedFiles.forEach((file) => {
        formData.append('files', file);
      });
      formData.append('categoryGroup', importCategory);
      const res = await fetch('/api/tasks/import-excel', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Gagal mengimpor file');
      }
      setIsModalOpen(false);
      setSelectedFiles([]);
      await fetchTasks();
    } catch (err: any) {
      setUploadError(err.message || 'Terjadi kesalahan saat mengunggah');
    } finally {
      setUploading(false);
    }
  };

  const openEdit = (task: Task) => {
    setEditTarget(task);
    setEditName(task.name);
    setEditCategory(task.category_group || 'Lainnya');
    setEditError('');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    if (!editName.trim()) {
      setEditError('Nama dataset tidak boleh kosong.');
      return;
    }
    try {
      setSaving(true);
      setEditError('');
      const res = await fetch(`/api/tasks/${editTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim(), categoryGroup: editCategory }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Gagal menyimpan perubahan');
      }
      setEditTarget(null);
      await fetchTasks();
    } catch (err: any) {
      setEditError(err.message || 'Terjadi kesalahan');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await fetch(`/api/tasks/${deleteTarget.id}?confirm=true`, { method: 'DELETE' });
      setDeleteTarget(null);
      setSelectedIds((prev) => { const s = new Set(prev); s.delete(deleteTarget.id); return s; });
      await fetchTasks();
    } catch (err: any) {
      console.error(err);
    } finally {
      setDeleting(false);
    }
  };

  // ---- Batch Select Logic ----
  const filteredTasks = tasks.filter((task) => {
    const matchesSearch = task.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory =
      selectedCategory === 'Semua Kategori' ||
      (task.category_group || 'Lainnya') === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const allFilteredSelected =
    filteredTasks.length > 0 && filteredTasks.every((t) => selectedIds.has(t.id));
  const someSelected = selectedIds.size > 0;
  const totalSelectedRecords = tasks
    .filter((t) => selectedIds.has(t.id))
    .reduce((sum, t) => sum + (t.successful || 0), 0);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filteredTasks.forEach((t) => next.delete(t.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filteredTasks.forEach((t) => next.add(t.id));
        return next;
      });
    }
  };

  const clearSelection = () => setSelectedIds(new Set());

  // ---- Batch Delete Logic ----
  const handleBatchDelete = async () => {
    const idsToDelete = Array.from(selectedIds);
    setBatchDeleting(true);
    setBatchProgress(0);
    setBatchTotal(idsToDelete.length);

    for (let i = 0; i < idsToDelete.length; i++) {
      try {
        await fetch(`/api/tasks/${idsToDelete[i]}?confirm=true`, { method: 'DELETE' });
      } catch (err) {
        console.error(`Gagal hapus ${idsToDelete[i]}:`, err);
      }
      setBatchProgress(i + 1);
    }

    setBatchDeleting(false);
    setBatchDeleteOpen(false);
    setSelectedIds(new Set());
    await fetchTasks();
  };

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)] flex items-center gap-2">
            <Building2 className="w-7 h-7 text-indigo-500" />
            Direktori Data
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            Koleksi dan arsip dataset hasil crawling yang terorganisir berdasarkan kategori industri.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-all cursor-pointer"
        >
          <Upload className="w-4 h-4" />
          Import File Excel (Batch)
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-[var(--color-surface)] p-4 rounded-2xl border border-[var(--color-border)]">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-[var(--color-text-muted)]" />
          <input
            type="text"
            placeholder="Cari nama direktori..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="w-full md:w-auto flex items-center gap-2">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full md:w-72 px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {CATEGORY_GROUPS.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ---- Batch Action Bar (muncul saat ada item dipilih) ---- */}
      {someSelected && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 bg-rose-500/5 border border-rose-500/30 rounded-2xl animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-3">
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-primary)] hover:text-rose-500 transition-colors cursor-pointer"
            >
              {allFilteredSelected ? (
                <CheckSquare className="w-4 h-4 text-rose-500" />
              ) : (
                <Square className="w-4 h-4 text-[var(--color-text-muted)]" />
              )}
              {allFilteredSelected ? 'Batal pilih semua' : 'Pilih semua di halaman ini'}
            </button>
            <span className="text-xs text-[var(--color-text-muted)]">|</span>
            <span className="text-xs font-semibold text-rose-500">
              {selectedIds.size} dataset dipilih
            </span>
            <span className="text-xs text-[var(--color-text-muted)]">
              ({totalSelectedRecords.toLocaleString()} total records)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={clearSelection}
              className="px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-xl hover:bg-[var(--color-bg)] transition-all cursor-pointer"
            >
              Batal
            </button>
            <button
              onClick={() => setBatchDeleteOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-all cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Hapus {selectedIds.size} Dataset
            </button>
          </div>
        </div>
      )}

      {/* Select All Bar (muncul saat belum ada seleksi, sebagai hint) */}
      {!someSelected && !loading && filteredTasks.length > 1 && (
        <div className="flex items-center gap-2">
          <button
            onClick={toggleSelectAll}
            className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors cursor-pointer"
          >
            <Square className="w-3.5 h-3.5" />
            Pilih semua untuk hapus sekaligus
          </button>
        </div>
      )}

      {/* Konten Grid Direktori */}
      {loading ? (
        <div className="py-24 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-500 mb-3" />
          <p className="text-sm text-[var(--color-text-secondary)]">Memuat daftar direktori...</p>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="py-20 text-center bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)]">
          <Database className="w-12 h-12 mx-auto text-[var(--color-text-muted)] mb-3" />
          <h3 className="text-base font-semibold text-[var(--color-text-primary)]">Belum ada direktori data</h3>
          <p className="text-xs text-[var(--color-text-secondary)] mt-1 max-w-sm mx-auto">
            Tidak ada dataset yang cocok dengan filter saat ini.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredTasks.map((t) => {
            const isChecked = selectedIds.has(t.id);
            return (
              <div
                key={t.id}
                className={`relative bg-[var(--color-surface)] border rounded-2xl p-5 flex flex-col justify-between shadow-sm transition-all ${
                  isChecked
                    ? 'border-rose-500/60 ring-2 ring-rose-500/20'
                    : 'border-[var(--color-border)] hover:border-indigo-500/50'
                }`}
              >
                {/* Checkbox overlay pojok kiri atas */}
                <button
                  onClick={() => toggleSelect(t.id)}
                  className="absolute top-3 left-3 z-10 cursor-pointer"
                  title={isChecked ? 'Batalkan pilihan' : 'Pilih dataset ini'}
                >
                  {isChecked ? (
                    <CheckSquare className="w-4.5 h-4.5 text-rose-500" />
                  ) : (
                    <Square className="w-4.5 h-4.5 text-[var(--color-text-muted)] hover:text-rose-400 transition-colors" />
                  )}
                </button>

                <div className="space-y-3 pl-5">
                  <div className="flex items-start justify-between gap-2">
                    <span className="inline-block px-2.5 py-1 bg-indigo-500/10 text-indigo-500 font-medium text-[11px] rounded-lg">
                      {t.category_group || 'Lainnya'}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full font-medium">
                      <CheckCircle2 className="w-3 h-3" />
                      Siap
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-[var(--color-text-primary)] line-clamp-1">
                    {t.name}
                  </h3>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[var(--color-border)]">
                    <div>
                      <span className="text-[11px] text-[var(--color-text-muted)] block">Total Records</span>
                      <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                        {(t.successful || 0).toLocaleString()} data
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] text-[var(--color-text-muted)] block">Tanggal</span>
                      <span className="text-sm font-medium text-[var(--color-text-secondary)] flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-[var(--color-text-muted)]" />
                        {new Date(t.created_at).toLocaleDateString('id-ID', { month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-[var(--color-border)] flex items-center gap-2">
                  <button
                    onClick={() => navigate(`/tasks/${t.id}`)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-500 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Buka Data
                  </button>
                  <a
                    href={`/api/tasks/${t.id}/export/xlsx`}
                    download
                    className="p-2 bg-[var(--color-bg)] hover:bg-[var(--color-border)] text-[var(--color-text-secondary)] rounded-xl border border-[var(--color-border)] transition-all cursor-pointer"
                    title="Download XLSX"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                  </a>
                  {/* Tombol Edit */}
                  <button
                    onClick={() => openEdit(t)}
                    className="p-2 bg-[var(--color-bg)] hover:bg-amber-500/10 text-amber-500 rounded-xl border border-[var(--color-border)] hover:border-amber-500/30 transition-all cursor-pointer"
                    title="Edit Dataset"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  {/* Tombol Delete */}
                  <button
                    onClick={() => setDeleteTarget(t)}
                    className="p-2 bg-[var(--color-bg)] hover:bg-rose-500/10 text-rose-500 rounded-xl border border-[var(--color-border)] hover:border-rose-500/30 transition-all cursor-pointer"
                    title="Hapus Dataset"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ===================== MODALS ===================== */}

      {/* Modal Batch Upload Excel */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Files className="w-5 h-5 text-indigo-500" />
                <h3 className="text-base font-bold text-[var(--color-text-primary)]">
                  Batch Import Dataset (.xlsx)
                </h3>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {uploadError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-xl text-xs">{uploadError}</div>
            )}

            <form onSubmit={handleBatchImport} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--color-text-primary)] mb-1">Pilih Kategori Kelompok</label>
                <select
                  value={importCategory}
                  onChange={(e) => setImportCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-[var(--color-text-primary)]"
                >
                  {CATEGORY_GROUPS.filter((c) => c !== 'Semua Kategori').map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                <p className="text-[11px] text-[var(--color-text-muted)] mt-1">Semua file yang diunggah akan dimasukkan ke dalam kategori ini.</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--color-text-primary)] mb-1">Pilih Satu atau Banyak File Excel</label>
                <input
                  type="file"
                  accept=".xlsx"
                  multiple
                  onChange={handleFileChange}
                  className="w-full text-xs text-[var(--color-text-secondary)] file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-500/10 file:text-indigo-500 hover:file:bg-indigo-500/20 cursor-pointer border border-[var(--color-border)] p-2 rounded-xl"
                  required
                />
              </div>
              {selectedFiles.length > 0 && (
                <div className="max-h-36 overflow-y-auto space-y-1.5 p-2 bg-[var(--color-bg)] rounded-xl border border-[var(--color-border)]">
                  <div className="text-[11px] font-semibold text-[var(--color-text-secondary)] px-1">{selectedFiles.length} file dipilih:</div>
                  {selectedFiles.map((f, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs text-[var(--color-text-primary)] px-2 py-1 bg-[var(--color-surface)] rounded-lg">
                      <span className="truncate max-w-[280px]">{f.name}</span>
                      <span className="text-[10px] text-[var(--color-text-muted)]">{(f.size / 1024).toFixed(0)} KB</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
                <button type="button" onClick={() => setIsModalOpen(false)} disabled={uploading}
                  className="px-4 py-2 border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)] rounded-xl text-xs font-medium cursor-pointer">
                  Batal
                </button>
                <button type="submit" disabled={uploading}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer">
                  {uploading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Mengimpor {selectedFiles.length} dataset...</> : `Mulai Import (${selectedFiles.length || 0})`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Edit Dataset */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Pencil className="w-5 h-5 text-amber-500" />
                <h3 className="text-base font-bold text-[var(--color-text-primary)]">Edit Dataset</h3>
              </div>
              <button onClick={() => setEditTarget(null)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            {editError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-xl text-xs">{editError}</div>
            )}
            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--color-text-primary)] mb-1">Nama Dataset</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Nama dataset..."
                  className="w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder-[var(--color-text-muted)]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--color-text-primary)] mb-1">Kategori Kelompok</label>
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  {CATEGORY_GROUPS.filter((c) => c !== 'Semua Kategori').map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
                <button type="button" onClick={() => setEditTarget(null)} disabled={saving}
                  className="px-4 py-2 border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)] rounded-xl text-xs font-medium cursor-pointer">
                  Batal
                </button>
                <button type="submit" disabled={saving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer disabled:opacity-60">
                  {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Menyimpan...</> : <><Save className="w-3.5 h-3.5" /> Simpan Perubahan</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus (single) */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-500/10 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-rose-500" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[var(--color-text-primary)]">Hapus Dataset?</h3>
                <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">Tindakan ini tidak dapat dibatalkan.</p>
              </div>
            </div>
            <p className="text-sm text-[var(--color-text-secondary)] bg-[var(--color-bg)] rounded-xl px-4 py-3 border border-[var(--color-border)]">
              Dataset <span className="font-semibold text-[var(--color-text-primary)]">"{deleteTarget.name}"</span> beserta seluruh{' '}
              <span className="font-semibold text-rose-500">{(deleteTarget.successful || 0).toLocaleString()} data</span> di dalamnya akan dihapus permanen.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button type="button" onClick={() => setDeleteTarget(null)} disabled={deleting}
                className="px-4 py-2 border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)] rounded-xl text-xs font-medium cursor-pointer">
                Batal
              </button>
              <button type="button" onClick={handleConfirmDelete} disabled={deleting}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer disabled:opacity-60">
                {deleting ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Menghapus...</> : <><Trash2 className="w-3.5 h-3.5" /> Ya, Hapus</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Batch Delete */}
      {batchDeleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl max-w-sm w-full p-6 space-y-5 shadow-2xl">
            {/* Header */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-500/10 flex items-center justify-center flex-shrink-0">
                <ShieldAlert className="w-5 h-5 text-rose-500" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[var(--color-text-primary)]">Hapus {selectedIds.size} Dataset?</h3>
                <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">Tindakan ini tidak dapat dibatalkan.</p>
              </div>
            </div>

            {/* Info summary */}
            <div className="bg-[var(--color-bg)] rounded-xl px-4 py-3 border border-[var(--color-border)] space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--color-text-muted)]">Jumlah dataset</span>
                <span className="font-semibold text-rose-500">{selectedIds.size} dataset</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--color-text-muted)]">Total records terhapus</span>
                <span className="font-semibold text-rose-500">{totalSelectedRecords.toLocaleString()} data</span>
              </div>
            </div>

            {/* Progress bar saat menghapus */}
            {batchDeleting && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-[var(--color-text-secondary)]">
                  <span>Menghapus dataset...</span>
                  <span className="font-mono font-semibold">{batchProgress}/{batchTotal}</span>
                </div>
                <div className="w-full h-2 bg-[var(--color-bg)] rounded-full overflow-hidden border border-[var(--color-border)]">
                  <div
                    className="h-full bg-rose-500 rounded-full transition-all duration-300"
                    style={{ width: `${batchTotal > 0 ? (batchProgress / batchTotal) * 100 : 0}%` }}
                  />
                </div>
                <p className="text-[11px] text-[var(--color-text-muted)]">Mohon tunggu, jangan tutup halaman ini.</p>
              </div>
            )}

            {/* Buttons */}
            {!batchDeleting && (
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setBatchDeleteOpen(false)}
                  className="px-4 py-2 border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)] rounded-xl text-xs font-medium cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleBatchDelete}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Ya, Hapus Semua
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}