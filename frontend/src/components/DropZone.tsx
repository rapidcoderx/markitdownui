import { useCallback, useRef, useState } from 'react'
import { CloudUpload, FileUp, Loader2, X, CheckCircle2, AlertCircle, Link2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from '@/components/ui/use-toast'
import { cn, formatBytes, getFileIcon } from '@/lib/utils'
import { convertFiles, convertUrl } from '@/lib/api'
import type { ConversionRecord, UploadFile } from '@/types'

const PROGRESS_INTERVAL_MS = 400
const PROGRESS_INCREMENT = 20
const PROGRESS_MAX_BEFORE_DONE = 85
const SUCCESS_CLEAR_DELAY_MS = 1500
const ERROR_CLEAR_DELAY_MS = 2500

const ACCEPTED_EXTENSIONS = [
  '.pdf', '.docx', '.doc', '.pptx', '.ppt',
  '.xlsx', '.xls', '.csv',
  '.html', '.htm', '.xml',
  '.txt', '.md', '.rst',
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp',
  '.mp3', '.wav', '.m4a',
  '.zip', '.json', '.yaml', '.yml', '.epub',
].join(',')

interface DropZoneProps {
  onConverted: (records: ConversionRecord[]) => void
}

export function DropZone({ onConverted }: DropZoneProps) {
  const [files, setFiles] = useState<UploadFile[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [isConverting, setIsConverting] = useState(false)
  const [urlInput, setUrlInput] = useState('')
  const [urlConverting, setUrlConverting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const addFiles = useCallback((newFiles: File[]) => {
    const uploads: UploadFile[] = newFiles.map((f) => ({
      id: crypto.randomUUID(),
      file: f,
      status: 'idle',
      progress: 0,
    }))
    setFiles((prev) => [...prev, ...uploads])
  }, [])

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id))
  }

  const clearAll = () => setFiles([])

  /* ── Drag handlers ─────────────────────────────────── */
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }
  const onDragLeave = () => setIsDragging(false)
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    addFiles(Array.from(e.dataTransfer.files))
  }

  /* ── Convert ─────────────────────────────────────── */
  const handleConvert = async () => {
    if (files.length === 0) return
    setIsConverting(true)

    // Mark all as uploading + animate progress
    setFiles((prev) => prev.map((f) => ({ ...f, status: 'uploading', progress: 30 })))

    try {
      const rawFiles = files.map((f) => f.file)
      // Simulate progress tick
      const progressTimer = setInterval(() => {
        setFiles((prev) =>
          prev.map((f) =>
            f.status === 'uploading' ? { ...f, progress: Math.min(f.progress + PROGRESS_INCREMENT, PROGRESS_MAX_BEFORE_DONE) } : f
          )
        )
      }, PROGRESS_INTERVAL_MS)

      const response = await convertFiles(rawFiles)
      clearInterval(progressTimer)

      const resultMap = new Map<string, ConversionRecord>()
      for (const r of response.results) {
        resultMap.set(r.original_filename, r)
      }

      setFiles((prev) =>
        prev.map((f) => {
          const record = resultMap.get(f.file.name)
          if (!record) return { ...f, status: 'error', progress: 100, error: 'No result returned' }
          return {
            ...f,
            status: record.status === 'success' ? 'success' : 'error',
            progress: 100,
            record,
            error: record.error_message ?? undefined,
          }
        })
      )

      const successRecords = response.results.filter((r) => r.status === 'success')
      if (successRecords.length > 0) onConverted(successRecords)

      // Clear queue after a short pause so users can see the result badges
      setTimeout(() => setFiles([]), SUCCESS_CLEAR_DELAY_MS)
    } catch (err) {
      setFiles((prev) =>
        prev.map((f) => ({
          ...f,
          status: 'error',
          progress: 100,
          error: (err as Error).message,
        }))
      )
      setTimeout(() => setFiles([]), ERROR_CLEAR_DELAY_MS)
    } finally {
      setIsConverting(false)
    }
  }

  const handleConvertUrl = async () => {
    const url = urlInput.trim()
    if (!url) return
    setUrlConverting(true)
    try {
      const record = await convertUrl(url)
      onConverted([record])
      setUrlInput('')
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'URL conversion failed',
        description: (err as Error).message,
      })
    } finally {
      setUrlConverting(false)
    }
  }

  const pendingCount = files.filter((f) => f.status === 'idle').length
  const doneCount = files.filter((f) => f.status === 'success' || f.status === 'error').length

  return (
    <div className="space-y-4">
      <Tabs defaultValue="files" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="files" className="gap-1.5">
            <FileUp className="h-3.5 w-3.5" />
            Files
          </TabsTrigger>
          <TabsTrigger value="url" className="gap-1.5">
            <Link2 className="h-3.5 w-3.5" />
            URL
          </TabsTrigger>
        </TabsList>
        <TabsContent value="files" className="mt-4 space-y-4">
      {/* Drop area */}
      <div
        className={cn(
          'relative flex min-h-[200px] cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border bg-card transition-all duration-200',
          isDragging && 'drag-active border-primary',
          'hover:border-primary/60 hover:bg-primary/5'
        )}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          multiple
          accept={ACCEPTED_EXTENSIONS}
          onChange={(e) => addFiles(Array.from(e.target.files ?? []))}
        />
        <div className="flex h-14 w-14 items-center justify-center rounded-xl border bg-background shadow-sm">
          {isDragging ? (
            <FileUp className="h-7 w-7 animate-bounce text-primary" />
          ) : (
            <CloudUpload className="h-7 w-7 text-muted-foreground" />
          )}
        </div>
        <div className="text-center">
          <p className="text-sm font-medium">
            {isDragging ? 'Drop your files here' : 'Drag & drop files or click to browse'}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            PDF, DOCX, PPTX, XLSX, HTML, TXT, MD, images, audio, ZIP&nbsp;&amp;&nbsp;more
          </p>
        </div>
        {files.length > 0 && (
          <Badge variant="secondary" className="absolute right-3 top-3">
            {files.length} file{files.length !== 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Queue · {files.length} file{files.length !== 1 ? 's' : ''}
            </p>
            {doneCount === 0 && (
              <button
                onClick={clearAll}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Clear all
              </button>
            )}
          </div>
          <ul className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {files.map((f) => (
              <FileRow key={f.id} upload={f} onRemove={() => removeFile(f.id)} />
            ))}
          </ul>
        </div>
      )}

      {/* Actions */}
      {files.length > 0 && (
        <div className="flex items-center gap-3">
          <Button
            onClick={handleConvert}
            disabled={isConverting || pendingCount === 0}
            className="flex-1"
          >
            {isConverting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Converting {files.length} file{files.length !== 1 ? 's' : ''}…
              </>
            ) : (
              <>
                <FileUp className="mr-2 h-4 w-4" />
                Convert {pendingCount > 0 ? pendingCount : files.length} file
                {(pendingCount || files.length) !== 1 ? 's' : ''} to Markdown
              </>
            )}
          </Button>
          {doneCount > 0 && (
            <Button variant="outline" onClick={clearAll}>
              Clear
            </Button>
          )}
        </div>
      )}
        </TabsContent>
        <TabsContent value="url" className="mt-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            Enter a web page URL to convert its content to Markdown.
          </p>
          <div className="flex gap-2">
            <input
              type="url"
              placeholder="https://example.com/page"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleConvertUrl()}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <Button
              onClick={handleConvertUrl}
              disabled={urlConverting || !urlInput.trim()}
            >
              {urlConverting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Link2 className="mr-2 h-4 w-4" />
                  Convert
                </>
              )}
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

/* ── File row ────────────────────────────────────────────────────────────── */
function FileRow({ upload, onRemove }: { upload: UploadFile; onRemove: () => void }) {
  const { file, status, progress, error } = upload

  return (
    <li className="flex items-center gap-3 rounded-lg border bg-card/50 p-3 text-sm animate-fade-in">
      <span className="text-xl leading-none">{getFileIcon(file.name)}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate font-medium">{file.name}</span>
          <span className="shrink-0 text-xs text-muted-foreground">{formatBytes(file.size)}</span>
        </div>
        {status === 'uploading' && (
          <Progress value={progress} className="mt-1.5 h-1" />
        )}
        {status === 'error' && (
          <p className="mt-0.5 truncate text-xs text-destructive">{error}</p>
        )}
      </div>
      {status === 'idle' && (
        <button onClick={onRemove} className="text-muted-foreground hover:text-foreground transition-colors">
          <X className="h-4 w-4" />
        </button>
      )}
      {status === 'success' && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />}
      {status === 'error' && <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />}
      {status === 'uploading' && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />}
    </li>
  )
}
