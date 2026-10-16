import { PrismaClient } from "../src/generated/client/index.js";
import { seed as workflowSeed } from "../src/modules/extra-operations.js";
import { seedCompensationAssumptions } from "../src/modules/compensation.js";
import { DEMO_USER_ID } from "../src/modules/admin.js";
import { hashPassword } from "../src/modules/auth.js";
import { seedBenchmarks } from "../src/modules/benchmark-seed.js";

const prisma = new PrismaClient();

const sources = [
  { id: "10000000-0000-4000-8000-000000000001", name: "示例科技日报", url: "https://news.example.com" },
  { id: "10000000-0000-4000-8000-000000000002", name: "示例招聘观察", url: "https://jobs.example.com" }
] as const;

const companies = [
  { id: "20000000-0000-4000-8000-000000000001", name: "Northstar AI", industry: "生成式 AI", region: "美国 · 旧金山", employeeCount: 680 },
  { id: "20000000-0000-4000-8000-000000000002", name: "Harbor Robotics", industry: "机器人", region: "中国 · 深圳", employeeCount: 420 },
  { id: "20000000-0000-4000-8000-000000000003", name: "Fieldnote Health", industry: "数字医疗", region: "新加坡", employeeCount: 235 }
] as const;

const intelligenceItems = [
  {
    id: "30000000-0000-4000-8000-000000000001",
    companyName: "Northstar AI",
    title: "Northstar AI 扩建企业产品团队",
    summary: "公司正在扩大企业产品和销售团队。",
    content: "Northstar AI 发布了新的企业产品，并在多个地区招聘产品和销售岗位。",
    kind: "company" as const,
    importance: "high" as const,
    tags: ["招聘", "企业软件"],
    publishedAt: new Date("2026-09-28T08:30:00.000Z"),
    sourceName: "示例科技日报"
  },
  {
    id: "30000000-0000-4000-8000-000000000002",
    companyName: null,
    title: "亚太企业加速采用生成式 AI",
    summary: "多家区域企业公布 AI 流程自动化试点。",
    content: "本季度多家亚太企业开始扩大生成式 AI 的内部试点，岗位需求集中在数据、产品和解决方案团队。",
    kind: "industry" as const,
    importance: "medium" as const,
    tags: ["生成式 AI", "亚太"],
    publishedAt: new Date("2026-09-27T03:00:00.000Z"),
    sourceName: "示例科技日报"
  },
  {
    id: "30000000-0000-4000-8000-000000000003",
    companyName: "Harbor Robotics",
    title: "Harbor Robotics 新增供应链与商业化岗位",
    summary: "深圳团队开放多类商业化和供应链岗位。",
    content: "Harbor Robotics 正在扩充深圳团队，新增岗位覆盖供应链运营、解决方案销售和现场部署。",
    kind: "company" as const,
    importance: "medium" as const,
    tags: ["招聘", "机器人"],
    publishedAt: new Date("2026-09-26T06:15:00.000Z"),
    sourceName: "示例招聘观察"
  }
] as const;

const signals = [
  {
    id: "40000000-0000-4000-8000-000000000001",
    companyName: "Northstar AI",
    sourceName: "示例科技日报",
    kind: "funding" as const,
    title: "完成新一轮融资",
    summary: "公司宣布完成新一轮融资，将投入企业产品和国际化团队建设。",
    occurredAt: new Date("2026-09-28T08:30:00.000Z")
  },
  {
    id: "40000000-0000-4000-8000-000000000002",
    companyName: "Northstar AI",
    sourceName: "示例招聘观察",
    kind: "hiring" as const,
    title: "商业化岗位增长",
    summary: "近一个月新增多个解决方案和销售岗位。",
    occurredAt: new Date("2026-09-25T04:00:00.000Z")
  },
  {
    id: "40000000-0000-4000-8000-000000000003",
    companyName: "Harbor Robotics",
    sourceName: "示例招聘观察",
    kind: "hiring" as const,
    title: "扩充华南交付团队",
    summary: "深圳和广州地区的实施与供应链岗位有所增加。",
    occurredAt: new Date("2026-09-27T06:30:00.000Z")
  },
  {
    id: "40000000-0000-4000-8000-000000000004",
    companyName: "Fieldnote Health",
    sourceName: "示例科技日报",
    kind: "other" as const,
    title: "进入新的东南亚市场",
    summary: "公司宣布扩大区域业务覆盖并建设本地运营团队。",
    occurredAt: new Date("2026-09-24T02:00:00.000Z")
  }
] as const;

