import { useRef, useState, useEffect } from "react"
import { ImagePlus, X, type LucideIcon, Play } from "lucide-react"

interface UploadAreaProps {
  onUpload?: (file: File, previewUrl: string) => void
  onClear?: () => void
  accept?: string
  title?: string
  subtitle?: string
  icon?: LucideIcon
  onError?: (message: string) => void
  validate?: (file: File, tempUrl: string) => Promise<boolean> | boolean
  maxSizeMB?: number
  /** Externally-set preview (e.g. from motion library) */
  externalPreview?: string | null
  externalFileType?: "image" | "video"
  className?: string
}

export function UploadArea({
  onUpload,
  onClear,
  accept = "image/jpeg,image/png,image/webp,image/bmp,image/tiff,.jpg,.jpeg,.png,.webp,.bmp,.tiff",
  title = "Загрузите изображение",
  subtitle,
  icon: Icon = ImagePlus,
  onError,
  validate,
  maxSizeMB = 10,
  externalPreview,
  externalFileType,
  className,
}: UploadAreaProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [fileType, setFileType] = useState<"image" | "video">("image")

  // Sync external preview from parent (e.g. motion library selection)
  useEffect(() => {
    if (externalPreview) {
      setPreview(externalPreview)
      setFileType(externalFileType ?? "video")
    }
  }, [externalPreview, externalFileType])

  const handleClick = () => {
    inputRef.current?.click()
  }

  const isTypeValid = (file: File): boolean => {
    // Simple extension/type check based on accept prop
    // This is a basic check, more complex validation (like duration) 
    // should be done by the parent via the onUpload callback or before calling it

    // We can check if the file type roughly matches the accept
    // But usually the browser handles the picker. 
    // Here we just pass it through, or we could strict check.
    // For now, let's trust the parent to validation or basic type check.

    const isVideo = file.type.startsWith("video/")
    const isImage = file.type.startsWith("image/")

    if (accept.includes("image") && !isImage && !accept.includes("video")) {
      onError?.("Invalid file type. Image required.")
      return false
    }
    if (accept.includes("video") && !isVideo && !accept.includes("image")) {
      onError?.("Invalid file type. Video required.")
      return false
    }

    return true
  }

  const handleFile = async (file: File) => {
    if (!isTypeValid(file)) return

    // Size validation
    const maxBytes = maxSizeMB * 1024 * 1024
    if (file.size > maxBytes) {
      onError?.(`Файл слишком большой. Максимум ${maxSizeMB} МБ`)
      return
    }

    const url = URL.createObjectURL(file)

    if (validate) {
      const isValid = await validate(file, url)
      if (!isValid) {
        URL.revokeObjectURL(url)
        return
      }
    }

    setPreview(url)
    setFileType(file.type.startsWith("video/") ? "video" : "image")
    onUpload?.(file, url)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    handleFile(file)
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    setPreview(null)
    if (inputRef.current) inputRef.current.value = ""
    onClear?.()
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items
    for (const item of items) {
      if (item.kind === "file") {
        const file = item.getAsFile()
        if (file) {
          // Basic check against accept (naive)
          if (accept.includes("video") && !file.type.startsWith("video/")) continue
          if (accept.includes("image") && !file.type.startsWith("image/")) continue

          handleFile(file)
          return // Only take the first valid one
        }
      }
    }
  }

  return (
    <div onPaste={handlePaste}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleChange}
        className="hidden"
      />

      {preview ? (
        <div className="relative w-full aspect-[3/4] rounded-2xl overflow-hidden bg-[#161616] border border-white/[0.06]">
          {fileType === "video" ? (
            <video
              src={preview}
              className="absolute inset-0 w-full h-full object-cover"
              autoPlay
              loop
              muted
              playsInline
            />
          ) : (
            <img
              src={preview}
              alt="Preview"
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}

          <button
            type="button"
            onClick={handleClear}
            className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 flex items-center justify-center hover:bg-black/80 transition-colors z-10"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleClick}
          className={`w-full flex flex-col items-center justify-center gap-2.5 py-6 px-4 rounded-2xl border border-dashed border-white/10 bg-[#161616] hover:bg-[#1c1c1c] transition-colors cursor-pointer ${className ?? ""}`}
        >
          <div className="w-10 h-10 rounded-full bg-[#222] flex items-center justify-center">
            <Icon className="w-5 h-5 text-white/40" />
          </div>
          <div className="text-center">
            <p className="text-sm text-white/70">
              {title}
            </p>
            {subtitle && <p className="text-xs text-white/35 mt-0.5">{subtitle}</p>}
          </div>
        </button>
      )}
    </div>
  )
}

