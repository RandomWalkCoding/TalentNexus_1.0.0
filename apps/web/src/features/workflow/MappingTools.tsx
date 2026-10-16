import { useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { mappingImportSchema } from "@hr-console/contracts";
import { write } from "./workflow-api";

export function MappingTools({ disabled, changed }: { disabled: boolean; changed: () => void }) {
  const file = useRef<HTMLInputElement>(null); const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  async function exportFile() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/v1/mapping/export"); if (!response.ok) throw new Error("导出失败");
      const body = await response.json() as { items: unknown[] };
      const url = URL.createObjectURL(new Blob([JSON.stringify({ items: body.items }, null, 2)], { type: "application/json" }));
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = "mapping.json"; anchor.click(); URL.revokeObjectURL(url); setMessage(`已导出 ${body.items.length} 条映射`);
    } catch { setMessage("导出失败，请重试。"); } finally { setBusy(false); }
  }
  async function importFile(selected: File) {
    setBusy(true); setMessage("");
    let imported = 0;
    try {
      if (selected.size > 1024 * 1024) throw new Error("文件超过 1 MB");
      const data = JSON.parse(await selected.text()) as { items?: unknown };
      const items = data?.items;
      if (!Array.isArray(items) || items.length === 0) throw new Error("导入格式无效");
      const batches = Array.from({ length: Math.ceil(items.length / 100) }, (_, index) => mappingImportSchema.parse({ items: items.slice(index * 100, (index + 1) * 100) }));
      for (const batch of batches) {
        const result = await write("/api/v1/mapping/import", "POST", batch) as { imported: number };
        imported += result.imported;
      }
      setMessage(`已导入 ${imported} 条映射`); changed();
    } catch (error) {
      if (imported) changed();
      setMessage(imported ? `已导入 ${imported} 条，后续批次失败，请检查后重试。` : error instanceof Error && error.message === "文件超过 1 MB" ? error.message : "导入失败，请检查 JSON 字段。");
    }
    finally { setBusy(false); if (file.current) file.current.value = ""; }
  }
  return <div className="mapping-tools"><input ref={file} type="file" accept="application/json,.json" hidden aria-label="导入映射文件" onChange={(event) => { const selected = event.target.files?.[0]; if (selected) void importFile(selected); }} /><button type="button" className="quiet-action" disabled={disabled || busy} onClick={() => file.current?.click()}><Upload size={14} />导入</button><button type="button" className="quiet-action" disabled={disabled || busy} onClick={() => void exportFile()}><Download size={14} />导出</button>{message && <span role="status">{message}</span>}</div>;
}
