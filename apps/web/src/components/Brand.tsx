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
    user: "M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M4 21v-2a8 8 0 0 1 16 0v2",
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
    camera:
      "M14.5 4h-5L7 7V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h1a1 1 0 0 1 1 1v2.7c0 .552.225 1.063.598 1.439l4.172 4.172A1 1 0 0 0 18.121 18h.7A1 1 0 0 0 20 17.3V6a2 2 0 0 0-2-2zM9 12H7V9h2z",
    x: "M18 6L6 18M6 6l12 12",
    flip: "M7 7h10v10H7zM17 3l-5 5 5 5",
    eye: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 17a5 5 0 0 0 5-5 4.9 4.9 0 0 0-2.5-4.3 5 5 0 0 0-5 0 4.9 4.9 0 0 0-2.5 4.3A5 5 0 0 0 12 17z",
    "eye-off": "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 17a5 5 0 0 0 5-5 4.9 4.9 0 0 0-2.5-4.3 5 5 0 0 0-5 0 4.9 4.9 0 0 0-2.5 4.3A5 5 0 0 0 12 17zM3.5 12a6.5 6.5 0 0 1 9.4 2l-1.3 1.3a5 5 0 0 1-1.4-1.4l1.3-1.3A6.5 6.5 0 0 1 3.5 12z",
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
