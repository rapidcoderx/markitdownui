import { useState } from 'react'
import {
  Eye,
  Download,
  Trash2,
  RotateCcw,
  CheckCircle2,
  XCircle,
  ClockIcon,
  Loader2,
  ChevronDown,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn, formatBytes, formatDate, getFileIcon } from '@/lib/utils'
import { deleteRecord, clearHistory, downloadFile } from '@/lib/api'
import logger from '@/lib/logger'
import type { ConversionRecord } from '@/types'

const log = logger.child('ConversionHistory')

const VISIBLE_COUNT = 3   // shown inline by default
const POPUP_COUNT   = 10  // shown in the "more" dialog

interface ConversionHistoryProps {
  records: ConversionRecord[]
  loading: boolean
  onRefresh: () => void
  onView: (id: string, filename: string) => void
  onRecordDeleted: (id: string) => void
  onClearAll: () => void
}

export function ConversionHistory({
  records,
  loading,
  onRefresh,
  onView,
  onRecordDeleted,
  onClearAll,
}: ConversionHistoryProps) {
  const [deletingId, setDeletingId]       = useState<string | null>(null)
  const [clearingAll, setClearingAll]     = useState(false)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [showMore, setShowMore]           = useState(false)

  const handleDelete = async (id: string, fromPopup = false) => {
    log.info('handleDelete id=%s', id)
    setDeletingId(id)
    try {
      await deleteRecord(id)
      onRecordDeleted(id)
      if (fromPopup && records.length <= 1) setShowMore(false)
    } finally {
      setDeletingId(null)
    }
  }

  const handleClearAll = async () => {
    if (!confirm(`Clear all ${records.length} records?`)) return
    log.warn('handleClearAll')
    setClearingAll(true)
    try {
      await clearHistory()
      onClearAll()
      setShowMore(false)
    } finally {
      setClearingAll(false)
    }
  }

  const handleDownload = async (record: ConversionRecord) => {
    setDownloadingId(record.id)
    try {
      await downloadFile(record.id, record.original_filename)
    } finally {
      setDownloadingId(null)
    }
  }

  const visible    = records.slice(0, VISIBLE_COUNT)
  const popupList  = records.slice(0, POPUP_COUNT)
  const extraCount = Math.max(0, records.length - VISIBLE_COUNT)

  const historyTokens = records.reduce(
    (acc, r) => {
      if (r.llm_tokens) {
        acc.input  += r.llm_tokens.input_tokens
        acc.output += r.llm_tokens.output_tokens
        acc.total  += r.llm_tokens.total_tokens
      }
      return acc
    },
    { input: 0, output: 0, total: 0 },
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading history…
      </div>
    )
  }

  const sharedRowProps = { deletingId, downloadingId, onView, onDownload: handleDownload, onDelete: handleDelete }

  return (
    <div className="space-y-3">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClockIcon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">
            {records.length} conversion{records.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={onRefresh}>
            <RotateCcw className="h-3.5 w-3.5" />
            Refresh
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive disabled:opacity-40"
            onClick={handleClearAll}
            disabled={clearingAll || records.length === 0}
            title="Clear all history"
          >
            {clearingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            Clear
          </Button>
        </div>
      </div>

      {records.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-16 text-center">
          <ClockIcon className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No conversions yet</p>
          <p className="text-xs text-muted-foreground/60">Upload a file to get started</p>
        </div>
      ) : (
        <>
          {/* Last 3 inline */}
          <ul className="space-y-2">
            {visible.map((record, idx) => (
              <li key={record.id} className="animate-fade-in" style={{ animationDelay: `${idx * 40}ms`, animationFillMode: 'both' }}>
                <HistoryRow record={record} {...sharedRowProps} />
                {idx < visible.length - 1 && <Separator className="mt-2" />}
              </li>
            ))}
          </ul>

          {/* Show more button */}
          {extraCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="group/more w-full gap-1.5 text-muted-foreground hover:text-foreground"
              onClick={() => setShowMore(true)}
            >
              <ChevronDown className="h-3.5 w-3.5 transition-transform duration-200 ease-out group-hover/more:translate-y-0.5" />
              Show {Math.min(extraCount, POPUP_COUNT - VISIBLE_COUNT)} more
            </Button>
          )}

          {/* Consolidated token footer */}
          {historyTokens.total > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-yellow-500/20 bg-yellow-500/5 px-3 py-2">
              <Zap className="h-3.5 w-3.5 shrink-0 text-yellow-500" />
              <span className="text-xs font-medium text-yellow-600 dark:text-yellow-400">
                {historyTokens.total.toLocaleString()} total tokens
              </span>
              <span className="text-xs text-muted-foreground/70">
                across {records.filter(r => r.llm_tokens).length} LLM-assisted conversion{records.filter(r => r.llm_tokens).length !== 1 ? 's' : ''}
              </span>
              <span className="ml-auto text-xs text-muted-foreground/60">
                {historyTokens.input.toLocaleString()} in&nbsp;·&nbsp;{historyTokens.output.toLocaleString()} out
              </span>
            </div>
          )}
        </>
      )}

      {/* "More" popup — last 10 */}
      <Dialog open={showMore} onOpenChange={setShowMore}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClockIcon className="h-4 w-4" />
              Recent conversions
              <span className="text-sm font-normal text-muted-foreground">
                (last {popupList.length})
              </span>
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-3">
            <ul className="space-y-2">
              {popupList.map((record, idx) => (
                <li key={record.id}>
                  <HistoryRow record={record} {...sharedRowProps} inPopup />
                  {idx < popupList.length - 1 && <Separator className="mt-2" />}
                </li>
              ))}
            </ul>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* ── History row ──────────────────────────────────────────────────────────── */
