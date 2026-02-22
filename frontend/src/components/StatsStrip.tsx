import { FileText, Package, Zap } from 'lucide-react'
import { formatBytes } from '@/lib/utils'
import type { ConversionRecord } from '@/types'

interface StatsStripProps {
  records: ConversionRecord[]
}

export function StatsStrip({ records }: StatsStripProps) {
  const fileCount = records.length
  const totalBytes = records.reduce((acc, r) => acc + (r.file_size ?? 0), 0)
  const totalTokens = records.reduce(
    (acc, r) => acc + (r.llm_tokens?.total_tokens ?? 0),
    0,
  )

  if (fileCount === 0) return null

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 py-4 text-sm text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <FileText className="h-4 w-4" />
        <span className="font-medium text-foreground">{fileCount}</span>
        <span>file{fileCount !== 1 ? 's' : ''} converted</span>
      </span>
      <span className="text-muted-foreground/50">·</span>
      <span className="inline-flex items-center gap-1.5">
        <Package className="h-4 w-4" />
        <span className="font-medium text-foreground">{formatBytes(totalBytes)}</span>
        <span>processed</span>
      </span>
      {totalTokens > 0 && (
        <>
          <span className="text-muted-foreground/50">·</span>
          <span className="inline-flex items-center gap-1.5">
            <Zap className="h-4 w-4 text-yellow-500" />
            <span className="font-medium text-foreground">
              {totalTokens.toLocaleString()}
            </span>
            <span>tokens used (session)</span>
          </span>
        </>
      )}
    </div>
  )
}
