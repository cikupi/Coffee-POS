"use client";
import React from "react";
import { Button } from "@/components/ui/button";

export type NumpadProps = {
  open: boolean;
  value: number | string;
  onChange: (next: number) => void;
  onClose: () => void;
  allowDecimal?: boolean;
};

function format(v: number | string) {
  if (typeof v === "number") return String(v);
  return v || "";
}

export function VirtualNumpad({ open, value, onChange, onClose, allowDecimal }: NumpadProps) {
  const keys = ["7","8","9","4","5","6","1","2","3","0","00", allowDecimal ? "." : ""] as const;
  if (!open) return null;
  function append(k: string) {
    const cur = format(value);
    if (k === "") return;
    if (k === "." && cur.includes(".")) return;
    const nextStr = (cur === "0" && k !== ".") ? k : cur + k;
    const num = Number(nextStr || 0);
    onChange(num);
  }
  function backspace() {
    const cur = format(value);
    const nextStr = cur.slice(0, -1);
    onChange(Number(nextStr || 0));
  }
  function clear() { onChange(0); }
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t bg-white shadow-2xl">
      <div className="max-w-3xl mx-auto p-3 space-y-2">
        <div className="grid grid-cols-3 gap-2">
          {keys.map((k) => k ? (
            <Button key={k} variant="secondary" onClick={() => append(k)}>{k}</Button>
          ) : <div key="empty" />)}
          <Button variant="outline" onClick={backspace}>←</Button>
          <Button variant="outline" onClick={clear}>Clear</Button>
          <Button onClick={onClose}>Done</Button>
        </div>
      </div>
    </div>
  );
}
