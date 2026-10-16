import { CircleCheck, CircleX, Database, LoaderCircle, Pencil, RefreshCw, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import type { AiReview, MacroSnapshot } from "@hr-console/contracts";

async function getReviews() { const response = await fetch("/api/v1/ai/reviews"); if (!response.ok) throw new Error(); return (await response.json() as { items: AiReview[] }).items; }
async function getSnapshots() { const response = await fetch("/api/v1/market-data/snapshots"); if (!response.ok) throw new Error(); return (await response.json() as { items: MacroSnapshot[] }).items; }

export function AiReviewPage() {
  const [reviews, setReviews] = useState<AiReview[]>([]); const [snapshots, setSnapshots] = useState<MacroSnapshot[]>([]);
  const [loading, setLoading] = useState(true); const [message, setMessage] = useState("");
  const [editing, setEditing] = useState<string | null>(null); const [edited, setEdited] = useState("");
  const refresh = async () => { setLoading(true); try { const [nextReviews, nextSnapshots] = await Promise.all([getReviews(), getSnapshots()]); setReviews(nextReviews); setSnapshots(nextSnapshots); setMessage(""); } catch { setMessage("阶段 10 数据暂不可用，请稍后重试。"); } finally { setLoading(false); } };
  useEffect(() => { void refresh(); }, []);
  async function decide(review: AiReview, status: "accepted" | "rejected" | "edited") {
    const body = { expectedVersion: review.version, status, edited: status === "edited" ? JSON.parse(edited) as Record<string, unknown> : undefined, note: status === "accepted" ? "研究员确认建议" : status === "rejected" ? "研究员驳回建议" : "研究员编辑建议" };
    const response = await fetch(`/api/v1/ai/reviews/${review.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (!response.ok) { setMessage("审核提交失败，记录可能已被更新。"); return; }
    setEditing(null); setMessage(status === "accepted" ? "建议已确认，正式事实未被静默覆盖。" : status === "rejected" ? "建议已驳回。" : "编辑后的建议已提交审核。"); await refresh();
  }
  return <div className="module-page"><div className="page-heading"><span className="eyebrow">STAGE 10 / AI & MACRO DATA</span><h1><Sparkles size={28} strokeWidth={1.7} />AI 结果审核</h1><p>模型只提交可核验建议，正式事实仍由人工确认。</p></div>
    {message && <div className="operation-alert">{message}</div>}<div className="stage10-toolbar"><span>{loading ? "正在读取任务状态..." : `${reviews.filter((item) => item.status === "pending").length} 条待审核`}</span><button type="button" className="icon-button" aria-label="刷新" title="刷新" onClick={() => void refresh()}><RefreshCw size={15} /></button></div>
    <section className="module-section"><div className="section-title"><Sparkles size={18} /><h2>建议队列</h2></div>{loading ? <div className="operation-loading"><LoaderCircle className="spin" size={20} />加载中...</div> : reviews.map((review) => <article className="stage10-review" key={review.id}><div><strong>组织关系建议</strong><span>版本 {review.version} · {review.status}</span>{editing === review.id ? <textarea aria-label="编辑建议" value={edited} onChange={(event) => setEdited(event.target.value)} /> : <pre>{JSON.stringify(review.proposed, null, 2)}</pre>}</div><div className="stage10-actions"><button type="button" onClick={() => void decide(review, "accepted")} disabled={review.status !== "pending"}><CircleCheck size={15} />接受</button><button type="button" onClick={() => void decide(review, "rejected")} disabled={review.status !== "pending"}><CircleX size={15} />驳回</button>{editing === review.id ? <button type="button" onClick={() => void decide(review, "edited")} disabled={review.status !== "pending"}><Pencil size={15} />提交编辑</button> : <button type="button" onClick={() => { setEditing(review.id); setEdited(JSON.stringify(review.proposed, null, 2)); }} disabled={review.status !== "pending"}><Pencil size={15} />编辑</button>}</div></article>)}</section>
    <section className="module-section"><div className="section-title"><Database size={18} /><h2>宏观数据源</h2></div><div className="stage10-sources">{snapshots.map((snapshot) => <div className="stage10-source" key={snapshot.id}><div><strong>{snapshot.metric === "exchange-rate" ? "汇率" : "PPP"} · {snapshot.version}</strong><span>{snapshot.source} · 有效至 {snapshot.validUntil}</span></div><span className={snapshot.stale ? "status-bad" : "status-good"}>{snapshot.stale ? "已过期" : snapshot.status === "published" ? "已发布" : snapshot.status}</span></div>)}</div></section>
  </div>;
}
