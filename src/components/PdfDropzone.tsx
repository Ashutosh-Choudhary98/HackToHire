import { useRef, useState } from "react";
import { FileText, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

// Lazy-load pdfjs only when needed (heavy dep, also avoids SSR issues)
async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  // Use bundled worker via Vite ?url import
  const workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  let text = "";
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const strs = content.items
      .map((it) => ("str" in it ? (it as { str: string }).str : ""))
      .filter(Boolean);
    text += strs.join(" ") + "\n\n";
  }
  return text.trim();
}

export function PdfDropzone({ onText }: { onText: (text: string) => void }) {
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handle = async (file: File) => {
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Please upload a PDF file");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("PDF too large (max 8MB)");
      return;
    }
    setLoading(true);
    setFileName(file.name);
    try {
      const text = await extractPdfText(file);
      if (text.length < 50) throw new Error("Could not extract enough text — try a text-based PDF");
      onText(text);
      toast.success(`Extracted ${text.length} characters from ${file.name}`);
    } catch (e) {
      toast.error((e as Error).message || "Failed to parse PDF");
      setFileName(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const f = e.dataTransfer.files?.[0];
        if (f) handle(f);
      }}
      onClick={() => inputRef.current?.click()}
      className="flex cursor-pointer items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-input/20 px-4 py-3 text-sm transition hover:bg-input/40"
    >
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handle(f);
        }}
      />
      {loading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Parsing PDF…</span>
        </>
      ) : fileName ? (
        <>
          <FileText className="h-4 w-4 text-primary" />
          <span className="truncate">Loaded: {fileName} (click to replace)</span>
        </>
      ) : (
        <>
          <Upload className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Drop a PDF resume here, or click to upload</span>
        </>
      )}
    </div>
  );
}
