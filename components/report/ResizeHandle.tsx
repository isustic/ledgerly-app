"use client";

import { translate } from "@/lib/i18n";
import { useLanguage } from "@/components/LanguageProvider";
interface ResizeHandleProps {
  onMouseDown: (e: React.MouseEvent) => void;
  onTouchStart?: (e: React.TouchEvent) => void;
  isDragging: boolean;
}

export function ResizeHandle({ onMouseDown, onTouchStart, isDragging }: ResizeHandleProps) {
    useLanguage();
  return (
    <div
      className="absolute right-0 top-0 bottom-0 w-1 hover:w-1.5 bg-transparent hover:bg-border/50 cursor-col-resize transition-all duration-150 ease-out group-hover:opacity-100 opacity-0"
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
      style={{ cursor: isDragging ? 'col-resize' : undefined }}
      aria-label={translate("Resize sidebar")}
      role="separator"
      tabIndex={0}
    />
  );
}