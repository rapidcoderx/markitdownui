import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso))
}

export function getFileIcon(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  const icons: Record<string, string> = {
    pdf: '📄',
    docx: '📝', doc: '📝',
    pptx: '📊', ppt: '📊',
    xlsx: '📈', xls: '📈', csv: '📈',
    html: '🌐', htm: '🌐',
    txt: '📃', md: '📃', rst: '📃',
    png: '🖼️', jpg: '🖼️', jpeg: '🖼️', gif: '🖼️', webp: '🖼️', bmp: '🖼️',
    mp3: '🎵', wav: '🎵', m4a: '🎵',
    zip: '🗜️',
    json: '🔧', yaml: '🔧', yml: '🔧',
    epub: '📚',
    xml: '📋',
  }
  return icons[ext] ?? '📄'
}
