"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { createOrReusePaymentRequest, type PaymentRequestResult } from "@/app/client/actions";
import { formatMoneyInput, formatVnd, parseMoneyInput } from "@/lib/money";

export type ClientDebtItem = {
  sessionMemberId: string;
  title: string;
  playedAt: string;
  slots: number;
  footballAmount: number;
  defaultWaterAmount: number;
  totalOutstanding: number;
  note: string | null;
  sessionNote: string | null;
};

type WaterSelection = { included: boolean; amount: number };
type Settlement = {
  status: "PAID" | "UNDERPAID" | "OVERPAID" | "CANCELLED" | "REVIEW_REQUIRED";
  expectedAmount: number;
  actualAmount: number | null;
};
const PAYMENT_BANK_ID = "CAKE";
const PAYMENT_ACCOUNT = "0978618991";
const POLLING_INTERVAL_MS = 1_000;
const MAX_POLLING_ATTEMPTS = 600;

function createDefaultWaterSelections(debts: ClientDebtItem[]) {
  return Object.fromEntries(debts.map((debt) => [debt.sessionMemberId, {
    included: true,
    amount: debt.defaultWaterAmount,
  }]));
}

export function PaymentDialog({ userId, debts }: { userId: string; debts: ClientDebtItem[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [qrFailed, setQrFailed] = useState(false);
  const [settlement, setSettlement] = useState<Settlement | null>(null);
  const [pollingTimedOut, setPollingTimedOut] = useState(false);
  const [payment, setPayment] = useState<Extract<PaymentRequestResult, { status: "success" }>["request"] | null>(null);
  const [water, setWater] = useState<Record<string, WaterSelection>>(() => createDefaultWaterSelections(debts));

  const reviewTotal = useMemo(() => debts.reduce((sum, debt) => {
    const selection = water[debt.sessionMemberId];
    return sum + debt.footballAmount + (selection?.included ? selection.amount : 0);
  }, 0), [debts, water]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [open]);

  const paymentCode = payment?.code;
  useEffect(() => {
    if (!open || !paymentCode) return;

    let stopped = false;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function pollStatus() {
      if (stopped) return;
      attempts += 1;

      try {
        const response = await fetch(`/api/payments/${encodeURIComponent(paymentCode!)}/status`, {
          cache: "no-store",
        });
        if (response.ok) {
          const result = await response.json() as { payment: Settlement | { status: "PENDING" } };
          if (result.payment.status !== "PENDING") {
            setSettlement(result.payment as Settlement);
            return;
          }
        }
      } catch {
        // A temporary network error should not interrupt payment checking.
      }

      if (attempts >= MAX_POLLING_ATTEMPTS) {
        setPollingTimedOut(true);
        return;
      }
      timer = setTimeout(pollStatus, POLLING_INTERVAL_MS);
    }

    void pollStatus();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [open, paymentCode]);

  useEffect(() => {
    if (settlement?.status !== "PAID") return;
    const timer = setTimeout(() => {
      setOpen(false);
      setPayment(null);
      setSettlement(null);
      setPollingTimedOut(false);
      router.refresh();
    }, 2_000);
    return () => clearTimeout(timer);
  }, [router, settlement?.status]);

  function toggleWater(debt: ClientDebtItem) {
    setWater((current) => {
      const previous = current[debt.sessionMemberId];
      return {
        ...current,
        [debt.sessionMemberId]: {
          included: !previous?.included,
          amount: previous?.amount || debt.defaultWaterAmount,
        },
      };
    });
  }

  function createPayment() {
    setError("");
    startTransition(async () => {
      const result = await createOrReusePaymentRequest({
        userId,
        sessions: debts.map((debt) => ({
          sessionMemberId: debt.sessionMemberId,
          waterAmount: water[debt.sessionMemberId]?.included ? water[debt.sessionMemberId].amount : 0,
        })),
      });
      if (result.status === "error") {
        setError(result.message);
        return;
      }
      setQrFailed(false);
      setSettlement(null);
      setPollingTimedOut(false);
      setPayment(result.request);
    });
  }

  function closeDialog() {
    if (isPending) return;
    setOpen(false);
    setPayment(null);
    setQrFailed(false);
    setSettlement(null);
    setPollingTimedOut(false);
    setWater(createDefaultWaterSelections(debts));
    setError("");
  }

  function retryPayment() {
    if (isPending) return;
    setPayment(null);
    setQrFailed(false);
    setSettlement(null);
    setPollingTimedOut(false);
    createPayment();
  }

  const qrUrl = payment
    ? `https://img.vietqr.io/image/${PAYMENT_BANK_ID}-${PAYMENT_ACCOUNT}-compact2.jpg?amount=${payment.expectedAmount}&addInfo=${encodeURIComponent(payment.code)}`
    : "";
  const settlementIsMismatch = settlement?.status === "UNDERPAID" || settlement?.status === "OVERPAID";

  return (
    <>
      <button className="client-pay-all" type="button" onClick={() => setOpen(true)}>
        Trả tất cả
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
      </button>

      {open ? (
        <div className="client-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDialog(); }}>
          <section className={`client-payment-dialog ${payment ? "qr-step" : ""}`} role="dialog" aria-modal="true" aria-labelledby="payment-dialog-title" aria-busy={isPending}>
            <button className="client-dialog-close" type="button" aria-label="Đóng" onClick={closeDialog}>×</button>
            {isPending ? (
              <div className="client-api-loading" role="status" aria-live="polite">
                <span aria-hidden="true" />
                <p>Đang tạo mã thanh toán...</p>
              </div>
            ) : null}

            {settlement ? (
              <div className={`payment-result ${settlement.status === "PAID" ? "success" : "mismatch"}`} role="status" aria-live="polite">
                <span className="payment-result-icon" aria-hidden="true">{settlement.status === "PAID" ? "✓" : "!"}</span>
                <p className="client-kicker">{settlement.status === "PAID" ? "THANH TOÁN THÀNH CÔNG" : settlementIsMismatch ? "CHUYỂN SAI SỐ TIỀN" : settlement.status === "CANCELLED" ? "MÃ ĐÃ HẾT HIỆU LỰC" : "GIAO DỊCH CẦN KIỂM TRA"}</p>
                <h2 id="payment-dialog-title">
                  {settlement.status === "PAID"
                    ? "Đã ghi nhận khoản thanh toán"
                    : settlementIsMismatch
                      ? "Số tiền chuyển không khớp"
                        : settlement.status === "CANCELLED"
                          ? "Thông tin thanh toán đã thay đổi"
                          : "Đã nhận tiền từ mã cũ"}
                </h2>
                <p>
                  {settlement.status === "PAID"
                    ? "Danh sách khoản nợ đang được cập nhật. Bạn sẽ tự động quay lại màn chi tiết."
                    : settlementIsMismatch
                      ? `Cần chuyển ${formatVnd(settlement.expectedAmount)}, đã nhận ${formatVnd(settlement.actualAmount ?? 0)}. Khoản nợ vẫn được giữ nguyên; bạn có thể tạo QR mới ngay.`
                    : settlement.status === "CANCELLED"
                      ? "Mã này không còn hiệu lực. Hãy quay lại chi tiết và tạo QR mới với số tiền mới nhất."
                      : `Yêu cầu ${formatVnd(settlement.expectedAmount)}, đã nhận ${formatVnd(settlement.actualAmount ?? 0)}. Vui lòng liên hệ admin để kiểm tra.`}
                </p>
                {settlement.status === "PAID" ? <span className="payment-returning"><i />Đang quay lại màn chi tiết...</span> : (
                  <button type="button" onClick={settlementIsMismatch ? retryPayment : () => { closeDialog(); router.refresh(); }}>{settlementIsMismatch ? "Tạo lại QR" : "Quay lại chi tiết"}</button>
                )}
              </div>
            ) : payment ? (
              <div className="qr-content">
                <p className="client-kicker" id="payment-dialog-title">SẴN SÀNG THANH TOÁN</p>
                <div className={`qr-image-shell ${qrFailed ? "qr-failed" : ""}`}>
                  {qrFailed ? (
                    <div className="qr-fallback" role="alert">
                      <span aria-hidden="true">!</span>
                      <strong>Không tải được mã QR</strong>
                      <p>Bạn có thể chuyển khoản thủ công bằng thông tin bên dưới.</p>
                    </div>
                  ) : (
                    <Image src={qrUrl} alt={`QR thanh toán ${payment.code}`} width={420} height={560} unoptimized priority onError={() => setQrFailed(true)} />
                  )}
                </div>
                <a
                  className="qr-download-button"
                  href={`/api/payments/${encodeURIComponent(payment.code)}/qr`}
                  download={`QR-${payment.code}.png`}
                >
                  Lưu ảnh QR
                </a>
                <strong className="qr-total">{formatVnd(payment.expectedAmount)}</strong>
                <div className="payment-account"><span>Số tài khoản</span><strong>{PAYMENT_ACCOUNT}</strong><button type="button" onClick={() => navigator.clipboard?.writeText(PAYMENT_ACCOUNT)}>Sao chép</button></div>
                <div className="payment-code"><span>Nội dung chuyển khoản</span><strong>{payment.code}</strong><button type="button" onClick={() => navigator.clipboard?.writeText(payment.code)}>Sao chép</button></div>
                <p className="payment-waiting"><i />{pollingTimedOut ? "Chưa nhận được kết quả. Bạn có thể đóng và kiểm tra lại sau." : "Đang chờ xác nhận thanh toán..."}</p>
                <p className="qr-note">Vui lòng giữ nguyên số tiền và nội dung để hệ thống tự đối soát.</p>
              </div>
            ) : (
              <>
                <div className="client-dialog-heading compact">
                  <p className="client-kicker" id="payment-dialog-title">KIỂM TRA TRƯỚC KHI TRẢ</p>
                </div>

                <div className="water-review-list">
                  {debts.map((debt) => {
                    const selection = water[debt.sessionMemberId];
                    return (
                      <div className="water-review-item" key={debt.sessionMemberId}>
                        <div className="water-session-info">
                          <div className="water-session-heading"><strong>{debt.title}</strong><span>· {new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(new Date(debt.playedAt))}</span></div>
                          {debt.note ? <small className="water-member-note">Ghi chú: {debt.note}</small> : null}
                        </div>
                        <div className="water-cost-breakdown">
                          <div className="water-cost-row football-cost"><span>Tiền bóng × {debt.slots} slot</span><strong>{formatVnd(debt.footballAmount)}</strong></div>
                          <div className="water-cost-row">
                            <label className="water-checkbox"><input type="checkbox" checked={selection?.included ?? false} onChange={() => toggleWater(debt)} /><i>{selection?.included ? "✓" : ""}</i><span>Tiền nước</span></label>
                            {selection?.included ? (
                              <div className="water-money-input"><input aria-label={`Tiền nước ${debt.title}`} type="text" inputMode="numeric" value={formatMoneyInput(selection.amount)} onChange={(event) => setWater((current) => ({ ...current, [debt.sessionMemberId]: { included: true, amount: parseMoneyInput(event.target.value) } }))} placeholder="0" /><span>đ</span></div>
                            ) : <span className="water-cost-empty">0 đ</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="client-payment-summary"><span>Tổng thanh toán</span><strong>{formatVnd(reviewTotal)}</strong></div>
                {error ? <div className="client-error" role="alert">! {error}</div> : null}
                <button className="generate-qr-button" type="button" disabled={isPending} onClick={createPayment}>
                  {isPending ? <span className="spinner" /> : null}{isPending ? "Đang tạo mã..." : "Xác nhận và tạo QR"}
                </button>
              </>
            )}
          </section>
        </div>
      ) : null}
    </>
  );
}
