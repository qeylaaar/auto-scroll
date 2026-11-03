import * as React from 'react';
import { Search, ArrowUpDown, FileSpreadsheet, FileJson, FileText, Info, Star, MessageSquare, User } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { DataChip } from '@/components/ui/Badge';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/Select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/Dialog';
import { TableRowSkeleton } from '@/components/ui/Skeleton';
import { api } from '@/lib/api';
import type { ResultRow, ReviewRow } from '@/types';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 25;

export function ResultsTable({
  taskId,
  provinceOptions,
  isPartial = false,
}: {
  taskId: string;
  provinceOptions: string[];
  isPartial?: boolean;
}) {
  const [rows, setRows] = React.useState<ResultRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState('');
  const [province, setProvince] = React.useState<string>('');
  const [hasPhone, setHasPhone] = React.useState(false);
  const [hasEmail, setHasEmail] = React.useState(false);
  const [hasCoords, setHasCoords] = React.useState(false);
  const [sortBy, setSortBy] = React.useState('id');
  const [sortDir, setSortDir] = React.useState<'ASC' | 'DESC'>('ASC');
  const [loading, setLoading] = React.useState(true);

  // State Dialog Detail Review
  const [selectedResult, setSelectedResult] = React.useState<ResultRow | null>(null);
  const [reviewsList, setReviewsList] = React.useState<ReviewRow[]>([]);
  const [loadingReviews, setLoadingReviews] = React.useState(false);

  React.useEffect(() => {
    setLoading(true);
    const handle = setTimeout(() => {
      api
        .getResults(taskId, { search, province, hasPhone, hasEmail, hasCoords, page, pageSize: PAGE_SIZE, sortBy, sortDir })
        .then((res) => {
          setRows(res.rows);
          setTotal(res.total);
          setLoading(false);
        });
    }, 250);
    return () => clearTimeout(handle);
  }, [taskId, search, province, hasPhone, hasEmail, hasCoords, page, sortBy, sortDir]);

  function handleOpenReviews(row: ResultRow) {
    setSelectedResult(row);
    setLoadingReviews(true);
    api
      .getReviews(row.id)
      .then((res) => setReviewsList(res.reviews))
      .catch(() => setReviewsList([]))
      .finally(() => setLoadingReviews(false));
  }

  function toggleSort(col: string) {
    if (sortBy === col) {
      setSortDir((d) => (d === 'ASC' ? 'DESC' : 'ASC'));
    } else {
      setSortBy(col);
      setSortDir('ASC');
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-3">
      {isPartial && total > 0 && (
        <div className="flex items-center gap-2 rounded-md bg-[var(--color-status-running-bg)] px-3 py-2 text-xs text-[var(--color-status-running)]">
          <Info className="h-3.5 w-3.5 shrink-0" />
          Task masih berjalan — data & export di bawah adalah hasil sementara ({total.toLocaleString('id-ID')} baris sejauh ini), akan terus bertambah.
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <Input
            placeholder="Cari nama atau alamat..."
            className="pl-8"
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
          />
        </div>

        <Select
          value={province || 'all'}
          onValueChange={(v) => {
            setPage(1);
            setProvince(v === 'all' ? '' : v);
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Semua Provinsi" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Provinsi</SelectItem>
            {provinceOptions.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {[
          { label: 'Ada Telepon', value: hasPhone, set: setHasPhone },
          { label: 'Ada Email', value: hasEmail, set: setHasEmail },
          { label: 'Ada Koordinat', value: hasCoords, set: setHasCoords },
        ].map((f) => (
          <button
            key={f.label}
            onClick={() => {
              setPage(1);
              f.set(!f.value);
            }}
            className={cn(
              'rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors',
              f.value
                ? 'border-[var(--color-accent)] bg-[var(--color-accent-light)] text-[var(--color-accent-dark)]'
                : 'border-[var(--color-border-strong)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)]'
            )}
          >
            {f.label}
          </button>
        ))}

        <div className="ml-auto flex items-center gap-1.5">
          <a href={api.exportUrl(taskId, 'reviews-csv')}>
            <Button size="sm" variant="secondary" title="Unduh seluruh ulasan pengguna dalam format CSV">
              <MessageSquare className="h-3.5 w-3.5 text-[var(--color-accent)]" /> Reviews CSV
            </Button>
          </a>
          <a href={api.exportUrl(taskId, 'csv')}>
            <Button size="sm" variant="secondary">
              <FileText className="h-3.5 w-3.5" /> CSV
            </Button>
          </a>
          <a href={api.exportUrl(taskId, 'xlsx')}>
            <Button size="sm" variant="secondary">
              <FileSpreadsheet className="h-3.5 w-3.5" /> XLSX
            </Button>
          </a>
          <a href={api.exportUrl(taskId, 'geojson')}>
            <Button size="sm" variant="secondary">
              <FileJson className="h-3.5 w-3.5" /> GeoJSON
            </Button>
          </a>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-[var(--color-border)] bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-left text-xs text-[var(--color-text-muted)]">
              {[
                { key: 'name', label: 'Name' },
                { key: 'full_address', label: 'Address' },
                { key: 'category', label: 'Category' },
                { key: 'phones', label: 'Phone' },
                { key: 'rating', label: 'Rating' },
                { key: 'total_reviews', label: 'Reviews' },
                { key: 'email', label: 'Email' },
                { key: 'website', label: 'Website' },
                { key: 'province', label: 'Province' },
                { key: 'coords', label: 'Coordinates' },
              ].map((col) => (
                <th key={col.key} className="whitespace-nowrap px-4 py-2.5 font-medium">
                  <button
                    className="flex items-center gap-1 hover:text-[var(--color-text-primary)]"
                    onClick={() => col.key !== 'coords' && toggleSort(col.key)}
                  >
                    {col.label}
                    {col.key !== 'coords' && <ArrowUpDown className="h-3 w-3" />}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 && Array.from({ length: 6 }).map((_, i) => <TableRowSkeleton key={i} columns={9} />)}
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface)]">
                <td className="max-w-[180px] truncate px-4 py-2.5 font-medium text-[var(--color-text-primary)]" title={r.name}>
                  {r.name}
                </td>
                <td className="max-w-[220px] truncate px-4 py-2.5 text-[var(--color-text-secondary)]" title={r.full_address}>
                  {r.full_address}
                </td>
                <td className="px-4 py-2.5 text-[var(--color-text-secondary)]">{r.category || '-'}</td>
                <td className="px-4 py-2.5 font-mono-data text-xs text-[var(--color-text-secondary)]">{r.phones || '-'}</td>
                <td className="px-4 py-2.5 font-mono-data text-xs text-[var(--color-text-secondary)]">
                  {r.rating && r.rating !== '-' ? (
                    <span className="inline-flex items-center gap-1 text-amber-600 font-medium">
                      <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                      {r.rating}
                    </span>
                  ) : (
                    '-'
                  )}
                </td>
                <td className="px-4 py-2.5 font-mono-data text-xs text-[var(--color-text-secondary)]">
                  {r.total_reviews && r.total_reviews !== '-' ? (
                    <button
                      type="button"
                      onClick={() => handleOpenReviews(r)}
                      className="inline-flex items-center gap-1 font-medium text-[var(--color-accent)] hover:underline cursor-pointer"
                      title="Klik untuk melihat komentar ulasan"
                    >
                      <MessageSquare className="h-3 w-3" />
                      {Number(r.total_reviews).toLocaleString('id-ID')}
                    </button>
                  ) : (
                    '-'
                  )}
                </td>
                <td className="px-4 py-2.5 text-xs text-[var(--color-text-secondary)]">{r.email || '-'}</td>
                <td className="max-w-[180px] truncate px-4 py-2.5 text-xs text-[var(--color-text-secondary)]">
                  {r.website ? (
                    <a href={r.website} target="_blank" rel="noopener noreferrer" className="text-[var(--color-accent)] hover:underline" title={r.website}>
                      {(() => { try { return new URL(r.website).hostname; } catch { return r.website; } })()}
                    </a>
                  ) : '-'}
                </td>
                <td className="px-4 py-2.5 text-[var(--color-text-secondary)]">{r.province || '-'}</td>
                <td className="px-4 py-2.5">
                  {r.latitude && r.longitude ? (
                    <DataChip>
                      {r.latitude.toFixed(4)}, {r.longitude.toFixed(4)}
                    </DataChip>
                  ) : (
                    <span className="text-xs text-[var(--color-text-muted)]">-</span>
                  )}
                </td>
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-sm text-[var(--color-text-muted)]">
                  Tidak ada hasil yang cocok dengan filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-xs text-[var(--color-text-secondary)]">
        <span>
          Menampilkan {rows.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, total)} dari{' '}
          <span className="font-mono-data">{total.toLocaleString('id-ID')}</span> hasil
        </span>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Prev
          </Button>
          <span className="font-mono-data">
            {page} / {totalPages}
          </span>
          <Button size="sm" variant="secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      </div>

      {/* Dialog Popup Detail Ulasan */}
      <Dialog open={!!selectedResult} onOpenChange={(open) => !open && setSelectedResult(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">{selectedResult?.name}</DialogTitle>
            <DialogDescription className="text-xs text-[var(--color-text-muted)]">
              {selectedResult?.full_address}
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] overflow-y-auto space-y-3 pr-2 my-2">
            {loadingReviews ? (
              <p className="text-xs text-[var(--color-text-muted)] text-center py-6">Memuat ulasan pengguna...</p>
            ) : reviewsList.length === 0 ? (
              <div className="text-center py-8 text-xs text-[var(--color-text-muted)]">
                Belum ada detail teks ulasan yang tersimpan untuk lokasi ini.
              </div>
            ) : (
              reviewsList.map((rev) => (
                <div key={rev.id} className="rounded-lg border border-[var(--color-border)] p-3 space-y-1.5 bg-gray-50/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-[10px] font-semibold text-blue-700">
                        <User className="h-3.5 w-3.5" />
                      </div>
                      <span className="text-xs font-medium text-[var(--color-text-primary)]">{rev.author_name}</span>
                    </div>
                    {rev.published_at && (
                      <span className="text-[11px] text-[var(--color-text-muted)]">{rev.published_at}</span>
                    )}
                  </div>
                  {rev.rating && (
                    <div className="flex items-center gap-0.5 text-amber-500">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={cn('h-3 w-3', i < rev.rating! ? 'fill-amber-400 text-amber-400' : 'text-gray-200')}
                        />
                      ))}
                    </div>
                  )}
                  {rev.review_text ? (
                    <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed whitespace-pre-line">
                      {rev.review_text}
                    </p>
                  ) : (
                    <p className="text-[11px] italic text-[var(--color-text-muted)]">-</p>
                  )}
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}