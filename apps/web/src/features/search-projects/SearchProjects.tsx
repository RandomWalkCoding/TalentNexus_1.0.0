import { BriefcaseBusiness, ChevronRight, CircleAlert, LoaderCircle, RefreshCw, UsersRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { CandidateProjectStage, SearchProject, SearchProjectCandidate, SearchProjectDetail } from "@hr-console/contracts";
import { useSearchParams } from "react-router-dom";
import { getSearchProject, getSearchProjects, updateCandidateStage } from "./search-projects-api";

const stages: Array<[CandidateProjectStage, string]> = [["research", "待研究"], ["longlist", "长名单"], ["shortlist", "短名单"], ["ready_to_contact", "待触达"], ["contacted", "已触达"], ["replied", "已回复"], ["conversation", "沟通中"], ["closed", "结束"]];
const statusNames: Record<SearchProject["status"], string> = { draft: "草稿", active: "进行中", paused: "已暂停", completed: "已完成" };

function date(value: string | null): string { return value ? new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium" }).format(new Date(value)) : "未设期限"; }

export function SearchProjects({ canWrite = false }: { canWrite?: boolean }) {
  const [params, setParams] = useSearchParams();
  const selectedId = params.get("project");
  const setSelectedId = (id: string) => setParams((current) => { current.set("project", id); return current; });
  const [projects, setProjects] = useState<SearchProject[]>([]);
  const [detail, setDetail] = useState<SearchProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError("");
    void getSearchProjects(controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      setProjects(result.items);
    }).catch(() => { if (!controller.signal.aborted) setError("寻访项目列表加载失败，请稍后重试。"); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [revision]);

  useEffect(() => {
    if (!selectedId && projects[0]) setParams((current) => {
      if (!current.get("project")) current.set("project", projects[0]!.id);
      return current;
    }, { replace: true });
  }, [projects, selectedId, setParams]);

  useEffect(() => {
    if (!selectedId) { setDetail(null); return; }
    const controller = new AbortController(); setDetailLoading(true); setDetail(null);
    void getSearchProject(selectedId, controller.signal).then((result) => { if (!controller.signal.aborted) setDetail(result); }).catch(() => { if (!controller.signal.aborted) setError("项目详情加载失败，请重新选择项目。" ); }).finally(() => { if (!controller.signal.aborted) setDetailLoading(false); });
    return () => controller.abort();
  }, [selectedId, revision]);

  const counts = useMemo(() => new Map(stages.map(([stage]) => [stage, detail?.candidates.filter((item) => item.stage === stage).length ?? 0])), [detail]);

  async function moveCandidate(candidate: SearchProjectCandidate, stage: CandidateProjectStage) {
    if (!canWrite || !detail || candidate.stage === stage) return;
    setUpdating(candidate.id); setError("");
    try { await updateCandidateStage(detail.id, candidate.id, stage); setRevision((value) => value + 1); }
    catch { setError("候选人阶段未更新，请刷新确认当前状态。"); }
    finally { setUpdating(null); }
  }

  return <div className="search-projects-page">
    <div className="page-heading"><span className="eyebrow">TALENT OPERATIONS / SEARCH PIPELINE</span><h1><BriefcaseBusiness size={28} strokeWidth={1.7} />人才寻访</h1><p>按项目管理目标人才、长短名单与下一步触达。</p></div>
    {error ? <div className="operation-alert" role="status"><CircleAlert size={16} />{error}</div> : null}
    <div className="search-projects-layout"><section className="project-index" aria-label="寻访项目"><header><div><h2>寻访项目</h2><span>{loading ? "同步中..." : `${projects.length} 个项目`}</span></div><button type="button" className="icon-button" aria-label="刷新寻访项目" title="刷新寻访项目" onClick={() => setRevision((value) => value + 1)}><RefreshCw size={15} /></button></header>{loading ? <div className="operation-loading"><LoaderCircle size={20} className="spin" />加载项目...</div> : projects.length ? <div className="project-list">{projects.map((project) => <button type="button" className={selectedId === project.id ? "selected" : ""} key={project.id} onClick={() => setSelectedId(project.id)}><span className={`project-status ${project.status}`}>{statusNames[project.status]}</span><strong>{project.name}</strong><small>{project.targetRole} · {project.regions.join(" / ")}</small><em>{project.candidateCount} 位候选人</em><ChevronRight size={15} /></button>)}</div> : <div className="operation-empty"><BriefcaseBusiness size={24} /><strong>暂无寻访项目</strong></div>}</section><section className="project-workspace" aria-label="寻访项目详情">{detailLoading ? <div className="operation-loading"><LoaderCircle size={20} className="spin" />加载项目详情...</div> : detail ? <><header className="project-heading"><div><span className={`project-status ${detail.status}`}>{statusNames[detail.status]}</span><h2>{detail.name}</h2><p>{detail.targetRole} · {detail.regions.join(" / ")} · {detail.owner}</p></div><dl><div><dt>目标</dt><dd>{detail.targetCount} 人</dd></div><div><dt>期限</dt><dd>{date(detail.deadline)}</dd></div></dl></header><p className="project-summary">{detail.summary}</p><div className="pipeline-strip" aria-label="候选人阶段漏斗">{stages.map(([stage, label]) => <button type="button" key={stage} onClick={() => document.getElementById(`stage-${stage}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" })}><span>{counts.get(stage)}</span><small>{label}</small></button>)}</div><div className="pipeline-columns">{stages.map(([stage, label]) => <section id={`stage-${stage}`} key={stage}><header><strong>{label}</strong><span>{counts.get(stage)}</span></header>{detail.candidates.filter((candidate) => candidate.stage === stage).map((candidate) => <article key={candidate.id}><span className="candidate-avatar">{candidate.talent.name.slice(0, 1)}</span><div><strong>{candidate.talent.name}</strong><small>{candidate.talent.title} · {candidate.talent.company}</small><em>{candidate.talent.level || "职级待判断"} · {candidate.talent.location}</em><label>推进至<select aria-label={`${candidate.talent.name} 的阶段`} value={candidate.stage} disabled={!canWrite || updating === candidate.id} onChange={(event) => void moveCandidate(candidate, event.target.value as CandidateProjectStage)}>{stages.map(([value, text]) => <option value={value} key={value}>{text}</option>)}</select></label></div></article>)}{counts.get(stage) === 0 ? <p className="pipeline-empty">暂无候选人</p> : null}</section>)}</div></> : <div className="operation-empty"><UsersRound size={25} /><strong>选择一个寻访项目查看候选人漏斗</strong></div>}</section></div>
  </div>;
}
