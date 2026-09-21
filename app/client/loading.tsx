export default function ClientLoading() {
  return (
    <div className="client-route-loading bg-base-200 text-primary" data-theme="light" role="status" aria-live="polite">
      <span className="loading loading-spinner loading-lg" aria-hidden="true" />
      <p>Đang tải dữ liệu...</p>
    </div>
  );
}
