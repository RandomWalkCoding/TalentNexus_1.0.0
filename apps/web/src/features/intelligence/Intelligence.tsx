import { AlertCircle, ArrowLeft, ArrowRight, ChevronRight, Compass, LoaderCircle, RefreshCw, Search, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { IntelligenceItem, IntelligenceListQuery } from "@hr-console/contracts";
import { getIntelligence, getIntelligenceDetail } from "./intelligence-api";
import { useDrawer, useSessionState } from "../operation-state";
import "../operations.css";

const initialQuery: IntelligenceListQuery = { page: 1, pageSize: 20, sort: "publishedAt:desc" };
const date = (value: string) => new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric" }).format(new Date(value));

export function Intelligence() {
  const [query, setQuery] = useSessionState("hr-intelligence", initialQuery); const [search, setSearch] = useState(query.q ?? "");
  const [data, setData] = useState<Awaited<ReturnType<typeof getIntelligence>>["data"] | null>(null);
  const [loading, setLoading] = useState(true); const [fallback, setFallback] = useState(false); const [selected, setSelected] = useState<IntelligenceItem | null>(null);
  const [detailLoading, setDetailLoading] = useState(false); const [message, setMessage] = useState(""); const [revision, setRevision] = useState(0);
  const detailRequest = useRef<AbortController | null>(null);
  const close = useCallback(() => { detailRequest.current?.abort(); setSelected(null); }, []); useDrawer(!!selected, close);
  useEffect(() => () => detailRequest.current?.abort(), []);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true);
    if (query.from && query.to && query.from > query.to) { setMessage("开始日期不能晚于结束日期。"); setLoading(false); return; }
    void getIntelligence(query, controller.signal).then((result) => { if (!controller.signal.aborted) { const pages = Math.max(1, Math.ceil(result.data.total / query.pageSize)); if (query.page > pages) { setQuery({ ...query, page: pages }); return; } setData(result.data); setFallback(result.fallback); setMessage(""); } }).catch(() => { if (!controller.signal.aborted) setMessage("情报加载失败，请重试。"); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [query, revision, setQuery]);
  async function openDetail(item: IntelligenceItem) {
    detailRequest.current?.abort(); const controller = new AbortController(); detailRequest.current = controller;
    setSelected(item); setDetailLoading(true); setMessage("");
    try { const result = await getIntelligenceDetail(item.id, controller.signal); if (!controller.signal.aborted) setSelected(result.data); }
    catch { if (!controller.signal.aborted) { close(); setMessage("详情加载失败，请重试。"); } }
    finally { if (!controller.signal.aborted) setDetailLoading(false); }
  }
  return <div className="operations-page"><div className="page-heading"><span className="eyebrow">INTELLIGENCE / SIGNALS</span><h1><Compass size={28} strokeWidth={1.7} />情报中心</h1></div>
    {fallback && <div className="operation-alert"><AlertCircle size={16} />API 暂不可用，当前显示演示情报数据。</div>}{message && <div role="status" className="operation-alert">{message}</div>}
    <section className="operation-toolbar"><div className="operation-search"><Search size={15} /><input aria-label="搜索情报" value={search} placeholder="搜索标题、公司或摘要" onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") setQuery({ ...query, q: search.trim() || undefined, page: 1 }); }} /><button type="button" aria-label="执行搜索" onClick={() => setQuery({ ...query, q: search.trim() || undefined, page: 1 })}>搜索</button></div><div className="operation-filters">
      <label>类型<select value={query.kind ?? ""} onChange={(event) => setQuery({ ...query, kind: (event.target.value || undefined) as IntelligenceListQuery["kind"], page: 1 })}><option value="">全部类型</option><option value="industry">行业</option><option value="company">公司</option></select></label>
      <label>重要性<select value={query.importance ?? ""} onChange={(event) => setQuery({ ...query, importance: (event.target.value || undefined) as IntelligenceListQuery["importance"], page: 1 })}><option value="">全部重要性</option><option value="high">高</option><option value="medium">中</option><option value="low">低</option></select></label>
      <label>来源<input value={query.source ?? ""} maxLength={160} onChange={(event) => setQuery({ ...query, source: event.target.value || undefined, page: 1 })} /></label>
      <label>开始日期<input type="date" value={query.from ?? ""} onChange={(event) => setQuery({ ...query, from: event.target.value || undefined, page: 1 })} /></label><label>结束日期<input type="date" value={query.to ?? ""} onChange={(event) => setQuery({ ...query, to: event.target.value || undefined, page: 1 })} /></label>
      <label>排序<select value={query.sort} onChange={(event) => setQuery({ ...query, sort: event.target.value as IntelligenceListQuery["sort"], page: 1 })}><option value="publishedAt:desc">最新优先</option><option value="publishedAt:asc">最早优先</option><option value="importance:desc">重要性优先</option></select></label>
    </div></section>
    <section className="operation-panel"><div className="operation-panel-head"><div><h2>最新情报</h2><span>{loading ? "同步中..." : `${data?.total ?? 0} 条结果`}</span></div><button type="button" className="icon-button" title="刷新情报" aria-label="刷新情报" onClick={() => setRevision((value) => value + 1)}><RefreshCw size={16} /></button></div>
      {loading ? <div className="operation-loading"><LoaderCircle size={20} className="spin" />加载情报中...</div> : data?.items.length ? <div className="intelligence-list">{data.items.map((item) => <button type="button" className="intelligence-row" key={item.id} onClick={() => void openDetail(item)}><span className={`importance importance-${item.importance}`}>{item.importance === "high" ? "高" : item.importance === "medium" ? "中" : "低"}</span><span className="operation-copy"><strong>{item.title}</strong><small>{item.companyName ?? "行业观察"} · {item.source.name} · {date(item.publishedAt)}</small><span>{item.summary}</span><em>{item.tags.join(" · ")}</em></span><ChevronRight size={17} /></button>)}</div> : <div className="operation-empty"><Compass size={24} /><strong>暂无匹配情报</strong></div>}
      <div className="operation-pagination"><span>第 {query.page} 页 / 共 {Math.max(1, Math.ceil((data?.total ?? 0) / query.pageSize))} 页</span><div><button type="button" aria-label="上一页" disabled={loading || query.page <= 1} onClick={() => setQuery({ ...query, page: query.page - 1 })}><ArrowLeft size={14} /></button><button type="button" aria-label="下一页" disabled={loading || query.page >= Math.ceil((data?.total ?? 0) / query.pageSize)} onClick={() => setQuery({ ...query, page: query.page + 1 })}><ArrowRight size={14} /></button></div></div>
    </section>
    {selected && <div className="operation-drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}><aside className="operation-drawer" aria-label="情报详情"><button className="drawer-close" aria-label="关闭详情" onClick={close}><X size={17} /></button>{detailLoading ? <div className="operation-loading"><LoaderCircle size={20} className="spin" />加载详情...</div> : <><span className={`importance importance-${selected.importance}`}>{selected.importance === "high" ? "高优先级" : selected.importance === "medium" ? "中优先级" : "低优先级"}</span><h2>{selected.title}</h2><p className="drawer-meta">{selected.companyName ?? "行业观察"} · {selected.source.name} · {date(selected.publishedAt)}</p><div className="drawer-section"><h3>摘要</h3><p>{selected.summary}</p></div><div className="drawer-section"><h3>详细内容</h3><p>{selected.content}</p></div><div className="drawer-tags">{selected.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>{selected.source.url && <a href={selected.source.url} target="_blank" rel="noreferrer">查看来源</a>}</>}</aside></div>}
  </div>;
}
