export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-brand"><span>₫</span><strong>MoneyFlow</strong></div>
        <div className="login-heading"><h1>Đăng nhập quản trị</h1><p>Nhập tài khoản admin để tiếp tục.</p></div>
        {error ? <div className="login-error" role="alert">Tài khoản hoặc mật khẩu không đúng.</div> : null}
        <form action="/api/auth/login" method="post" className="login-form">
          <input type="hidden" name="next" value={next ?? "/admin"} />
          <label><span>Tài khoản</span><input name="username" type="text" autoComplete="username" autoFocus required /></label>
          <label><span>Mật khẩu</span><input name="password" type="password" autoComplete="current-password" required /></label>
          <button className="primary-button" type="submit">Đăng nhập</button>
        </form>
      </section>
    </main>
  );
}
