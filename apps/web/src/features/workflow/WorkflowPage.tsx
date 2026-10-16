import { AlertCircle, ArrowLeft, ArrowRight, BriefcaseBusiness, Building2, ChevronRight, ContactRound, LoaderCircle, ListFilter, Plus, RefreshCw, Search, Users, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import type { Lead, MappingItem, OutreachCampaign, ResearchTask, Talent } from "@hr-console/contracts";
import { createWorkflow, getTalentCategories, getWorkflow, getWorkflowDetail, updateWorkflow, write, type WorkflowItem, type WorkflowResource } from "./workflow-api";
import { WorkflowEditor } from "./WorkflowEditor";
import { CategoryManager } from "./CategoryManager";
import { MappingTools } from "./MappingTools";
import { useDrawer, useSessionState } from "../operation-state";
import "../operations.css";

const stages: Array<[string, string]> = [["new", "新线索"], ["qualified", "已确认"], ["contacted", "已触达"], ["won", "已转化"], ["lost", "已关闭"]];
type Config = { title: string; icon: typeof Users; filterLabel: string; filters: Array<[string, string]> };
const configs: Record<WorkflowResource, Config> = {
  leads: { title: "线索池", icon: ListFilter, filterLabel: "阶段", filters: [["", "全部阶段"], ...stages] },
  talents: { title: "人才库", icon: Users, filterLabel: "分类", filters: [] },
  "research-tasks": { title: "摸排任务", icon: BriefcaseBusiness, filterLabel: "状态", filters: [["", "全部状态"], ["todo", "待开始"], ["in_progress", "进行中"], ["done", "已完成"]] },
  outreach: { title: "触达", icon: ContactRound, filterLabel: "状态", filters: [["", "全部状态"], ["draft", "草稿"], ["running", "进行中"], ["paused", "已暂停"], ["done", "已完成"]] },
  mapping: { title: "Mapping", icon: Building2, filterLabel: "类型", filters: [["", "全部类型"], ["company", "公司"], ["role", "岗位"], ["level", "职级"]] }
};
const statusText = Object.fromEntries([...stages, ...configs["research-tasks"].filters, ...configs.outreach.filters]);
const date = (value: string) => new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric" }).format(new Date(value));

export function WorkflowPage(props: { resource: WorkflowResource; category?: string }) {
  return <WorkflowWorkspace key={`${props.resource}:${props.category ?? ""}`} {...props} />;
}

function WorkflowWorkspace({ resource, category }: { resource: WorkflowResource; category?: string }) {
  const config = configs[resource]; const Icon = config.icon; const location = useLocation();
  const initialSearch = new URLSearchParams(location.search).get("q") ?? "";
  const [query, setQuery] = useSessionState(`hr-workflow-${resource}-${category ?? ""}`, { q: initialSearch, filter: category ?? "", page: 1, pageSize: 20, location: "", tag: "", channel: "" });
  const [search, setSearch] = useState(query.q);
  const [data, setData] = useState<Awaited<ReturnType<typeof getWorkflow>> | null>(null);
  const [loading, setLoading] = useState(true); const [selected, setSelected] = useState<WorkflowItem | null>(null);
  const [creating, setCreating] = useState(false); const [detailLoading, setDetailLoading] = useState(false); const [detailFallback, setDetailFallback] = useState(false);
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState(""); const [revision, setRevision] = useState(0);
  const [talentCategories, setTalentCategories] = useState(["未分类", "技术", "产品", "商业化"]);
  const [checked, setChecked] = useState<string[]>([]); const [batchStage, setBatchStage] = useState("qualified"); const [confirmBatch, setConfirmBatch] = useState(false);
  const detailRequest = useRef<AbortController | null>(null);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  const close = useCallback(() => { detailRequest.current?.abort(); setSelected(null); setCreating(false); setDetailLoading(false); }, []);
  useDrawer(!!selected || creating, close);
  useEffect(() => () => detailRequest.current?.abort(), []);
  useEffect(() => { const q = new URLSearchParams(location.search).get("q"); if (q !== null) { setSearch(q); setQuery((current) => ({ ...current, q, page: 1 })); } }, [location.search, setQuery]);
  useEffect(() => {
    if (resource !== "talents") return;
    const controller = new AbortController();
    void getTalentCategories(controller.signal).then(setTalentCategories).catch(() => { if (!controller.signal.aborted) setMessage("分类加载失败，可刷新重试。"); });
    return () => controller.abort();
  }, [resource, revision]);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true);
    void getWorkflow(resource, { ...query, channel: query.channel || undefined }, controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      const pages = Math.max(1, Math.ceil(result.total / query.pageSize));
      if (query.page > pages) { setQuery((current) => ({ ...current, page: pages })); return; }
      setData(result);
    }).catch(() => { if (!controller.signal.aborted) setMessage("列表加载失败，请重试。"); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [resource, query, revision, setQuery]);
  useEffect(() => { setChecked([]); setConfirmBatch(false); }, [query]);
  const label = (item: WorkflowItem) => resource === "talents" ? `${(item as Talent).name} · ${(item as Talent).title}` : resource === "leads" ? (item as Lead).subject : resource === "mapping" ? (item as MappingItem).source : (item as ResearchTask | OutreachCampaign).name;
  const summary = (item: WorkflowItem) => resource === "talents" ? (item as Talent).tags.join(" · ") : (item as Lead | ResearchTask | OutreachCampaign | MappingItem).summary;
  const meta = (item: WorkflowItem) => resource === "talents" ? `${(item as Talent).category} · ${(item as Talent).location}` : resource === "mapping" ? `${(item as MappingItem).target} · 置信度 ${(item as MappingItem).confidence}%` : resource === "outreach" ? `${(item as OutreachCampaign).channel} · 目标 ${(item as OutreachCampaign).targetCount ?? (item as OutreachCampaign).touched} · 发送 ${(item as OutreachCampaign).touched} · 回复 ${(item as OutreachCampaign).replies}` : resource === "research-tasks" ? `${(item as ResearchTask).owner} · ${(item as ResearchTask).progress}% · ${(item as ResearchTask).deadline ?? "未设截止日期"}` : `${(item as Lead).owner} · ${(item as Lead).source ?? "手动录入"} · 最近触达 ${(item as Lead).lastTouchedAt ?? "无"} · 评分 ${(item as Lead).score}`;
  async function openDetail(item: WorkflowItem) {
    detailRequest.current?.abort(); const controller = new AbortController(); detailRequest.current = controller;
    setSelected(item); setDetailLoading(true); setDetailFallback(false); setMessage("");
    try { const result = await getWorkflowDetail(resource, item.id, controller.signal); if (!controller.signal.aborted) { setSelected(result.item); setDetailFallback(result.fallback); } }
    catch { if (!controller.signal.aborted) { close(); setMessage("详情加载失败，请重试。"); } }
    finally { if (!controller.signal.aborted) setDetailLoading(false); }
  }
  async function save(input: Record<string, unknown>) {
    setBusy(true); setMessage("");
    try {
      if (selected) { const result = await updateWorkflow(resource, selected.id, input); setSelected((current) => current?.id === result.id ? result : current); }
      else { await createWorkflow(resource, input); close(); }
      refresh(); setMessage(selected ? "已保存更改" : "记录已创建");
    } catch { setMessage("保存失败，原记录未更改。请重试。"); throw new Error("保存失败，原记录未更改。"); }
    finally { setBusy(false); }
  }
  async function batch() {
    setBusy(true); setConfirmBatch(false);
    try {
      const result = await write("/api/v1/leads/batch", "POST", { ids: checked, patch: { stage: batchStage } }) as { succeeded: number; failed: number; results: Array<{ id: string; success: boolean }> };
      setMessage(`批量操作完成：成功 ${result.succeeded} 条，失败 ${result.failed} 条。`); setChecked(result.results.filter((entry) => !entry.success).map((entry) => entry.id)); refresh();
    } catch { setMessage("批量操作失败，请刷新确认记录状态后重试。"); } finally { setBusy(false); }
  }
  const readOnly = loading || !data || data.fallback;
  return <div className="operations-page">
    <div className="page-heading"><span className="eyebrow">{resource.toUpperCase()} / OPERATIONS</span><h1><Icon size={28} strokeWidth={1.7} />{category ? `${config.title} · ${category}` : config.title}</h1></div>
    {data?.fallback && <div className="operation-alert"><AlertCircle size={16} />API 暂不可用，当前显示演示数据；编辑功能不可用。</div>}
    {message && <div role="status" className="operation-alert">{message}</div>}
    <section className="operation-toolbar"><div className="operation-search"><Search size={15} /><input aria-label="搜索记录" value={search} placeholder="搜索名称、公司或摘要" onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") setQuery((current) => ({ ...current, q: search.trim(), page: 1 })); }} /><button type="button" onClick={() => setQuery((current) => ({ ...current, q: search.trim(), page: 1 }))}>搜索</button></div><div className="operation-filters"><label>{config.filterLabel}<select value={query.filter} onChange={(event) => setQuery((current) => ({ ...current, filter: event.target.value, page: 1 }))}>{(resource === "talents" ? [["", "全部分类"], ...talentCategories.map((name) => [name, name])] : config.filters).map(([value, text]) => <option value={value} key={value}>{text}</option>)}</select></label>
      {resource === "talents" && <><label>地区<input value={query.location} onChange={(event) => setQuery((current) => ({ ...current, location: event.target.value, page: 1 }))} /></label><label>标签<input value={query.tag} onChange={(event) => setQuery((current) => ({ ...current, tag: event.target.value, page: 1 }))} /></label></>}
      {resource === "outreach" && <label>渠道<select value={query.channel} onChange={(event) => setQuery((current) => ({ ...current, channel: event.target.value, page: 1 }))}><option value="">全部渠道</option><option value="email">邮件</option><option value="linkedin">LinkedIn</option><option value="phone">电话</option></select></label>}
    </div></section>
    {resource === "talents" && <CategoryManager disabled={readOnly} revision={revision} changed={refresh} />}
    {resource === "mapping" && <MappingTools disabled={readOnly} changed={refresh} />}
    {resource === "leads" && <div className="batch-toolbar"><label><input type="checkbox" aria-label="选择本页全部线索" checked={!!data?.items.length && checked.length === data.items.length} disabled={readOnly} onChange={(event) => setChecked(event.target.checked ? data!.items.map((item) => item.id) : [])} />已选 {checked.length} 条</label><select aria-label="批量阶段" value={batchStage} onChange={(event) => setBatchStage(event.target.value)}>{stages.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select><button type="button" className="quiet-action" disabled={!checked.length || readOnly || busy} onClick={() => setConfirmBatch(true)}>批量修改阶段</button>{confirmBatch && <div role="alertdialog" aria-label="确认批量操作"><span>确认将 {checked.length} 条线索改为「{statusText[batchStage]}」？</span><button type="button" onClick={() => void batch()}>确认</button><button type="button" onClick={() => setConfirmBatch(false)}>取消</button></div>}</div>}
    <section className="operation-panel"><div className="operation-panel-head"><div><h2>{config.title}列表</h2><span>{loading ? "同步中..." : `${data?.total ?? 0} 条记录`}</span></div><div><button className="icon-button" title="刷新列表" aria-label="刷新列表" onClick={refresh}><RefreshCw size={15} /></button>{["leads", "research-tasks", "outreach"].includes(resource) && <button className="quiet-action" disabled={readOnly || busy} onClick={() => { setCreating(true); setMessage(""); }}><Plus size={15} />新建</button>}</div></div>
      {loading ? <div className="operation-loading"><LoaderCircle size={20} className="spin" />加载中...</div> : data?.items.length ? <div className="workflow-list">{data.items.map((item) => <div className="workflow-row" key={item.id}>
        {resource === "leads" && <input type="checkbox" aria-label={`选择${label(item)}`} checked={checked.includes(item.id)} disabled={readOnly || busy} onChange={(event) => setChecked((current) => event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))} />}
        <button type="button" className="workflow-main" onClick={() => void openDetail(item)}><span className="workflow-mark"><Icon size={16} /></span><span className="operation-copy"><strong>{label(item)}</strong><small>{meta(item)}</small><span>{summary(item)}</span><em>{date(item.updatedAt)}</em></span><ChevronRight size={16} /></button>
        {["leads", "research-tasks", "outreach"].includes(resource) && <button type="button" className="workflow-status" disabled={busy || readOnly} onClick={() => void openDetail(item)}>{statusText[resource === "leads" ? (item as Lead).stage : (item as ResearchTask | OutreachCampaign).status]}</button>}
      </div>)}</div> : <div className="operation-empty"><Icon size={24} /><strong>暂无匹配记录</strong></div>}
      <div className="operation-pagination"><span>第 {query.page} 页 / 共 {Math.max(1, Math.ceil((data?.total ?? 0) / query.pageSize))} 页</span><div><button type="button" aria-label="上一页" disabled={loading || query.page <= 1} onClick={() => setQuery((current) => ({ ...current, page: current.page - 1 }))}><ArrowLeft size={14} /></button><button type="button" aria-label="下一页" disabled={loading || query.page >= Math.ceil((data?.total ?? 0) / query.pageSize)} onClick={() => setQuery((current) => ({ ...current, page: current.page + 1 }))}><ArrowRight size={14} /></button></div></div>
    </section>
    {(selected || creating) && <div className="operation-drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}><aside className="operation-drawer" aria-label={creating ? "新建记录" : "记录详情"}><button type="button" className="drawer-close" aria-label="关闭详情" onClick={close}><X size={17} /></button>{detailLoading ? <div className="operation-loading"><LoaderCircle size={20} className="spin" />加载详情...</div> : <><span className="importance importance-medium">{creating ? "新建" : "详情"}</span><h2>{selected ? label(selected) : `新建${config.title}`}</h2>{detailFallback && <p role="status" className="operation-alert">当前为只读演示详情。</p>}{selected && <><p className="drawer-meta">更新于 {date(selected.updatedAt)}</p><div className="drawer-section"><h3>摘要</h3><p>{summary(selected)}</p><p>{meta(selected)}</p>{resource === "talents" && <p>职级：{(selected as Talent).level || "未录入"} · 公司：{(selected as Talent).company}</p>}{resource === "outreach" && <p>回复率：{(selected as OutreachCampaign).touched ? (((selected as OutreachCampaign).replies / (selected as OutreachCampaign).touched) * 100).toFixed(1) : "0"}%</p>}</div></>}
      <WorkflowEditor key={selected?.id ?? "create"} resource={resource} item={selected} categories={talentCategories} disabled={readOnly || detailFallback} busy={busy} save={save} />
    </>}</aside></div>}
  </div>;
}