interface HistoryRowProps {
  record: ConversionRecord
  deletingId: string | null
  downloadingId: string | null
  onView: (id: string, filename: string) => void
  onDownload: (record: ConversionRecord) => void
  onDelete: (id: string, fromPopup?: boolean) => void
  inPopup?: boolean
}

function HistoryRow({
  record, deletingId, downloadingId, onView, onDownload, onDelete, inPopup = false,
}: HistoryRowProps) {
  const isDeleting    = deletingId === record.id
  const isDownloading = downloadingId === record.id

  return (
    <div className={cn(
      'group relative flex items-start gap-3 rounded-lg border-l-2 border-l-transparent p-3',
      'transition-[background-color,border-color,box-shadow] duration-200 ease-out',
      'hover:border-l-primary hover:bg-zinc-100 hover:shadow-sm',
      'dark:hover:border-l-primary dark:hover:bg-zinc-800/70 dark:hover:shadow-none',
      isDeleting && 'pointer-events-none opacity-50'
    )}>
      <span className="mt-0.5 text-xl leading-none">{getFileIcon(record.original_filename)}</span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-medium">{record.original_filename}</span>
          <StatusBadge status={record.status} />
          {record.llm_tokens && (
            <span className="inline-flex items-center gap-1 rounded-full border border-yellow-500/30 bg-yellow-500/10 px-1.5 py-0.5 text-[10px] font-medium">
              <Zap className="h-2.5 w-2.5 text-yellow-500" />
              <span className="text-blue-500 dark:text-blue-400">{record.llm_tokens.input_tokens.toLocaleString()}</span>
              <span className="text-muted-foreground/50">/</span>
              <span className="text-emerald-500 dark:text-emerald-400">{record.llm_tokens.output_tokens.toLocaleString()}</span>
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
          <span>{formatBytes(record.file_size)}</span>
          <span>·</span>
          <span>{formatDate(record.created_at)}</span>
        </div>
        {record.status === 'error' && record.error_message && (
          <p className="mt-1 truncate text-xs text-destructive">{record.error_message}</p>
        )}
        {record.status === 'success' && record.markdown_preview && (
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground/70 font-mono">
            {record.markdown_preview}
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity duration-200 ease-out group-hover:opacity-100">
        {record.status === 'success' && (
          <>
            <Button variant="ghost" size="icon" className="h-7 w-7"
              onClick={() => onView(record.id, record.original_filename)} title="Preview">
              <Eye className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7"
              onClick={() => onDownload(record)} disabled={isDownloading} title="Download">
              {isDownloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            </Button>
          </>
        )}
        <Button variant="ghost" size="icon"
          className="h-7 w-7 text-destructive hover:text-destructive"
          onClick={() => onDelete(record.id, inPopup)} disabled={isDeleting} title="Delete">
          {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: 'success' | 'error' }) {
  if (status === 'success') {
    return (
      <Badge variant="success" className="gap-1 text-[10px]">
        <CheckCircle2 className="h-2.5 w-2.5" />
        Converted
      </Badge>
    )
  }
  return (
    <Badge variant="error" className="gap-1 text-[10px]">
      <XCircle className="h-2.5 w-2.5" />
      Failed
    </Badge>
  )
}