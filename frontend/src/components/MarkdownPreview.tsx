import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Copy, Download, Loader2, Check } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getRecord, downloadFile } from '@/lib/api'
import { toast } from '@/components/ui/use-toast'
import type { ConversionRecordDetail } from '@/types'

interface MarkdownPreviewProps {
  recordId: string | null
  originalFilename: string
  onClose: () => void
}

export function MarkdownPreview({ recordId, originalFilename, onClose }: MarkdownPreviewProps) {
  const [detail, setDetail] = useState<ConversionRecordDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    if (!recordId) return
    setLoading(true)
    setDetail(null)
    getRecord(recordId)
      .then(setDetail)
      .finally(() => setLoading(false))
  }, [recordId])

  const handleCopy = async () => {
    if (!detail?.markdown_content) return
    try {
      await navigator.clipboard.writeText(detail.markdown_content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast({ variant: 'destructive', title: 'Failed to copy to clipboard' })
    }
  }

  const handleDownload = async () => {
    if (!recordId) return
    setDownloading(true)
    try {
      await downloadFile(recordId, originalFilename)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <Dialog open={!!recordId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] flex flex-col w-full max-w-5xl">
        <DialogHeader className="shrink-0">
          <DialogTitle className="truncate pr-8">{originalFilename}</DialogTitle>
          <DialogDescription>Converted Markdown output</DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex flex-1 items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && detail && (
          <>
            <Tabs defaultValue="preview" className="flex flex-1 flex-col min-h-0">
              <div className="flex items-center justify-between shrink-0">
                <TabsList>
                  <TabsTrigger value="preview">Preview</TabsTrigger>
                  <TabsTrigger value="raw">Raw Markdown</TabsTrigger>
                </TabsList>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleCopy}>
                    {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? 'Copied!' : 'Copy'}
                  </Button>
                  <Button size="sm" onClick={handleDownload} disabled={downloading}>
                    {downloading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Download className="h-3.5 w-3.5" />
                    )}
                    Download .md
                  </Button>
                </div>
              </div>

              <TabsContent value="preview" className="flex-1 min-h-0 mt-3">
                <ScrollArea className="h-[55vh] rounded-lg border bg-card p-6">
                  <article className="prose prose-sm max-w-none dark:prose-invert">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {detail.markdown_content || '*No content*'}
                    </ReactMarkdown>
                  </article>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="raw" className="flex-1 min-h-0 mt-3">
                <ScrollArea className="h-[55vh] rounded-lg border bg-card p-4">
                  <pre className="font-mono text-xs leading-relaxed whitespace-pre-wrap break-words text-foreground/80">
                    {detail.markdown_content || ''}
                  </pre>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
