export interface ConversionRecord {
  id: string
  original_filename: string
  output_filename: string
  file_size: number
  status: 'success' | 'error'
  error_message?: string | null
  created_at: string
  markdown_preview?: string | null
  llm_tokens?: {
    input_tokens: number
    output_tokens: number
    total_tokens: number
  } | null
}

export interface ConversionRecordDetail extends ConversionRecord {
  markdown_content: string
}

export interface BulkConversionResponse {
  results: ConversionRecord[]
  total: number
}

export type UploadStatus = 'idle' | 'uploading' | 'success' | 'error'

export interface UploadFile {
  id: string
  file: File
  status: UploadStatus
  progress: number
  record?: ConversionRecord
  error?: string
}
