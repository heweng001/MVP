"use client";

import { SortableMetricTable } from "./SortableMetricTable";

function pct(rate: number | null | undefined) {
  if (rate == null || !Number.isFinite(rate)) return "—";
  return `${(rate * 100).toFixed(1)}%`;
}

type Channel = {
  id: string;
  channelGroup: string;
  sessions: number;
  engagedSessions: number;
  conversions: number;
  engagementRate: number;
};

type Landing = {
  id: string;
  pagePath: string;
  sessions: number;
  engagedSessions: number;
  conversions: number;
  engagementRate: number;
};

export function GaChannelsTable({ rows }: { rows: Channel[] }) {
  return (
    <SortableMetricTable
      rows={rows}
      defaultSortKey="sessions"
      emptyColSpan={5}
      emptyText="暂无数据。请开启同步并运行新加坡 seo-worker。"
      columns={[
        {
          key: "channelGroup",
          label: "渠道组",
          sortValue: (r) => r.channelGroup,
          render: (r) => r.channelGroup,
        },
        {
          key: "sessions",
          label: "会话",
          sortValue: (r) => r.sessions,
          render: (r) => r.sessions.toLocaleString(),
        },
        {
          key: "engagedSessions",
          label: "互动会话",
          sortValue: (r) => r.engagedSessions,
          render: (r) => r.engagedSessions.toLocaleString(),
        },
        {
          key: "conversions",
          label: "转化",
          sortValue: (r) => r.conversions,
          render: (r) => r.conversions.toLocaleString(),
        },
        {
          key: "engagementRate",
          label: "互动率",
          sortValue: (r) => r.engagementRate,
          render: (r) => pct(r.engagementRate),
        },
      ]}
    />
  );
}

export function GaLandingPagesTable({ rows }: { rows: Landing[] }) {
  return (
    <SortableMetricTable
      rows={rows}
      defaultSortKey="sessions"
      emptyColSpan={5}
      emptyText="暂无落地页数据"
      columns={[
        {
          key: "pagePath",
          label: "路径",
          sortValue: (r) => r.pagePath,
          className: "break-all font-mono text-xs",
          render: (r) => r.pagePath,
        },
        {
          key: "sessions",
          label: "会话",
          sortValue: (r) => r.sessions,
          render: (r) => r.sessions.toLocaleString(),
        },
        {
          key: "engagedSessions",
          label: "互动会话",
          sortValue: (r) => r.engagedSessions,
          render: (r) => r.engagedSessions.toLocaleString(),
        },
        {
          key: "conversions",
          label: "转化",
          sortValue: (r) => r.conversions,
          render: (r) => r.conversions.toLocaleString(),
        },
        {
          key: "engagementRate",
          label: "互动率",
          sortValue: (r) => r.engagementRate,
          render: (r) => pct(r.engagementRate),
        },
      ]}
    />
  );
}
