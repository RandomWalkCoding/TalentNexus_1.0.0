import { useEffect, useState } from "react";
import { Plus, Save } from "lucide-react";
import { getCategoryDetails, write } from "./workflow-api";

export function CategoryManager({ disabled, revision, changed }: { disabled: boolean; revision: number; changed: () => void }) {
  const [categories, setCategories] = useState<Awaited<ReturnType<typeof getCategoryDetails>>>([]);
  const [name, setName] = useState(""); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => { const controller = new AbortController(); void getCategoryDetails(controller.signal).then(setCategories).catch(() => { if (!controller.signal.aborted) setMessage("分类加载失败"); }); return () => controller.abort(); }, [revision]);
  async function action(url: string, method: "POST" | "PATCH", data: unknown) {
    setBusy(true); setMessage("");
    try { await write(url, method, data); setCategories(await getCategoryDetails()); setName(""); changed(); setMessage("分类已保存"); }
    catch (error) { setMessage(error instanceof Error ? error.message : "保存失败"); }
    finally { setBusy(false); }
  }
  return <details className="category-manager"><summary>分类管理</summary><div className="category-list">{categories.map((category) => <form key={category.name} onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); void action(`/api/v1/talent-categories/${encodeURIComponent(category.name)}`, "PATCH", { name: data.get("name") ?? category.name, owner: data.get("owner") }); }}><strong>{category.count ?? 0} 人</strong><input aria-label={`${category.name}分类名称`} name="name" required maxLength={100} defaultValue={category.name} disabled={disabled || busy || category.name === "未分类"} /><input aria-label={`${category.name}负责人`} name="owner" required maxLength={120} defaultValue={category.owner ?? "未分配"} disabled={disabled || busy} /><button type="submit" className="icon-button" title="保存分类" aria-label={`保存${category.name}分类`} disabled={disabled || busy}><Save size={15} /></button></form>)}</div><form onSubmit={(event) => { event.preventDefault(); void action("/api/v1/talent-categories", "POST", { name: name.trim() }); }}><input aria-label="新分类名称" placeholder="新分类名称" required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} disabled={disabled || busy} /><button type="submit" className="quiet-action" disabled={disabled || busy || !name.trim()}><Plus size={14} />新增分类</button></form>{message && <p role="status">{message}</p>}</details>;
}
