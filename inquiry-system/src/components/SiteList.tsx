"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SITE_TIERS, SITE_TYPES, formatDate, formatDateTime, toDateInputValue } from "@/lib/labels";
import type { SiteListTab, SiteSortField, SortDir } from "@/lib/list-tabs";
import { compareSemver } from "@/lib/semver";
import { SiteFormConfigPanel } from "./SiteFormConfigPanel";
import { SideDrawer } from "./SideDrawer";

/** 与后端 guessGscPropertyUrl 一致，仅用于 UI 提示 */
function guessScDomain(domain: string) {
  const d = String(domain || "")
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .replace(/^www\./i, "")
    .toLowerCase();
  return d ? `sc-domain:${d}` : "";
}

export type SiteRow = {
  id: string;
  domain: string;
  siteType: string;
  tier: string;
  startDate: string | null;
  endDate: string | null;
  siteKey: string;
  productKeywords: string;
  spamExtraWords: string;
  wpAdminUrl: string;
  wpUsername: string;
  wpPassword: string;
  hasWpCredentials: boolean;
  hasWpPassword: boolean;
  enabled: boolean;
  clientId: string;
  clientName: string;
  promo: {
    id: string;
    lastSubmittedBy: string;
    lastSubmittedAt: string | null;
  } | null;
  forms: {
    id: string;
    formId: string;
    label: string;
    toEmails: string;
    ccEmails: string;
    enabled: boolean;
  }[];
  formCount: number;
  gscSyncEnabled: boolean;
  gscPropertyUrl: string;
  gscPeriodDays: number;
  gscLastSyncAt: string | null;
  gscLastError: string;
  gscKeywordCount: number;
  gscPageCount: number;
  gscAvgPosition: number | null;
  gaSyncEnabled: boolean;
  gaPropertyId: string;
  gaPeriodDays: number;
  gaLastSyncAt: string | null;
  gaLastError: string;
  gaSessions: number;
  gaUsers: number;
  gaConversions: number;
  gaEngagementRate: number | null;
};

type ClientOpt = {
  id: string;
  name: string;
  contactName: string;
  phone: string;
  address: string;
  notes: string;
  lastVisitAt: string | null;
};

const tierClass: Record<string, string> = {
  重点: "bg-rose-100 text-rose-800",
  正常: "bg-slate-100 text-slate-700",
  维护: "bg-amber-100 text-amber-800",
};

type SiteTab = {
  key: SiteListTab;
  label: string;
  hint: string;
  count: number;
};

const NEW_CLIENT = "__new__";

const emptyForm = {
  clientId: NEW_CLIENT,
  newClientName: "",
  domain: "",
  siteType: "展示型",
  tier: "正常",
  startDate: "",
  endDate: "",
  wpAdminUrl: "",
  wpUsername: "",
  wpPassword: "",
  enabled: true,
  gscSyncEnabled: false,
  gscPropertyUrl: "",
  gscPeriodDays: 28,
  gaSyncEnabled: false,
  gaPropertyId: "",
  gaPeriodDays: 28,
};

const emptyClientForm = {
  name: "",
  contactName: "",
  phone: "",
  address: "",
  notes: "",
  lastVisitAt: "",
};

type BatchPluginProgress = {
  phase: "detect" | "update" | "done";
  percent: number;
  label: string;
  total: number;
  checked: number;
  needUpdate: number;
  updated: number;
  failed: number;
  unreachable: number;
  current?: string;
  errors: string[];
};

