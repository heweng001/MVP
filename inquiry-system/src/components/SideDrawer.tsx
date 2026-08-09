"use client";

import type { ReactNode } from "react";

/** 右侧全高抽屉（询盘配置 / 编辑等） */
export function SideDrawer({
  onClose,
  children,
  widthClass = "max-w-lg",
  zClass = "z-50",
}: {
  onClose: () => void;
  children: ReactNode;
  widthClass?: string;
  zClass?: string;
}) {
  return (
    <div
      className={`fixed inset-0 ${zClass} flex justify-end bg-black/40`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div
        className={`w-full ${widthClass} bg-white h-full shadow-xl flex flex-col`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {children}
      </div>
    </div>
  );
}
