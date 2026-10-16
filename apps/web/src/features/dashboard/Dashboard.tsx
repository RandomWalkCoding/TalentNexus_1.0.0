import { useEffect, useMemo, useState } from "react";
import { ArrowDownUp, ArrowRight, BellRing, Building2, CalendarDays, Check, CircleAlert, Clock3, LayoutGrid, List, RotateCcw, Satellite, Sparkles, Users, X } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import type { DashboardResponse } from "@hr-console/contracts";

import { dashboardAction, getDashboard } from "./dashboard-api";

type ViewMode = "cards" | "layout";
type FollowupFilter = "全部" | "待联系" | "跟进中" | "已回复";

function readViewMode(): ViewMode {
  return localStorage.getItem("hr-dashboard-view") === "layout" ? "layout" : "cards";
}

function formattedDate(date: Date): string {
  return new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "long" }).format(date);
}

function greeting(hour: number): string {
  if (hour < 6) return "夜深了";
  if (hour < 11) return "早上好";
  if (hour < 14) return "中午好";
  if (hour < 18) return "下午好";
  return "晚上好";
}

function shortTime(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
}

export function Dashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [isFallback, setIsFallback] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>(readViewMode);
  const [filter, setFilter] = useState<FollowupFilter>("全部");
  const [newestFirst, setNewestFirst] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<{ id: string; company: string; item: DashboardResponse["recommendations"][number] } | null>(null);
  const [notice, setNotice] = useState("");
  const [assistantOpen, setAssistantOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError(false);
    void getDashboard(controller.signal).then(({ data: result, fallback }) => {
      setData(result);
      setIsFallback(fallback);
      setLoadError(fallback);
    }).catch(() => {
      if (!controller.signal.aborted) setLoadError(true);
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [refreshKey]);

  useEffect(() => {
    localStorage.setItem("hr-dashboard-view", viewMode);
  }, [viewMode]);

  const followups = useMemo(() => {
    const values = (data?.followups ?? []).filter((item) => filter === "全部" || item.status === filter);
    return values.slice().sort((left, right) => {
      const comparison = new Date(left.occurredAt).getTime() - new Date(right.occurredAt).getTime();
      return newestFirst ? -comparison : comparison;
    });
  }, [data?.followups, filter, newestFirst]);

  async function handleIgnore(id: string, company: string) {
    setBusyId(id);
    try {
      const item = data?.recommendations.find((recommendation) => recommendation.id === id);
      if (!item) return;
      if (!isFallback) await dashboardAction(`/api/v1/dashboard/recommendations/${id}/ignore`);
      setData((current) => current ? { ...current, recommendations: current.recommendations.filter((item) => item.id !== id) } : current);
      setDismissed({ id, company, item });
      setNotice("");
    } catch {
      setNotice("忽略失败，请检查 API 连接后重试。");
    } finally {
      setBusyId(null);
    }
  }

  async function handleRestore() {
    if (!dismissed) return;
    setBusyId(dismissed.id);
    try {
      if (!isFallback) await dashboardAction(`/api/v1/dashboard/recommendations/${dismissed.id}/restore`);
      setData((current) => current ? { ...current, recommendations: [...current.recommendations, dismissed.item] } : current);
      setDismissed(null);
      setNotice("");
    } catch {
      setNotice("撤销失败，请检查 API 连接后重试。");
    } finally {
      setBusyId(null);
    }
  }

  async function handleCreateTask(id: string, company: string) {
    setBusyId(id);
    try {
      const recommendation = data?.recommendations.find((item) => item.id === id);
      if (!recommendation) return;
      const action = isFallback ? { followup: {
        id: `demo-${Date.now()}`, name: recommendation.company, role: "人才摸排任务", company: recommendation.company,
        summary: "已创建推荐目标跟进任务", status: "待联系" as const, occurredAt: new Date().toISOString()
      } } : await dashboardAction(`/api/v1/dashboard/recommendations/${id}/tasks`);
      if (action.followup) setData((current) => current ? { ...current, followups: [action.followup!, ...current.followups] } : current);
      setFilter("全部");
      setNotice(`已为 ${company} 创建跟进任务。`);
    } catch {
      setNotice("创建跟进任务失败，请稍后重试。");
    } finally {
      setBusyId(null);
    }
  }

  const stats = data?.stats;

  return <div className={`dashboard dashboard-${viewMode}`}>
    <section className="dashboard-hero" aria-labelledby="dashboard-title">
      <div className="hero-orbit hero-orbit-one" />
      <div className="hero-orbit hero-orbit-two" />
      <div className="hero-watermark" aria-hidden="true">TALENTNEXUS</div>
      <div className="hero-copy">
        <div className="hero-greeting"><span className="hero-avatar">R</span><div><strong>{greeting(new Date().getHours())}，Rachel！</strong><span><CalendarDays size={13} />{formattedDate(new Date())}</span></div></div>
        <h1 id="dashboard-title">欢迎来到 <em>TalentNexus</em></h1>
        <p>团队今天的情报与动作，一屏看全</p>
        <div className="hero-stats" aria-label="人才运营统计">
          <Link to="/talent-pool?scope=all"><Users size={15} /><span>人才库</span><strong>{loading ? "--" : (stats?.talentCount ?? 0).toLocaleString("zh-CN")}</strong><small>人</small></Link>
          <Link to="/talent-pool?created=week"><Sparkles size={15} /><span>本周新增</span><strong>{loading ? "--" : (stats?.weeklyNew ?? 0).toLocaleString("zh-CN")}</strong><small>人</small></Link>
          <Link to="/competitor-monitoring"><Building2 size={15} /><span>竞对监测</span><strong>{loading ? "--" : stats?.monitoredCompanies ?? 0}</strong><small>家</small></Link>
        </div>
      </div>
      <button className="assistant-button" type="button" onClick={() => setAssistantOpen(true)}><Satellite size={15} />安装助手</button>
      <div className="hero-satellite" aria-hidden="true"><span className="satellite-panel left" /><span className="satellite-core"><Satellite size={31} /></span><span className="satellite-panel right" /></div>
    </section>

    {loadError && <div className="dashboard-alert" role="status"><CircleAlert size={16} /><span>{isFallback ? "API 暂不可用，当前显示演示数据；操作结果仅保存在演示会话中。" : "首页数据加载失败。"}</span><button type="button" onClick={() => setRefreshKey((current) => current + 1)}>重新连接</button></div>}
    {notice && <div className="dashboard-notice" role="status"><Check size={15} />{notice}<button type="button" aria-label="关闭提示" onClick={() => setNotice("")}><X size={14} /></button></div>}

    <div className="workbench-toolbar"><div className="workbench-title"><span className="workbench-icon"><Users size={16} /></span><h2>我的作战台</h2><span className="count-badge">{data?.recommendations.length ?? 3} 张</span></div><div className="view-switch" aria-label="作战台视图"><button type="button" aria-pressed={viewMode === "layout"} onClick={() => setViewMode("layout")} title="排版视图"><List size={15} /><span>排版</span></button><button type="button" aria-pressed={viewMode === "cards"} onClick={() => setViewMode("cards")} title="卡片视图"><LayoutGrid size={15} /><span>卡片</span></button></div></div>

    <div className="workbench-grid">
      <section className="dashboard-panel recommendations-panel" aria-labelledby="recommendations-title">
        <div className="panel-heading"><div><h2 id="recommendations-title">推荐目标</h2><p>AI 每周一生成</p></div><Link to="/intelligence" aria-label="查看情报中心"><ArrowRight size={16} /></Link></div>
        {loading ? <div className="dashboard-skeleton" aria-label="正在加载推荐目标"><span /><span /><span /></div> : data?.recommendations.length ? <div className="recommendation-list">{data.recommendations.map((item) => <article className="recommendation-card" key={item.id}>
          <button className="recommendation-main" type="button" onClick={() => navigate(`/competitor-monitoring?company=${encodeURIComponent(item.company)}`)}>
            <span className="company-glyph">{item.company.slice(0, 1)}</span><span className="recommendation-head"><strong>{item.company}</strong><small><span>{item.category}</span><i />{item.region}</small></span>
          </button>
          <p className="recommendation-signal">{item.signal}</p>
          <div className="recommendation-foot"><span>预估规模 <strong>{item.estimatedSize}</strong></span><div><button type="button" className="quiet-action" disabled={busyId === item.id} onClick={() => void handleIgnore(item.id, item.company)}>忽略</button><button type="button" className="primary-action" disabled={busyId === item.id} onClick={() => void handleCreateTask(item.id, item.company)}>{busyId === item.id ? "处理中" : "创建跟进"}</button></div></div>
        </article>)}</div> : <div className="panel-empty"><Sparkles size={20} /><strong>暂无推荐目标</strong><span>新的公司信号出现后会显示在这里。</span></div>}
        {dismissed && <div className="undo-bar"><span>已忽略 {dismissed.company}</span><button type="button" disabled={busyId === dismissed.id} onClick={() => void handleRestore()}><RotateCcw size={13} />撤销</button></div>}
      </section>

      <section className="dashboard-panel followups-panel" aria-labelledby="followups-title">
        <div className="panel-heading"><div><h2 id="followups-title">今日跟进</h2><p>我触达过的人 · {data?.followups.length ?? 0} 项</p></div><Link to="/research-tasks" aria-label="查看全部跟进任务"><ArrowRight size={16} /></Link></div>
        <div className="followup-controls"><label><span className="sr-only">按状态筛选跟进</span><select value={filter} onChange={(event) => setFilter(event.target.value as FollowupFilter)}>{["全部", "待联系", "跟进中", "已回复"].map((status) => <option key={status}>{status}</option>)}</select></label><button type="button" className="sort-button" onClick={() => setNewestFirst((current) => !current)} title={newestFirst ? "按最早时间优先" : "按最新时间优先"}><ArrowDownUp size={14} /><span>{newestFirst ? "最新" : "最早"}</span></button></div>
          {loading ? <div className="followup-skeleton" aria-label="正在加载今日跟进"><span /><span /><span /><span /></div> : followups.length ? <div className="followup-list">{followups.map((item) => <Link className="followup-row" to={`/research-tasks?q=${encodeURIComponent(item.company)}`} key={item.id}>
          <span className={`status-mark status-${item.status === "已回复" ? "done" : item.status === "待联系" ? "waiting" : "active"}`}><Check size={12} /></span><span className="followup-copy"><strong>{item.name}<small>{item.role}</small></strong><span>{item.company} · {item.summary}</span></span><span className="followup-meta"><span className={`status-label status-label-${item.status === "已回复" ? "done" : item.status === "待联系" ? "waiting" : "active"}`}>{item.status}</span><time dateTime={item.occurredAt}><Clock3 size={11} />{shortTime(item.occurredAt)}</time></span>
        </Link>)}</div> : <div className="panel-empty"><CalendarDays size={20} /><strong>{filter === "全部" ? "今天还没有跟进事项" : `没有“${filter}”的跟进`}</strong><span>调整筛选条件，或创建一条新的跟进任务。</span></div>}
      </section>

      <section className="dashboard-panel outreach-panel" aria-labelledby="outreach-title">
        <div className="panel-heading"><div><h2 id="outreach-title">我的触达</h2><p>战役与回复</p></div><Link to="/outreach" aria-label="查看触达工作台"><ArrowRight size={16} /></Link></div>
        <div className="outreach-metrics"><div><span>累计触达</span><strong>{loading ? "--" : data?.outreach.total ?? 0}</strong><small>次</small></div><div><span>近 7 天回复</span><strong>{loading ? "--" : data?.outreach.repliesLast7Days ?? 0}</strong><small>人</small></div></div>
        <div className="outreach-subhead"><span>最近战役</span><span>回复 / 触达</span></div>
        {loading ? <div className="followup-skeleton"><span /><span /><span /></div> : data?.outreach.events.length ? <div className="outreach-list">{data.outreach.events.map((event) => <div className="outreach-event" key={event.id}><span className="event-icon"><BellRing size={13} /></span><span className="event-copy"><strong>{event.title}</strong><small>{event.channel} · {new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit" }).format(new Date(event.occurredAt))}</small></span><span className="reply-count"><strong>{event.replies} / {event.touched}</strong><small>回复 / 触达</small></span></div>)}</div> : <div className="panel-empty compact-empty"><BellRing size={18} /><strong>暂无触达记录</strong></div>}
      </section>
    </div>

    {assistantOpen && <div className="dashboard-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setAssistantOpen(false); }}><section className="assistant-dialog" role="dialog" aria-modal="true" aria-labelledby="assistant-title"><button type="button" className="dialog-close" aria-label="关闭" onClick={() => setAssistantOpen(false)}><X size={17} /></button><span className="assistant-dialog-icon"><Satellite size={22} /></span><h2 id="assistant-title">TalentNexus 浏览器助手</h2><p>助手安装包尚未接入此工作区。现在仍可使用 TalentNexus 查看信号、安排跟进与追踪触达。</p><button type="button" className="primary-action" onClick={() => setAssistantOpen(false)}>知道了</button></section></div>}
  </div>;
}
