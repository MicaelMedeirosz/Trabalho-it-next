export function Brand({ light = false }: { light?: boolean }) {
  return (
    <div
      className={`brand ${light ? "brand-light" : ""}`}
      aria-label="ITNEXT — Data workspace"
    >
      <img
        className="brand-logo"
        src="/itnext-logo.png"
        alt="ITNEXT"
        width="260"
        height="88"
      />
      <div className="brand-caption">DATA WORKSPACE</div>
    </div>
  );
}

export function Icon({
  name,
  className = "",
}: {
  name: string;
  className?: string;
}) {
  const paths: Record<string, string> = {
    upload: "M12 16V4m-4 4 4-4 4 4M4 16v4h16v-4",
    grid: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
    shield: "M12 3 3 7v5c0 5 9 9 9 9s9-4 9-9V7zM8 12l3 3 5-6",
    clock: "M12 8v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0",
    chart: "M4 3v18h17M8 16v-4m5 4V7m5 9v-6",
    database:
      "M20 6c0 2-4 3-8 3S4 8 4 6s4-3 8-3 8 1 8 3ZM4 6v12c0 2 4 3 8 3s8-1 8-3V6M4 12c0 2 4 3 8 3s8-1 8-3",
    exit: "M9 4H4v16h5m5-13 5 5-5 5M9 12h10",
    arrow: "M5 12h14m-5-5 5 5-5 5",
    file: "M14 2H5v20h14V7l-5-5v5h5M8 12h8M8 16h6",
  };
  return (
    <svg
      className={className}
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] ?? paths.database} />
    </svg>
  );
}
