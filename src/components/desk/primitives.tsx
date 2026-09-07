import type { ReactNode } from "react";
import { ArrowUpRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CompactWordmark } from "./compact-wordmark";
export function Brand() {
  return (
    <a className="desk-brand desk-brand--matrix" href="/" aria-label="BUY HARD home">
      <CompactWordmark />
      <ArrowUpRight size={16} aria-hidden="true" />
    </a>
  );
}
export function PageHeading({
  title,
  children,
  compact = false,
}: {
  title: string;
  children?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={compact ? (children ? "desk-page-actions" : "desk-page-label") : "desk-heading"}
    >
      <h1 className={compact ? "sr-only" : undefined}>{title}</h1>
      {children}
    </div>
  );
}
export function Empty({ children }: { children: ReactNode }) {
  return <p className="desk-empty">{children}</p>;
}
export function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="ghost" size="icon" onClick={onClick} aria-label="Close">
      <X size={20} />
    </Button>
  );
}
export function OutLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a className="desk-text-link" href={href} target="_blank" rel="noreferrer">
      {children}
      <ArrowUpRight size={16} />
    </a>
  );
}
export function Loading() {
  return (
    <main className="desk-public">
      <Brand />
      <output className="desk-loading">Opening your desk…</output>
    </main>
  );
}
