import Image from "next/image";
import Link from "next/link";

type NavigationItem = "dashboard" | "manual" | "history";

export function MotorcycleNavigation({
  active,
  canManage = false,
}: {
  active: NavigationItem;
  canManage?: boolean;
}) {
  return (
    <aside className="side-rail" aria-label="MotoMemory navigation">
      <div className="brand-lockup">
        <Image
          className="brand-logo"
          src="/images/motomemory-logo.png"
          alt=""
          width={42}
          height={42}
          priority
        />
        <span className="brand-name">MotoMemory</span>
      </div>

      <nav className="primary-nav" aria-label="Primary navigation">
        <Link
          className={`nav-item${active === "dashboard" ? " nav-item-active" : ""}`}
          href="/#dashboard"
          aria-current={active === "dashboard" ? "page" : undefined}
        >
          <span className="nav-icon" aria-hidden="true">⌂</span>
          Dashboard
        </Link>
        <span className="nav-item nav-item-deferred" aria-disabled="true" title="Planned for a later phase">
          <span className="nav-icon" aria-hidden="true">⚒</span>
          Maintenance
          <small>Later phase</small>
        </span>
        <Link
          className={`nav-item${active === "history" ? " nav-item-active" : ""}`}
          href="/#maintenance-history"
          aria-current={active === "history" ? "page" : undefined}
        >
          <span className="nav-icon" aria-hidden="true">◷</span>
          History
          <small>Service records</small>
        </Link>
        <Link
          className={`nav-item${active === "manual" ? " nav-item-active" : ""}`}
          href="/manual"
          aria-current={active === "manual" ? "page" : undefined}
        >
          <span className="nav-icon" aria-hidden="true">▤</span>
          Manual
          <small>Source PDF</small>
        </Link>
      </nav>

      <div className="rail-spacer" />
      <span className="scope-label">{canManage ? "Local owner mode" : "Read-only deployment"}</span>
    </aside>
  );
}
