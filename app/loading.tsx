export default function Loading() {
  return (
    <div className="route-loading" role="status" aria-live="polite">
      <span className="route-loading-spinner" aria-hidden="true" />
      <p>Đang tải dữ liệu...</p>
    </div>
  );
}
