import { useCallback, useEffect, useState } from 'react'
import { Header } from '@/components/Header'
import { DropZone } from '@/components/DropZone'
import { ConversionHistory } from '@/components/ConversionHistory'
import { MarkdownPreview } from '@/components/MarkdownPreview'
import { Toaster } from '@/components/ui/toaster'
import { toast } from '@/components/ui/use-toast'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { getHistory } from '@/lib/api'
import logger from '@/lib/logger'
import type { ConversionRecord } from '@/types'
import { Upload, History, Github } from 'lucide-react'

const log = logger.child('App')

export default function App() {
  const [history, setHistory] = useState<ConversionRecord[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [previewFilename, setPreviewFilename] = useState('')
  const fetchHistory = useCallback(async () => {
    log.debug('fetchHistory: loading')
    setHistoryLoading(true)
    try {
      const records = await getHistory()
      log.info('fetchHistory: %d record(s)', records.length)
      setHistory(records)
    } catch (err) {
      log.error('fetchHistory failed', err)
      toast({ variant: 'destructive', title: 'Failed to load history' })
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  const handleConverted = (newRecords: ConversionRecord[]) => {
    log.info('handleConverted: %d new record(s)', newRecords.length)
    setHistory((prev) => {
      const existing = new Set(prev.map((r) => r.id))
      const fresh = newRecords.filter((r) => !existing.has(r.id))
      log.debug('handleConverted: %d truly new (de-duped)', fresh.length)
      return [...fresh, ...prev]
    })
    toast({
      variant: 'success',
      title: `${newRecords.length} file${newRecords.length !== 1 ? 's' : ''} converted`,
      description: 'Click any row to preview the Markdown output.',
    })
  }

  const handleView = (id: string, filename: string) => {
    log.debug('handleView id=%s filename=%s', id, filename)
    setPreviewId(id)
    setPreviewFilename(filename)
  }

  const handleRecordDeleted = (id: string) => {
    log.info('handleRecordDeleted id=%s', id)
    setHistory((prev) => prev.filter((r) => r.id !== id))
  }

  const handleClearAll = () => {
    log.warn('handleClearAll: clearing entire history')
    setHistory([])
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        {/* Hero */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            MarkItDown{' '}
            <span className="bg-gradient-to-r from-primary/80 to-primary bg-clip-text text-transparent">
              UI
            </span>
          </h1>
          <p className="mt-2 text-muted-foreground">
            Powered by{' '}
            <a
              href="https://github.com/microsoft/markitdown"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4 hover:text-foreground transition-colors"
            >
              Microsoft MarkItDown
            </a>
            {' '}&mdash; PDF, DOCX, PPTX, XLSX, HTML, images, audio &amp; more
          </p>
        </div>

        {/* Two-column layout */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Upload panel */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <Upload className="h-4 w-4" />
                Upload &amp; Convert
              </CardTitle>
              <CardDescription>
                Drop one or more files — bulk conversions run in parallel
              </CardDescription>
            </CardHeader>
            <Separator />
            <CardContent className="pt-5">
              <DropZone onConverted={handleConverted} />
            </CardContent>
          </Card>

          {/* History panel */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <History className="h-4 w-4" />
                Conversion History
              </CardTitle>
              <CardDescription>
                All converted documents — preview, download or delete
              </CardDescription>
            </CardHeader>
            <Separator />
            <CardContent className="pt-5">
              <ConversionHistory
                records={history}
                loading={historyLoading}
                onRefresh={fetchHistory}
                onView={handleView}
                onRecordDeleted={handleRecordDeleted}
                onClearAll={handleClearAll}
              />
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-5 text-center text-xs text-muted-foreground">
        <div className="flex flex-col items-center gap-1.5">
          <div className="flex items-center gap-2">
            <span>&copy; {new Date().getFullYear()} Sathishkumar Krishnan</span>
            <span className="text-muted-foreground/40">·</span>
            <span>MarkItDown UI</span>
            <span className="text-muted-foreground/40">·</span>
            <span>MIT License</span>
            <a
              href="https://github.com/microsoft/markitdown"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground transition-colors hover:text-foreground"
              title="Microsoft MarkItDown on GitHub"
            >
              <Github className="h-3.5 w-3.5" />
            </a>
          </div>
          <p className="text-[10px] text-muted-foreground/50">
            Uses{' '}
            <a
              href="https://github.com/microsoft/markitdown"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-muted-foreground/80"
            >
              Microsoft MarkItDown
            </a>
            {' '}(MIT) &mdash; not affiliated with or endorsed by Microsoft Corporation.
          </p>
        </div>
      </footer>

      {/* Markdown preview dialog */}
      <MarkdownPreview
        recordId={previewId}
        originalFilename={previewFilename}
        onClose={() => setPreviewId(null)}
      />

      <Toaster />
    </div>
  )
}
