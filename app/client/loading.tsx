export default function ClientLoading() {
  return (
    <div className="client-route-loading" role="status" aria-live="polite">
      <span aria-hidden="true" />
      <p>Đang tải dữ liệu...</p>
    </div>
  );
}
