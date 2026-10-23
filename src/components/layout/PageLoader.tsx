export function PageLoader() {
  return (
    <div className="page" aria-busy="true">
      <div className="skeleton" style={{ height: 44, width: 280 }} />
      <div className="kpi-grid">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 96 }} />)}
      </div>
      <div className="skeleton" style={{ height: 360 }} />
    </div>
  );
}
