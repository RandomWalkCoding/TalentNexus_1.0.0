import {
  Bell, Blocks, BriefcaseBusiness, ChartNoAxesCombined, ChevronDown, CircleHelp,
  Compass, ContactRound, Database, GitFork, LayoutDashboard, ListFilter, Map, Moon,
  Radar, Search, Settings, Shield, Sparkles, Sun, Users, X
} from "lucide-react";
import { Component, lazy, Suspense, useCallback, useEffect, useState } from "react";
import { BrowserRouter, Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Dashboard } from "../features/dashboard/Dashboard";
import { JobLevels } from "../features/job-levels/JobLevels";
import { Intelligence } from "../features/intelligence/Intelligence";
import { CompetitorMonitoring } from "../features/competitor-monitoring/CompetitorMonitoring";
import { AiBriefing } from "../features/ai-briefing/AiBriefing";
import { OrganizationMap } from "../features/organization/OrganizationMap";
import { SearchProjects } from "../features/search-projects/SearchProjects";

import { SettingsPage } from "../features/admin/SettingsPage";

import { LoginPage } from "../features/auth/LoginPage";
import { getCurrentUser, logout } from "../features/auth/auth-api";
import { getNotifications, markNotificationsRead } from "../features/notifications/notifications-api";
import { searchWorkspace } from "../features/search/search-api";
import type { MeResponse, Notification, SearchResult } from "@hr-console/contracts";

import { useDrawer } from "../features/operation-state";

const WorkflowPage = lazy(() => import("../features/workflow/WorkflowPage").then((module) => ({ default: module.WorkflowPage })));
const Compensation = lazy(() => import("../features/compensation/Compensation").then((module) => ({ default: module.Compensation })));
const AdminPage = lazy(() => import("../features/admin/AdminPage").then((module) => ({ default: module.AdminPage })));
const AiReviewPage = lazy(() => import("../features/ai-review/AiReviewPage").then((module) => ({ default: module.AiReviewPage })));
const MailPage = lazy(() => import("../features/mail/MailPage").then((module) => ({ default: module.MailPage })));
const BenchmarkStructurePage = lazy(() => import("../features/benchmark/BenchmarkPages").then((module) => ({ default: module.BenchmarkStructurePage })));
const LevelBenchmarkPage = lazy(() => import("../features/benchmark/BenchmarkPages").then((module) => ({ default: module.LevelBenchmarkPage })));
const CompetitivenessPage = lazy(() => import("../features/benchmark/BenchmarkPages").then((module) => ({ default: module.CompetitivenessPage })));

const routePermissions: Record<string, MeResponse["permissions"][number]> = {
  dashboard: "dashboard:read", intelligence: "intelligence:read", "competitor-monitoring": "competitors:read",
  "ai-briefing": "briefings:read", leads: "leads:read", "talent-pool": "talents:read",
  "research-tasks": "research-tasks:read", organizations: "organizations:read", "search-projects": "search-projects:read",
  outreach: "outreach:read", "mail-review": "outreach:read", mapping: "mapping:read", "job-levels": "job-levels:read", compensation: "compensation:read",
  "ai-review": "intelligence:read", admin: "admin:read", settings: "settings:read"
};
const roleNames = { admin: "超级管理员", hr: "HR / 招聘负责人", manager: "业务管理者" };

type Page = { path: string; title: string; description: string; icon: LucideIcon };
type Group = { title: string; pages: Page[] };

