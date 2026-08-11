"use client";

import { SortableMetricTable } from "./SortableMetricTable";

type Kw = {
  id: string;
  keyword: string;
  position: number;
  clicks: number;
  impressions: number;
  ctr: number;
};

type Page = {
  id: string;
  pageUrl: string;
  position: number;
  clicks: number;
  impressions: number;
};

export function GscKeywordsTable({ rows }: { rows: Kw[] }) {
  return (
    <SortableMetricTable
      rows={rows}
      defaultSortKey="impressions"
      emptyColSpan={5}
      emptyText="暂无数据。请在新加坡 worker 同步，或先在信息核对中维护目标关键词。"
      columns={[
        {
          key: "keyword",
          label: "关键词",
          sortValue: (r) => r.keyword,
          render: (r) => r.keyword,
        },
        {
          key: "position",
          label: "平均排名",
          sortValue: (r) => (r.impressions > 0 ? r.position : Number.POSITIVE_INFINITY),
          render: (r) => (r.impressions > 0 ? r.position.toFixed(1) : "—"),
        },
        {
          key: "clicks",
          label: "点击",
          sortValue: (r) => r.clicks,
          render: (r) => r.clicks.toLocaleString(),
        },
        {
          key: "impressions",
          label: "展示",
          sortValue: (r) => r.impressions,
          render: (r) => r.impressions.toLocaleString(),
        },
        {
          key: "ctr",
          label: "CTR",
          sortValue: (r) => r.ctr,
          render: (r) => (r.impressions > 0 ? `${(r.ctr * 100).toFixed(1)}%` : "—"),
        },
      ]}
    />
  );
}

export function GscPagesTable({ rows }: { rows: Page[] }) {
  return (
    <SortableMetricTable
      rows={rows}
      defaultSortKey="impressions"
      emptyColSpan={4}
      emptyText="暂无页面数据"
      columns={[
        {
          key: "pageUrl",
          label: "页面",
          sortValue: (r) => r.pageUrl,
          className: "break-all",
          render: (r) => (
            <a
              href={r.pageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--brand)] hover:underline"
            >
              {r.pageUrl}
            </a>
          ),
        },
        {
          key: "position",
          label: "平均排名",
          sortValue: (r) => r.position,
          render: (r) => r.position.toFixed(1),
        },
        {
          key: "clicks",
          label: "点击",
          sortValue: (r) => r.clicks,
          render: (r) => r.clicks.toLocaleString(),
        },
        {
          key: "impressions",
          label: "展示",
          sortValue: (r) => r.impressions,
          render: (r) => r.impressions.toLocaleString(),
        },
      ]}
    />
  );
}
