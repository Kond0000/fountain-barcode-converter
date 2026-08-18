import type { ReactNode } from "react";

export function SectionHeader({ children }: { children: ReactNode }) {
  return (
    <div className="section-header">
      <h2>{children}</h2>
      <span aria-hidden="true" />
    </div>
  );
}
