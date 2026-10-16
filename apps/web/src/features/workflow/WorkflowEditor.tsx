import { useState } from "react";
import { Save } from "lucide-react";
import { leadCreateSchema, leadUpdateSchema, mappingUpdateSchema, outreachCreateSchema, outreachUpdateSchema, researchTaskCreateSchema, researchTaskUpdateSchema, talentUpdateSchema } from "@hr-console/contracts";
import type { WorkflowItem, WorkflowResource } from "./workflow-api";

const statusOptions: Record<string, Array<[string, string]>> = {
  leads: [["new", "新线索"], ["qualified", "已确认"], ["contacted", "已触达"], ["won", "已转化"], ["lost", "已关闭"]],
  "research-tasks": [["todo", "待开始"], ["in_progress", "进行中"], ["done", "已完成"]],
  outreach: [["draft", "草稿"], ["running", "进行中"], ["paused", "已暂停"], ["done", "已完成"]]
};

export function WorkflowEditor({ resource, item, categories, disabled, busy, save }: { resource: WorkflowResource; item: WorkflowItem | null; categories: string[]; disabled: boolean; busy: boolean; save: (input: Record<string, unknown>) => Promise<void> }) {
  const creating = !item;
  const [draft, setDraft] = useState<Record<string, unknown>>(() => ({ subject: "", name: "", company: "", source: "手动录入", lastTouchedAt: null, owner: "", score: 50, summary: "", target: "", progress: 0, deadline: null, result: "", channel: "email", targetCount: resource === "outreach" ? ((item as { targetCount?: number; touched?: number } | null)?.targetCount ?? (item as { touched?: number } | null)?.touched ?? 0) : 0, touched: 0, replies: 0, status: resource === "outreach" ? "draft" : "todo", stage: "new", ...item }));
  const [error, setError] = useState("");
  const text = (key: string, title: string, options?: { numeric?: boolean; multiline?: boolean; date?: boolean }) => <label key={key}>{title}{options?.multiline ? <textarea maxLength={5000} value={String(draft[key] ?? "")} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} /> : <input type={options?.numeric ? "number" : options?.date ? "date" : "text"} min={options?.numeric ? 0 : undefined} max={options?.numeric && ["score", "progress", "confidence"].includes(key) ? 100 : undefined} maxLength={300} value={String(draft[key] ?? "")} onChange={(event) => setDraft({ ...draft, [key]: options?.numeric ? Number(event.target.value) : options?.date && !event.target.value ? null : event.target.value })} />}</label>;
  const select = (key: string, title: string, options: Array<[string, string]>) => <label>{title}<select value={String(draft[key] ?? "")} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })}>{options.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>;
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError("");
    const schema = creating ? resource === "leads" ? leadCreateSchema : resource === "research-tasks" ? researchTaskCreateSchema : outreachCreateSchema : resource === "leads" ? leadUpdateSchema : resource === "research-tasks" ? researchTaskUpdateSchema : resource === "outreach" ? outreachUpdateSchema : resource === "talents" ? talentUpdateSchema : mappingUpdateSchema;
    const fields = creating ? resource === "leads" ? ["subject", "company", "source", "lastTouchedAt", "owner", "score", "summary", "stage"] : resource === "research-tasks" ? ["name", "owner", "target", "summary", "status", "progress", "deadline", "result"] : ["name", "channel", "summary", "status", "targetCount", "touched", "replies"] : resource === "leads" ? ["stage", "owner", "source", "lastTouchedAt"] : resource === "research-tasks" ? ["status", "progress", "owner", "deadline", "result"] : resource === "outreach" ? ["status", "targetCount", "touched", "replies"] : resource === "talents" ? ["category"] : ["target", "confidence", "summary"];
    const parsed = schema.safeParse(Object.fromEntries(fields.filter((key) => draft[key] !== undefined).map((key) => [key, draft[key]])));
    if (!parsed.success) { setError("请补全必填项，并检查数字范围。"); return; }
    if (resource === "outreach" && (Number(draft.replies) > Number(draft.touched) || Number(draft.touched) > Number(draft.targetCount))) { setError("目标人数、发送数和回复数应依次递减。"); return; }
    try { await save(parsed.data); } catch (error) { setError(error instanceof Error ? error.message : "保存失败，记录未更改。"); }
  }
  return <form className="workflow-edit" onSubmit={(event) => void submit(event)}>
    <fieldset disabled={disabled || busy}>
      {creating && <>{text(resource === "leads" ? "subject" : "name", "名称")}{resource === "leads" && text("company", "公司")}{resource === "research-tasks" && text("target", "摸排目标")}{resource === "outreach" && select("channel", "渠道", [["email", "邮件"], ["linkedin", "LinkedIn"], ["phone", "电话"]])}{text("summary", "摘要", { multiline: true })}</>}
      {resource === "leads" && <>{select("stage", "阶段", statusOptions.leads!)}{text("owner", "负责人")}{text("source", "来源")}{text("lastTouchedAt", "最近触达", { date: true })}{creating && text("score", "评分", { numeric: true })}</>}
      {resource === "research-tasks" && <>{select("status", "状态", statusOptions[resource]!)}{text("owner", "负责人")}{text("deadline", "截止日期", { date: true })}{text("progress", "进度 (%)", { numeric: true })}{text("result", "摸排成果", { multiline: true })}</>}
      {resource === "outreach" && <>{select("status", "状态", statusOptions.outreach!)}{text("targetCount", "目标人数", { numeric: true })}{text("touched", "发送数", { numeric: true })}{text("replies", "回复数", { numeric: true })}</>}
      {resource === "talents" && select("category", "分类", categories.map((name) => [name, name]))}
      {resource === "mapping" && <>{text("target", "映射目标")}{text("confidence", "置信度 (%)", { numeric: true })}{text("summary", "说明", { multiline: true })}</>}
      <button className="primary-action drawer-action" type="submit"><Save size={14} />{busy ? "保存中..." : creating ? "创建记录" : resource === "talents" ? "保存分类" : "保存更改"}</button>
    </fieldset>
    {error && <p role="alert" className="form-error">{error}</p>}
  </form>;
}
