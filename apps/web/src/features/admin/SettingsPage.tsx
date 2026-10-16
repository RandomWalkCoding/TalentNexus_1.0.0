import { useEffect, useState } from "react";
import { CheckCircle2, CircleAlert, Cloud, Moon, Sun, Settings, Save } from "lucide-react";
import { compensationCurrencySchema, compensationLocationSchema, preferencesSchema } from "@hr-console/contracts";
import type { Preferences } from "@hr-console/contracts";
import { adminWrite, loadMe } from "./admin-api";
import { getStorageStatus } from "./storage-api";
import "./admin.css";

const locationNames: Record<string, string> = { beijing: "北京", shanghai: "上海", shenzhen: "深圳", guangzhou: "广州", "hong-kong": "香港", singapore: "新加坡", "united-states": "美国", japan: "日本", "south-korea": "韩国", germany: "德国", "united-kingdom": "英国", uae: "阿联酋", "saudi-arabia": "沙特阿拉伯", france: "法国" };
type Props = { theme: Preferences["theme"]; density: Preferences["density"]; setTheme: (value: Preferences["theme"]) => void; setDensity: (value: Preferences["density"]) => void };

export function SettingsPage({ theme, density, setTheme, setDensity }: Props) {
  const [preferences, setPreferences] = useState<Preferences>({ theme, density, notifications: true, defaultLocation: "beijing", defaultCurrency: "CNY" });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [canWrite, setCanWrite] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [storage, setStorage] = useState<Awaited<ReturnType<typeof getStorageStatus>> | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    void Promise.all([loadMe(controller.signal), getStorageStatus(controller.signal)]).then(([me, status]) => { setPreferences(me.preferences); setTheme(me.preferences.theme); setDensity(me.preferences.density); setCanWrite(me.permissions.includes("settings:write")); setStorage(status); }).catch((reason: unknown) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "加载失败，请重试"); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [revision, setTheme, setDensity]);

  async function save() {
    setBusy(true); setError(""); setMessage("");
    try { const result = await adminWrite("me/preferences", "PATCH", { ...preferences, theme, density }); setPreferences(preferencesSchema.parse(result.preferences)); setMessage("偏好已保存"); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "保存失败，请重试"); }
    finally { setBusy(false); }
  }
  return <div className="preferences-page"><div className="page-heading"><span className="eyebrow">PREFERENCES</span><h1><Settings size={28} />设置</h1></div>
    {loading && <p className="admin-feedback" role="status">正在加载…</p>}{error && <p role="alert" className="admin-feedback">{error} <button className="admin-action" onClick={() => setRevision((value) => value + 1)}>重试</button></p>}
    <section className="settings-section"><h2>外观</h2><div className="setting-row"><strong>主题</strong><div className="segmented" aria-label="主题"><button type="button" aria-pressed={theme === "dark"} onClick={() => setTheme("dark")}><Moon size={15} />深色</button><button type="button" aria-pressed={theme === "light"} onClick={() => setTheme("light")}><Sun size={15} />浅色</button></div></div><div className="setting-row"><strong>显示密度</strong><div className="segmented" aria-label="显示密度"><button type="button" aria-pressed={density === "comfortable"} onClick={() => setDensity("comfortable")}>舒适</button><button type="button" aria-pressed={density === "compact"} onClick={() => setDensity("compact")}>紧凑</button></div></div></section>
    <section className="settings-section"><h2>工作偏好</h2><div className="setting-row"><label htmlFor="notifications">通知</label><input id="notifications" type="checkbox" checked={preferences.notifications} disabled={loading || busy || !canWrite} onChange={(event) => setPreferences({ ...preferences, notifications: event.target.checked })} /></div><div className="setting-row"><label htmlFor="default-location">默认地区</label><select id="default-location" value={preferences.defaultLocation} disabled={loading || busy || !canWrite} onChange={(event) => setPreferences({ ...preferences, defaultLocation: event.target.value as Preferences["defaultLocation"] })}>{compensationLocationSchema.options.map((location) => <option key={location} value={location}>{locationNames[location]}</option>)}</select></div><div className="setting-row"><label htmlFor="default-currency">默认币种</label><select id="default-currency" value={preferences.defaultCurrency} disabled={loading || busy || !canWrite} onChange={(event) => setPreferences({ ...preferences, defaultCurrency: event.target.value as Preferences["defaultCurrency"] })}>{compensationCurrencySchema.options.map((currency) => <option key={currency}>{currency}</option>)}</select></div></section>
    <section className="settings-section storage-section"><div className="storage-heading"><div><h2>云端存储</h2><p>工作区数据持续保存到 TalentNexus 的云端数据库。</p></div>{storage?.connected ? <span className="storage-status connected"><CheckCircle2 size={15} />已连接</span> : <span className="storage-status"><CircleAlert size={15} />连接检查中</span>}</div><div className="storage-provider"><Cloud size={18} /><div><strong>PostgreSQL 云端数据库</strong><span>{storage?.lastSyncedAt ? `最近同步 ${new Date(storage.lastSyncedAt).toLocaleString("zh-CN")}` : "正在检查数据库连接"}</span></div></div><div className="storage-scopes">{(storage?.scopes ?? ["用户与权限", "个人偏好", "通知", "操作日志", "业务数据"]).map((scope) => <span key={scope}>{scope}</span>)}</div></section>
    <button type="button" className="admin-action" disabled={loading || busy || !canWrite} onClick={() => void save()}><Save size={15} />{busy ? "保存中…" : "保存偏好"}</button>{message && <p role="status" className="admin-feedback">{message}</p>}
  </div>;
}
