import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Link } from "react-router-dom";
import { Mail, Plus, RefreshCw, Send, X } from "lucide-react";
import type { z } from "zod";
import * as c from "@hr-console/contracts";
import { useDrawer } from "../operation-state";
import { errors, errorText, loadMessage, pickOptionsSchema, projectOptionsSchema, query, read, sendPreview, write } from "./mail-api";
import "./mail.css";

const statusLabels: Record<c.MailMessageStatus, string> = { draft: "草稿", pending_review: "待审批", rejected: "已驳回", approved: "已批准", queued: "排队中", sending: "发送中", delivery_unknown: "结果待核对", sent: "已发送", delivered: "已送达", failed: "发送失败", bounced: "已退信", replied: "已回复", stopped: "已停止" };
const classifications: Record<c.MailReplyClassification, string> = { positive: "积极回应", discussion: "待沟通", rejected: "拒绝", auto_reply: "自动回复", unknown: "待人工分类", unsubscribed: "退订" };
const connectionLabels = { connecting: "等待授权", connected: "已连接", expired: "授权失效", disconnected: "已断开", error: "连接异常" };
const exclusionLabels: Record<string, string> = { NOT_APPROVED: "尚未批准", VERSION_CONFLICT: "版本变化", SUPPRESSED: "已排除", DUPLICATE_CONTACT: "重复触达或跟进失效", CONNECTION_UNAVAILABLE: "邮箱不可用", OUTSIDE_SEND_WINDOW: "不在发送窗口", RATE_LIMITED: "达到限额", ALREADY_QUEUED: "已在队列中", ALREADY_SENT: "已发送或正在核对" };
const reasons: Record<string, string> = { rejected: "拒绝", unsubscribed: "退订", bounced: "退信", manual: "人工排除", connection_disconnected: "邮箱断开" };
const displayTime = (value: string | null) => value ? new Date(value).toLocaleString("zh-CN") : "—";
const iso = (value: string) => value ? new Date(value).toISOString() : null;
const localTime = (value: string | null) => value ? new Date(Date.parse(value) - new Date(value).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "";
type PageProps = { canWrite: boolean; currentUserId: string };
type Mutation = (action: () => Promise<void>, success?: string) => Promise<void>;

function useRemote<T>(schema: z.ZodType<T>, path: string, revision = 0) {
  const [data, setData] = useState<T | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(""); setData(null);
    void read(schema, path, controller.signal).then(value => { if (!controller.signal.aborted) setData(value); }).catch(e => { if (!controller.signal.aborted) setError(errorText(e)); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [schema, path, revision]);
  return { data, loading, error };
}
function State({ loading, error, empty = false }: { loading: boolean; error: string; empty?: boolean }) {
  return loading ? <p className="mail-state" role="status">正在读取…</p> : error ? <p className="mail-state" role="alert">{error}</p> : empty ? <p className="mail-state">暂无符合条件的记录。</p> : null;
}
function Pagination({ page, total, onPage }: { page: number; total: number; onPage: (value: number) => void }) {
  return <div className="mail-pagination"><span>共 {total} 条 · 第 {page} / {Math.max(1, Math.ceil(total / 20))} 页</span><button disabled={page <= 1} onClick={() => onPage(page - 1)}>上一页</button><button disabled={page * 20 >= total} onClick={() => onPage(page + 1)}>下一页</button></div>;
}
function Dialog({ title, close, children, busy = false, error = "", notice = "" }: { title: string; close: () => void; children: ReactNode; busy?: boolean; error?: string; notice?: string }) {
  const safeClose = useCallback(() => { if (!busy) close(); }, [busy, close]);
  useDrawer(true, safeClose, ".mail-dialog");
  return <div className="mail-backdrop"><section className="mail-dialog" aria-label={title}><header><h2>{title}</h2><button type="button" disabled={busy} onClick={close} aria-label="关闭"><X size={20} /></button></header>{error && <p className="mail-error" role="alert">{error}</p>}{notice && <p className="mail-notice" role="status">{notice}</p>}{children}</section></div>;
}

export function MailPage({ canWrite, currentUserId }: PageProps) {
  const [tab, setTab] = useState("messages"), [revision, setRevision] = useState(0), [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [compose, setCompose] = useState<c.MailMessageDetail | "new" | null>(null), [messageId, setMessageId] = useState<string | null>(null), [replyId, setReplyId] = useState<string | null>(null), [preview, setPreview] = useState<c.MailSendPreviewResponse | null>(null);
  const closeCompose = useCallback(() => setCompose(null), []), closeMessage = useCallback(() => setMessageId(null), []), closeReply = useCallback(() => setReplyId(null), []), closePreview = useCallback(() => setPreview(null), []);
  const refresh = useCallback(() => setRevision(v => v + 1), []);
  const active = useRef(false);
  const mutate: Mutation = async (action, success) => {
    if (active.current) return;
    active.current = true; setBusy(true); setError(""); setNotice("");
    try { await action(); if (success) setNotice(success); refresh(); }
    catch (e) { setError(errorText(e)); }
    finally { active.current = false; setBusy(false); }
  };
  const authResult = new URLSearchParams(window.location.search).get("authorization");
  return <div className="module-page mail-page"><div className="page-heading"><span className="eyebrow">MAIL OUTREACH</span><h1><Mail size={28} />邮箱触达与反馈</h1><p>核对收件人，人工审批后发送；将真实回复同步到寻访项目。</p></div>
    <div className="mail-toolbar"><button disabled={busy} onClick={refresh}><RefreshCw size={15} />刷新</button>{canWrite && <button className="primary-action" disabled={busy} onClick={() => setCompose("new")}><Plus size={15} />新建邮件草稿</button>}<Link to="/outreach">触达战役</Link><Link to="/search-projects">人才寻访</Link></div>
    {!canWrite && <p className="mail-notice">当前为只读权限。</p>}{authResult && <p className="mail-notice" role="status">{authResult === "connected" ? "邮箱授权成功，可以创建草稿。" : errors[authResult] ?? "授权未完成，请重新连接。"}</p>}
    {error && <div className="mail-error" role="alert">{error}<button onClick={() => setError("")}>关闭提示</button></div>}{notice && <p className="mail-notice" role="status">{notice}</p>}
    <nav className="mail-tabs" aria-label="邮箱功能">{[["messages", "草稿与发送"], ["replies", "回复与反馈"], ["connections", "邮箱连接"], ["suppressions", "排除名单"], ["funnel", "触达漏斗"]].map(([key, label]) => <button key={key} aria-pressed={tab === key} onClick={() => setTab(key!)}>{label}</button>)}</nav>
    {tab === "messages" && <Messages revision={revision} canWrite={canWrite} busy={busy} open={setMessageId} preview={ids => void mutate(async () => setPreview(await sendPreview(ids)))} />}
    {tab === "replies" && <Replies revision={revision} open={setReplyId} />}
    {tab === "connections" && <Connections revision={revision} canWrite={canWrite} currentUserId={currentUserId} busy={busy} mutate={mutate} />}
    {tab === "suppressions" && <Suppressions revision={revision} canWrite={canWrite} busy={busy} mutate={mutate} />}
    {tab === "funnel" && <Funnel revision={revision} />}
    {compose && <Dialog title={compose === "new" ? "新建草稿" : "编写跟进邮件"} close={closeCompose} busy={busy} error={error} notice={notice}><Compose initial={compose === "new" ? null : compose} busy={busy} mutate={mutate} currentUserId={currentUserId} done={id => { setCompose(null); setMessageId(id); }} /></Dialog>}
    {messageId && !compose && !preview && <Dialog title="邮件详情与审批" close={closeMessage} busy={busy} error={error} notice={notice}><MessageDetail id={messageId} canWrite={canWrite} busy={busy} mutate={mutate} revision={revision} onPreview={id => void mutate(async () => setPreview(await sendPreview([id])))} followUp={setCompose} /></Dialog>}
    {replyId && <Dialog title="回复原文与反馈修正" close={closeReply} busy={busy} error={error} notice={notice}><ReplyDetail id={replyId} canWrite={canWrite} busy={busy} mutate={mutate} revision={revision} /></Dialog>}
    {preview && <Dialog title="确认发送预览" close={closePreview} busy={busy} error={error} notice={notice}><Preview value={preview} busy={busy} mutate={mutate} close={closePreview} /></Dialog>}
  </div>;
}

function Messages({ revision, canWrite, busy, open, preview }: { revision: number; canWrite: boolean; busy: boolean; open: (id: string) => void; preview: (ids: string[]) => void }) {
  const [page, setPage] = useState(1), [status, setStatus] = useState(""), [q, setQ] = useState(""), [project, setProject] = useState(""), [campaign, setCampaign] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const result = useRemote(c.mailMessageListResponseSchema, `mail/messages?${query({ page, status, q, projectId: project, campaignId: campaign })}`, revision);
  const choices = result.data?.items.filter(m => selected.includes(m.id)).map(m => m.id) ?? [];
  return <section className="module-section"><div className="mail-filters"><label>搜索<input value={q} maxLength={200} placeholder="邮箱或主题" onChange={e => { setQ(e.target.value); setPage(1); setSelected([]); }} /></label><label>状态<select value={status} onChange={e => { setStatus(e.target.value); setPage(1); setSelected([]); }}><option value="">全部状态</option>{Object.entries(statusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label>项目 ID<input value={project} placeholder="全部项目" onChange={e => { setProject(e.target.value); setPage(1); }} /></label><label>战役 ID<input value={campaign} placeholder="全部战役" onChange={e => { setCampaign(e.target.value); setPage(1); }} /></label></div>
    {canWrite && <div className="mail-toolbar"><button disabled={busy || !choices.length} onClick={() => preview(choices)}><Send size={15} />预览所选 {choices.length} 封</button><span>入队后按发送窗口与限额执行。</span></div>}
    <State {...result} empty={!result.data?.items.length} />{result.data && <><div className="mail-table-wrap"><table><thead><tr>{canWrite && <th>选择</th>}<th>收件人 / 主题</th><th>状态</th><th>计划 / 实际发送</th><th>版本 / 尝试</th><th>操作</th></tr></thead><tbody>{result.data.items.map(m => <tr key={m.id}>{canWrite && <td><input type="checkbox" aria-label={`选择 ${m.recipient} 的 ${m.subject}`} checked={choices.includes(m.id)} onChange={e => setSelected(value => e.target.checked ? [...value, m.id] : value.filter(id => id !== m.id))} /></td>}<td><strong>{m.recipient}</strong><span>{m.subject}</span>{m.followUpOfId && <small>跟进邮件</small>}</td><td><span className={`mail-badge mail-status-${m.status}`}>{statusLabels[m.status]}</span>{m.lastErrorCode && <small>{errors[m.lastErrorCode]}</small>}</td><td>{displayTime(m.scheduledAt)}<small>已发送：{displayTime(m.sentAt)}</small></td><td>v{m.version} / 内容 v{m.contentVersion}<small>{m.attemptCount} / {m.maxAttempts} 次</small></td><td><button onClick={() => open(m.id)}>查看详情</button></td></tr>)}</tbody></table></div><Pagination page={page} total={result.data.total} onPage={value => { setPage(value); setSelected([]); }} /></>}
  </section>;
}

function Connections({ revision, canWrite, currentUserId, busy, mutate }: PageProps & { revision: number; busy: boolean; mutate: Mutation }) {
  const [page, setPage] = useState(1), [notes, setNotes] = useState<Record<string, string>>({}), [jobs, setJobs] = useState<c.MailSyncJob[]>([]);
  const result = useRemote(c.mailConnectionListResponseSchema, `mail/connections?page=${page}`, revision);
  const liveJobIds = jobs.filter(j => ["queued", "running"].includes(j.status)).map(j => j.id).join(",");
  useEffect(() => {
    if (!liveJobIds) return;
    const controller = new AbortController();
    const poll = () => { void Promise.all(liveJobIds.split(",").map(id => read(c.mailSyncJobSchema, `mail/sync-jobs/${id}`, controller.signal))).then(values => { if (!controller.signal.aborted) setJobs(previous => previous.map(j => values.find(v => v.id === j.id) ?? j)); }).catch(() => { /* Keep last persisted state; refresh or retry remains available. */ }); };
    poll(); const timer = window.setInterval(poll, 5000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [liveJobIds]);
  return <section className="module-section"><h2>连接工作邮箱</h2><p>授权读取回信、发送邮件及离线访问。Google 与 Microsoft 凭据由服务器加密保存。</p>
    {canWrite && <div className="mail-toolbar">{(["google", "microsoft"] as const).map(provider => <button key={provider} disabled={busy} onClick={() => void mutate(async () => { const result = await write(c.mailAuthorizeRequestSchema, c.mailAuthorizationResponseSchema, "connections/authorize", { provider }); window.location.assign(result.authorizationUrl); })}>连接 {provider === "google" ? "Google Gmail" : "Microsoft 365"}</button>)}</div>}
    <State {...result} empty={!result.data?.items.length} /><div className="mail-cards">{result.data?.items.map(conn => <article className="mail-card" key={conn.id}><div className="mail-card-heading"><strong>{conn.email ?? "尚未完成授权"}</strong><span className="mail-badge">{connectionLabels[conn.status]}</span></div><p>{conn.provider === "google" ? "Google Gmail" : "Microsoft 365"}</p><small>权限：{conn.capabilities.join(" / ") || "未授权"}</small><small>上次同步：{displayTime(conn.lastSyncedAt)}</small>{conn.errorCode && <p className="mail-error">{errors[conn.errorCode]}</p>}{canWrite && conn.ownerId === currentUserId && <><div className="mail-toolbar"><button disabled={busy} onClick={() => void mutate(async () => { const r = await write(c.mailReconnectRequestSchema, c.mailAuthorizationResponseSchema, `connections/${conn.id}/reconnect`, { expectedVersion: conn.version }); window.location.assign(r.authorizationUrl); })}>重新授权</button><button disabled={busy || conn.status !== "connected"} onClick={() => void mutate(async () => { const r = await write(c.mailSyncRequestSchema, c.mailSyncResponseSchema, `connections/${conn.id}/sync`, { expectedVersion: conn.version, idempotencyKey: crypto.randomUUID() }); setJobs(previous => [...previous.filter(j => j.connectionId !== conn.id), r.job]); }, "回信同步已提交，可查看下方进度。")}>同步回信</button></div>{conn.status !== "disconnected" && <div className="mail-filters"><label>断开原因<input value={notes[conn.id] ?? ""} maxLength={2000} minLength={3} onChange={e => setNotes(v => ({ ...v, [conn.id]: e.target.value }))} placeholder="至少 3 字；断开将停止未发邮件" /></label><button disabled={busy || (notes[conn.id]?.trim().length ?? 0) < 3} onClick={() => void mutate(async () => { await write(c.mailDisconnectRequestSchema, c.mailConnectionSchema, `connections/${conn.id}/disconnect`, { expectedVersion: conn.version, note: notes[conn.id] }); }, "已断开邮箱并停止未发邮件。")}>断开连接</button></div>}</>}{jobs.filter(j => j.connectionId === conn.id).map(job => <p key={job.id} role="status">同步：{({ queued: "排队中", running: "同步中", succeeded: "已完成", failed: "失败" })[job.status]} · 导入 {job.importedCount} · 待关联 {job.unassociatedCount}{job.errorCode ? ` · ${errors[job.errorCode]}` : ""}</p>)}</article>)}</div>{result.data && <Pagination page={page} total={result.data.total} onPage={setPage} />}
  </section>;
}

function Compose({ initial, currentUserId, busy, mutate, done }: { initial: c.MailMessageDetail | null; currentUserId: string; busy: boolean; mutate: Mutation; done: (id: string) => void }) {
  const [connectionId, setConnectionId] = useState(initial?.connectionId ?? ""), [talentId, setTalentId] = useState(initial?.talentId ?? ""), [projectId, setProjectId] = useState(initial?.projectId ?? ""), [campaignId, setCampaignId] = useState(initial?.campaignId ?? ""), [candidateProjectId, setCandidate] = useState(initial?.candidateProjectId ?? "");
  const [recipient, setRecipient] = useState(initial?.recipient ?? ""), [subject, setSubject] = useState(initial ? `Re: ${initial.subject}` : ""), [bodyText, setBody] = useState(""), [scheduledAt, setSchedule] = useState("");
  const [talentSearch, setTalentSearch] = useState("");
  const connections = useRemote(c.mailConnectionListResponseSchema, "mail/connections?status=connected&pageSize=100");
  const talents = useRemote(pickOptionsSchema, `talents?${query({ q: talentSearch, pageSize: 50 })}`);
  const projects = useRemote(pickOptionsSchema, "search-projects?pageSize=100");
  const campaigns = useRemote(pickOptionsSchema, "outreach?pageSize=100");
  const candidatePath = projectId ? `search-projects/${projectId}` : "";
  const [candidates, setCandidates] = useState<z.infer<typeof projectOptionsSchema>["candidates"]>([]), [candidateError, setCandidateError] = useState("");
  useEffect(() => {
    setCandidates([]); setCandidateError(""); if (!candidatePath) return;
    const controller = new AbortController(); void read(projectOptionsSchema, candidatePath, controller.signal).then(data => { if (!controller.signal.aborted) setCandidates(data.candidates); }).catch(e => { if (!controller.signal.aborted) setCandidateError(errorText(e)); }); return () => controller.abort();
  }, [candidatePath]);
  const ownConnections = connections.data?.items.filter(conn => conn.ownerId === currentUserId) ?? [];
  const submit = (event: FormEvent) => {
    event.preventDefault(); void mutate(async () => {
      const r = await write(c.mailDraftCreateSchema, c.mailMessageResponseSchema, "messages", { connectionId, talentId, projectId: projectId || null, candidateProjectId: candidateProjectId || null, campaignId: campaignId || null, recipient, subject, bodyText, scheduledAt: iso(scheduledAt), followUpOfId: initial?.id ?? null, templateId: null }); done(r.message.id);
    }, "草稿已保存，请核对后提交审批。");
  };
  return <form className="mail-form" onSubmit={submit}><p>单一收件人 · 纯文本 · 首次触达与跟进均需人工审批</p>{[connections, talents, projects, campaigns].map((r, i) => r.error ? <p className="mail-error" key={i}>{r.error}</p> : null)}{candidateError && <p className="mail-error">{candidateError}</p>}
    <div className="mail-form-grid"><label>发送邮箱<select required disabled={!!initial} value={connectionId} onChange={e => setConnectionId(e.target.value)}><option value="">请选择已授权邮箱</option>{ownConnections.map(conn => <option key={conn.id} value={conn.id}>{conn.email}</option>)}</select></label><label>人才搜索<input value={talentSearch} maxLength={100} disabled={!!initial} onChange={e => setTalentSearch(e.target.value)} placeholder="输入姓名筛选人才" /></label><label>关联人才<select required value={talentId} disabled={!!initial} onChange={e => { setTalentId(e.target.value); setCandidate(""); }}><option value="">请选择人才</option>{initial && !talents.data?.items.some(t => t.id === initial.talentId) && <option value={initial.talentId}>{initial.talentId}</option>}{talents.data?.items.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label><label>寻访项目<select disabled={!!initial} value={projectId} onChange={e => { setProjectId(e.target.value); setCandidate(""); }}><option value="">不关联项目</option>{projects.data?.items.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>候选人项目<select disabled={!!initial || !projectId} value={candidateProjectId} onChange={e => setCandidate(e.target.value)}><option value="">不回写项目阶段</option>{candidates.filter(p => p.talentId === talentId).map(p => <option key={p.id} value={p.id}>{p.talent.name} · 当前项目</option>)}</select></label><label>触达战役<select disabled={!!initial} value={campaignId} onChange={e => setCampaignId(e.target.value)}><option value="">不关联战役</option>{campaigns.data?.items.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label></div>
    <label>实际收件邮箱<input required type="email" maxLength={254} value={recipient} readOnly={!!initial} onChange={e => setRecipient(e.target.value)} autoComplete="off" /></label><label>主题<input required maxLength={300} value={subject} onChange={e => setSubject(e.target.value)} /></label><label>正文<textarea required maxLength={50000} rows={12} value={bodyText} onChange={e => setBody(e.target.value)} placeholder="填写已确认的岗位与联系内容" /></label><label>计划发送时间（本地时间，可空）<input type="datetime-local" value={scheduledAt} onChange={e => setSchedule(e.target.value)} /></label><button className="primary-action" disabled={busy || !ownConnections.length} type="submit">保存草稿</button>{!connections.loading && !ownConnections.length && <p>请先在「邮箱连接」中完成授权。</p>}
  </form>;
}

function MessageDetail({ id, canWrite, busy, mutate, revision, onPreview, followUp }: { id: string; canWrite: boolean; busy: boolean; mutate: Mutation; revision: number; onPreview: (id: string) => void; followUp: (m: c.MailMessageDetail) => void }) {
  const result = useRemote(c.mailMessageResponseSchema, `mail/messages/${id}`, revision);
  return <><State {...result} />{result.data && <MessageActions key={`${id}-${result.data.message.version}`} m={result.data.message} canWrite={canWrite} busy={busy} mutate={mutate} onPreview={onPreview} followUp={followUp} />}</>;
}
function MessageActions({ m, canWrite, busy, mutate, onPreview, followUp }: { m: c.MailMessageDetail; canWrite: boolean; busy: boolean; mutate: Mutation; onPreview: (id: string) => void; followUp: (m: c.MailMessageDetail) => void }) {
  const [recipient, setRecipient] = useState(m.recipient), [subject, setSubject] = useState(m.subject), [bodyText, setBody] = useState(m.bodyText), [scheduledAt, setSchedule] = useState(localTime(m.scheduledAt)), [note, setNote] = useState(""), [kind, setKind] = useState("appointment"), [occurredAt, setOccurredAt] = useState(localTime(new Date().toISOString()));
  const editable = canWrite && ["draft", "pending_review", "approved", "rejected", "failed"].includes(m.status);
  const changed = recipient !== m.recipient || subject !== m.subject || bodyText !== m.bodyText || scheduledAt !== localTime(m.scheduledAt);
  const action = (path: string, inputSchema: z.ZodType, input: unknown) => void mutate(async () => { await write(inputSchema, c.mailMessageResponseSchema, `messages/${m.id}/${path}`, input); }, "操作已保存。");
  return <div className="mail-form"><div className="mail-card-heading"><span className={`mail-badge mail-status-${m.status}`}>{statusLabels[m.status]}</span><span>内容 v{m.contentVersion} · 记录 v{m.version}</span></div>{m.lastErrorCode && <p className="mail-error">{errors[m.lastErrorCode]}</p>}<p>人才 {m.talentId}{m.projectId && <> · <Link to={`/search-projects?project=${m.projectId}`}>查看关联寻访项目 ↗</Link></>}</p>
    <form className="mail-form" onSubmit={e => { e.preventDefault(); void mutate(async () => { await write(c.mailDraftUpdateSchema, c.mailMessageResponseSchema, `messages/${m.id}`, { expectedVersion: m.version, recipient, subject, bodyText, scheduledAt: iso(scheduledAt) }, "PATCH"); }, "内容已保存，需要重新提交审批。"); }}>
      <label>实际收件邮箱<input type="email" required readOnly={!editable} value={recipient} maxLength={254} onChange={e => setRecipient(e.target.value)} /></label><label>主题<input required readOnly={!editable} value={subject} maxLength={300} onChange={e => setSubject(e.target.value)} /></label><label>邮件正文<textarea required readOnly={!editable} rows={12} value={bodyText} maxLength={50000} onChange={e => setBody(e.target.value)} /></label><label>计划时间<input type="datetime-local" readOnly={!editable} value={scheduledAt} onChange={e => setSchedule(e.target.value)} /></label>{editable && <button type="submit" disabled={busy || !changed}>保存修改并清除审批</button>}
    </form>{m.approval && <p className="mail-notice">审批：{m.approval.decision === "approved" ? "批准" : "驳回"} · 内容 v{m.approval.contentVersion} · {displayTime(m.approval.reviewedAt)}<br />{m.approval.note}</p>}<div className="mail-detail-meta"><span>发送：{displayTime(m.sentAt)}</span><span>回复：{displayTime(m.repliedAt)}</span><span>尝试：{m.attemptCount}/{m.maxAttempts}</span><span>下次尝试：{displayTime(m.nextAttemptAt)}</span>{m.stopReason && <span>停止原因：{reasons[m.stopReason]}</span>}</div>
    {canWrite && <><label>审批 / 停止 / 反馈原因<textarea rows={2} value={note} maxLength={2000} onChange={e => setNote(e.target.value)} placeholder="至少 3 字；拒绝或退订将停止工作区后续触达" /></label><div className="mail-toolbar">
      {["draft", "rejected"].includes(m.status) && <button disabled={busy || changed} onClick={() => action("submit-review", c.mailSubmitReviewSchema, { expectedVersion: m.version })}>提交审批</button>}
      {m.status === "pending_review" && <>{(["approved", "rejected"] as const).map(decision => <button key={decision} disabled={busy || changed || note.trim().length < 3} onClick={() => action("review", c.mailReviewDecisionSchema, { expectedVersion: m.version, decision, note })}>{decision === "approved" ? "批准当前内容" : "驳回"}</button>)}<small>由项目负责人或管理员审批。</small></>}
      {m.status === "approved" && <button className="primary-action" disabled={busy || changed} onClick={() => onPreview(m.id)}>预览并发送</button>}
      {m.status === "failed" && <button disabled={busy || m.attemptCount >= m.maxAttempts || !["RATE_LIMITED", "AUTH_EXPIRED", "PROVIDER_UNAVAILABLE"].includes(m.lastErrorCode ?? "")} onClick={() => action("retry", c.mailRetryRequestSchema, { expectedVersion: m.version, idempotencyKey: `retry_${m.id}_${m.version}` })}>重新入队</button>}
      {["draft", "pending_review", "approved", "rejected", "queued", "failed"].includes(m.status) && <button disabled={busy || note.trim().length < 3} onClick={() => action("stop", c.mailStopRequestSchema, { expectedVersion: m.version, note })}>停止发送</button>}
      {["sent", "delivered"].includes(m.status) && !m.repliedAt && <button disabled={busy} onClick={() => followUp(m)}>创建跟进草稿</button>}
    </div>{m.sentAt && <div className="mail-filters"><label>人工反馈<select value={kind} onChange={e => setKind(e.target.value)}><option value="appointment">已预约沟通</option><option value="rejected">已拒绝</option><option value="unsubscribed">已退订</option><option value="manual">人工备注</option></select></label><label>发生时间<input required type="datetime-local" value={occurredAt} onChange={e => setOccurredAt(e.target.value)} /></label><button disabled={busy || !occurredAt || note.trim().length < 3} onClick={() => void mutate(async () => { await write(c.mailManualFeedbackCreateSchema, c.mailManualFeedbackResponseSchema, `messages/${m.id}/feedback`, { expectedVersion: m.version, idempotencyKey: `feedback_${m.id}_${m.version}_${kind}`, kind, note, occurredAt: iso(occurredAt) }); }, "反馈已记录，相关寻访阶段与漏斗已更新。")}>记录反馈</button></div>}</>}
  </div>;
}

function Preview({ value, busy, mutate, close }: { value: c.MailSendPreviewResponse; busy: boolean; mutate: Mutation; close: () => void }) {
  const [confirmed, setConfirmed] = useState(false), [bodies, setBodies] = useState<c.MailMessageDetail[]>([]), [error, setError] = useState(""), [loading, setLoading] = useState(true);
  useEffect(() => { const controller = new AbortController(); setLoading(true); setError(""); setConfirmed(false); void Promise.all(value.eligible.map(m => loadMessage(m.messageId, controller.signal))).then(items => {
    if (items.some((item, index) => item.message.version !== value.eligible[index]!.expectedVersion || item.message.contentVersion !== value.eligible[index]!.approvedContentVersion)) throw new Error("邮件内容或状态已变化，请关闭并重新生成预览。");
    if (!controller.signal.aborted) setBodies(items.map(i => i.message));
  }).catch(e => { if (!controller.signal.aborted) setError(errorText(e)); }).finally(() => { if (!controller.signal.aborted) setLoading(false); }); return () => controller.abort(); }, [value]);
  return <div className="mail-form"><p>可发送 {value.eligible.length} 封 · 排除 {value.excluded.length} 封 · 预览有效至 {displayTime(value.expiresAt)}</p><State loading={loading} error={error} />{value.eligible.map(item => <article className="mail-card" key={item.messageId}><strong>{item.recipient}</strong><h3>{item.subject}</h3><small>内容 v{item.approvedContentVersion} · {item.scheduledAt ? displayTime(item.scheduledAt) : "下一个允许的发送时刻"}</small><details><summary>核对完整正文</summary><pre>{bodies.find(m => m.id === item.messageId)?.bodyText}</pre></details></article>)}{value.excluded.length > 0 && <div className="mail-error"><strong>以下记录不会入队</strong>{value.excluded.map(item => <p key={item.messageId}>{item.recipient} · {exclusionLabels[item.reason]}</p>)}</div>}<label className="mail-check"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />我已核对以上收件人、正文和计划，确认提交发送队列。</label><button className="primary-action" disabled={busy || !confirmed || loading || !!error || !value.eligible.length || Date.parse(value.expiresAt) <= Date.now()} onClick={() => void mutate(async () => { await write(c.mailEnqueueRequestSchema, c.mailEnqueueResponseSchema, "send-batches", { previewId: value.previewId, idempotencyKey: `batch_${value.previewId}` }); close(); }, "已加入发送队列，可刷新查看发送结果。")}>确认入队 {value.eligible.length} 封</button></div>;
}

function Replies({ revision, open }: { revision: number; open: (id: string) => void }) {
  const [page, setPage] = useState(1), [classification, setClassification] = useState("");
  const result = useRemote(c.mailReplyListResponseSchema, `mail/replies?${query({ page, classification })}`, revision);
  return <section className="module-section"><div className="mail-filters"><label>回复分类<select value={classification} onChange={e => { setClassification(e.target.value); setPage(1); }}><option value="">全部分类</option>{Object.entries(classifications).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label></div><State {...result} empty={!result.data?.items.length} />{result.data && <><div className="mail-table-wrap"><table><thead><tr><th>发件人 / 主题</th><th>收到时间</th><th>当前分类</th><th>来源</th><th>操作</th></tr></thead><tbody>{result.data.items.map(r => <tr key={r.id}><td><strong>{r.sender}</strong><span>{r.subject}</span></td><td>{displayTime(r.receivedAt)}</td><td>{classifications[r.classification]}</td><td>{{ rule: "规则建议", ai: "AI 建议", human: "人工确认", unclassified: "待处理" }[r.classificationSource]}</td><td><button onClick={() => open(r.id)}>原文与修正</button></td></tr>)}</tbody></table></div><Pagination page={page} total={result.data.total} onPage={setPage} /></>}</section>;
}
function ReplyDetail({ id, revision, canWrite, busy, mutate }: { id: string; revision: number; canWrite: boolean; busy: boolean; mutate: Mutation }) {
  const result = useRemote(c.mailReplyResponseSchema, `mail/replies/${id}`, revision);
  return <><State {...result} />{result.data && <ReplyCorrection key={`${id}-${result.data.reply.version}`} reply={result.data.reply} canWrite={canWrite} busy={busy} mutate={mutate} />}</>;
}
function ReplyCorrection({ reply, canWrite, busy, mutate }: { reply: c.MailReplyDetail; canWrite: boolean; busy: boolean; mutate: Mutation }) {
  const [classification, setClassification] = useState(reply.classification), [note, setNote] = useState(""), [nextActionAt, setNextActionAt] = useState("");
  return <div className="mail-form"><h3>{reply.subject}</h3><p>{reply.sender} · {displayTime(reply.receivedAt)}</p><p>初始建议：{classifications[reply.suggestedClassification]} · 当前：{classifications[reply.classification]} · {reply.classificationSource === "human" ? "人工确认" : reply.classificationSource === "rule" ? "规则建议" : "待人工确认"}</p><pre className="mail-original">{reply.bodyText ?? `原文已按保留期删除（${displayTime(reply.contentDeletedAt)}）`}</pre>{reply.concerns.length > 0 && <p>{reply.concerns.join("；")}</p>}{reply.reviewNote && <p>上次修正：{reply.reviewNote} · {displayTime(reply.reviewedAt)}</p>}{reply.projectId && <Link to={`/search-projects?project=${reply.projectId}`}>查看关联寻访项目 ↗</Link>}{canWrite && <form className="mail-form" onSubmit={e => { e.preventDefault(); void mutate(async () => { await write(c.mailFeedbackCorrectionSchema, c.mailFeedbackCorrectionResponseSchema, `replies/${reply.id}/feedback`, { expectedVersion: reply.version, classification, note, nextActionAt: iso(nextActionAt) }, "PATCH"); }, "分类已修正，项目阶段与漏斗已更新。已有排除名单将保留。"); }}><label>人工分类<select value={classification} onChange={e => setClassification(e.target.value as c.MailReplyClassification)}>{Object.entries(classifications).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label>下一次行动（本地时间）<input type="datetime-local" value={nextActionAt} onChange={e => setNextActionAt(e.target.value)} /></label><label>修正理由<textarea required minLength={3} maxLength={2000} rows={3} value={note} onChange={e => setNote(e.target.value)} /></label><p>拒绝 / 退订会停止工作区后续触达；更正分类后，已关闭项目和排除名单需单独处理。</p><button type="submit" disabled={busy || note.trim().length < 3}>保存人工分类</button></form>}</div>;
}

function Suppressions({ revision, canWrite, busy, mutate }: { revision: number; canWrite: boolean; busy: boolean; mutate: Mutation }) {
  const [page, setPage] = useState(1), [q, setQ] = useState(""), [email, setEmail] = useState(""), [talentId, setTalentId] = useState(""), [note, setNote] = useState(""), [reason, setReason] = useState("manual");
  const result = useRemote(c.mailSuppressionListResponseSchema, `mail/suppressions?${query({ page, q })}`, revision);
  return <section className="module-section"><h2>工作区排除名单</h2><p>跨邮箱、战役和项目生效。拒绝和退订会结束相应寻访；名单不自动解除。</p>{canWrite && <details className="mail-card"><summary>手动添加排除记录</summary><form className="mail-form" onSubmit={e => { e.preventDefault(); void mutate(async () => { await write(c.mailSuppressionCreateSchema, c.mailSuppressionSchema, "suppressions", { email, talentId: talentId || null, reason, note }); setEmail(""); setTalentId(""); setNote(""); }, "排除记录已保存，未发触达已停止。"); }}><div className="mail-form-grid"><label>邮箱<input type="email" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} /></label><label>人才 ID（可空）<input value={talentId} maxLength={80} onChange={e => setTalentId(e.target.value)} /></label><label>原因类型<select value={reason} onChange={e => setReason(e.target.value)}><option value="manual">人工排除</option><option value="rejected">拒绝</option><option value="unsubscribed">退订</option></select></label></div><label>说明<textarea required minLength={3} maxLength={2000} value={note} onChange={e => setNote(e.target.value)} /></label><button disabled={busy || note.trim().length < 3} type="submit">添加并停止后续触达</button></form></details>}<div className="mail-filters"><label>搜索邮箱<input maxLength={200} value={q} onChange={e => { setQ(e.target.value); setPage(1); }} /></label></div><State {...result} empty={!result.data?.items.length} />{result.data && <><div className="mail-table-wrap"><table><thead><tr><th>邮箱 / 人才</th><th>原因</th><th>说明</th><th>添加时间</th></tr></thead><tbody>{result.data.items.map(s => <tr key={s.id}><td>{s.email}<small>{s.talentId ?? "仅此邮箱"}</small></td><td>{reasons[s.reason]}</td><td>{s.note}</td><td>{displayTime(s.createdAt)}</td></tr>)}</tbody></table></div><Pagination page={page} total={result.data.total} onPage={setPage} /></>}</section>;
}
function Funnel({ revision }: { revision: number }) {
  const [from, setFrom] = useState(() => new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)), [to, setTo] = useState(() => new Date(Date.now() + 86400000).toISOString().slice(0, 10)), [projectId, setProject] = useState(""), [campaignId, setCampaign] = useState(""), [ownerId, setOwner] = useState(""), [templateId, setTemplate] = useState("");
  const result = useRemote(c.mailFunnelResponseSchema, `mail/funnel?${query({ from: from ? new Date(`${from}T00:00:00`).toISOString() : "", to: to ? new Date(`${to}T00:00:00`).toISOString() : "", projectId, campaignId, ownerId, templateId })}`, revision);
  const metrics = { sent: "已发送", delivered: "确认送达", replied: "已回复", effectiveReplies: "有效回复", appointments: "预约沟通", rejected: "拒绝", bounced: "退信", unsubscribed: "退订", manualFeedback: "人工备注" } as const;
  return <section className="module-section"><h2>触达漏斗</h2><p>统计所选期间首次发送的邮件及其后续反馈；每项按邮件去重。送达仅计算供应商确认的证据。</p><div className="mail-filters"><label>发送起始日<input type="date" value={from} onChange={e => setFrom(e.target.value)} /></label><label>结束日（不含）<input type="date" value={to} onChange={e => setTo(e.target.value)} /></label>{[["项目 ID", projectId, setProject], ["战役 ID", campaignId, setCampaign], ["负责人 ID", ownerId, setOwner], ["模板 ID", templateId, setTemplate]].map(([label, value, setter]) => <label key={String(label)}>{String(label)}<input value={String(value)} onChange={e => (setter as (v: string) => void)(e.target.value)} /></label>)}</div><State {...result} />{result.data && <><div className="mail-metrics">{Object.entries(metrics).map(([key, label]) => <article key={key}><small>{label}</small><strong>{result.data![key as keyof typeof metrics]}</strong></article>)}</div><p className="mail-muted">统计截至 {displayTime(result.data.asOf)} · 按首次发送时间归组</p></>}</section>;
}
