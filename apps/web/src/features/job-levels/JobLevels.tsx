import { Blocks, ChevronRight, CircleAlert, DollarSign, Filter, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { JobLevel, JobSeriesCode, JobLevelsResponse } from "@hr-console/contracts";
import { getJobLevels } from "./job-levels-api";
import "./job-levels.css";

const allSeries: Array<JobSeriesCode | "ALL"> = ["ALL", "EX", "M", "P", "S", "T", "U", "W"];

function money(value: number, currency: "USD" | "CNY") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
}

export function JobLevels() {
  const [data, setData] = useState<JobLevelsResponse | null>(null);
  const [series, setSeries] = useState<JobSeriesCode | "ALL">("ALL");
  const [currency, setCurrency] = useState<"USD" | "CNY">("USD");
  const [metric, setMetric] = useState<"baseSalary" | "totalCash">("baseSalary");
  const [loading, setLoading] = useState(true);
  const [fallback, setFallback] = useState(false);
  const [selected, setSelected] = useState<JobLevel | null>(null);
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    void getJobLevels({ series: series === "ALL" ? undefined : series, currency, metric }, controller.signal).then((result) => {
      setData(result.data); setFallback(result.fallback);
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [series, currency, metric]);

  const visibleSeries = useMemo(() => data?.series.filter((item) => series === "ALL" || item.code === series) ?? [], [data?.series, series]);
  const grades = data?.surveyGrades ?? Array.from({ length: 24 }, (_, index) => index + 2);
  const firstGrade = grades[0] ?? 2;
  const displayedLevels = data?.levels ?? [];
  const displayedBenchmarks = (data?.benchmarks ?? []).filter((item) => selectedCompanies.length === 0 || selectedCompanies.includes(item.id));
  const levelColor = (level: JobLevel) => data?.series.find((item) => item.code === level.series)?.color ?? "#517387";

  function toggleCompany(id: string) {
    setSelectedCompanies((current) => current.includes(id) ? current.filter((companyId) => companyId !== id) : [...current, id]);
  }

  return <div className="job-levels-page">
    <div className="page-heading job-level-heading"><div><span className="eyebrow">DATA TOOLS / CAREER ARCHITECTURE</span><h1><Blocks size={28} strokeWidth={1.7} />职级体系</h1><p>统一序列、职级与 Survey Grade，支持人才盘点与薪酬对标。</p></div><div className="job-level-meta"><span>数据更新至 {data?.asOf ?? "--"}</span><span>汇率 1 USD = {data?.fxRate ?? "--"} CNY</span></div></div>
    {fallback && <div className="dashboard-alert" role="status"><CircleAlert size={16} /><span>API 暂不可用，当前显示演示职级数据。</span></div>}
    <section className="level-toolbar"><div className="series-filters" role="group" aria-label="序列过滤"><Filter size={15} /><button className={series === "ALL" ? "active" : ""} onClick={() => setSeries("ALL")}>全部序列</button>{allSeries.slice(1).map((code) => <button key={code} className={series === code ? "active" : ""} onClick={() => setSeries(code)}>{code}</button>)}</div><div className="level-selects"><label>薪酬口径<select value={metric} onChange={(event) => setMetric(event.target.value as typeof metric)}><option value="baseSalary">Base Salary</option><option value="totalCash">Total Cash</option></select></label><label>币种<select value={currency} onChange={(event) => setCurrency(event.target.value as typeof currency)}><option value="USD">USD 美元</option><option value="CNY">CNY 人民币</option></select></label></div></section>
    <section className="level-panel architecture-panel"><div className="level-panel-header"><div><h2>职级架构总览</h2><p>横轴为 Survey Grade 2–25，区块宽度代表覆盖范围。点击区块查看职责与薪酬带。</p></div><span className="panel-note">{loading ? "同步中..." : `${displayedLevels.length} 个职级`}</span></div><div className="level-chart-scroll"><div className="level-chart" style={{ "--grade-count": grades.length } as CSSProperties}><div className="grade-row"><span className="axis-title">序列</span>{grades.map((grade) => <span key={grade}>{grade}</span>)}</div>{visibleSeries.map((item) => <div className="level-row" key={item.code}><div className="series-label" style={{ color: item.color }}><strong>{item.code}</strong><small>{item.nameZh.replace("序列", "")}</small></div><div className="track"><div className="grade-grid">{grades.map((grade) => <i key={grade} />)}</div>{displayedLevels.filter((level) => level.series === item.code).map((level) => <button key={level.id} className="level-band" style={{ left: `${((level.gradeFrom - firstGrade) / grades.length) * 100}%`, width: `${((level.gradeTo - level.gradeFrom + 1) / grades.length) * 100}%`, background: item.color }} onClick={() => setSelected(level)} title={`${level.code} ${level.name}`}><strong>{level.code}</strong><span>{level.name}</span></button>)}</div></div>)}</div></div></section>
    <section className="series-legend">{visibleSeries.map((item) => <button type="button" key={item.code} className="series-card" onClick={() => setSeries(item.code)}><span className="series-swatch" style={{ background: item.color }}>{item.code}</span><span><strong>{item.nameZh}</strong><small>{item.roles.join(" · ")}</small><em>{item.description}</em></span><ChevronRight size={15} /></button>)}</section>
    <section className="level-panel benchmark-panel"><div className="level-panel-header"><div><h2>公司职级横向比较</h2><p>选择公司查看同一职级口径下的市场样本。</p></div><span className="panel-note">{displayedBenchmarks.length} 家样本</span></div><div className="benchmark-list">{(data?.benchmarks ?? []).map((item) => <button type="button" aria-pressed={selectedCompanies.includes(item.id)} className={`benchmark-chip${selectedCompanies.includes(item.id) ? " selected" : ""}`} key={item.id} onClick={() => toggleCompany(item.id)}><strong>{item.company}</strong><span>{item.levelCode}</span><em>{money(item.salary, currency)}</em></button>)}</div>{selectedCompanies.length > 0 && <div className="benchmark-selection" aria-label="已选公司对比">{displayedBenchmarks.map((item) => <div key={item.id}><strong>{item.company}</strong><span>{item.levelCode}</span><em>{money(item.salary, currency)}</em><small>{item.employees?.toLocaleString("en-US") ?? "--"} FTE</small></div>)}</div>}</section>
    {selected && <div className="level-drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}><aside className="level-drawer" aria-label="职级详情"><button className="drawer-close" aria-label="关闭详情" onClick={() => setSelected(null)}><X size={17} /></button><span className="drawer-code" style={{ background: levelColor(selected) }}>{selected.code}</span><h2>{selected.name}</h2><p className="drawer-series">{selected.series} 序列 · Survey Grade {selected.gradeFrom}–{selected.gradeTo}</p><div className="drawer-section"><h3>职责摘要</h3><p>{selected.summary}</p><ul>{selected.responsibilities.map((item) => <li key={item}>{item}</li>)}</ul></div><div className="drawer-section salary-band"><h3>薪酬带 · {currency}</h3><div><span><small>Min</small><strong>{money(selected.salaryBand.min * (currency === "CNY" ? data?.fxRate ?? 1 : 1), currency)}</strong></span><span><small>Mid</small><strong>{money(selected.salaryBand.mid * (currency === "CNY" ? data?.fxRate ?? 1 : 1), currency)}</strong></span><span><small>Max</small><strong>{money(selected.salaryBand.max * (currency === "CNY" ? data?.fxRate ?? 1 : 1), currency)}</strong></span></div></div><div className="drawer-tip"><DollarSign size={14} />薪酬带来自 {data?.asOf ?? "2026-09-28"} 市场调研</div></aside></div>}
  </div>;
}
