import { AlertCircle, ArrowLeft, ArrowRight, Building2, ChevronRight, LoaderCircle, RefreshCw, Search, ShieldCheck, ShieldOff, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import type { Competitor, CompetitorDetailResponse, CompetitorListQuery } from "@hr-console/contracts";
import { getCompetitorDetail, getCompetitors, updateMonitoring } from "./competitor-monitoring-api";
import { useDrawer, useSessionState } from "../operation-state";
import "../operations.css";

export function CompetitorMonitoring() {
  const location = useLocation(); const company = new URLSearchParams(location.search).get("company") ?? "";
  const [query, setQuery] = useSessionState<CompetitorListQuery>("hr-competitors", { page: 1, pageSize: 20, sort: "lastUpdatedAt:desc", q: company || undefined });
  const [search, setSearch] = useState(query.q ?? "");
  const [data, setData] = useState<Awaited<ReturnType<typeof getCompetitors>>["data"] | null>(null);
  const [loading, setLoading] = useState(true); const [fallback, setFallback] = useState(false);
  const [selected, setSelected] = useState<CompetitorDetailResponse | null>(null); const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null); const [message, setMessage] = useState(""); const [revision, setRevision] = useState(0);
  const detailRequest = useRef<AbortController | null>(null); const close = useCallback(() => { detailRequest.current?.abort(); setSelected(null); }, []);
  useDrawer(!!selected, close); useEffect(() => () => detailRequest.current?.abort(), []);
  useEffect(() => { const next = new URLSearchParams(location.search).get("company"); if (next !== null) { setSearch(next); setQuery((current) => ({ ...current, q: next, page: 1 })); } }, [location.search, setQuery]);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true);
    void getCompetitors(query, controller.signal).then((result) => { if (!controller.signal.aborted) { const pages = Math.max(1, Math.ceil(result.data.total / query.pageSize)); if (query.page > pages) { setQuery({ ...query, page: pages }); return; } setData(result.data); setFallback(result.fallback); setMessage(""); } }).catch(() => { if (!controller.signal.aborted) setMessage("竞对加载失败，请重试。"); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [query, revision, setQuery]);
  async function open(item: Competitor) {
    detailRequest.current?.abort(); const controller = new AbortController(); detailRequest.current = controller;
    setSelected({ competitor: item, signals: [] }); setDetailLoading(true); setMessage("");
    try { const result = await getCompetitorDetail(item.id, controller.signal); if (!controller.signal.aborted) setSelected(result.data); }
    catch { if (!controller.signal.aborted) { close(); setMessage("竞对详情加载失败，请重试。"); } }
    finally { if (!controller.signal.aborted) setDetailLoading(false); }
  }
  async function toggle(item: Competitor) {
    const next = !item.monitored; setBusy(item.id); setMessage("");
    setData((current) => current ? { ...current, items: current.items.map((entry) => entry.id === item.id ? { ...entry, monitored: next } : entry) } : current);
    try { await updateMonitoring(item.id, next); setMessage(next ? "已启用监测" : "已停用监测"); setRevision((value) => value + 1); }
    catch { setData((current) => current ? { ...current, items: current.items.map((entry) => entry.id === item.id ? { ...entry, monitored: item.monitored } : entry) } : current); setMessage("监测状态更新失败，已恢复原状态。"); }
    finally { setBusy(null); }
  }
  return <div className="operations-page"><div className="page-heading"><span className="eyebrow">COMPETITOR / MONITORING</span><h1><Building2 size={28} strokeWidth={1.7} />竞对监测</h1></div>
    {fallback && <div className="operation-alert"><AlertCircle size={16} />API 暂不可用，当前显示演示竞对数据；编辑功能不可用。</div>}{message && <div role="status" className="operation-alert">{message}</div>}
    <section className="operation-toolbar"><div className="operation-search"><Search size={15} /><input aria-label="搜索竞对" value={search} placeholder="搜索公司、行业或地区" onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") setQuery({ ...query, q: search.trim() || undefined, page: 1 }); }} /><button type="button" onClick={() => setQuery({ ...query, q: search.trim() || undefined, page: 1 })}>搜索</button></div><div className="operation-filters"><label>行业<input aria-label="行业筛选" value={query.industry ?? ""} onChange={(event) => setQuery({ ...query, industry: event.target.value || undefined, page: 1 })} /></label><label>监测状态<select value={query.monitored === undefined ? "" : String(query.monitored)} onChange={(event) => setQuery({ ...query, monitored: event.target.value === "" ? undefined : event.target.value === "true", page: 1 })}><option value="">全部</option><option value="true">监测中</option><option value="false">未监测</option></select></label><label>排序<select value={query.sort} onChange={(event) => setQuery({ ...query, sort: event.target.value as CompetitorListQuery["sort"], page: 1 })}><option value="lastUpdatedAt:desc">最新变化</option><option value="name:asc">名称</option><option value="employeeCount:desc">团队规模</option></select></label></div></section>
    <section className="operation-panel"><div className="operation-panel-head"><div><h2>重点公司</h2><span>{loading ? "同步中..." : `${data?.total ?? 0} 家公司`}</span></div><button type="button" className="icon-button" title="刷新竞对" aria-label="刷新竞对" onClick={() => setRevision((value) => value + 1)}><RefreshCw size={15} /></button></div>
      {loading ? <div className="operation-loading"><LoaderCircle size={20} className="spin" />加载竞对中...</div> : data?.items.length ? <div className="competitor-list">{data.items.map((item) => <div className="competitor-row" key={item.id}><button type="button" className="competitor-main" onClick={() => void open(item)}><span className="company-glyph"><Building2 size={16} /></span><span className="operation-copy"><strong>{item.name}</strong><small>{item.industry} · {item.region} · {item.employeeCount?.toLocaleString() ?? "--"} 人</small><span>{item.hiringSignal ?? item.fundingSignal ?? "暂无最新信号"}</span></span><ChevronRight size={17} /></button><button type="button" className={`monitor-toggle ${item.monitored ? "on" : ""}`} disabled={busy === item.id || fallback} onClick={() => void toggle(item)} title={item.monitored ? "停用监测" : "启用监测"}>{item.monitored ? <ShieldCheck size={15} /> : <ShieldOff size={15} />}<span>{item.monitored ? "监测中" : "未监测"}</span></button></div>)}</div> : <div className="operation-empty"><Building2 size={24} /><strong>暂无匹配竞对</strong></div>}
      <div className="operation-pagination"><span>第 {query.page} 页 / 共 {Math.max(1, Math.ceil((data?.total ?? 0) / query.pageSize))} 页</span><div><button type="button" aria-label="上一页" disabled={loading || query.page <= 1} onClick={() => setQuery({ ...query, page: query.page - 1 })}><ArrowLeft size={14} /></button><button type="button" aria-label="下一页" disabled={loading || query.page >= Math.ceil((data?.total ?? 0) / query.pageSize)} onClick={() => setQuery({ ...query, page: query.page + 1 })}><ArrowRight size={14} /></button></div></div>
    </section>
    {selected && <div className="operation-drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}><aside className="operation-drawer" aria-label="竞对详情"><button className="drawer-close" aria-label="关闭详情" onClick={close}><X size={17} /></button>{detailLoading ? <div className="operation-loading"><LoaderCircle size={20} className="spin" />加载详情...</div> : <><span className="importance importance-medium">竞对详情</span><h2>{selected.competitor.name}</h2><p className="drawer-meta">{selected.competitor.industry} · {selected.competitor.region} · {selected.competitor.employeeCount?.toLocaleString() ?? "--"} 人</p><div className="drawer-section"><h3>最新变化</h3><p>{selected.competitor.fundingSignal ?? "暂无融资信号"}</p><p>{selected.competitor.hiringSignal ?? "暂无招聘信号"}</p></div><div className="drawer-section"><h3>监测信号</h3>{selected.signals.length ? selected.signals.map((signal) => <div className="signal-item" key={signal.id}><strong>{signal.title}</strong><p>{signal.summary}</p><small>{signal.source.name} · {new Date(signal.occurredAt).toLocaleDateString("zh-CN")}</small></div>) : <p>暂无信号。</p>}</div></>}</aside></div>}
  </div>;
}
