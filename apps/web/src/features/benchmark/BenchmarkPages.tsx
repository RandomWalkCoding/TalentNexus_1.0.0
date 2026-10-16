import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { BenchmarkFilter, BenchmarkStructure, CompetitivenessReport, CompensationLocation, LevelMapping } from "@hr-console/contracts";
import { getStructure, getLevelMappings, reviewLevelMapping, compareCompetitiveness, exportBenchmark } from "./benchmark-api";
import "./benchmark.css";

const regions: [CompensationLocation, string][] = [["beijing", "北京"], ["shanghai", "上海"], ["shenzhen", "深圳"], ["singapore", "新加坡"], ["united-states", "美国"]];
const money = (value: number | null, currency: string) => value === null ? "数据不足 / 未估值" : `${currency} ${value.toLocaleString("zh-CN", { maximumFractionDigits: 2 })}`;
const labels = { pending: "待审核", confirmed: "已确认", rejected: "已驳回" };
const positions = { "below-p25": "低于 P25", "p25-p50": "P25–P50", "p50-p75": "P50–P75", "above-p75": "高于或等于 P75" };

function Navigation() {
  return <nav className="benchmark-nav" aria-label="薪酬与对标"><Link to="/compensation">薪酬计算器</Link><Link to="/compensation/analysis">薪酬结构</Link><Link to="/compensation/calculation-analysis">计算分析</Link><Link to="/job-levels/benchmarks">职级对标审核</Link><Link to="/compensation/competitiveness">地区竞争力</Link></nav>;
}
function Heading({ title, description }: { title: string; description: string }) {
  return <><div className="page-heading"><span className="eyebrow">COMPENSATION INTELLIGENCE</span><h1>{title}</h1><p>{description}</p></div><Navigation /></>;
}
function Filters({ value, onChange }: { value: Partial<BenchmarkFilter>; onChange: (value: Partial<BenchmarkFilter>) => void }) {
  return <div className="benchmark-filters">
    <label>公司<input value={value.company ?? ""} placeholder="全部公司" onChange={e => onChange({ ...value, company: e.target.value })} /></label>
    <label>岗位<input value={value.role ?? ""} placeholder="全部岗位" onChange={e => onChange({ ...value, role: e.target.value })} /></label>
    <label>地区<select value={value.location ?? ""} onChange={e => onChange({ ...value, location: (e.target.value || undefined) as CompensationLocation | undefined })}><option value="">全部地区</option>{regions.map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select></label>
    <label>职级<input value={value.levelCode ?? ""} placeholder="全部职级" onChange={e => onChange({ ...value, levelCode: e.target.value || undefined })} /></label>
    <label>序列<select value={value.series ?? ""} onChange={e => onChange({ ...value, series: (e.target.value || undefined) as BenchmarkFilter["series"] })}><option value="">全部序列</option>{["EX", "M", "P", "S", "T", "U", "W"].map(s => <option key={s}>{s}</option>)}</select></label>
    <label>样本截止<input type="date" value={value.asOfDate ?? "2026-10-14"} onChange={e => onChange({ ...value, asOfDate: e.target.value })} /></label>
    <label>市场口径<select value={value.metric ?? "totalCash"} onChange={e => onChange({ ...value, metric: e.target.value as BenchmarkFilter["metric"] })}><option value="totalCash">年度税前总现金</option><option value="base">年度基本工资</option></select></label>
  </div>;
}
function State({ loading, error, empty, retry }: { loading: boolean; error: string; empty: boolean; retry: () => void }) {
  if (loading) return <div className="benchmark-state" role="status">正在读取数据…</div>;
  if (error) return <div className="benchmark-state" role="alert"><p>{error}</p><button onClick={retry}>重试</button></div>;
  if (empty) return <div className="benchmark-state">暂无符合条件的数据，请调整筛选。</div>;
  return null;
}

export function BenchmarkStructurePage() {
  const [filters, setFilters] = useState<Partial<BenchmarkFilter>>({});
  const [data, setData] = useState<BenchmarkStructure | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(""); setData(null);
    const timer = window.setTimeout(() => {
      void getStructure(filters, controller.signal).then(result => { if (!controller.signal.aborted) setData(result); }).catch((err: Error) => { if (!controller.signal.aborted) setError(err.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 180);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [filters, revision]);
  return <section className="benchmark-page"><Heading title="薪酬结构分析" description="年度税前样本 · 区分实际奖金、目标奖金与股权估值" /><Filters value={filters} onChange={setFilters} />
    <State loading={loading} error={error} empty={!data?.groups.length} retry={() => setRevision(r => r + 1)} />
    {data && <><div className="benchmark-meta"><span>演示样本 · 最低有效样本 {data.minimumSampleCount} 个 · {data.calculationVersion}</span><button disabled={!data.groups.length} onClick={() => exportBenchmark(data)}>导出结构快照</button></div>
      <div className="benchmark-grid">{data.groups.map(group => <article className="benchmark-card" key={`${group.location}:${group.currency}:${group.levelCode}:${group.series}:${group.role}`}>
        <span className="eyebrow">{regions.find(([code]) => code === group.location)?.[1] ?? group.location} · {group.levelCode}</span><h2>{group.role}</h2><p>{group.sampleCount} 个样本 / {group.eligibleCount} 个有效样本 · {group.sampleDate}</p>
        <div className="benchmark-metrics"><div><small>年度总现金（均值）</small><strong>{money(group.totalCash, group.currency)}</strong></div><div><small>雇主总成本（含股权）</small><strong>{money(group.employerCost, group.currency)}</strong></div></div>
        <div className="benchmark-bars" aria-label="薪酬组成">{group.components.map(part => <div key={part.key}><span>{part.label}</span><meter min={0} max={100} value={part.share ?? 0} aria-label={`${part.label}占比`} /><span>{money(part.amount, group.currency)}{part.share !== null ? ` · ${part.share}%` : ""}</span></div>)}</div>
        <div className="benchmark-percentiles">{(["p25", "p50", "p75"] as const).map(key => <div key={key}><small>{key.toUpperCase()}</small><strong>{money(group[key], group.currency)}</strong></div>)}</div>
        {group.insufficient && <p className="benchmark-warning">数据不足：未达到 {data.minimumSampleCount} 个有效样本，不输出分位数。</p>}
        {group.missing.length > 0 && <p className="benchmark-warning">缺失项：{group.missing.join("、")}</p>}
      </article>)}</div>
      <details className="benchmark-card"><summary>样本来源与奖金说明（{data.samples.length}）</summary><div className="benchmark-table-wrap"><table><thead><tr><th>公司 / 岗位</th><th>地区 / 周期</th><th>基本工资</th><th>目标奖金</th><th>实际奖金</th><th>股权估值</th><th>来源许可</th></tr></thead><tbody>{data.samples.map(s => <tr key={s.id}><td>{s.company}<br />{s.role} · {s.levelCode}</td><td>{s.location}<br />年度税前 · {s.sampleDate}</td><td>{money(s.base, s.currency)}</td><td>{money(s.bonusTarget, s.currency)}</td><td>{money(s.bonusActual, s.currency)}</td><td>{s.equity === null ? "未估值" : money(s.equity, s.currency)}</td><td><a href={s.sourceUrl} target="_blank" rel="noreferrer">{s.source}</a><br />{s.license}</td></tr>)}</tbody></table></div></details>
      <p className="benchmark-meta">快照 {data.snapshotId} · 分位数采用线性插值；总现金仅含基本工资、实际奖金和现金津贴。股权未估值时保留缺失。</p>
    </>}
  </section>;
}

export function LevelBenchmarkPage({ canWrite = true }: { canWrite?: boolean }) {
  const [filters, setFilters] = useState<Partial<BenchmarkFilter>>({});
  const [items, setItems] = useState<LevelMapping[]>([]);
  const [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [revision, setRevision] = useState(0), [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({}), [choices, setChoices] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(""); setItems([]);
    const timer = window.setTimeout(() => {
      void getLevelMappings(filters, controller.signal).then(result => { if (!controller.signal.aborted) setItems(result.items); }).catch((err: Error) => { if (!controller.signal.aborted) setError(err.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 180);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [filters, revision]);
  async function review(item: LevelMapping, status: "confirmed" | "rejected") {
    setBusy(item.id); setNotice("");
    try {
      await reviewLevelMapping(item.id, { expectedVersion: item.version, status, ...(status === "confirmed" ? { selectedLevel: choices[item.id] ?? item.candidateLevels[0]! } : {}), note: notes[item.id] ?? "" });
      setNotice("审核已保存，历史版本可追溯。"); setRevision(r => r + 1);
    } catch (err) { setNotice(err instanceof Error ? err.message : "审核失败"); }
    finally { setBusy(null); }
  }
  return <section className="benchmark-page"><Heading title="职级对标审核" description="外部职级 → 内部候选职级 · 来源证据、置信度与人工确认" /><Filters value={filters} onChange={setFilters} />
    {!canWrite && <p className="benchmark-warning">当前角色只读，可查看证据与审核历史。</p>}{notice && <p role="status">{notice}</p>}
    <State loading={loading} error={error} empty={!items.length} retry={() => setRevision(r => r + 1)} />
    <div className="benchmark-grid">{items.map(item => <article className="benchmark-card" key={item.id}><span className="eyebrow">{item.company} · {item.location} · {item.series}</span><h2>{item.externalLevel} → {item.selectedLevel ?? item.candidateLevels.join(" / ")}</h2><p>{item.role} · 置信度 {item.confidence}% · {labels[item.status]} · v{item.version}</p><p>{item.rationale}</p>
      {item.evidenceUrl ? <a href={item.evidenceUrl} target="_blank" rel="noreferrer">查看来源证据 ↗</a> : <p className="benchmark-warning">无来源证据，暂不可确认。</p>}
      <label>确认职级<select value={choices[item.id] ?? item.selectedLevel ?? item.candidateLevels[0]} onChange={e => setChoices({ ...choices, [item.id]: e.target.value })} disabled={!canWrite || busy !== null}>{item.candidateLevels.map(level => <option key={level}>{level}</option>)}</select></label>
      <label>审核备注<textarea value={notes[item.id] ?? ""} onChange={e => setNotes({ ...notes, [item.id]: e.target.value })} minLength={3} maxLength={1000} placeholder="至少 3 字，记录确认或驳回依据" disabled={!canWrite || busy !== null} /></label>
      <div className="benchmark-actions"><button disabled={!canWrite || busy !== null || !item.evidenceUrl || (notes[item.id]?.trim().length ?? 0) < 3} onClick={() => void review(item, "confirmed")}>{busy === item.id ? "保存中…" : "确认映射"}</button><button disabled={!canWrite || busy !== null || (notes[item.id]?.trim().length ?? 0) < 3} onClick={() => void review(item, "rejected")}>驳回</button></div>
      <details><summary>历史记录（{item.history.length}）</summary>{item.history.map(h => <p key={h.version}>v{h.version} · {h.status} · {h.selectedLevel ?? "无"}<br />{h.note}<br />{h.createdAt} · 操作者 {h.actorId}</p>)}</details>
    </article>)}</div>
  </section>;
}

export function CompetitivenessPage() {
  const [regionA, setRegionA] = useState<CompensationLocation>("beijing"), [regionB, setRegionB] = useState<CompensationLocation>("singapore");
  const [cashA, setCashA] = useState("570000"), [cashB, setCashB] = useState("160000");
  const [budget, setBudget] = useState("700000"), [role, setRole] = useState("产品经理"), [levelCode, setLevel] = useState("P4");
  const [target, setTarget] = useState<"p25" | "p50" | "p75">("p50"), [asOfDate, setAsOfDate] = useState("2026-10-14");
  const [report, setReport] = useState<CompetitivenessReport | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function calculate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setReport(null);
    try {
      const result = await compareCompetitiveness({ role, levelCode, metric: "totalCash", asOfDate, target,
        plans: [{ name: "A", location: regionA, annualCash: Number(cashA), employerBudget: Number(budget) }, { name: "B", location: regionB, annualCash: Number(cashB) }] });
      setReport(result);
    } catch (err) { setError(err instanceof Error ? err.message : "计算失败"); }
    finally { setBusy(false); }
  }
  return <section className="benchmark-page"><Heading title="地区薪酬竞争力" description="方案 A/B · 本币、名义汇率与购买力并排 · 税费估算" />
    <form className="benchmark-card benchmark-form" onSubmit={event => void calculate(event)}>
      <div className="benchmark-filters"><label>岗位<input required value={role} onChange={e => setRole(e.target.value)} /></label><label>职级<input required value={levelCode} onChange={e => setLevel(e.target.value)} /></label><label>目标分位<select value={target} onChange={e => setTarget(e.target.value as typeof target)}><option value="p25">P25</option><option value="p50">P50</option><option value="p75">P75</option></select></label><label>样本截止<input required type="date" value={asOfDate} onChange={e => setAsOfDate(e.target.value)} /></label></div>
      <div className="benchmark-plan-inputs"><fieldset><legend>方案 A</legend><label>地区 A<select value={regionA} onChange={e => setRegionA(e.target.value as CompensationLocation)}>{regions.map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select></label><label>年总现金 A（本币）<input required type="number" min="0" max="1000000000" step="0.01" value={cashA} onChange={e => setCashA(e.target.value)} /></label><label>雇主预算 A（本币）<input required type="number" min="0" max="1000000000" step="0.01" value={budget} onChange={e => setBudget(e.target.value)} /></label></fieldset>
      <fieldset><legend>方案 B</legend><label>地区 B<select value={regionB} onChange={e => setRegionB(e.target.value as CompensationLocation)}>{regions.map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select></label><label>年总现金 B（本币）<input required type="number" min="0" max="1000000000" step="0.01" value={cashB} onChange={e => setCashB(e.target.value)} /></label><p>支持同地区 A/B 比较；更换地区后请核对本币输入。</p></fieldset></div>
      <button disabled={busy} type="submit">{busy ? "计算中…" : "生成比较快照"}</button>
    </form>
    {error && <p role="alert" className="benchmark-warning">{error}</p>}
    {!report && !busy && !error && <p className="benchmark-state">输入方案后生成报告，图表与导出共享同一快照。</p>}
    {report && <><div className="benchmark-meta"><span>已生成方案：{report.input.role} · {report.input.levelCode} · 样本截止 {report.input.asOfDate} · 目标 {report.input.target.toUpperCase()}</span><button onClick={() => exportBenchmark(report)}>导出比较报告</button></div>
      <div className="benchmark-grid">{report.results.map(result => <article className="benchmark-card" key={`${result.name}:${result.location}`}><span className="eyebrow">方案 {result.name} · {result.label} · {result.currency}</span><h2>{result.position ? positions[result.position] : "暂不判断竞争力"}</h2><p>{result.sampleCount} 个有效样本 · 年度税前总现金</p>
        <dl className="benchmark-values">{[
          ["年总现金", money(result.annualCash, result.currency)], ["税后到手（估算）", money(result.takeHome, result.currency)], ["企业总成本（估算）", money(result.employerCost, result.currency)],
          ["名义汇率换算", money(result.nominalCny, "CNY")], ["购买力参考（非支付工资）", money(result.purchasingPowerCny, "PPP CNY")],
          ["P25 / P50 / P75", [result.p25, result.p50, result.p75].map(v => money(v, result.currency)).join(" / ")],
          ["目标分位差距（正值需增加）", result.targetGap === null ? "数据不足 / 数据过期" : `${result.currency} ${result.targetGap.toLocaleString()}`],
          ["预算反推可支付年现金", result.budgetCash === null ? "未输入预算" : money(result.budgetCash, result.currency)]
        ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
        <div className="benchmark-trend"><h3>年度累计到手（等额月付估算）</h3><svg viewBox="0 0 360 110" role="img" aria-label={`方案 ${result.name} 累计到手趋势`}><polyline fill="none" stroke="currentColor" strokeWidth="3" points={result.trend.map((point, i) => `${10 + i * 30},${100 - (result.takeHome > 0 ? point.takeHome / result.takeHome : 0) * 80}`).join(" ")} /></svg><span>1 月 → 12 月 · {money(result.trend.at(-1)!.takeHome, result.currency)}</span></div>
        {result.warnings.map(w => <p className="benchmark-warning" key={w}>{w}</p>)}
      </article>)}</div>
      <p className="benchmark-meta">快照 {report.snapshotId} · {report.calculationVersion}<br />汇率 {report.exchangeRateDate} · PPP {report.pppYear} 年（演示系数） · 税费 {report.assumptionsVersion} · {report.macroStale ? "宏观数据过期" : "宏观版本有效"}</p>
    </>}
  </section>;
}
