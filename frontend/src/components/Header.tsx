import { useState } from 'react'
import { FileCode2, Info, Sun, Moon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useTheme } from '@/lib/theme'

export function Header() {
  const [infoOpen, setInfoOpen] = useState(false)
  const { theme, toggle } = useTheme()

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <FileCode2 className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-sm font-bold tracking-tight">MarkItDown UI</span>
            <span className="text-[10px] text-muted-foreground">
              Powered by{' '}
              <a
                href="https://github.com/microsoft/markitdown"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-foreground transition-colors"
              >
                Microsoft MarkItDown
              </a>
              {' '}&middot; PDF, DOCX, PPTX, XLSX, HTML, images, audio &amp; more
            </span>
          </div>
        </div>

        {/* Right side */}
        <nav className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={toggle}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => setInfoOpen(true)}
            title="About MarkItDown UI"
          >
            <Info className="h-4 w-4" />
          </Button>
        </nav>
      </div>

      {/* About dialog */}
      <Dialog open={infoOpen} onOpenChange={setInfoOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileCode2 className="h-5 w-5" />
              MarkItDown UI
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              A web-based document-to-Markdown converter built on top of{' '}
              <a
                href="https://github.com/microsoft/markitdown"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-foreground underline underline-offset-4 hover:no-underline"
              >
                Microsoft MarkItDown
              </a>
              , an open-source library for converting PDF, DOCX, PPTX, XLSX,
              HTML, images, audio, and more into clean Markdown.
            </p>
            <p>
              Features include AI-powered image descriptions via Anthropic Claude
              and OpenAI GPT-4o, bulk conversions, per-session LLM token tracking,
              conversion history, and a Markdown preview pane.
            </p>

            <div className="rounded-lg border bg-muted/40 px-3 py-2.5 space-y-1">
              <p>
                <span className="font-medium text-foreground">Author</span>
                {' · '}Sathishkumar Krishnan
              </p>
              <p>
                <span className="font-medium text-foreground">License</span>
                {' · '}MIT
              </p>
            </div>

            <p className="text-[11px] leading-relaxed text-muted-foreground/60">
              MarkItDown UI is an independent open-source project and is not
              affiliated with, sponsored by, or endorsed by Microsoft Corporation.
              &ldquo;Microsoft MarkItDown&rdquo; refers to the open-source library
              published at{' '}
              <a
                href="https://github.com/microsoft/markitdown"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-muted-foreground"
              >
                github.com/microsoft/markitdown
              </a>{' '}
              and used here under its MIT License.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </header>
  )
}
