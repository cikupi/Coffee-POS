"use client";
import React, { useMemo } from "react";
import { Button } from "@/components/ui/button";

export type VirtualKeyboardProps = {
  open: boolean;
  value: string;
  onChange: (next: string) => void;
  onClose: () => void;
  layout?: "qwerty" | "numeric";
};

export function VirtualKeyboard({ open, value, onChange, onClose, layout = "qwerty" }: VirtualKeyboardProps) {
  const rows = useMemo(() => {
    if (layout === "numeric") return [["7","8","9"],["4","5","6"],["1","2","3"],["0","00","."]];
    return [
      ["q","w","e","r","t","y","u","i","o","p"],
      ["a","s","d","f","g","h","j","k","l"],
      ["z","x","c","v","b","n","m","-","_"]
    ];
  }, [layout]);
  if (!open) return null;
  function append(k: string) { onChange((value || "") + k); }
  function space() { onChange((value || "") + " "); }
  function backspace() { onChange((value || "").slice(0, -1)); }
  function clear() { onChange(""); }
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t bg-white shadow-2xl">
      <div className="max-w-3xl mx-auto p-3 space-y-2">
        {rows.map((r, idx) => (
          <div key={idx} className="flex gap-2 justify-center">
            {r.map((k) => (
              <Button key={k} variant="secondary" onClick={() => append(k)}>{k}</Button>
            ))}
          </div>
        ))}
        <div className="flex gap-2 justify-center">
          <Button variant="outline" onClick={backspace}>←</Button>
          <Button variant="outline" onClick={clear}>Clear</Button>
          <Button variant="secondary" onClick={space}>Space</Button>
          <Button onClick={onClose}>Done</Button>
        </div>
      </div>
    </div>
  );
}
