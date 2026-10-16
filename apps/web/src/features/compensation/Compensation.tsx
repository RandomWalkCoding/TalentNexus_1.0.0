import { Calculator, ChevronDown, CircleAlert, FileText, LineChart, RefreshCw, SlidersHorizontal, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type {
  CompensationBasis,
  CompensationCalculateInput,
  CompensationCalculateResponse,
  CompensationLocation,
  CompensationMode,
  CompensationResult
} from "@hr-console/contracts";

import { calculateCompensation, getCompensationAssumptions } from "./compensation-api";
import "./compensation.css";

const locationOrder: CompensationLocation[] = ["beijing", "shanghai", "shenzhen", "guangzhou", "hong-kong", "singapore", "united-states", "japan", "south-korea", "germany", "united-kingdom", "uae", "saudi-arabia", "france"];
const locationLabels: Record<CompensationLocation, string> = {
  beijing: "北京", shanghai: "上海", shenzhen: "深圳", guangzhou: "广州", "hong-kong": "中国香港", singapore: "新加坡",
  "united-states": "美国", japan: "日本", "south-korea": "韩国", germany: "德国", "united-kingdom": "英国",
  uae: "阿联酋", "saudi-arabia": "沙特", france: "法国"
};
const defaultInput: CompensationCalculateInput = { mode: "compare", basis: "nominal", locations: ["beijing", "shanghai", "hong-kong"], currency: "CNY", monthlyGross: 30000, annualBonus: 60000 };

function money(value: number, currency: string) {
  return new Intl.NumberFormat("zh-CN", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
}

function percent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function Waterfall({ items, title, currency }: { items: CompensationResult["candidateWaterfall"]; title: string; currency: string }) {
  const max = Math.max(...items.map((item) => Math.abs(item.value)), 1);
  return <div className="waterfall"><div className="chart-caption"><strong>{title}</strong><span>年度金额</span></div><div className="waterfall-bars">{items.map((item) => <div className="waterfall-item" key={item.label}><div className="waterfall-bar-wrap"><div className={`waterfall-bar ${item.kind}`} style={{ height: `${Math.max(18, Math.abs(item.value) / max * 100)}%`, background: item.color }}><span>{money(Math.abs(item.value), currency)}</span></div></div><small>{item.label}</small></div>)}</div></div>;
}

function TrendChart({ result }: { result: CompensationResult }) {
  const max = Math.max(...result.trend.map((point) => point.employerCost), 1);
  return <div className="trend-chart" aria-label={`${result.label}月度到手曲线`}><div className="trend-lines"><svg viewBox="0 0 720 210" role="img" aria-label="税前、到手和企业成本趋势"><polyline points={result.trend.map((point, index) => `${index * 65},${200 - point.gross / max * 175}`).join(" ")} fill="none" stroke="#397ea7" strokeWidth="3" /><polyline points={result.trend.map((point, index) => `${index * 65},${200 - point.takeHome / max * 175}`).join(" ")} fill="none" stroke="#3b9b82" strokeWidth="3" /><polyline points={result.trend.map((point, index) => `${index * 65},${200 - point.employerCost / max * 175}`).join(" ")} fill="none" stroke="#8b6ec1" strokeWidth="3" />{result.trend.map((point, index) => <g key={point.month}><circle cx={index * 65} cy={200 - point.takeHome / max * 175} r="3.5" fill="#3b9b82" /><text x={index * 65} y="207" textAnchor="middle">{point.month}</text></g>)}</svg></div><div className="chart-legend"><span><i className="legend-gross" />税前名义</span><span><i className="legend-take-home" />税后到手</span><span><i className="legend-employer" />企业成本</span></div></div>;
}

function CompensationCard({ result }: { result: CompensationResult }) {
  return <article className="compensation-card"><div className="compensation-card-head"><div><span className="location-kicker">MARKET BENCHMARK</span><h2>{result.label}</h2></div><span className="currency-tag">{result.currency}</span></div><div className="compensation-primary"><div><small>税前名义（年）</small><strong>{money(result.grossAnnual, result.currency)}</strong></div><div><small>税后到手（年）</small><strong className="positive">{money(result.takeHomeAnnual, result.currency)}</strong></div></div><dl className="compensation-details"><div><dt>五险一金 / MPF</dt><dd>{money(result.mandatoryAnnual, result.currency)}</dd></div><div><dt>个人所得税</dt><dd>{money(result.taxAnnual, result.currency)}</dd></div><div><dt>企业总成本</dt><dd>{money(result.employerCostAnnual, result.currency)}</dd></div><div><dt>综合税负率</dt><dd>{percent(result.effectiveTaxRate)}</dd></div><div><dt>到手率</dt><dd>{percent(result.takeHomeRate)}</dd></div><div><dt>年终奖</dt><dd>{money(result.bonusAnnual, result.currency)}</dd></div></dl><Waterfall items={result.candidateWaterfall} title="候选人侧" currency={result.currency} /></article>;
}

export function Compensation({ analysisOnly = false }: { analysisOnly?: boolean }) {
  const navigate = useNavigate();
  const [input, setInput] = useState<CompensationCalculateInput>(defaultInput);
  const [response, setResponse] = useState<CompensationCalculateResponse | null>(() => {
    const saved = localStorage.getItem("hr-compensation-calculation");
    if (!saved) return null;
    try {
      return JSON.parse(saved) as CompensationCalculateResponse;
    } catch {
      return null;
    }
  });
  const [assumptions, setAssumptions] = useState<Awaited<ReturnType<typeof getCompensationAssumptions>>["data"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fallback, setFallback] = useState(false);
  const [showAssumptions, setShowAssumptions] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void getCompensationAssumptions(controller.signal).then(({ data, fallback: usedFallback }) => { setAssumptions(data); setFallback(usedFallback); }).catch(() => undefined);
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (analysisOnly) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setLoading(true);
      setError("");
      void calculateCompensation(input, controller.signal).then(setResponse).catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "薪酬计算失败，已保留上次结果");
      }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 300);
    return () => { window.clearTimeout(timeout); controller.abort(); };
  }, [analysisOnly, input]);

  useEffect(() => {
    if (response) localStorage.setItem("hr-compensation-calculation", JSON.stringify(response));
  }, [response]);

  const analysisResult = useMemo(() => {
    if (response?.results.length) return response.results.find((item) => item.location === "beijing") ?? response.results[0]!;
    return null;
  }, [response]);

  function updateInput<K extends keyof CompensationCalculateInput>(key: K, value: CompensationCalculateInput[K]) {
    setInput((current) => ({ ...current, [key]: value }));
  }

  function toggleLocation(locationId: CompensationLocation) {
    setInput((current) => {
      const locations = current.locations.includes(locationId) ? current.locations.filter((item) => item !== locationId) : [...current.locations, locationId];
      return { ...current, locations: locations.length ? locations : current.locations };
    });
  }

  if (analysisOnly) {
    return <div className="compensation-page analysis-page"><PageHeading analysis /><section className="analysis-toolbar"><button type="button" onClick={() => navigate("/compensation")}><Calculator size={15} />返回计算器</button><span>{response?.calculationId ? `计算快照 ${response.calculationId}` : "请先在计算器生成结果"}</span></section>{analysisResult ? <><section className="analysis-metrics">{[["企业总成本（年）", analysisResult.employerCostAnnual], ["税前名义（年）", analysisResult.grossAnnual], ["税后到手", analysisResult.takeHomeAnnual]].map(([label, value]) => <div key={String(label)}><span>{label}</span><strong>{money(Number(value), analysisResult.currency)}</strong></div>)}</section><section className="analysis-grid"><div className="analysis-panel"><Waterfall items={analysisResult.candidateWaterfall} title="候选人侧（税前 → 到手）" currency={analysisResult.currency} /><Waterfall items={analysisResult.employerWaterfall} title="公司侧（税前 → 企业总成本）" currency={analysisResult.currency} /></div><div className="analysis-panel"><div className="chart-caption"><strong>月度到手曲线</strong><span>{analysisResult.label}</span></div><TrendChart result={analysisResult} /></div></section></> : <div className="analysis-empty"><LineChart size={26} /><strong>先完成一次薪酬计算</strong><span>计算结果会在这里生成统一的指标、瀑布图和月度趋势。</span><button type="button" onClick={() => navigate("/compensation")}>打开计算器</button></div>}</div>;
  }

  return <div className="compensation-page"><PageHeading /><div className="compensation-tabs">{["明细查询", "薪酬诊断", "内部诊断", "薪酬对比", "薪酬计算器", "政策指引", "城市系数", "今日汇率", "AI 答疑"].map((tab) => <button type="button" className={tab === "薪酬计算器" ? "active" : ""} key={tab}>{tab}</button>)}</div>{(fallback || error) && <div className="compensation-alert" role="status"><CircleAlert size={16} /><span>{error || "API 暂不可用，当前显示演示假设。"}</span></div>}<section className="compensation-controls"><div className="control-row"><div className="mode-switch" role="group" aria-label="计算模式">{(["forward", "reverse", "compare"] as CompensationMode[]).map((mode) => <button type="button" key={mode} className={input.mode === mode ? "active" : ""} onClick={() => updateInput("mode", mode)}>{mode === "forward" ? "正算" : mode === "reverse" ? "反推" : "对比"}</button>)}</div><div className="mode-switch" role="group" aria-label="对比口径">{(["native", "nominal", "ppp"] as CompensationBasis[]).map((basis) => <button type="button" key={basis} className={input.basis === basis ? "active" : ""} onClick={() => updateInput("basis", basis)}>{basis === "native" ? "本币原值" : basis === "nominal" ? "名义汇率" : "PPP 国际元"}</button>)}</div><Link className="analysis-link" to="/compensation/analysis"><LineChart size={15} />查看分析</Link></div><div className="location-picker"><div className="control-label"><SlidersHorizontal size={15} /><span>对比地点</span><small>已选 {input.locations.length}</small></div><div className="location-chips">{locationOrder.map((locationId) => <button type="button" className={input.locations.includes(locationId) ? "selected" : ""} key={locationId} onClick={() => toggleLocation(locationId)}>{locationLabels[locationId]}</button>)}</div></div><div className="input-grid"><label><span>{input.mode === "reverse" ? "目标月到手" : "月薪（税前）"}</span><input type="number" min="1" step="100" value={input.monthlyGross} onChange={(event) => updateInput("monthlyGross", Number(event.target.value))} /></label><label><span>年终奖（年）</span><input type="number" min="0" step="1000" value={input.annualBonus} onChange={(event) => updateInput("annualBonus", Number(event.target.value))} /></label><label><span>展示币种</span><select value={input.currency} onChange={(event) => updateInput("currency", event.target.value as CompensationCalculateInput["currency"])}><option value="CNY">CNY 人民币</option><option value="USD">USD 美元</option><option value="HKD">HKD 港币</option><option value="SGD">SGD 新币</option><option value="EUR">EUR 欧元</option><option value="GBP">GBP 英镑</option></select></label></div></section><section className="compensation-results"><div className="section-heading"><div><span className="eyebrow">CALCULATION RESULT</span><h2>地区结果</h2></div><span>{loading ? "计算中..." : response ? `快照 ${response.calculationId}` : "等待参数"}</span></div><div className="result-grid">{response?.results.map((item) => <CompensationCard key={item.location} result={item} />) ?? <div className="result-skeleton">输入参数后生成地区结果</div>}</div></section><section className="assumption-panel"><button type="button" onClick={() => setShowAssumptions(!showAssumptions)}><span><FileText size={16} />对比口径与假设</span><ChevronDown size={16} className={showAssumptions ? "rotated" : ""} /></button>{showAssumptions && <div className="assumption-content"><div><strong>规则版本</strong><span>{assumptions?.version ?? "--"} · 生效日 {assumptions?.asOfDate ?? "--"}</span></div>{(assumptions?.assumptions.filter((item) => input.locations.includes(item.location)) ?? []).map((item) => <div key={item.location}><strong>{item.label}</strong><span>{item.notes.join("；")} · 社保/公积金 {percent(item.mandatoryRate)} · 企业成本 {percent(item.employerRate)}</span></div>)}</div>}</section><div className="compensation-footnote"><Sparkles size={14} />金额保留两位小数；本页面用于市场对标演示，不替代当地税务申报。</div></div>;
}

function PageHeading({ analysis = false }: { analysis?: boolean }) {
  return <div className="page-heading compensation-heading"><div><span className="eyebrow">DATA TOOLS / COMPENSATION</span><h1><Calculator size={28} strokeWidth={1.7} />{analysis ? "薪酬分析" : "市场薪酬"}</h1><p>{analysis ? "统一计算快照下的薪酬结构、企业成本与月度趋势。" : "全球分国别薪酬对标 · 税后计算 · 市场定位"}</p></div><div className="compensation-meta"><span>汇率日期 2026-09-29</span><button type="button" title="刷新宏观数据"><RefreshCw size={14} />刷新宏观</button></div></div>;
}
