import type { CSSProperties, HTMLAttributes } from "react";

import "./sponsor-credit.css";

const sponsors = {
  convex: { name: "Convex", url: "https://www.convex.dev/" },
  openai: { name: "OpenAI", url: "https://openai.com/" },
  firecrawl: { name: "Firecrawl", url: "https://www.firecrawl.dev/" },
  agentmail: { name: "AgentMail", url: "https://www.agentmail.to/" },
} as const;

export type SponsorName = keyof typeof sponsors;

type SponsorCreditProps = Omit<HTMLAttributes<HTMLElement>, "children" | "prefix"> & {
  sponsor: SponsorName;
  prefix?: string;
  link?: boolean;
};

/** Small attribution for the provider responsible for the adjacent product work. */
export function SponsorCredit({
  sponsor,
  prefix,
  link = false,
  className,
  style,
  ...props
}: SponsorCreditProps) {
  const brand = sponsors[sponsor];
  const classes = ["bh-sponsor-credit", className].filter(Boolean).join(" ");
  const logoStyle = {
    "--bh-sponsor-logo": `url("${import.meta.env.BASE_URL}brand/${sponsor}.svg")`,
    ...style,
  } as CSSProperties;
  const content = (
    <>
      {prefix ? <span className="bh-sponsor-credit__prefix">{prefix}</span> : null}
      <span className="bh-sponsor-credit__mark" aria-hidden="true" />
      <span>{brand.name}</span>
    </>
  );

  if (link) {
    return (
      <a
        className={classes}
        style={logoStyle}
        href={brand.url}
        target="_blank"
        rel="noopener noreferrer"
        data-sponsor={sponsor}
        {...props}
      >
        {content}
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    );
  }

  return (
    <span className={classes} style={logoStyle} data-sponsor={sponsor} {...props}>
      {content}
    </span>
  );
}