export function SiteList({
  initialSites,
  clients,
  ingestUrl,
  latestPluginVersion,
  filters,
  tab,
  tabs,
}: {
  initialSites: SiteRow[];
  clients: ClientOpt[];
  ingestUrl: string;
  latestPluginVersion: string;
  filters: {
    clientId: string;
    q: string;
    enabled: string;
    tab: SiteListTab;
    sort: SiteSortField;
    order: SortDir;
  };
  tab: SiteListTab;
  tabs: SiteTab[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<SiteRow | null>(null);
  const [configSite, setConfigSite] = useState<SiteRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [batchProgress, setBatchProgress] = useState<BatchPluginProgress | null>(null);
  const [expandedClients, setExpandedClients] = useState<Set<string>>(() => new Set());
  const [editingClient, setEditingClient] = useState<ClientOpt | null>(null);
  const [clientForm, setClientForm] = useState(emptyClientForm);
  const [clientError, setClientError] = useState("");
  const [gscAdvancedOpen, setGscAdvancedOpen] = useState(false);

  const clientGroups = useMemo(() => {
    const map = new Map<string, SiteRow[]>();
    for (const s of initialSites) {
      const list = map.get(s.clientId) || [];
      list.push(s);
      map.set(s.clientId, list);
    }
    const order: string[] = [];
    for (const s of initialSites) {
      if (!order.includes(s.clientId)) order.push(s.clientId);
    }
    return order.map((id) => {
      const sites = map.get(id)!;
      return {
        clientId: id,
        clientName: sites[0]?.clientName || "",
        sites,
      };
    });
  }, [initialSites]);

  function buildHref(overrides: Record<string, string | null | undefined> = {}) {
    const p = new URLSearchParams();
    const next = {
      tab: filters.tab,
      clientId: filters.clientId,
      q: filters.q,
      enabled: filters.enabled,
      sort: filters.sort,
      order: filters.order,
      ...overrides,
    };
    for (const [k, v] of Object.entries(next)) {
      if (v) p.set(k, v);
    }
    const qs = p.toString();
    return qs ? `/admin/sites?${qs}` : "/admin/sites";
  }

  function toggleClientExpand(clientId: string) {
    setExpandedClients((prev) => {
      const next = new Set(prev);
      if (next.has(clientId)) next.delete(clientId);
      else next.add(clientId);
      return next;
    });
  }

  function openClientEdit(clientId: string, clientName: string) {
    const c = clients.find((x) => x.id === clientId);
    setEditingClient(c || { id: clientId, name: clientName, contactName: "", phone: "", address: "", notes: "", lastVisitAt: null });
    setClientForm({
      name: c?.name || clientName,
      contactName: c?.contactName || "",
      phone: c?.phone || "",
      address: c?.address || "",
      notes: c?.notes || "",
      lastVisitAt: toDateInputValue(c?.lastVisitAt),
    });
    setClientError("");
  }

  function closeClientEdit() {
    setEditingClient(null);
    setClientError("");
  }

  async function saveClient(e: FormEvent) {
    e.preventDefault();
    if (!editingClient) return;
    setBusy(true);
    setClientError("");
    const res = await fetch(`/api/admin/clients/${editingClient.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(clientForm),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setClientError(data.error || "保存失败");
      return;
    }
    closeClientEdit();
    router.refresh();
  }

  function sortHref(field: SiteSortField) {
    const same = filters.sort === field;
    const nextOrder: SortDir = same && filters.order === "asc" ? "desc" : "asc";
    return buildHref({ sort: field, order: nextOrder });
  }

  function sortMark(field: SiteSortField) {
    if (filters.sort !== field) return "";
    return filters.order === "asc" ? " ↑" : " ↓";
  }

  function openCreate() {
    setConfigSite(null);
    setEditing(null);
    // 从某客户页跳转过来时沿用该客户；否则默认「新客户」
    setForm({
      ...emptyForm,
      clientId: filters.clientId || NEW_CLIENT,
      newClientName: "",
    });
    setGscAdvancedOpen(false);
    setCreating(true);
    setError("");
  }

  async function openEdit(s: SiteRow) {
    setConfigSite(null);
    setCreating(false);
    setError("");
    setBusy(true);
    let wpPassword = "";
    try {
      const res = await fetch(`/api/admin/sites/${s.id}?secrets=1`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        wpPassword = String(data.site?.wpPassword || "");
      } else if (s.hasWpPassword) {
        setBusy(false);
        setError(data.error || "读取网站密码失败，请重试");
        return;
      }
    } catch {
      setBusy(false);
      if (s.hasWpPassword) {
        setError("读取网站密码失败，请重试");
        return;
      }
    }
    setBusy(false);
    setEditing(s);
    const prop = s.gscPropertyUrl || "";
    const guessed = guessScDomain(s.domain);
    setGscAdvancedOpen(Boolean(prop && prop !== guessed));
    setForm({
      clientId: s.clientId,
      newClientName: "",
      domain: s.domain,
      siteType: s.siteType || "展示型",
      tier: s.tier || "正常",
      startDate: toDateInputValue(s.startDate),
      endDate: toDateInputValue(s.endDate),
      wpAdminUrl: s.wpAdminUrl || "",
      wpUsername: s.wpUsername || "",
      wpPassword,
      enabled: s.enabled,
      gscSyncEnabled: s.gscSyncEnabled,
      gscPropertyUrl: prop,
      gscPeriodDays: s.gscPeriodDays || 28,
      gaSyncEnabled: s.gaSyncEnabled,
      gaPropertyId: s.gaPropertyId || "",
      gaPeriodDays: s.gaPeriodDays || 28,
    });
  }

  function closeModal() {
    setCreating(false);
    setEditing(null);
    setGscAdvancedOpen(false);
    setError("");
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");

    let clientId = form.clientId;
    if (!editing && clientId === NEW_CLIENT) {
      const name = form.newClientName.trim();
      if (!name) {
        setBusy(false);
        setError("请填写新客户名称");
        return;
      }
      const clientRes = await fetch("/api/admin/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const clientData = await clientRes.json().catch(() => ({}));
      if (!clientRes.ok) {
        setBusy(false);
        setError(clientData.error || "创建客户失败");
        return;
      }
      clientId = clientData.client?.id;
      if (!clientId) {
        setBusy(false);
        setError("创建客户失败");
        return;
      }
    }

    const url = editing ? `/api/admin/sites/${editing.id}` : "/api/admin/sites";
    const { newClientName: _n, ...sitePayload } = form;
    const res = await fetch(url, {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...sitePayload, clientId }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "保存失败");
      return;
    }
    closeModal();
    router.refresh();
  }

  async function remove(s: SiteRow) {
    if (!confirm(`确认删除网站「${s.domain}」？相关询盘也会删除。`)) return;
    setBusy(true);
    await fetch(`/api/admin/sites/${s.id}`, { method: "DELETE" });
    setBusy(false);
    if (configSite?.id === s.id) setConfigSite(null);
    router.refresh();
  }

  async function enterWpAdmin(s: SiteRow) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/sites/${s.id}/wp-login`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || "无法进入后台");
        return;
      }
      const formEl = document.createElement("form");
      formEl.method = "POST";
      formEl.action = data.loginUrl;
      formEl.target = "_blank";
      formEl.acceptCharset = "UTF-8";
      const fields: Record<string, string> = {
        log: data.username,
        pwd: data.password,
        "wp-submit": "Log In",
        redirect_to: data.redirectTo || "",
        testcookie: "1",
      };
      for (const [name, value] of Object.entries(fields)) {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = name;
        input.value = value;
        formEl.appendChild(input);
      }
      document.body.appendChild(formEl);
      formEl.submit();
      formEl.remove();
    } finally {
      setBusy(false);
    }
  }

  async function batchUpdatePlugins() {
    if (!latestPluginVersion) {
      alert("无法读取中心最新插件版本，请稍后重试。");
      return;
    }
    if (
      !confirm(
        `先检测全部网站插件版本，再仅更新「已检测到插件且非最新」的站点；未检测到插件的网站将跳过。是否继续？`,
      )
    ) {
      return;
    }

    setBusy(true);
    setBatchProgress({
      phase: "detect",
      percent: 2,
      label: "正在加载网站列表…",
      total: 0,
      checked: 0,
      needUpdate: 0,
      updated: 0,
      failed: 0,
      unreachable: 0,
      errors: [],
    });

    try {
      const listRes = await fetch("/api/admin/sites", { cache: "no-store" });
      const listData = await listRes.json().catch(() => ({}));
      if (!listRes.ok) {
        throw new Error(listData.error || "加载网站列表失败");
      }
      const sites: { id: string; domain: string }[] = Array.isArray(listData.sites)
        ? listData.sites.map((s: { id: string; domain: string }) => ({
            id: String(s.id),
            domain: String(s.domain || ""),
          }))
        : [];

      if (sites.length === 0) {
        setBatchProgress({
          phase: "done",
          percent: 100,
          label: "没有可检测的网站",
          total: 0,
          checked: 0,
          needUpdate: 0,
          updated: 0,
          failed: 0,
          unreachable: 0,
          errors: [],
        });
        return;
      }

      type DetectResult =
        | { kind: "outdated"; id: string; domain: string; version: string }
        | { kind: "latest"; id: string; domain: string; version: string }
        | { kind: "skip"; id: string; domain: string; reason: string };

      let checked = 0;
      const bumpDetect = (
        partial: Partial<BatchPluginProgress> & { needUpdateCount?: number },
      ) => {
        const need = partial.needUpdateCount ?? 0;
        setBatchProgress({
          phase: "detect",
          percent: Math.min(50, Math.round((checked / sites.length) * 50)),
          label: `正在检测插件版本（${checked}/${sites.length}）`,
          total: sites.length,
          checked,
          needUpdate: need,
          updated: 0,
          failed: 0,
          unreachable: partial.unreachable ?? 0,
          current: partial.current,
          errors: partial.errors ?? [],
        });
      };

      // 并行检测（限流），未检测到插件的站点仅跳过、不进入更新队列
      const CONCURRENCY = 8;
      const detectResults: DetectResult[] = new Array(sites.length);
      let cursor = 0;
      let skipCount = 0;
      let outdatedCount = 0;

      const workers = Array.from({ length: Math.min(CONCURRENCY, sites.length) }, async () => {
        while (true) {
          const i = cursor++;
          if (i >= sites.length) return;
          const site = sites[i];
          try {
            const res = await fetch(`/api/admin/sites/${site.id}/plugin-version`, {
              cache: "no-store",
            });
            const data = await res.json().catch(() => ({}));
            if (data.ok && data.version) {
              const ver = String(data.version);
              if (compareSemver(ver, latestPluginVersion) < 0) {
                detectResults[i] = {
                  kind: "outdated",
                  id: site.id,
                  domain: site.domain,
                  version: ver,
                };
                outdatedCount += 1;
              } else {
                detectResults[i] = {
                  kind: "latest",
                  id: site.id,
                  domain: site.domain,
                  version: ver,
                };
              }
            } else {
              detectResults[i] = {
                kind: "skip",
                id: site.id,
                domain: site.domain,
                reason: String(data.error || "未检测到插件"),
              };
              skipCount += 1;
            }
          } catch (e) {
            detectResults[i] = {
              kind: "skip",
              id: site.id,
              domain: site.domain,
              reason: e instanceof Error ? e.message : "检测失败",
            };
            skipCount += 1;
          }
          checked += 1;
          bumpDetect({
            current: site.domain,
            unreachable: skipCount,
            needUpdateCount: outdatedCount,
          });
        }
      });
      await Promise.all(workers);

      const outdated = detectResults.filter(
        (r): r is Extract<DetectResult, { kind: "outdated" }> => r?.kind === "outdated",
      );
      const unreachable = detectResults.filter((r) => r?.kind === "skip").length;

      setBatchProgress({
        phase: outdated.length ? "update" : "done",
        percent: outdated.length ? 52 : 100,
        label: outdated.length
          ? `检测完成：${outdated.length} 个需更新，${unreachable} 个未检测到已跳过；开始更新…`
          : `检测完成：无需更新（已跳过未检测到插件的 ${unreachable} 个站点）`,
        total: sites.length,
        checked: sites.length,
        needUpdate: outdated.length,
        updated: 0,
        failed: 0,
        unreachable,
        errors: [],
      });

      if (outdated.length === 0) {
        return;
      }

      // 仅更新「检测到插件且版本落后」的站点
      let updated = 0;
      let failed = 0;
      const errors: string[] = [];
      for (let i = 0; i < outdated.length; i++) {
        const site = outdated[i];
        const base = 52;
        const span = 48;
        setBatchProgress({
          phase: "update",
          percent: Math.round(base + ((i + 0.2) / outdated.length) * span),
          label: `正在更新 ${site.domain}（${site.version} → ${latestPluginVersion}，${i + 1}/${outdated.length}）`,
          total: sites.length,
          checked: sites.length,
          needUpdate: outdated.length,
          updated,
          failed,
          unreachable,
          current: site.domain,
          errors: [...errors],
        });

        try {
          const res = await fetch(`/api/admin/sites/${site.id}/update-plugin`, {
            method: "POST",
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            failed += 1;
            errors.push(`${site.domain}：${data.error || "更新失败"}`);
          } else {
            updated += 1;
          }
        } catch (e) {
          failed += 1;
          errors.push(
            `${site.domain}：${e instanceof Error ? e.message : "更新失败"}`,
          );
        }

        setBatchProgress({
          phase: "update",
          percent: Math.round(base + ((i + 1) / outdated.length) * span),
          label: `更新进度 ${i + 1}/${outdated.length}`,
          total: sites.length,
          checked: sites.length,
          needUpdate: outdated.length,
          updated,
          failed,
          unreachable,
          current: site.domain,
          errors: [...errors],
        });
      }

      setBatchProgress({
        phase: "done",
        percent: 100,
        label: `完成：需更新 ${outdated.length} 个，成功 ${updated} 个${failed ? `，失败 ${failed} 个` : ""}；跳过未检测到 ${unreachable} 个`,
        total: sites.length,
        checked: sites.length,
        needUpdate: outdated.length,
        updated,
        failed,
        unreachable,
        errors,
      });
    } catch (e) {
      setBatchProgress({
        phase: "done",
        percent: 100,
        label: "批量更新中断",
        total: 0,
        checked: 0,
        needUpdate: 0,
        updated: 0,
        failed: 0,
        unreachable: 0,
        errors: [e instanceof Error ? e.message : String(e)],
      });
    } finally {
      setBusy(false);
    }
  }

  const showModal = creating || !!editing;
  // Keep config panel in sync with refreshed list data
  const configLive =
    configSite && initialSites.find((s) => s.id === configSite.id)
      ? initialSites.find((s) => s.id === configSite.id)!
      : configSite;

  return (
    <div className="space-y-4">
      {error && !showModal ? (
        <p className="text-sm text-[var(--danger)] bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {error}
        </p>
      ) : null}
      <form className="flex flex-wrap gap-2 bg-white border border-[var(--line)] rounded-xl p-3 shadow-sm">
        <input type="hidden" name="tab" value={tab} />
        {filters.sort ? (
          <>
            <input type="hidden" name="sort" value={filters.sort} />
            <input type="hidden" name="order" value={filters.order} />
          </>
        ) : null}
        <select
          name="clientId"
          defaultValue={filters.clientId}
          className="border border-[var(--line)] rounded-lg px-2 py-1.5 text-sm"
        >
          <option value="">全部客户</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          name="enabled"
          defaultValue={filters.enabled}
          className="border border-[var(--line)] rounded-lg px-2 py-1.5 text-sm"
          title="对接是否开启：开启=询盘进本系统；关闭=拒收推送"
        >
          <option value="">全部对接状态</option>
          <option value="1">对接中</option>
          <option value="0">已关闭对接</option>
        </select>
        <input
          name="q"
          defaultValue={filters.q}
          placeholder="搜索域名/客户名"
          className="border border-[var(--line)] rounded-lg px-2 py-1.5 text-sm flex-1 min-w-[160px]"
        />
        <button className="bg-[var(--brand)] text-white rounded-lg px-3 py-1.5 text-sm">筛选</button>
        {filters.sort ? (
          <Link
            href={buildHref({ sort: null, order: null })}
            className="border border-[var(--line)] rounded-lg px-3 py-1.5 text-sm bg-white text-[var(--muted)] hover:text-[var(--ink)]"
          >
            清除排序
          </Link>
        ) : null}
        <button
          type="button"
          onClick={openCreate}
          disabled={clients.length === 0}
          className="border border-[var(--line)] rounded-lg px-3 py-1.5 text-sm bg-white disabled:opacity-50"
        >
          新增网站
        </button>
      </form>

      {clients.length === 0 ? (
        <p className="text-sm text-[var(--warn)]">请先在「客户」中创建客户，再新增网站。</p>
      ) : null}

      <div className="flex flex-wrap items-end justify-between gap-2 border-b border-[var(--line)]">
        <div className="flex flex-wrap gap-1 min-w-0 flex-1">
          {tabs.map((t) => {
            const active = t.key === tab;
            return (
              <span key={t.key} className="relative group/tab">
                <Link
                  href={buildHref({ tab: t.key })}
                  className={`inline-block px-2.5 py-1.5 text-xs rounded-t-md border border-b-0 -mb-px ${
                    active
                      ? "bg-white border-[var(--line)] text-[var(--brand)] font-medium"
                      : "border-transparent text-[var(--muted)] hover:text-[var(--ink)]"
                  }`}
                >
                  {t.label}
                  <span className="ml-1 tabular-nums">{t.count}</span>
                </Link>
                {t.hint ? (
                  <span
                    role="tooltip"
                    className="pointer-events-none absolute left-0 top-full z-40 mt-1.5 w-64 max-w-[min(16rem,calc(100vw-2rem))] rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2.5 py-2 text-[11px] leading-relaxed text-[var(--ink)] shadow-lg opacity-0 invisible group-hover/tab:opacity-100 group-hover/tab:visible transition-opacity"
                  >
                    {t.hint}
                  </span>
                ) : null}
              </span>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => batchUpdatePlugins()}
          disabled={busy || !latestPluginVersion}
          className="shrink-0 mb-px bg-[var(--brand)] text-white rounded-lg px-3 py-1.5 text-sm disabled:opacity-50"
          title={
            latestPluginVersion
              ? `先检测全部站点，再更新非最新版到 ${latestPluginVersion}`
              : "无法读取中心插件版本"
          }
        >
          插件更新
        </button>
      </div>

      <div className="bg-white border border-[var(--line)] rounded-xl overflow-x-auto">
        <table className="w-full text-sm min-w-[980px]">
          <thead className="bg-black/[0.02] text-left text-[var(--muted)]">
            <tr>
              <th className="px-3 py-2">域名</th>
              <th className="px-3 py-2">所属客户</th>
              <th className="px-3 py-2">分层</th>
              <th className="px-3 py-2">信息核对</th>
              <th className="px-3 py-2">
                <Link href={sortHref("startDate")} className="hover:text-[var(--ink)]" title="按开始日期排序">
                  开始日期{sortMark("startDate")}
                </Link>
              </th>
              <th className="px-3 py-2">
                <Link href={sortHref("endDate")} className="hover:text-[var(--ink)]" title="按结束日期排序">
                  结束日期{sortMark("endDate")}
                </Link>
              </th>
              <th className="px-3 py-2" title="是否接受该站 WordPress 插件推送的询盘">
                对接状态
              </th>
              <th className="px-3 py-2">
                <Link href={sortHref("formCount")} className="hover:text-[var(--ink)]" title="按表单数排序">
                  表单数{sortMark("formCount")}
                </Link>
              </th>
              <th className="px-3 py-2" title="Google Search Console 近 N 天缓存（新加坡 seo-worker 同步）">
                GSC
              </th>
              <th className="px-3 py-2" title="Google Analytics 4 近 N 天缓存（新加坡 seo-worker 同步）">
                GA
              </th>
              <th className="px-3 py-2 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {clientGroups.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-3 py-10 text-center text-[var(--muted)]">
                  暂无网站
                </td>
              </tr>
            ) : (
              clientGroups.flatMap((group) => {
                const multi = group.sites.length > 1;
                const expanded = expandedClients.has(group.clientId);
                const visible = multi && !expanded ? group.sites.slice(0, 1) : group.sites;
                return visible.map((s, idx) => (
                  <tr key={s.id} className="border-t border-[var(--line)]">
                    <td className="px-3 py-2 font-medium">
                      <div className="flex items-center gap-1.5">
                        {multi && idx === 0 ? (
                          <button
                            type="button"
                            onClick={() => toggleClientExpand(group.clientId)}
                            className="shrink-0 w-5 h-5 inline-flex items-center justify-center rounded text-[var(--muted)] hover:bg-black/5 hover:text-[var(--ink)]"
                            title={expanded ? "折叠同客户其他域名" : `展开另 ${group.sites.length - 1} 个域名`}
                            aria-expanded={expanded}
                          >
                            {expanded ? "▼" : "▶"}
                          </button>
                        ) : multi ? (
                          <span className="w-5 shrink-0" />
                        ) : null}
                        <a
                          href={
                            /^https?:\/\//i.test(s.domain)
                              ? s.domain
                              : `https://${s.domain}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[var(--brand)] hover:underline"
                          title="在新窗口打开网站"
                        >
                          {s.domain}
                        </a>
                        {multi && idx === 0 && !expanded ? (
                          <span className="text-[11px] text-[var(--muted)] whitespace-nowrap">
                            +{group.sites.length - 1}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1">
                        {s.clientName}
                        <button
                          type="button"
                          onClick={() => openClientEdit(s.clientId, s.clientName)}
                          className="inline-flex items-center justify-center w-5 h-5 rounded text-[var(--muted)] hover:bg-black/5 hover:text-[var(--brand)]"
                          title="编辑客户信息"
                          aria-label="编辑客户信息"
                        >
                          <svg
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            className="w-3.5 h-3.5"
                            aria-hidden
                          >
                            <path d="M13.586 3.586a2 2 0 112.828 2.828l-8.5 8.5A2 2 0 016.5 15.5H4v-2.5a2 2 0 01.586-1.414l8.999-8z" />
                          </svg>
                        </button>
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${tierClass[s.tier] || ""}`}>
                        {s.tier || "正常"}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {s.promo ? (
                        <Link
                          href={`/admin/promos/${s.promo.id}`}
                          className="text-sky-800 hover:underline whitespace-nowrap text-xs"
                          title="查看信息核对"
                        >
                          {s.promo.lastSubmittedBy || "未更新"}
                          {s.promo.lastSubmittedAt ? (
                            <span className="text-[var(--muted)] ml-1">
                              {formatDateTime(s.promo.lastSubmittedAt)}
                            </span>
                          ) : null}
                        </Link>
                      ) : (
                        <span className="text-[var(--muted)]">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{formatDate(s.startDate)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{formatDate(s.endDate)}</td>
                    <td className="px-3 py-2">
                      {s.enabled ? (
                        <span
                          className="text-xs px-2 py-0.5 rounded-full bg-teal-100 text-teal-800"
                          title="本系统接受该站插件推送的询盘"
                        >
                          对接中
                        </span>
                      ) : (
                        <span
                          className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600"
                          title="本系统拒收该站推送；询盘由 WPForms 原生邮件发送，不进统计"
                        >
                          已关闭
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">{s.formCount}</td>
                    <td className="px-3 py-2 text-xs">
                      {s.gscSyncEnabled ? (
                        <Link
                          href={`/admin/sites/${s.id}/gsc`}
                          className="text-[var(--brand)] hover:underline whitespace-nowrap"
                          title={
                            s.gscLastError
                              ? `同步错误：${s.gscLastError}`
                              : s.gscLastSyncAt
                                ? `上次同步 ${formatDateTime(s.gscLastSyncAt)}`
                                : "已开启，等待新加坡 worker 同步"
                          }
                        >
                          {s.gscLastError ? (
                            <span className="text-[var(--danger)]">同步失败</span>
                          ) : s.gscLastSyncAt ? (
                            <>
                              {s.gscAvgPosition != null ? `均排 ${s.gscAvgPosition.toFixed(1)}` : "已同步"}
                              <span className="text-[var(--muted)]">
                                {" "}
                                · {s.gscKeywordCount}词/{s.gscPageCount}页
                              </span>
                            </>
                          ) : (
                            <span className="text-[var(--muted)]">待同步</span>
                          )}
                        </Link>
                      ) : (
                        <span className="text-[var(--muted)]">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {s.gaSyncEnabled ? (
                        <Link
                          href={`/admin/sites/${s.id}/ga`}
                          className="text-[var(--brand)] hover:underline whitespace-nowrap"
                          title={
                            s.gaLastError
                              ? `同步错误：${s.gaLastError}`
                              : s.gaLastSyncAt
                                ? `上次同步 ${formatDateTime(s.gaLastSyncAt)}`
                                : "已开启，等待新加坡 seo-worker 同步"
                          }
                        >
                          {s.gaLastError ? (
                            <span className="text-[var(--danger)]">同步失败</span>
                          ) : s.gaLastSyncAt ? (
                            <>
                              {s.gaSessions.toLocaleString()} 会话
                              <span className="text-[var(--muted)]">
                                {" "}
                                · {s.gaConversions} 转化
                              </span>
                            </>
                          ) : (
                            <span className="text-[var(--muted)]">待同步</span>
                          )}
                        </Link>
                      ) : (
                        <span className="text-[var(--muted)]">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap space-x-2">
                      {s.hasWpCredentials ? (
                        <button
                          type="button"
                          className="text-[var(--brand)]"
                          disabled={busy}
                          onClick={() => enterWpAdmin(s)}
                          title="新窗口自动提交 WP 登录（遇验证码/安全插件可能失败）"
                        >
                          进入后台
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="text-[var(--brand)] font-medium"
                        onClick={() => {
                          closeModal();
                          setConfigSite(s);
                        }}
                      >
                        询盘配置
                      </button>
                      <Link href={`/admin/sites/${s.id}/report`} className="text-[var(--brand)]">
                        月度报表
                      </Link>
                      <button type="button" className="text-[var(--brand)]" onClick={() => openEdit(s)}>
                        编辑
                      </button>
                      <button
                        type="button"
                        className="text-[var(--danger)]"
                        disabled={busy}
                        onClick={() => remove(s)}
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                ));
              })
            )}
          </tbody>
        </table>
      </div>

      {batchProgress ? (
        <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-5 shadow-lg space-y-4">
            <h3 className="text-base font-semibold">插件批量更新</h3>
            {latestPluginVersion ? (
              <p className="text-xs text-[var(--muted)]">中心最新版：{latestPluginVersion}</p>
            ) : null}
            <div className="space-y-2">
              <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-[var(--brand)] transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.max(0, batchProgress.percent))}%` }}
                />
              </div>
              <p className="text-sm text-[var(--ink)]">{batchProgress.label}</p>
              {batchProgress.current && batchProgress.phase !== "done" ? (
                <p className="text-xs text-[var(--muted)] break-all">当前：{batchProgress.current}</p>
              ) : null}
              <div className="grid grid-cols-2 gap-2 text-xs text-[var(--muted)]">
                <div>已检测：{batchProgress.checked}/{batchProgress.total || "—"}</div>
                <div>需更新：{batchProgress.needUpdate}</div>
                <div className="text-teal-700">成功更新：{batchProgress.updated}</div>
                <div className={batchProgress.failed ? "text-[var(--danger)]" : ""}>
                  失败：{batchProgress.failed}
                  {batchProgress.unreachable
                    ? ` · 跳过（未检测到）${batchProgress.unreachable}`
                    : ""}
                </div>
              </div>
              {batchProgress.errors.length > 0 ? (
                <div className="max-h-40 overflow-y-auto rounded-lg border border-[var(--line)] bg-black/[0.02] p-2 text-xs text-[var(--danger)] space-y-1">
                  {batchProgress.errors.slice(0, 30).map((err) => (
                    <p key={err}>{err}</p>
                  ))}
                  {batchProgress.errors.length > 30 ? (
                    <p>…另有 {batchProgress.errors.length - 30} 条</p>
                  ) : null}
                </div>
              ) : null}
            </div>
            {batchProgress.phase === "done" ? (
              <div className="flex justify-end">
                <button
                  type="button"
                  className="bg-[var(--brand)] text-white rounded-lg px-3 py-1.5 text-sm"
                  onClick={() => setBatchProgress(null)}
                >
                  关闭
                </button>
              </div>
            ) : (
              <p className="text-xs text-[var(--muted)]">进行中请勿关闭页面…</p>
            )}
          </div>
        </div>
      ) : null}

      {showModal ? (
        <SideDrawer onClose={closeModal}>
          <form onSubmit={save} className="flex flex-col h-full min-h-0">
            <div className="shrink-0 px-5 pt-5 pb-3 flex items-start justify-between gap-3 border-b border-[var(--line)]">
              <h2 className="text-lg font-semibold">{editing ? "编辑网站" : "新增网站"}</h2>
              <button
                type="button"
                onClick={closeModal}
                className="text-sm border border-[var(--line)] rounded-lg px-2 py-1 shrink-0"
              >
                关闭
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
            <div className="grid gap-3">
              <div
                className={
                  !editing && form.clientId === NEW_CLIENT
                    ? "grid grid-cols-2 gap-3"
                    : "grid gap-3"
                }
              >
                <label className="text-sm">
                  <span className="text-xs text-[var(--muted)]">所属客户 *</span>
                  <select
                    required
                    value={form.clientId}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        clientId: e.target.value,
                        newClientName: e.target.value === NEW_CLIENT ? form.newClientName : "",
                      })
                    }
                    className="mt-1 w-full border border-[var(--line)] rounded-lg px-2 py-1.5"
                  >
                    {!editing ? <option value={NEW_CLIENT}>新客户</option> : null}
                    {editing ? <option value="">选择客户</option> : null}
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                {!editing && form.clientId === NEW_CLIENT ? (
                  <label className="text-sm">
                    <span className="text-xs text-[var(--muted)]">客户名称 *</span>
                    <input
                      required
                      value={form.newClientName}
                      onChange={(e) => setForm({ ...form, newClientName: e.target.value })}
                      placeholder="稍后可在客户列表完善信息"
                      className="mt-1 w-full border border-[var(--line)] rounded-lg px-2 py-1.5"
                    />
                  </label>
                ) : null}
              </div>
              <label className="text-sm">
                <span className="text-xs text-[var(--muted)]">网站域名 *</span>
                <input
                  required
                  value={form.domain}
                  onChange={(e) => setForm({ ...form, domain: e.target.value })}
                  placeholder="example.com"
                  className="mt-1 w-full border border-[var(--line)] rounded-lg px-2 py-1.5"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm">
                  <span className="text-xs text-[var(--muted)]">站点类型</span>
                  <select
                    value={form.siteType}
                    onChange={(e) => setForm({ ...form, siteType: e.target.value })}
                    className="mt-1 w-full border border-[var(--line)] rounded-lg px-2 py-1.5"
                  >
                    {SITE_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  <span className="text-xs text-[var(--muted)]">分层</span>
                  <select
                    value={form.tier}
                    onChange={(e) => setForm({ ...form, tier: e.target.value })}
                    className="mt-1 w-full border border-[var(--line)] rounded-lg px-2 py-1.5"
                  >
                    {SITE_TIERS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm">
                  <span className="text-xs text-[var(--muted)]">开始日期</span>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                    className="mt-1 w-full border border-[var(--line)] rounded-lg px-2 py-1.5"
                  />
                </label>
                <label className="text-sm">
                  <span className="text-xs text-[var(--muted)]">结束日期</span>
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                    className="mt-1 w-full border border-[var(--line)] rounded-lg px-2 py-1.5"
                  />
                </label>
              </div>
              <div className="rounded-lg border border-[var(--line)] bg-black/[0.02] p-3 space-y-3">
                <p className="text-xs text-[var(--muted)] leading-relaxed">
                  WordPress 运维（可选）：用于「进入后台」与「更新插件」。遇验证码/双因素时自动登录可能失败。
                </p>
                <label className="text-sm block">
                  <span className="text-xs text-[var(--muted)]">后台入口</span>
                  <input
                    value={form.wpAdminUrl}
                    onChange={(e) => setForm({ ...form, wpAdminUrl: e.target.value })}
                    placeholder="https://example.com/wp-admin"
                    className="mt-1 w-full border border-[var(--line)] rounded-lg px-2 py-1.5"
                  />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-sm">
                    <span className="text-xs text-[var(--muted)]">用户名</span>
                    <input
                      value={form.wpUsername}
                      onChange={(e) => setForm({ ...form, wpUsername: e.target.value })}
                      autoComplete="off"
                      className="mt-1 w-full border border-[var(--line)] rounded-lg px-2 py-1.5"
                    />
                  </label>
                  <label className="text-sm">
                    <span className="text-xs text-[var(--muted)]">密码</span>
                    <input
                      type="text"
                      value={form.wpPassword}
                      onChange={(e) => setForm({ ...form, wpPassword: e.target.value })}
                      autoComplete="off"
                      className="mt-1 w-full border border-[var(--line)] rounded-lg px-2 py-1.5"
                    />
                  </label>
                </div>
              </div>
              <div className="rounded-lg border border-[var(--line)] bg-black/[0.02] p-3 space-y-2">
                <label className="text-sm flex items-start gap-2">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={form.gscSyncEnabled}
                    onChange={(e) => setForm({ ...form, gscSyncEnabled: e.target.checked })}
                  />
                  <span>
                    <span className="font-medium">同步 Google Search Console</span>
                    <span className="block text-xs text-[var(--muted)] mt-1 leading-relaxed">
                      由新加坡 seo-worker 每日拉取排名/页面展示数据并回写本系统。需先在 GSC
                      将该站属性授权给服务账号。
                    </span>
                  </span>
                </label>
                <p className="text-xs text-[var(--muted)] leading-relaxed">
                  默认按网站域名使用{" "}
                  <code className="bg-white/80 px-1 rounded">
                    {guessScDomain(form.domain) || "sc-domain:域名"}
                  </code>
                  。仅当 GSC 为网址前缀属性时需自定义。
                </p>
                <label className="text-sm block">
                  <span className="text-xs text-[var(--muted)]">统计天数</span>
                  <input
                    type="number"
                    min={1}
                    max={90}
                    value={form.gscPeriodDays}
                    onChange={(e) =>
                      setForm({ ...form, gscPeriodDays: Number(e.target.value) || 28 })
                    }
                    className="mt-1 w-28 border border-[var(--line)] rounded-lg px-2 py-1.5 bg-white"
                  />
                </label>
                <div>
                  <button
                    type="button"
                    className="text-xs text-[var(--brand)] hover:underline"
                    onClick={() => setGscAdvancedOpen((v) => !v)}
                  >
                    {gscAdvancedOpen ? "收起高级：自定义 GSC 属性" : "高级：自定义 GSC 属性"}
                  </button>
                  {gscAdvancedOpen ? (
                    <label className="text-sm block mt-2">
                      <span className="text-xs text-[var(--muted)]">GSC 属性 URL（可选）</span>
                      <input
                        value={form.gscPropertyUrl}
                        onChange={(e) => setForm({ ...form, gscPropertyUrl: e.target.value })}
                        placeholder="sc-domain:example.com 或 https://www.example.com/"
                        className="mt-1 w-full border border-[var(--line)] rounded-lg px-2 py-1.5 bg-white"
                      />
                      <span className="block text-[11px] text-[var(--muted)] mt-1">
                        留空则按域名自动使用 sc-domain。填网址前缀时须与 GSC 完全一致（含尾斜杠）。
                      </span>
                    </label>
                  ) : null}
                </div>
                {editing ? (
                  <Link
                    href={`/admin/sites/${editing.id}/gsc`}
                    className="text-xs text-[var(--brand)] hover:underline inline-block"
                  >
                    查看已同步的 GSC 数据 →
                  </Link>
                ) : null}
              </div>
              <div className="rounded-lg border border-[var(--line)] bg-black/[0.02] p-3 space-y-2">
                <label className="text-sm flex items-start gap-2">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={form.gaSyncEnabled}
                    onChange={(e) => setForm({ ...form, gaSyncEnabled: e.target.checked })}
                  />
                  <span>
                    <span className="font-medium">同步 Google Analytics 4</span>
                    <span className="block text-xs text-[var(--muted)] mt-1 leading-relaxed">
                      由新加坡 seo-worker 与 GSC 同进程拉取会话/落地页/渠道并回写。需在 GA4
                      媒体资源中把服务账号加为「查看者」。
                    </span>
                  </span>
                </label>
                <label className="text-sm block">
                  <span className="text-xs text-[var(--muted)]">GA4 Property ID（纯数字）</span>
                  <input
                    value={form.gaPropertyId}
                    onChange={(e) => setForm({ ...form, gaPropertyId: e.target.value })}
                    placeholder="例如 123456789（不是 G-XXXX）"
                    className="mt-1 w-full border border-[var(--line)] rounded-lg px-2 py-1.5 bg-white"
                  />
                </label>
                <label className="text-sm block">
                  <span className="text-xs text-[var(--muted)]">统计天数</span>
                  <input
                    type="number"
                    min={1}
                    max={90}
                    value={form.gaPeriodDays}
                    onChange={(e) =>
                      setForm({ ...form, gaPeriodDays: Number(e.target.value) || 28 })
                    }
                    className="mt-1 w-28 border border-[var(--line)] rounded-lg px-2 py-1.5 bg-white"
                  />
                </label>
                {editing ? (
                  <Link
                    href={`/admin/sites/${editing.id}/ga`}
                    className="text-xs text-[var(--brand)] hover:underline inline-block"
                  >
                    查看已同步的 GA 数据 →
                  </Link>
                ) : null}
              </div>
            </div>
            {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
            </div>
            <div className="shrink-0 border-t border-[var(--line)] px-5 py-3 flex justify-start gap-2 bg-white">
              <button
                disabled={busy}
                className="bg-[var(--brand)] text-white rounded-lg px-3 py-1.5 text-sm disabled:opacity-50"
              >
                保存
              </button>
              <button
                type="button"
                onClick={closeModal}
                className="border border-[var(--line)] rounded-lg px-3 py-1.5 text-sm"
              >
                取消
              </button>
            </div>
          </form>
        </SideDrawer>
      ) : null}

      {editingClient ? (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <form
            onSubmit={saveClient}
            className="bg-white rounded-2xl w-full max-w-xl p-5 space-y-3 shadow-lg max-h-[90vh] overflow-y-auto"
          >
            <h2 className="text-lg font-semibold">编辑客户</h2>
            <div className="grid md:grid-cols-2 gap-3">
              <label className="text-sm md:col-span-2">
                <span className="text-xs text-[var(--muted)]">客户名称 *</span>
                <input
                  required
                  value={clientForm.name}
                  onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })}
                  className="mt-1 w-full border border-[var(--line)] rounded-lg px-2 py-1.5"
                />
              </label>
              <label className="text-sm">
                <span className="text-xs text-[var(--muted)]">联系人称呼</span>
                <input
                  value={clientForm.contactName}
                  onChange={(e) => setClientForm({ ...clientForm, contactName: e.target.value })}
                  className="mt-1 w-full border border-[var(--line)] rounded-lg px-2 py-1.5"
                />
              </label>
              <label className="text-sm">
                <span className="text-xs text-[var(--muted)]">电话</span>
                <input
                  value={clientForm.phone}
                  onChange={(e) => setClientForm({ ...clientForm, phone: e.target.value })}
                  className="mt-1 w-full border border-[var(--line)] rounded-lg px-2 py-1.5"
                />
              </label>
              <label className="text-sm">
                <span className="text-xs text-[var(--muted)]">最近上门日期</span>
                <input
                  type="date"
                  value={clientForm.lastVisitAt}
                  onChange={(e) => setClientForm({ ...clientForm, lastVisitAt: e.target.value })}
                  className="mt-1 w-full border border-[var(--line)] rounded-lg px-2 py-1.5"
                />
              </label>
              <label className="text-sm md:col-span-2">
                <span className="text-xs text-[var(--muted)]">地址</span>
                <input
                  value={clientForm.address}
                  onChange={(e) => setClientForm({ ...clientForm, address: e.target.value })}
                  className="mt-1 w-full border border-[var(--line)] rounded-lg px-2 py-1.5"
                />
              </label>
              <label className="text-sm md:col-span-2">
                <span className="text-xs text-[var(--muted)]">备注</span>
                <textarea
                  value={clientForm.notes}
                  onChange={(e) => setClientForm({ ...clientForm, notes: e.target.value })}
                  className="mt-1 w-full border border-[var(--line)] rounded-lg px-2 py-1.5 min-h-[70px]"
                />
              </label>
            </div>
            {clientError ? <p className="text-sm text-[var(--danger)]">{clientError}</p> : null}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={closeClientEdit}
                className="border border-[var(--line)] rounded-lg px-3 py-1.5 text-sm"
              >
                取消
              </button>
              <button
                disabled={busy}
                className="bg-[var(--brand)] text-white rounded-lg px-3 py-1.5 text-sm disabled:opacity-50"
              >
                保存
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {configLive ? (
        <SiteFormConfigPanel
          key={`${configLive.id}-${configLive.enabled}-${configLive.forms.map((f) => f.id).join(",")}`}
          siteId={configLive.id}
          domain={configLive.domain}
          siteKey={configLive.siteKey}
          ingestUrl={ingestUrl}
          forms={configLive.forms}
          enabled={configLive.enabled}
          onClose={() => setConfigSite(null)}
        />
      ) : null}
    </div>
  );
}
