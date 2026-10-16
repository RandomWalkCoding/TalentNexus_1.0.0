import { AlertCircle, ArrowLeft, ArrowRight, CalendarDays, CircleCheck, LoaderCircle, RefreshCw, Search, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Briefing, BriefingListQuery } from "@hr-console/contracts";
import { getBriefingDetail, getBriefings, readAllBriefings, setBriefingRead } from "./briefing-api";
import { useDrawer, useSessionState } from "../operation-state";
import "../operations.css";

export function AiBriefing() {
  const [query, setQuery] = useSessionState<BriefingListQuery>("hr-briefings", { page: 1, pageSize: 20 });
  const [search, setSearch] = useState(query.q ?? ""); const [items, setItems] = useState<Briefing[]>([]);
  const [total, setTotal] = useState(0); const [loading, setLoading] = useState(true); const [fallback, setFallback] = useState(false);
  const [selected, setSelected] = useState<Briefing | null>(null); const [detailLoading, setDetailLoading] = useState(false);
  const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false); const [revision, setRevision] = useState(0);
  const detailRequest = useRef<AbortController | null>(null); const close = useCallback(() => { detailRequest.current?.abort(); setSelected(null); }, []);
  useDrawer(!!selected, close); useEffect(() => () => detailRequest.current?.abort(), []);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true);
    void getBriefings(query, controller.signal).then((result) => { if (!controller.signal.aborted) { const pages = Math.max(1, Math.ceil(result.total / query.pageSize)); if (query.page > pages) { setQuery({ ...query, page: pages }); return; } setItems(result.items); setTotal(result.total); setFallback(result.fallback); } }).catch(() => {
      if (!controller.signal.aborted) setMessage("快讯加载失败，请重试。");
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [query, revision, setQuery]);
  const unread = items.filter((item) => !item.read).length;
  async function open(item: Briefing) {
    detailRequest.current?.abort(); const controller = new AbortController(); detailRequest.current = controller;
    setSelected(item); setDetailLoading(true); setMessage("");
    try {
      const detail = fallback ? item : await getBriefingDetail(item.id, controller.signal);
      if (controller.signal.aborted) return;
      setSelected(detail);
      if (!detail.read && !fallback) {
        const updated = await setBriefingRead(item.id);
        if (controller.signal.aborted) return;
        setItems((current) => current.map((entry) => entry.id === item.id ? updated : entry)); setSelected(updated);
        if (query.read === false) setRevision((value) => value + 1);
      }
    } catch { if (!controller.signal.aborted) setMessage("详情或已读状态更新失败，请重试。"); }
    finally { if (!controller.signal.aborted) setDetailLoading(false); }
  }
  async function readAll() {
    setBusy(true);
    try { await readAllBriefings(); setItems((current) => current.map((entry) => ({ ...entry, read: true }))); setRevision((value) => value + 1); setMessage("已全部标记已读"); }
    catch { setMessage("批量标记失败，状态未更改。"); }
    finally { setBusy(false); }
  }
  return <div className="operations-page"><div className="page-heading"><span className="eyebrow">AI BRIEFING / DAILY DIGEST</span><h1><Sparkles size={28} strokeWidth={1.7} />AI 快讯</h1></div>
    {fallback && <div className="operation-alert"><AlertCircle size={16} />快讯 API 暂不可用，当前为只读演示数据。</div>}{message && <div role="status" className="operation-alert">{message}</div>}
    <section className="briefing-hero"><div><span className="briefing-kicker"><Sparkles size={14} />TODAY'S SIGNALS</span><h2>今日值得关注的市场变化</h2><p>{loading ? "正在生成摘要..." : `共整理 ${total} 条信号，本页 ${unread} 条尚未阅读。`}</p></div><div className="briefing-date"><CalendarDays size={16} /><span>{new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long", day: "numeric" }).format(new Date())}</span></div></section>
    <section className="operation-toolbar"><div className="operation-search"><Search size={15} /><input aria-label="搜索快讯" placeholder="搜索标题或摘要" value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") setQuery({ ...query, q: search.trim() || undefined, page: 1 }); }} /><button type="button" onClick={() => setQuery({ ...query, q: search.trim() || undefined, page: 1 })}>搜索</button></div><div className="operation-filters"><label>阅读状态<select value={query.read === undefined ? "" : String(query.read)} onChange={(event) => setQuery({ ...query, read: event.target.value === "" ? undefined : event.target.value === "true", page: 1 })}><option value="">全部</option><option value="false">未读</option><option value="true">已读</option></select></label><label>主题<input aria-label="主题筛选" value={query.topic ?? ""} onChange={(event) => setQuery({ ...query, topic: event.target.value || undefined, page: 1 })} /></label></div></section>
    <section className="operation-panel"><div className="operation-panel-head"><div><h2>重点摘要</h2><span>{unread} 条未读</span></div><div><button type="button" className="icon-button" aria-label="刷新快讯" title="刷新快讯" onClick={() => setRevision((value) => value + 1)}><RefreshCw size={15} /></button><button type="button" className="quiet-action" disabled={busy || fallback || total === 0} onClick={() => void readAll()}><CircleCheck size={14} />全部标记已读</button></div></div>
      {loading ? <div className="operation-loading"><LoaderCircle size={20} className="spin" />生成每日摘要...</div> : items.length ? <div className="briefing-list">{items.map((entry, index) => <button type="button" className={`briefing-card${entry.read ? " is-read" : ""}`} key={entry.id} onClick={() => void open(entry)}><span className="briefing-index">{String((query.page - 1) * 20 + index + 1).padStart(2, "0")}</span><span className="operation-copy"><strong>{entry.intelligence.title}</strong><small>{entry.intelligence.companyName ?? "行业观察"} · {entry.intelligence.source.name} · 可信度 {entry.confidence ?? "--"}%</small><span>{entry.intelligence.summary}</span><em>{entry.intelligence.tags.join(" · ")}</em></span><ArrowRight size={16} /></button>)}</div> : <div className="operation-empty"><Sparkles size={24} /><strong>今日暂无快讯</strong></div>}
      <div className="operation-pagination"><span>第 {query.page} 页 / 共 {Math.max(1, Math.ceil(total / 20))} 页</span><div><button type="button" aria-label="上一页" disabled={query.page <= 1 || loading} onClick={() => setQuery({ ...query, page: query.page - 1 })}><ArrowLeft size={14} /></button><button type="button" aria-label="下一页" disabled={query.page >= Math.ceil(total / 20) || loading} onClick={() => setQuery({ ...query, page: query.page + 1 })}><ArrowRight size={14} /></button></div></div>
    </section>
    {selected && <div className="operation-drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}><aside className="operation-drawer" aria-label="快讯详情"><button type="button" className="drawer-close" aria-label="关闭详情" onClick={close}><X size={17} /></button>{detailLoading ? <div className="operation-loading"><LoaderCircle size={20} className="spin" />加载详情...</div> : <><span className="importance importance-high">AI 精选 · 可信度 {selected.confidence ?? "--"}%</span><h2>{selected.intelligence.title}</h2><p className="drawer-meta">{selected.intelligence.companyName ?? "行业观察"} · {selected.intelligence.source.name}</p><div className="drawer-section"><h3>摘要</h3><p>{selected.intelligence.summary}</p></div><div className="drawer-section"><h3>分析内容</h3><p>{selected.intelligence.content}</p></div></>}</aside></div>}
  </div>;
}