const groups: Group[] = [
  { title: "工作台", pages: [{ path: "/dashboard", title: "仪表盘", description: "人才运营总览与今日工作", icon: LayoutDashboard }] },
  { title: "情报与机会", pages: [
    { path: "/intelligence", title: "情报中心", description: "行业动态与重点公司信号", icon: Compass },
    { path: "/competitor-monitoring", title: "竞对监测", description: "组织变化与招聘趋势", icon: Radar },
    { path: "/ai-briefing", title: "AI 快讯", description: "市场信息每日摘要", icon: Sparkles },
    { path: "/leads", title: "线索池", description: "线索收集与推进", icon: ListFilter }
  ] },
  { title: "人才运营", pages: [
    { path: "/talent-pool", title: "人才库", description: "人才档案与分类", icon: Users },
    { path: "/research-tasks", title: "摸排任务", description: "任务进度与成果", icon: BriefcaseBusiness },
    { path: "/organizations", title: "组织摸排", description: "组织关系与证据核验", icon: GitFork },
    { path: "/search-projects", title: "人才寻访", description: "寻访项目与候选人漏斗", icon: BriefcaseBusiness },
    { path: "/outreach", title: "触达", description: "战役与回复跟踪", icon: ContactRound },
    { path: "/mail-review", title: "邮箱触达", description: "邮件审批、发送与回信反馈", icon: ContactRound },
    { path: "/mapping", title: "Mapping", description: "公司、岗位、职级映射", icon: Map }
  ] },
  { title: "数据工具", pages: [
    { path: "/job-levels", title: "职级体系", description: "序列与职级架构", icon: Blocks },
    { path: "/compensation", title: "市场薪酬", description: "跨地区薪酬测算", icon: ChartNoAxesCombined },
    { path: "/job-levels/benchmarks", title: "职级对标审核", description: "证据与职级映射确认", icon: Blocks },
    { path: "/compensation/competitiveness", title: "地区竞争力", description: "方案 A/B 与市场分位", icon: ChartNoAxesCombined }
  ] },
  { title: "系统", pages: [
    { path: "/ai-review", title: "AI 审核", description: "模型建议与宏观数据状态", icon: Sparkles },
    { path: "/admin", title: "管理台", description: "用户与权限管理", icon: Shield },
    { path: "/settings", title: "设置", description: "工作台显示偏好", icon: Settings }
  ] }
];

const pages = groups.flatMap((group) => group.pages);
const routedPages = pages.filter((page) => !["/dashboard", "/compensation", "/admin", "/job-levels/benchmarks", "/compensation/competitiveness", "/ai-review", "/mail-review"].includes(page.path));
const extraPages: Page[] = [
  { path: "/talent-pool/uncategorized", title: "未分类人才", description: "尚未分组的人才", icon: Users },
  { path: "/talent-pool/technology", title: "技术人才", description: "技术职能人才分类", icon: Users },
  { path: "/talent-pool/product", title: "产品人才", description: "产品职能人才分类", icon: Users },
  { path: "/compensation/analysis", title: "薪酬结构", description: "样本组成与市场分位", icon: ChartNoAxesCombined },
  { path: "/compensation/calculation-analysis", title: "计算分析", description: "计算瀑布图与月度趋势", icon: ChartNoAxesCombined }
];

function readTheme(): "dark" | "light" {
  return localStorage.getItem("hr-theme") === "light" ? "light" : "dark";
}

function readDensity(): "comfortable" | "compact" {
  return localStorage.getItem("hr-density") === "compact" ? "compact" : "comfortable";
}

