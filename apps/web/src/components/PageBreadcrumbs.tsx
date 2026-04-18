import Link from "next/link";

export type BreadcrumbItem = { label: string; href?: string };

export function PageBreadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav className="mb-5" aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-x-1 gap-y-1 text-sm font-medium">
        {items.map((item, i) => (
          <li key={`${item.label}-${i}`} className="flex items-center gap-1">
            {i > 0 ? (
              <span
                className="material-symbols-outlined shrink-0 text-[18px] leading-none text-outline"
                aria-hidden
              >
                chevron_right
              </span>
            ) : null}
            {item.href ? (
              <Link href={item.href} className="text-on-surface-variant transition hover:text-primary">
                {item.label}
              </Link>
            ) : (
              <span className="text-on-surface" aria-current="page">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
