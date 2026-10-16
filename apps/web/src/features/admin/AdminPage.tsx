import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, RefreshCw, Save, Search, Shield, Users, BookOpen, History, Pencil, Power, X } from "lucide-react";
import type { AdminUser, DictionaryItem, AuditLog, AdminRole } from "@hr-console/contracts";
import { adminWrite, loadMe, loadRoles, loadUsers, loadDictionaries, loadLogs } from "./admin-api";
import "./admin.css";

const tabs = [{ code: "users", name: "用户", icon: Users }, { code: "roles", name: "角色与权限", icon: Shield }, { code: "dictionaries", name: "字典", icon: BookOpen }, { code: "logs", name: "操作日志", icon: History }] as const;
type Tab = typeof tabs[number]["code"];
const roleNames = { admin: "超级管理员", hr: "HR / 招聘负责人", manager: "业务管理者" };

export function AdminPage() {
  const [tab, setTab] = useState<Tab>("users");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [dictionaries, setDictionaries] = useState<DictionaryItem[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [canWrite, setCanWrite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [revision, setRevision] = useState(0);
  const [editor, setEditor] = useState<"new" | AdminUser | DictionaryItem | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void loadMe(controller.signal).then((me) => setCanWrite(me.permissions.includes("admin:write"))).catch(() => setCanWrite(false));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(page), pageSize: "20" });
    if (q) params.set("q", q);
    if (filter) params.set(tab === "users" ? "role" : tab === "dictionaries" ? "group" : "action", filter);
    if (tab === "users" && status) params.set("status", status);
    setLoading(true); setError("");
    const request = tab === "roles" ? loadRoles(controller.signal).then(setRoles) : tab === "users" ? loadUsers(params.toString(), controller.signal).then((data) => { setUsers(data.items); setTotal(data.total); }) : tab === "dictionaries" ? loadDictionaries(params.toString(), controller.signal).then((data) => { setDictionaries(data.items); setTotal(data.total); }) : loadLogs(params.toString(), controller.signal).then((data) => { setLogs(data.items); setTotal(data.total); });
    void request.catch((reason: unknown) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "加载失败，请重试"); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [tab, page, q, filter, status, revision]);

  async function write(path: string, method: "POST" | "PATCH", input: unknown) {
    setBusy(true); setMessage(""); setError("");
    try { await adminWrite(path, method, input); setLoading(true); setMessage("已保存"); setEditor(null); setRevision((value) => value + 1); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "保存失败，请重试"); }
    finally { setBusy(false); }
  }

  return <div className="admin-page"><div className="page-heading"><span className="eyebrow">ADMINISTRATION</span><h1><Shield size={28} />管理台</h1></div>
    <div className="admin-tabs" role="tablist" aria-label="管理视图" onKeyDown={(event) => { const index = tabs.findIndex((item) => item.code === tab); const next = event.key === "ArrowRight" ? (index + 1) % tabs.length : event.key === "ArrowLeft" ? (index + tabs.length - 1) % tabs.length : event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : -1; if (next < 0) return; event.preventDefault(); const button = event.currentTarget.querySelectorAll<HTMLButtonElement>("button")[next]; button?.click(); button?.focus(); }}>{tabs.map((item) => <button key={item.code} id={`tab-${item.code}`} role="tab" tabIndex={tab === item.code ? 0 : -1} aria-selected={tab === item.code} aria-controls="admin-panel" onClick={() => { setTab(item.code); setPage(1); setQ(""); setSearch(""); setFilter(""); setStatus(""); setEditor(null); setMessage(""); }}><item.icon size={16} />{item.name}</button>)}</div>
    <section id="admin-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
      {tab !== "roles" && <form className="admin-toolbar" onSubmit={(event) => { event.preventDefault(); setQ(search.trim()); setPage(1); }}>
        {tab !== "logs" && <><input aria-label="搜索管理记录" placeholder={tab === "users" ? "姓名或邮箱" : "字典编码或名称"} value={search} onChange={(event) => setSearch(event.target.value)} /><button className="icon-button" title="搜索" aria-label="搜索" type="submit"><Search size={17} /></button></>}
        {tab === "users" ? <><select aria-label="角色筛选" value={filter} onChange={(event) => { setFilter(event.target.value); setPage(1); }}><option value="">全部角色</option>{Object.entries(roleNames).map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select><select aria-label="账户状态" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="">全部状态</option><option value="active">启用</option><option value="disabled">停用</option></select></> : <input aria-label={tab === "logs" ? "审计动作" : "字典分组"} placeholder={tab === "logs" ? "动作，例如 patch.admin" : "字典分组"} value={filter} onChange={(event) => { setFilter(event.target.value); setPage(1); }} />}
        <button className="icon-button" type="button" aria-label="刷新" title="刷新" onClick={() => setRevision((value) => value + 1)}><RefreshCw size={16} /></button>
        {canWrite && tab !== "logs" && <button className="admin-action" type="button" onClick={() => setEditor("new")}><Plus size={15} />{tab === "users" ? "新增用户" : "新增字典"}</button>}
      </form>}
      {editor && <form className="admin-form" key={typeof editor === "string" ? `${tab}-new` : editor.id} onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); const input = tab === "users" ? editor === "new" ? { name: form.get("name"), email: form.get("email"), role: form.get("role") } : { role: form.get("role") } : editor === "new" ? { group: form.get("group"), code: form.get("code"), label: form.get("label") } : { label: form.get("label") }; void write(`admin/${tab}${editor === "new" ? "" : `/${editor.id}`}`, editor === "new" ? "POST" : "PATCH", input); }}>
        <h2>{editor === "new" ? "新增" : "编辑"}{tab === "users" ? "用户" : "字典"}</h2>
        {tab === "users" ? <>{editor === "new" && <><label>姓名<input autoFocus name="name" required maxLength={120} /></label><label>邮箱<input name="email" type="email" required /></label></>}<label>角色<select name="role" defaultValue={editor !== "new" && "role" in editor ? editor.role : "hr"}>{Object.entries(roleNames).map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select></label></> : <>{editor === "new" && <><label>分组<input autoFocus name="group" required maxLength={80} /></label><label>编码<input name="code" required pattern="[a-z0-9-]{1,80}" maxLength={80} /></label></>}<label>名称<input name="label" required maxLength={120} defaultValue={editor !== "new" && "label" in editor ? editor.label : ""} /></label></>}
        <button className="admin-action" disabled={busy} type="submit"><Save size={15} />保存</button><button className="icon-button" type="button" aria-label="取消编辑" title="取消编辑" disabled={busy} onClick={() => setEditor(null)}><X size={16} /></button>
      </form>}
      {error && <div className="admin-feedback" role="alert">{error} <button className="admin-action" onClick={() => setRevision((value) => value + 1)}>重试</button></div>}{message && <div role="status" className="admin-feedback">{message}</div>}
      {loading && !error ? <div className="admin-empty" role="status">正在加载…</div> : !error && <div className="admin-table-wrap"><table className="admin-table"><thead><tr>{(tab === "users" ? ["用户", "角色", "状态", "更新时间", "操作"] : tab === "roles" ? ["角色", "资源权限"] : tab === "dictionaries" ? ["分组", "编码", "名称", "状态", "操作"] : ["操作者", "动作", "资源", "记录 ID", "时间"]).map((name) => <th scope="col" key={name}>{name}</th>)}</tr></thead><tbody>
        {tab === "users" && users.map((user) => <tr key={user.id}><td>{user.name}<small>{user.email}</small></td><td>{roleNames[user.role]}</td><td><span className={`admin-status ${user.status}`}>{user.status === "active" ? "启用" : "停用"}</span></td><td>{new Date(user.updatedAt).toLocaleString("zh-CN")}</td><td>{canWrite && <><button className="icon-button" disabled={busy} title="编辑角色" aria-label={`编辑${user.name}角色`} onClick={() => setEditor(user)}><Pencil size={15} /></button><button className="icon-button" disabled={busy} title={user.status === "active" ? "停用" : "启用"} aria-label={`${user.status === "active" ? "停用" : "启用"}${user.name}`} onClick={() => void write(`admin/users/${user.id}`, "PATCH", { status: user.status === "active" ? "disabled" : "active" })}><Power size={15} /></button></>}</td></tr>)}
        {tab === "roles" && roles.map((role) => <tr key={role.code}><td>{role.name}<small>{role.code}</small></td><td><div className="admin-permissions">{role.permissions.map((permission) => <span key={permission}>{permission}</span>)}</div></td></tr>)}
        {tab === "dictionaries" && dictionaries.map((item) => <tr key={item.id}><td>{item.group}</td><td>{item.code}</td><td>{item.label}</td><td><span className={`admin-status ${item.enabled ? "active" : "disabled"}`}>{item.enabled ? "启用" : "停用"}</span></td><td>{canWrite && <><button className="icon-button" disabled={busy} title="编辑字典" aria-label={`编辑${item.label}`} onClick={() => setEditor(item)}><Pencil size={15} /></button><button className="icon-button" disabled={busy} title={item.enabled ? "停用" : "启用"} aria-label={`${item.enabled ? "停用" : "启用"}${item.label}`} onClick={() => void write(`admin/dictionaries/${item.id}`, "PATCH", { enabled: !item.enabled })}><Power size={15} /></button></>}</td></tr>)}
        {tab === "logs" && logs.map((log) => <tr key={log.id}><td>{log.actorName}</td><td>{log.action}</td><td>{log.resource}</td><td>{log.resourceId ?? "—"}<small>{log.requestId}</small></td><td>{new Date(log.createdAt).toLocaleString("zh-CN")}</td></tr>)}
      </tbody></table>{!(tab === "roles" ? roles.length : tab === "users" ? users.length : tab === "dictionaries" ? dictionaries.length : logs.length) && <div className="admin-empty">暂无记录</div>}</div>}
      {tab !== "roles" && <div className="admin-pagination"><span>共 {total} 条 · 第 {page} 页</span><button className="icon-button" title="上一页" aria-label="上一页" disabled={page === 1 || loading} onClick={() => setPage(page - 1)}><ChevronLeft size={17} /></button><button className="icon-button" title="下一页" aria-label="下一页" disabled={page * 20 >= total || loading} onClick={() => setPage(page + 1)}><ChevronRight size={17} /></button></div>}
    </section></div>;
}