async function main(): Promise<void> {
  await prisma.adminUser.upsert({
    where: { id: DEMO_USER_ID },
    create: { id: DEMO_USER_ID, name: "Rachel", email: "rachel@talentnexus.local", passwordHash: hashPassword("TalentNexus07!"), role: "admin", preference: { create: {} } },
    update: { name: "Rachel", email: "rachel@talentnexus.local", passwordHash: hashPassword("TalentNexus07!"), role: "admin", status: "active" }
  });
  for (const notification of [
    { id: "50000000-0000-4000-8000-000000000001", title: "TalentNexus 已准备就绪", body: "你的工作台数据已同步到云端存储。", href: "/settings" },
    { id: "50000000-0000-4000-8000-000000000002", title: "本周人才信号已更新", body: "发现 12 条新的候选人和公司动态。", href: "/intelligence" },
    { id: "50000000-0000-4000-8000-000000000003", title: "薪酬假设版本已更新", body: "当前使用 2026 Q3 版本的市场薪酬规则。", href: "/compensation" }
  ]) {
    await prisma.notification.upsert({ where: { id: notification.id }, create: { ...notification, userId: DEMO_USER_ID }, update: { title: notification.title, body: notification.body, href: notification.href } });
  }
  for (const entry of [
    { group: "lead-stage", code: "new", label: "新线索" },
    { group: "lead-stage", code: "qualified", label: "已确认" },
    { group: "talent-function", code: "technology", label: "技术" },
    { group: "talent-function", code: "product", label: "产品" }
  ]) {
    await prisma.dictionaryItem.upsert({ where: { group_code: { group: entry.group, code: entry.code } }, create: entry, update: {} });
  }
  for (const source of sources) {
    await prisma.source.upsert({ where: { id: source.id }, create: source, update: source });
  }

  for (const company of companies) {
    const savedCompany = await prisma.company.upsert({ where: { id: company.id }, create: company, update: company });
    await prisma.competitorMonitor.upsert({
      where: { companyId: savedCompany.id },
      create: { companyId: savedCompany.id, monitored: true },
      update: {}
    });
  }

  const organizationUnits = [
    { id: "21000000-0000-4000-8000-000000000001", companyId: companies[0].id, parentId: null, name: "企业产品部", kind: "team", region: "上海", role: "产品与解决方案", status: "verified" },
    { id: "21000000-0000-4000-8000-000000000002", companyId: companies[0].id, parentId: "21000000-0000-4000-8000-000000000001", name: "亚太产品团队", kind: "team", region: "亚太", role: "产品管理", status: "unverified" },
    { id: "21000000-0000-4000-8000-000000000003", companyId: companies[1].id, parentId: null, name: "深圳研发中心", kind: "department", region: "深圳", role: "研发与交付", status: "verified" }
  ] as const;
  for (const unit of organizationUnits) {
    await prisma.organizationUnit.upsert({ where: { id: unit.id }, create: unit, update: unit });
  }
  await prisma.evidence.upsert({
    where: { id: "22000000-0000-4000-8000-000000000001" },
    create: { id: "22000000-0000-4000-8000-000000000001", organizationUnitId: organizationUnits[0].id, sourceId: sources[0].id, title: "公开招聘信息", excerpt: "企业产品团队正在招聘负责人。", collectedAt: new Date("2026-09-28T08:30:00.000Z"), confidence: 88, status: "verified", reviewedAt: new Date("2026-09-29T08:30:00.000Z"), reviewNote: "研究员已核验" },
    update: { organizationUnitId: organizationUnits[0].id, sourceId: sources[0].id, title: "公开招聘信息", excerpt: "企业产品团队正在招聘负责人。", confidence: 88, status: "verified", reviewedAt: new Date("2026-09-29T08:30:00.000Z"), reviewNote: "研究员已核验" }
  });

  const leaderProfiles = [
    { id: "23000000-0000-4000-8000-000000000001", companyId: companies[0].id, organizationUnitId: organizationUnits[1].id, name: "林予安", currentTitle: "亚太产品负责人", previousTitles: ["产品总监"], regions: ["中国", "新加坡"], teamSummary: "负责区域产品与商业化团队", contactChannels: ["公开邮箱"], status: "verified" },
    { id: "23000000-0000-4000-8000-000000000002", companyId: companies[1].id, organizationUnitId: organizationUnits[2].id, name: "周启明", currentTitle: "研发总监", previousTitles: ["研发负责人"], regions: ["中国 · 深圳"], teamSummary: "负责机器人研发与交付团队", contactChannels: ["公司主页"], status: "unverified" }
  ] as const;
  for (const leader of leaderProfiles) {
    const data = { ...leader, previousTitles: [...leader.previousTitles], regions: [...leader.regions], contactChannels: [...leader.contactChannels] };
    await prisma.leaderProfile.upsert({ where: { id: leader.id }, create: data, update: data });
  }
  await prisma.leaderEvidence.upsert({
    where: { id: "24000000-0000-4000-8000-000000000001" },
    create: { id: "24000000-0000-4000-8000-000000000001", leaderId: leaderProfiles[0].id, sourceId: sources[1].id, title: "公开招聘岗位信息", excerpt: "招聘信息显示该负责人覆盖亚太产品团队。", collectedAt: new Date("2026-09-28T08:45:00.000Z"), confidence: 84, status: "verified" },
    update: { leaderId: leaderProfiles[0].id, sourceId: sources[1].id, title: "公开招聘岗位信息", excerpt: "招聘信息显示该负责人覆盖亚太产品团队。", confidence: 84, status: "verified" }
  });

  for (const item of intelligenceItems) {
    const source = await prisma.source.findUniqueOrThrow({ where: { name: item.sourceName } });
    const company = item.companyName ? await prisma.company.findUniqueOrThrow({ where: { name: item.companyName } }) : null;
    await prisma.intelligenceItem.upsert({
      where: { id: item.id },
      create: {
        id: item.id,
        title: item.title,
        summary: item.summary,
        content: item.content,
        kind: item.kind,
        importance: item.importance,
        tags: [...item.tags],
        publishedAt: item.publishedAt,
        sourceId: source.id,
        companyId: company?.id ?? null
      },
      update: {
        title: item.title,
        summary: item.summary,
        content: item.content,
        kind: item.kind,
        importance: item.importance,
        tags: [...item.tags],
        publishedAt: item.publishedAt,
        sourceId: source.id,
        companyId: company?.id ?? null
      }
    });
  }

  for (const signal of signals) {
    const company = await prisma.company.findUniqueOrThrow({ where: { name: signal.companyName } });
    const source = await prisma.source.findUniqueOrThrow({ where: { name: signal.sourceName } });
    const monitor = await prisma.competitorMonitor.findUniqueOrThrow({ where: { companyId: company.id } });
    const data = { id: signal.id, kind: signal.kind, title: signal.title, summary: signal.summary, occurredAt: signal.occurredAt };
    await prisma.monitorSignal.upsert({
      where: { id: signal.id },
      create: { ...data, monitorId: monitor.id, sourceId: source.id },
      update: { ...data, monitorId: monitor.id, sourceId: source.id }
    });
  }

  for (const company of companies) {
    const savedCompany = await prisma.company.findUniqueOrThrow({ where: { id: company.id } });
    const monitor = await prisma.competitorMonitor.findUniqueOrThrow({ where: { companyId: savedCompany.id } });
    const latestSignal = await prisma.monitorSignal.findFirst({
      where: { monitorId: monitor.id },
      orderBy: { occurredAt: "desc" },
      select: { occurredAt: true }
    });
    if (latestSignal) {
      await prisma.competitorMonitor.update({
        where: { id: monitor.id },
        data: { lastUpdatedAt: latestSignal.occurredAt }
      });
    }
  }
  for (const name of ["未分类", "技术", "产品", "商业化"]) {
    await prisma.talentCategory.upsert({ where: { name }, create: { name }, update: {} });
  }
  for (const item of workflowSeed.leads) {
    const { updatedAt, ...data } = item;
    await prisma.lead.upsert({ where: { id: item.id }, create: { ...data, updatedAt: new Date(updatedAt) }, update: {} });
  }
  for (const item of workflowSeed.talents) {
    const { updatedAt, ...data } = item;
    await prisma.talent.upsert({ where: { id: item.id }, create: { ...data, updatedAt: new Date(updatedAt) }, update: {} });
  }
  const searchProject = { id: "25000000-0000-4000-8000-000000000001", name: "亚太产品负责人寻访", companyId: companies[0].id, targetRole: "产品负责人", regions: ["中国", "新加坡"], owner: "Rachel", status: "active", targetCount: 5, deadline: "2026-11-01", summary: "搭建候选人长短名单" };
  await prisma.searchProject.upsert({ where: { id: searchProject.id }, create: searchProject, update: searchProject });
  await prisma.candidateProject.upsert({
    where: { projectId_talentId: { projectId: searchProject.id, talentId: "talent-1" } },
    create: { id: "26000000-0000-4000-8000-000000000001", projectId: searchProject.id, talentId: "talent-1", stage: "longlist", source: "研究任务" },
    update: { stage: "longlist", source: "研究任务" }
  });
  const companyIdByName = new Map<string, string>(companies.map((company) => [company.name, company.id]));
  for (const item of workflowSeed["research-tasks"]) {
    const { updatedAt, ...data } = item;
    const companyId = companyIdByName.get(item.target) ?? null;
    await prisma.researchTask.upsert({ where: { id: item.id }, create: { ...data, companyId, updatedAt: new Date(updatedAt) }, update: { companyId } });
  }
  await prisma.researchTaskLeader.upsert({
    where: { researchTaskId_leaderId: { researchTaskId: "task-1", leaderId: leaderProfiles[0].id } },
    create: { researchTaskId: "task-1", leaderId: leaderProfiles[0].id },
    update: {}
  });
  for (const item of workflowSeed.outreach) {
    const { updatedAt, ...data } = item;
    await prisma.outreachCampaign.upsert({ where: { id: item.id }, create: { ...data, updatedAt: new Date(updatedAt) }, update: {} });
  }
  for (const item of workflowSeed.mapping) {
    const { updatedAt, ...data } = item;
    await prisma.mappingItem.upsert({ where: { id: item.id }, create: { ...data, updatedAt: new Date(updatedAt) }, update: {} });
  }
  for (const item of intelligenceItems) {
    await prisma.briefing.upsert({ where: { id: `briefing-${item.id}` }, create: { id: `briefing-${item.id}`, intelligenceId: item.id, read: false }, update: {} });
  }
  await seedCompensationAssumptions(prisma);
  await seedBenchmarks(prisma);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