function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const [theme, setTheme] = useState(readTheme);
  const [density, setDensity] = useState(readDensity);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const testMode = import.meta.env.MODE === "test";
  const [currentUser, setCurrentUser] = useState<MeResponse | null>(testMode ? {
    user: { id: "00000000-0000-4000-8000-000000000001", name: "Rachel", email: "rachel@talentnexus.local", role: "admin", status: "active", updatedAt: "2026-10-05T00:00:00.000Z" },
    permissions: [...Object.values(routePermissions), "admin:read", "admin:write", "settings:read", "settings:write", "search:read", "notifications:read", "notifications:write"],
    preferences: { theme: "dark", density: "comfortable", notifications: true, defaultLocation: "beijing", defaultCurrency: "CNY" }
  } : null);
  const [authLoading, setAuthLoading] = useState(!testMode);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [searchRevision, setSearchRevision] = useState(0);
  const [notificationError, setNotificationError] = useState("");
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [notificationRevision, setNotificationRevision] = useState(0);
  const [markingRead, setMarkingRead] = useState(false);
  const [accountError, setAccountError] = useState("");
  const closeSearch = useCallback(() => setSearchOpen(false), []);
  useDrawer(searchOpen && !!currentUser, closeSearch, ".search-dialog");

  useEffect(() => {
    if (testMode) return;
    const controller = new AbortController();
    void getCurrentUser(controller.signal).then((user) => {
      setCurrentUser(user);
      setTheme(user.preferences.theme);
      setDensity(user.preferences.density);
    }).catch(() => setCurrentUser(null)).finally(() => setAuthLoading(false));
    return () => controller.abort();
  }, [testMode]);

  useEffect(() => {
    if (!currentUser || testMode) { setNotifications([]); setUnreadNotifications(0); return; }
    const controller = new AbortController();
    setNotificationLoading(true); setNotificationError("");
    void getNotifications(controller.signal).then((result) => {
      if (!controller.signal.aborted) {
        setNotifications(result.items);
        setUnreadNotifications(result.unreadCount);
      }
    }).catch(() => {
      if (!controller.signal.aborted) setNotificationError("通知加载失败，请重试。");
    }).finally(() => { if (!controller.signal.aborted) setNotificationLoading(false); });
    return () => controller.abort();
  }, [currentUser, testMode, notificationRevision]);

  useEffect(() => {
    setSearchResults([]); setSearchError(""); setSearchLoading(false);
    if (!searchOpen || query.trim().length < 2 || testMode) return;
    const controller = new AbortController();
    setSearchLoading(true);
    const timer = window.setTimeout(() => {
      void searchWorkspace(query, controller.signal).then((results) => {
        if (!controller.signal.aborted) setSearchResults(results);
      }).catch(() => {
        if (!controller.signal.aborted) setSearchError("工作区搜索失败，请重试。");
      }).finally(() => { if (!controller.signal.aborted) setSearchLoading(false); });
    }, 180);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query, searchOpen, testMode, searchRevision]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.density = density;
    localStorage.setItem("hr-theme", theme);
    localStorage.setItem("hr-density", density);
  }, [theme, density]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (currentUser && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === "Escape") {
        setSearchOpen(false);
        setNotificationsOpen(false);
        setUserOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [currentUser]);

  const canViewPath = (path: string) => {
    const permission = path === "/job-levels/benchmarks" ? "mapping:read" : routePermissions[path.split("/")[1] ?? ""];
    return !permission || !!currentUser?.permissions.includes(permission);
  };
  const visibleGroups = groups.map((group) => ({ ...group, pages: group.pages.filter((page) => canViewPath(page.path)) })).filter((group) => group.pages.length);
  const current = [...pages, ...extraPages].find((page) => page.path === location.pathname);
  const filtered = [...pages, ...extraPages].filter((page) => canViewPath(page.path)).filter((page) => `${page.title} ${page.description}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));

  function choosePage(path: string) {
    navigate(path);
    setSearchOpen(false);
    setQuery("");
  }

  function completeLogin(user: MeResponse) {
    setCurrentUser(user);
    setTheme(user.preferences.theme);
    setDensity(user.preferences.density);
  }

  async function handleLogout() {
    setAccountError("");
    try {
      await logout();
      setCurrentUser(null); setUserOpen(false); setNotificationsOpen(false); setSearchOpen(false); setQuery("");
    } catch { setAccountError("退出登录失败，请重试。"); }
  }

  async function handleReadAll() {
    setMarkingRead(true); setNotificationError("");
    try {
      await markNotificationsRead();
      setNotifications((items) => items.map((item) => ({ ...item, read: true })));
      setUnreadNotifications(0);
    } catch { setNotificationError("标记已读失败，未读状态已保留，请重试。"); }
    finally { setMarkingRead(false); }
  }

  if (authLoading) return <div className="auth-loading">正在连接 TalentNexus...</div>;
  if (!currentUser) return <LoginPage onLogin={completeLogin} />;

  return <div className="app-shell">
    <a className="skip-link" href="#main-content">跳到主内容</a>
    <aside className="sidebar">
      <Link className="brand" to="/dashboard"><span className="brand-mark"><Radar size={21} strokeWidth={2} /></span><span><strong>TalentNexus</strong><small>AI TALENT OPERATIONS</small></span></Link>
      <div className="workspace-name"><span className="workspace-dot" />增长中心</div>
      <nav className="sidebar-nav" aria-label="主导航">
        {visibleGroups.filter((group) => group.title !== "系统").map((group) => <section className="nav-group" key={group.title}>
          <h2>{group.title}</h2>
          {group.pages.map((page) => <NavLink className={({ isActive }) => `nav-link${isActive ? " active" : ""}`} end to={page.path} key={page.path}><page.icon size={17} strokeWidth={1.8} /><span>{page.title}</span></NavLink>)}
          {group.title === "人才运营" && canViewPath("/talent-pool") && <div className="subnav"><NavLink to="/talent-pool/uncategorized">未分类</NavLink><NavLink to="/talent-pool/technology">技术人才</NavLink><NavLink to="/talent-pool/product">产品人才</NavLink></div>}
        </section>)}
      </nav>
      <div className="sidebar-bottom">{visibleGroups.find((group) => group.title === "系统")?.pages.map((page) => <NavLink className={({ isActive }) => `nav-link${isActive ? " active" : ""}`} end to={page.path} key={page.path}><page.icon size={17} strokeWidth={1.8} /><span>{page.title}</span></NavLink>)}
        <div className="sidebar-account"><span className="avatar">{currentUser.user.name.slice(0, 1)}</span><span><strong>{currentUser.user.name}</strong><small>{roleNames[currentUser.user.role]}</small></span></div>
      </div>
    </aside>
    <div className="main-area">
      <header className="topbar"><div className="breadcrumb"><span>工作台</span><span>/</span><strong>{current?.title ?? "页面未找到"}</strong></div>
        <div className="top-actions"><button type="button" className="search-trigger" onClick={() => setSearchOpen(true)}><Search size={16} /><span>搜索模块...</span><kbd>Ctrl K</kbd></button>
          <button type="button" className="icon-button" aria-label={theme === "dark" ? "切换浅色主题" : "切换深色主题"} title={theme === "dark" ? "切换浅色主题" : "切换深色主题"} onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}</button>
          <div className="popover-anchor"><button type="button" className="icon-button notification-button" aria-label="通知" title="通知" aria-expanded={notificationsOpen} onClick={() => { setNotificationsOpen(!notificationsOpen); setUserOpen(false); }}><Bell size={18} />{unreadNotifications > 0 && <span className="notification-count">{unreadNotifications > 99 ? "99+" : unreadNotifications}</span>}</button>{notificationsOpen && <div className="popover notification-panel"><div className="notification-heading"><h2>通知</h2><button type="button" onClick={() => void handleReadAll()} disabled={!unreadNotifications || markingRead || notificationLoading}>全部已读</button></div>{notificationError ? <p role="status">{notificationError}<button type="button" onClick={() => setNotificationRevision((value) => value + 1)}>重新加载</button></p> : null}{notificationLoading ? <p role="status">加载通知...</p> : notifications.length ? notifications.map((item) => <Link className={`notification-item${item.read ? " read" : ""}`} to={item.href ?? "#"} key={item.id} onClick={() => setNotificationsOpen(false)}><strong>{item.title}</strong><span>{item.body}</span></Link>) : !notificationError ? <p>暂无通知</p> : null}</div>}</div>
          <div className="popover-anchor"><button type="button" className="account-button" aria-expanded={userOpen} onClick={() => { setUserOpen(!userOpen); setNotificationsOpen(false); }}><span className="avatar small">{currentUser.user.name.slice(0, 1)}</span><span>{currentUser.user.name}</span><ChevronDown size={14} /></button>{userOpen && <div className="popover account-panel"><strong>{currentUser.user.name}</strong><small>{roleNames[currentUser.user.role]} · TalentNexus 工作区</small>{accountError ? <p role="status">{accountError}</p> : null}<Link to="/settings" onClick={() => setUserOpen(false)}><Settings size={15} />个人设置</Link><button type="button" onClick={() => void handleLogout()}>退出登录</button></div>}</div>
        </div>
      </header>
      <main className="content" id="main-content" tabIndex={-1}>{current && !canViewPath(location.pathname) ? <div className="not-found" role="status"><h1>没有访问权限</h1><p>请联系管理员确认此模块的访问范围。</p><Link to="/dashboard">返回工作台</Link></div> : <ModuleBoundary key={location.pathname}><Suspense fallback={<div className="operation-loading" role="status">加载模块...</div>}><Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/job-levels/benchmarks" element={<LevelBenchmarkPage canWrite={currentUser.permissions.includes("mapping:write")} />} />
        <Route path="/compensation/competitiveness" element={<CompetitivenessPage />} />
        <Route path="/compensation/analysis" element={<BenchmarkStructurePage />} />
        <Route path="/compensation/calculation-analysis" element={<Compensation analysisOnly />} />
        <Route path="/ai-review" element={<AiReviewPage />} />
        <Route path="/mail-review" element={<MailPage canWrite={currentUser.permissions.includes("outreach:write")} currentUserId={currentUser.user.id} />} />
        <Route path="/compensation" element={<CompensationRoute />} />
        {routedPages.map((page) => <Route path={page.path} element={page.path === "/settings" ? <SettingsPage theme={theme} density={density} setTheme={setTheme} setDensity={setDensity} /> : page.path === "/job-levels" ? <JobLevels /> : page.path === "/intelligence" ? <Intelligence /> : page.path === "/competitor-monitoring" ? <CompetitorMonitoring /> : page.path === "/ai-briefing" ? <AiBriefing /> : page.path === "/organizations" ? <OrganizationMap canWrite={currentUser.permissions.includes("organizations:write")} /> : page.path === "/search-projects" ? <SearchProjects canWrite={currentUser.permissions.includes("search-projects:write")} /> : page.path === "/leads" ? <WorkflowPage resource="leads" /> : page.path === "/talent-pool" ? <WorkflowPage resource="talents" /> : page.path === "/research-tasks" ? <WorkflowPage resource="research-tasks" /> : page.path === "/outreach" ? <WorkflowPage resource="outreach" /> : page.path === "/mapping" ? <WorkflowPage resource="mapping" /> : <ModulePage page={page} />} key={page.path} />)}
        <Route path="/talent-pool/uncategorized" element={<WorkflowPage resource="talents" category="未分类" />} />
        <Route path="/talent-pool/technology" element={<WorkflowPage resource="talents" category="技术" />} />
        <Route path="/talent-pool/product" element={<WorkflowPage resource="talents" category="产品" />} />
        <Route path="*" element={<NotFound />} />
      </Routes></Suspense></ModuleBoundary>}</main>
    </div>
    {searchOpen && <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSearchOpen(false); }}><div className="search-dialog" role="dialog" aria-modal="true" aria-label="全局搜索"><div className="dialog-input"><Search size={19} /><input maxLength={80} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索模块、人才、公司、组织或项目" aria-label="搜索模块" /><button type="button" aria-label="关闭搜索" onClick={() => setSearchOpen(false)}><X size={17} /></button></div><div className="search-list" aria-busy={searchLoading}>{searchLoading ? <p role="status">正在搜索工作区...</p> : null}{searchError ? <p role="status">{searchError}<button type="button" onClick={() => setSearchRevision((value) => value + 1)}>重试</button></p> : null}{searchResults.map((item) => <button type="button" key={`${item.kind}-${item.id}`} onClick={() => choosePage(item.href)}><Search size={17} /><span><strong>{item.title}</strong><small>{item.subtitle}</small></span><span className="search-arrow">↗</span></button>)}{filtered.map((page) => <button type="button" key={page.path} onClick={() => choosePage(page.path)}><page.icon size={17} /><span><strong>{page.title}</strong><small>{page.description}</small></span><span className="search-arrow">↗</span></button>)}{!searchLoading && !searchError && !searchResults.length && !filtered.length && <p>没有匹配的结果</p>}</div></div></div>}
  </div>;
}

class ModuleBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <div className="not-found" role="alert"><h1>模块加载失败</h1><p>请检查连接后重新载入页面。</p><button type="button" onClick={() => window.location.reload()}>重新载入</button></div> : this.props.children;
  }
}

function ModulePage({ page }: { page: Page }) {
  return <div className="module-page"><div className="page-heading"><span className="eyebrow">{page.path.split("/")[1]?.toUpperCase()}</span><h1><page.icon size={28} strokeWidth={1.7} />{page.title}</h1><p>{page.description}</p></div><section className="module-section"><div className="section-title"><Database size={18} /><h2>工作区</h2></div><div className="empty-state"><CircleHelp size={24} strokeWidth={1.5} /><strong>暂无数据</strong><Link to="/dashboard">返回工作台</Link></div></section></div>;
}

function CompensationRoute() {
  return <Compensation />;
}

function NotFound() {
  return <div className="not-found"><h1>页面未找到</h1><p>检查地址是否正确，或返回工作台继续浏览。</p><Link to="/dashboard">返回工作台</Link></div>;
}

export function App() {
  return <BrowserRouter><AppShell /></BrowserRouter>;
}
