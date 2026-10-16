import { Check, ChevronRight, CircleAlert, FileSearch, GitFork, LoaderCircle, RefreshCw, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { OrganizationDetailResponse, OrganizationEvidenceStatus, OrganizationUnit } from "@hr-console/contracts";
import { useSearchParams } from "react-router-dom";
import { useDrawer } from "../operation-state";
import { getLeader, getOrganization, getOrganizations, reviewOrganizationEvidence } from "./organization-api";

const statusLabel: Record<OrganizationEvidenceStatus, string> = { pending: "待审核", unverified: "待核验", verified: "已核验", rejected: "已驳回" };

function date(value: string): string { return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium" }).format(new Date(value)); }

function OrganizationNode({ item, childrenByParent, depth, select }: { item: OrganizationUnit; childrenByParent: Map<string | null, OrganizationUnit[]>; depth: number; select: (id: string) => void }) {
  const children = childrenByParent.get(item.id) ?? [];
  return <li className="org-tree-item" style={{ "--org-depth": depth } as React.CSSProperties}>
    <button type="button" onClick={() => select(item.id)}><span className={`org-node-dot ${item.status}`} /><span className="org-node-copy"><strong>{item.name}</strong><small>{item.role ?? item.kind}{item.region ? ` · ${item.region}` : ""}</small></span><span className="org-node-evidence">{item.evidenceCount} 条证据</span><ChevronRight size={15} /></button>
    {children.length > 0 ? <ul>{children.map((child) => <OrganizationNode key={child.id} item={child} childrenByParent={childrenByParent} depth={depth + 1} select={select} />)}</ul> : null}
  </li>;
}

export function OrganizationMap({ canWrite = false }: { canWrite?: boolean }) {
  const [params, setParams] = useSearchParams();
  const selectedId = params.get("unit");
  const leaderId = params.get("leader");
  const [units, setUnits] = useState<OrganizationUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState<OrganizationDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const close = useCallback(() => {
    setParams((current) => { current.delete("unit"); current.delete("leader"); return current; }, { replace: true });
    setDetail(null);
  }, [setParams]);
  const setSelectedId = (id: string) => setParams((current) => { current.set("unit", id); current.delete("leader"); return current; });
  useDrawer(!!(selectedId || leaderId), close);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    void getOrganizations(controller.signal).then((result) => { if (!controller.signal.aborted) setUnits(result.items); }).catch(() => {
      if (!controller.signal.aborted) setError("组织图暂时无法加载，请检查连接后重试。");
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [revision]);

  useEffect(() => {
    if (!selectedId) return;
    const controller = new AbortController();
    setDetailLoading(true); setDetail(null); setDetailError("");
    void getOrganization(selectedId, controller.signal).then((result) => { if (!controller.signal.aborted) setDetail(result); }).catch(() => {
      if (!controller.signal.aborted) setDetailError("组织详情加载失败，请重试或重新选择节点。");
    }).finally(() => { if (!controller.signal.aborted) setDetailLoading(false); });
    return () => controller.abort();
  }, [selectedId, revision]);

  const childrenByParent = useMemo(() => {
    const map = new Map<string | null, OrganizationUnit[]>();
    for (const item of units) map.set(item.parentId, [...(map.get(item.parentId) ?? []), item]);
    return map;
  }, [units]);
  const roots = childrenByParent.get(null) ?? [];

  async function review(evidenceId: string, status: OrganizationEvidenceStatus) {
    if (!canWrite) return;
    setReviewing(evidenceId); setError("");
    try { await reviewOrganizationEvidence(evidenceId, status); setRevision((value) => value + 1); }
    catch { setError("证据审核未保存，请稍后重试。"); }
    finally { setReviewing(null); }
  }

  return <div className="organization-page">
    <div className="page-heading"><span className="eyebrow">RESEARCH / ORGANIZATION EVIDENCE</span><h1><GitFork size={28} strokeWidth={1.7} />组织摸排</h1><p>按组织关系查看岗位范围、证据来源与核验状态。</p></div>
    {error ? <div className="operation-alert" role="status"><CircleAlert size={16} />{error}</div> : null}
    <section className="organization-toolbar"><div><strong>组织关系图</strong><span>{loading ? "正在同步节点..." : `${units.length} 个组织节点`}</span></div><button type="button" className="icon-button" aria-label="刷新组织图" title="刷新组织图" onClick={() => setRevision((value) => value + 1)}><RefreshCw size={15} /></button></section>
    <section className="organization-canvas" aria-label="组织关系图">
      {loading ? <div className="operation-loading"><LoaderCircle size={20} className="spin" />加载组织关系...</div> : roots.length ? <ul className="org-tree">{roots.map((root) => <OrganizationNode key={root.id} item={root} childrenByParent={childrenByParent} depth={0} select={setSelectedId} />)}</ul> : <div className="operation-empty"><GitFork size={25} /><strong>暂无组织节点</strong><span>导入或录入组织信息后会显示在这里。</span></div>}
    </section>
    {selectedId || leaderId ? <div className="operation-drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}><aside className="operation-drawer organization-drawer" aria-label={leaderId ? "领队档案详情" : "组织节点详情"}><button type="button" className="drawer-close" aria-label="关闭详情" onClick={close}><X size={17} /></button>{leaderId ? <LeaderDetails id={leaderId} selectOrganization={setSelectedId} /> : detailLoading ? <div className="operation-loading"><LoaderCircle size={20} className="spin" />加载节点详情...</div> : detail ? <><span className={`evidence-status ${detail.status}`}>{statusLabel[detail.status]}</span><h2>{detail.name}</h2><p className="drawer-meta">{detail.role ?? detail.kind}{detail.region ? ` · ${detail.region}` : ""} · 版本 {detail.version}</p><div className="drawer-section"><h3>组织范围</h3><p>{detail.childrenCount} 个下级节点 · {detail.children.length} 个当前可见</p>{detail.children.length ? <div className="organization-children">{detail.children.map((child) => <button type="button" key={child.id} onClick={() => setSelectedId(child.id)}>{child.name}<ChevronRight size={14} /></button>)}</div> : null}</div><div className="drawer-section evidence-review"><h3><FileSearch size={15} />证据审核</h3>{detail.evidence.length ? detail.evidence.map((evidence) => <article key={evidence.id}><div><span className={`evidence-status ${evidence.status}`}>{statusLabel[evidence.status]}</span><strong>{evidence.title}</strong><p>{evidence.excerpt}</p><small>{date(evidence.collectedAt)} · 可信度 {evidence.confidence}% · {evidence.source.url && /^https?:\/\//i.test(evidence.source.url) ? <a href={evidence.source.url} target="_blank" rel="noreferrer">{evidence.source.name}</a> : evidence.source.name}</small></div>{canWrite && evidence.status !== "verified" ? <div className="evidence-actions"><button type="button" disabled={reviewing === evidence.id} onClick={() => void review(evidence.id, "verified")}><Check size={14} />核验</button><button type="button" disabled={reviewing === evidence.id} onClick={() => void review(evidence.id, "rejected")}>驳回</button></div> : null}</article>) : <p className="drawer-meta">该节点暂未关联证据。</p>}</div></> : <div role="status"><p>{detailError || "未找到组织详情。"}</p><button type="button" onClick={() => setRevision((value) => value + 1)}>重试</button></div>}</aside></div> : null}
  </div>;
}

function LeaderDetails({ id, selectOrganization }: { id: string; selectOrganization: (id: string) => void }) {
  const [leader, setLeader] = useState<Awaited<ReturnType<typeof getLeader>> | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setLeader(null); setError("");
    void getLeader(id, controller.signal).then((result) => { if (!controller.signal.aborted) setLeader(result); })
      .catch(() => { if (!controller.signal.aborted) setError("领队档案加载失败，请重试或重新搜索。"); });
    return () => controller.abort();
  }, [id, revision]);
  if (error) return <div role="status"><p>{error}</p><button type="button" onClick={() => setRevision((value) => value + 1)}>重试</button></div>;
  if (!leader) return <div className="operation-loading"><LoaderCircle size={20} className="spin" />加载领队档案...</div>;
  return <>
    <span className={`evidence-status ${leader.status}`}>{statusLabel[leader.status]}</span><h2>{leader.name}</h2>
    <p className="drawer-meta">{leader.currentTitle ?? "职务待补充"} · {leader.regions.join(" / ")} · 版本 {leader.version}</p>
    {leader.organizationUnitId ? <button type="button" onClick={() => selectOrganization(leader.organizationUnitId!)}>查看所属组织<ChevronRight size={14} /></button> : null}
    <div className="drawer-section"><h3>团队范围</h3><p>{leader.teamSummary ?? "暂无团队说明"}</p><h3>过往职务</h3><p>{leader.previousTitles.join(" / ") || "暂无记录"}</p><h3>联系渠道</h3><p>{leader.contactChannels.join(" / ") || "暂无已登记渠道"}</p></div>
    <div className="drawer-section evidence-review"><h3><FileSearch size={15} />证据来源</h3>{leader.evidence.length ? leader.evidence.map((evidence) => <article key={evidence.id}><div><span className={`evidence-status ${evidence.status}`}>{statusLabel[evidence.status]}</span><strong>{evidence.title}</strong><p>{evidence.excerpt}</p><small>{date(evidence.collectedAt)} · 可信度 {evidence.confidence}% · {evidence.source.url && /^https?:\/\//i.test(evidence.source.url) ? <a href={evidence.source.url} target="_blank" rel="noreferrer">{evidence.source.name}</a> : evidence.source.name}</small></div></article>) : <p className="drawer-meta">暂无关联证据。</p>}</div>
  </>;
}
