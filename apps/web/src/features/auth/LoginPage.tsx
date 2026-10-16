import { useState } from "react";
import { ArrowRight, KeyRound, Radar } from "lucide-react";
import type { MeResponse } from "@hr-console/contracts";
import { login } from "./auth-api";
import "./auth.css";

export function LoginPage({ onLogin }: { onLogin: (user: MeResponse) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try { onLogin(await login({ email, password })); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "登录失败，请重试"); }
    finally { setBusy(false); }
  }

  return <main className="login-page"><section className="login-panel"><div className="login-brand"><span className="login-mark"><Radar size={24} /></span><span><strong>TalentNexus</strong><small>AI TALENT OPERATIONS</small></span></div><div className="login-heading"><span className="eyebrow">WELCOME BACK</span><h1>进入人才智能运营台</h1><p>连接人才信号、运营动作和市场决策。</p></div><form onSubmit={submit}><label>邮箱<input autoComplete="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@company.com" required /></label><label>密码<input autoComplete="current-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="请输入密码" minLength={8} required /></label>{error && <div className="login-error" role="alert">{error}</div>}<button className="login-submit" disabled={busy} type="submit"><KeyRound size={16} />{busy ? "登录中..." : "登录 TalentNexus"}<ArrowRight size={16} /></button></form><p className="login-footnote">登录后，偏好设置、操作记录和工作台数据会保存到云端数据库。</p></section></main>;
}
