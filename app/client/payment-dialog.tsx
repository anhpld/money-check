"use client";

import Image from "next/image";
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
  waterAmount: number | null;
  totalOutstanding: number;
  note: string | null;
};

type WaterSelection = { included: boolean; amount: number };

export function PaymentDialog({ userId, userName, debts }: { userId: string; userName: string; debts: ClientDebtItem[] }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [payment, setPayment] = useState<Extract<PaymentRequestResult, { status: "success" }>["request"] | null>(null);
  const [water, setWater] = useState<Record<string, WaterSelection>>(() => Object.fromEntries(
    debts.map((debt) => [debt.sessionMemberId, {
      included: (debt.waterAmount ?? 0) > 0,
      amount: debt.waterAmount ?? debt.defaultWaterAmount,
    }]),
  ));

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
      setPayment(result.request);
    });
  }

  function closeDialog() {
    if (isPending) return;
    setOpen(false);
    setPayment(null);
    setError("");
  }

  const qrUrl = payment
    ? `https://img.vietqr.io/image/momo-PSP2623210100000214-compact2.jpg?amount=${payment.expectedAmount}&addInfo=${encodeURIComponent(payment.code)}`
    : "";

  return (
    <>
      <button className="client-pay-all" type="button" onClick={() => setOpen(true)}>
        Trả tất cả · {formatVnd(debts.reduce((sum, debt) => sum + debt.footballAmount + (debt.waterAmount ?? 0), 0))}
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
      </button>

      {open ? (
        <div className="client-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDialog(); }}>
          <section className={`client-payment-dialog ${payment ? "qr-step" : ""}`} role="dialog" aria-modal="true" aria-labelledby="payment-dialog-title">
            <button className="client-dialog-close" type="button" aria-label="Đóng" onClick={closeDialog}>×</button>

            {payment ? (
              <div className="qr-content">
                <p className="client-kicker">SẴN SÀNG THANH TOÁN</p>
                <h2 id="payment-dialog-title">Quét mã để trả tiền</h2>
                <p className="qr-subtitle">QR của {userName} · {payment.items.length} buổi</p>
                {payment.reused ? <div className="reused-notice">Đang dùng lại mã thanh toán chưa hoàn tất trước đó.</div> : null}
                <div className="qr-image-shell">
                  <Image src={qrUrl} alt={`QR thanh toán ${payment.code}`} width={420} height={560} unoptimized priority />
                </div>
                <strong className="qr-total">{formatVnd(payment.expectedAmount)}</strong>
                <div className="payment-code"><span>Nội dung chuyển khoản</span><strong>{payment.code}</strong><button type="button" onClick={() => navigator.clipboard?.writeText(payment.code)}>Sao chép</button></div>
                <p className="qr-note">Vui lòng giữ nguyên số tiền và nội dung để hệ thống tự đối soát.</p>
              </div>
            ) : (
              <>
                <div className="client-dialog-heading">
                  <p className="client-kicker">KIỂM TRA TRƯỚC KHI TRẢ</p>
                  <h2 id="payment-dialog-title">Bạn có uống nước không?</h2>
                  <p>Tích vào từng buổi có uống nước và sửa số tiền nếu cần.</p>
                </div>

                <div className="water-review-list">
                  {debts.map((debt) => {
                    const selection = water[debt.sessionMemberId];
                    return (
                      <div className="water-review-item" key={debt.sessionMemberId}>
                        <div className="water-session-info">
                          <span>{new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(new Date(debt.playedAt))}</span>
                          <strong>{debt.title}</strong>
                          <small>{debt.slots} slot · Tiền bóng {formatVnd(debt.footballAmount)}</small>
                        </div>
                        <label className="water-checkbox"><input type="checkbox" checked={selection?.included ?? false} onChange={() => toggleWater(debt)} /><i>{selection?.included ? "✓" : ""}</i><span>Có uống nước</span></label>
                        {selection?.included ? (
                          <div className="water-money-input"><input aria-label={`Tiền nước ${debt.title}`} type="text" inputMode="numeric" value={formatMoneyInput(selection.amount)} onChange={(event) => setWater((current) => ({ ...current, [debt.sessionMemberId]: { included: true, amount: parseMoneyInput(event.target.value) } }))} placeholder="0" /><span>đ</span></div>
                        ) : null}
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
