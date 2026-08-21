"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { saveCollection } from "@/app/collections/actions";
import type { CollectionEditorData, CollectionUser } from "@/app/collections/types";
import { allocateBySlots, formatMoneyInput, formatVnd, parseMoneyInput, roundUpToOneThousand } from "@/lib/money";

export function CollectionEditor({ users, initial }: { users: CollectionUser[]; initial?: CollectionEditorData }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState("");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [playedAt, setPlayedAt] = useState(initial?.playedAt ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [totalAmount, setTotalAmount] = useState(initial?.totalAmount ?? 0);
  const [defaultWaterAmount, setDefaultWaterAmount] = useState(initial?.defaultWaterAmount ?? 0);
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>(initial?.members.map((member) => member.userId) ?? []);
  const [slots, setSlots] = useState<Record<string, number>>(
    Object.fromEntries(initial?.members.map((member) => [member.userId, member.slots]) ?? []),
  );
  const [amounts, setAmounts] = useState<Record<string, number>>(
    Object.fromEntries(initial?.members.map((member) => [member.userId, member.amountDue]) ?? []),
  );

  const membersByUser = useMemo(
    () => new Map(initial?.members.map((member) => [member.userId, member]) ?? []),
    [initial],
  );
  const selectedUsers = users.filter((user) => selectedIds.includes(user.id));
  const totalSlots = selectedIds.reduce((sum, userId) => sum + (slots[userId] ?? 1), 0);
  const amountPerSlot = totalSlots
    ? roundUpToOneThousand(totalAmount / totalSlots)
    : 0;
  const allocatedAmount = selectedIds.reduce((sum, userId) => sum + (amounts[userId] ?? 0), 0);
  const difference = allocatedAmount - totalAmount;

  function distributeEvenly(ids: string[], total: number, slotValues = slots) {
    setAmounts(allocateBySlots(
      total,
      ids.map((id) => ({ id, slots: slotValues[id] ?? 1 })),
    ));
  }

  function changeTotal(value: number) {
    const nextTotal = Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
    setTotalAmount(nextTotal);
    if (selectedIds.length) distributeEvenly(selectedIds, nextTotal);
  }

  function toggleUser(userId: string) {
    const isSelected = selectedIds.includes(userId);
    const nextIds = isSelected ? selectedIds.filter((id) => id !== userId) : [...selectedIds, userId];
    const nextSlots = { ...slots };
    if (isSelected) delete nextSlots[userId];
    else nextSlots[userId] = 1;
    setSelectedIds(nextIds);
    setSlots(nextSlots);
    distributeEvenly(nextIds, totalAmount, nextSlots);
  }

  function selectAll() {
    const nextIds = selectedIds.length === users.length ? [] : users.map((user) => user.id);
    const nextSlots = Object.fromEntries(nextIds.map((id) => [id, slots[id] ?? 1]));
    setSelectedIds(nextIds);
    setSlots(nextSlots);
    distributeEvenly(nextIds, totalAmount, nextSlots);
  }

  function changeSlots(userId: string, difference: number) {
    const nextSlots = { ...slots, [userId]: Math.max(1, (slots[userId] ?? 1) + difference) };
    setSlots(nextSlots);
    distributeEvenly(selectedIds, totalAmount, nextSlots);
  }

  function validate() {
    if (title.trim().length < 3) return "Nhập tên buổi bóng có ít nhất 3 ký tự.";
    if (!playedAt) return "Chọn ngày giờ đá bóng.";
    if (totalAmount <= 0) return "Nhập tổng tiền lớn hơn 0.";
    if (!selectedIds.length) return "Chọn ít nhất một người tham gia.";
    if (selectedIds.some((id) => !Number.isInteger(amounts[id]) || amounts[id] < 0)) return "Kiểm tra lại số tiền của người tham gia.";
    return "";
  }

  function openPreview() {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError("");
    setPreview(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function save(status: "DRAFT" | "PUBLISHED") {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      setPreview(false);
      return;
    }

    setError("");
    startTransition(async () => {
      const result = await saveCollection({
        id: initial?.id,
        title,
        playedAt,
        note,
        totalAmount,
        defaultWaterAmount,
        status,
        adjustmentReason,
        members: selectedIds.map((userId) => ({ userId, slots: slots[userId] ?? 1, amountDue: amounts[userId] ?? 0 })),
      });
      if (result.status === "error") {
        setError(result.message);
        return;
      }
      router.push("/collections");
      router.refresh();
    });
  }

  if (preview) {
    return (
      <div className="collection-preview">
        <div className="preview-banner">
          <div>
            <p className="eyebrow">KIỂM TRA LẦN CUỐI</p>
            <h2>Preview khoản thu</h2>
            <p>Đây là dữ liệu người dùng sẽ nhìn thấy sau khi public.</p>
          </div>
          <span className="draft-pill">{initial?.status === "PUBLISHED" ? "Đang public" : "Bản nháp"}</span>
        </div>

        <section className="preview-summary panel">
          <div><span>Buổi bóng</span><strong>{title}</strong></div>
          <div><span>Ngày đá</span><strong>{new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(playedAt))}</strong></div>
          <div><span>Người tham gia</span><strong>{selectedIds.length} người · {totalSlots} slot</strong></div>
          <div><span>Tiền nước gợi ý</span><strong>{formatVnd(defaultWaterAmount)}</strong></div>
        </section>

        <section className="money-overview">
          <div className="money-card"><span>Tổng tiền nhập</span><strong>{formatVnd(totalAmount)}</strong></div>
          <div className="money-card"><span>Tổng đã phân bổ</span><strong>{formatVnd(allocatedAmount)}</strong></div>
          <div className={`money-card ${difference === 0 ? "balanced" : "different"}`}>
            <span>Chênh lệch</span><strong>{difference > 0 ? "+" : ""}{formatVnd(difference)}</strong>
          </div>
        </section>

        {difference !== 0 ? (
          <div className="preview-warning"><span>!</span>Tổng tiền phân bổ đang {difference > 0 ? "cao hơn" : "thấp hơn"} tổng tiền buổi bóng {formatVnd(Math.abs(difference))}. Bạn vẫn có thể public.</div>
        ) : null}

        <article className="panel preview-members">
          <div className="list-header"><div><h2>Chi tiết từng người</h2><p>Số tiền cuối cùng do admin xác nhận</p></div></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Người tham gia</th><th>Slot</th><th>Đã thanh toán</th><th>Phải đóng</th></tr></thead>
              <tbody>
                {selectedUsers.map((user, index) => (
                  <tr key={user.id}>
                    <td><span className={`user-avatar tone-${index % 5}`}>{user.name[0]?.toUpperCase()}</span><strong>{user.name}</strong></td>
                    <td><span className="slot-count-badge">{slots[user.id] ?? 1} slot</span></td>
                    <td>{formatVnd(membersByUser.get(user.id)?.amountPaid ?? 0)}</td>
                    <td><strong className="amount-emphasis">{formatVnd(amounts[user.id] ?? 0)}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        {error ? <div className="editor-error" role="alert">! {error}</div> : null}
        <div className="editor-footer preview-footer">
          <button className="secondary-button" type="button" disabled={isPending} onClick={() => setPreview(false)}>Quay lại chỉnh sửa</button>
          <div>
            {initial?.status !== "PUBLISHED" ? <button className="secondary-button" type="button" disabled={isPending} onClick={() => save("DRAFT")}>Lưu bản nháp</button> : null}
            <button className="primary-button publish-button" type="button" disabled={isPending} onClick={() => save("PUBLISHED")}>
              {isPending ? <span className="spinner" /> : null}
              {isPending ? "Đang lưu..." : initial?.status === "PUBLISHED" ? "Lưu thay đổi" : "Public khoản thu"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="collection-editor">
      <div className="collection-editor-grid">
        <section className="panel editor-panel">
          <div className="editor-section-heading"><span>01</span><div><h2>Thông tin buổi bóng</h2><p>Nhập tổng chi phí cần thu.</p></div></div>
          <div className="editor-fields">
            <div className="field-group full-field"><label htmlFor="collection-title">Tên buổi bóng</label><input id="collection-title" className="plain-input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ví dụ: Đá bóng tối thứ 5" maxLength={100} /></div>
            <div className="field-group full-field"><label htmlFor="played-at">Ngày đá</label><input id="played-at" className="plain-input" type="date" value={playedAt} onChange={(event) => setPlayedAt(event.target.value)} /></div>
            <div className="field-group full-field"><label htmlFor="total-amount">Tổng tiền</label><div className="money-input"><input id="total-amount" type="text" inputMode="numeric" value={formatMoneyInput(totalAmount)} onChange={(event) => changeTotal(parseMoneyInput(event.target.value))} placeholder="0" /><span>VNĐ</span></div></div>
            <div className="field-group full-field"><label htmlFor="water-amount">Tiền nước gợi ý</label><div className="money-input"><input id="water-amount" type="text" inputMode="numeric" value={formatMoneyInput(defaultWaterAmount)} onChange={(event) => setDefaultWaterAmount(parseMoneyInput(event.target.value))} placeholder="0" /><span>VNĐ</span></div><small className="field-hint">Client sẽ thấy số tiền này khi tích “Có uống nước” và có thể sửa lại.</small></div>
            <div className="field-group full-field"><label htmlFor="collection-note">Ghi chú</label><textarea id="collection-note" className="plain-input" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Thông tin thêm về buổi bóng..." maxLength={500} /></div>
            {initial?.status === "PUBLISHED" ? <div className="field-group full-field"><label htmlFor="adjustment-reason">Lý do điều chỉnh</label><input id="adjustment-reason" className="plain-input" value={adjustmentReason} onChange={(event) => setAdjustmentReason(event.target.value)} placeholder="Ví dụ: Bổ sung tiền nước" maxLength={200} /></div> : null}
          </div>
        </section>

        <section className="panel editor-panel participant-panel">
          <div className="editor-section-heading participant-heading">
            <span>02</span><div><h2>Chọn người tham gia</h2><p>Thêm/bớt người sẽ chia đều lại toàn bộ.</p></div>
            <button type="button" onClick={selectAll}>{selectedIds.length === users.length && users.length ? "Bỏ chọn" : "Chọn tất cả"}</button>
          </div>
          <div className="participant-list">
            {users.map((user, index) => {
              const selected = selectedIds.includes(user.id);
              return (
                <label className={`participant-choice ${selected ? "selected" : ""}`} key={user.id}>
                  <input type="checkbox" checked={selected} onChange={() => toggleUser(user.id)} />
                  <span className={`user-avatar tone-${index % 5}`}>{user.name[0]?.toUpperCase()}</span>
                  <span>{user.name}</span>
                  <i>{selected ? "✓" : ""}</i>
                </label>
              );
            })}
            {!users.length ? <div className="mini-empty">Chưa có người dùng. Hãy tạo người dùng trước.</div> : null}
          </div>
        </section>
      </div>

      {selectedIds.length ? (
        <section className="panel allocation-panel">
          <div className="allocation-heading">
            <div><p className="eyebrow">PHÂN BỔ CHI PHÍ</p><h2>Chỉnh slot và số tiền</h2><p>{totalSlots} slot · <strong>{formatVnd(amountPerSlot)}</strong>/slot, đã làm tròn lên 1.000đ.</p></div>
            <button className="recalculate-button" type="button" onClick={() => distributeEvenly(selectedIds, totalAmount)}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" /></svg>
              Chia đều lại
            </button>
          </div>
          <div className="allocation-list">
            {selectedUsers.map((user, index) => (
              <div className="allocation-row" key={user.id}>
                <div className="allocation-user"><span className={`user-avatar tone-${index % 5}`}>{user.name[0]?.toUpperCase()}</span><div><strong>{user.name}</strong><small>{membersByUser.get(user.id)?.amountPaid ? `Đã trả ${formatVnd(membersByUser.get(user.id)!.amountPaid)}` : "Chưa thanh toán"}</small></div></div>
                <div className="allocation-controls">
                  <div className="slot-stepper" aria-label={`Số slot của ${user.name}`}>
                    <button type="button" aria-label={`Giảm slot của ${user.name}`} disabled={(slots[user.id] ?? 1) <= 1} onClick={() => changeSlots(user.id, -1)}>−</button>
                    <span><strong>{slots[user.id] ?? 1}</strong><small>slot</small></span>
                    <button type="button" aria-label={`Tăng slot của ${user.name}`} onClick={() => changeSlots(user.id, 1)}>+</button>
                  </div>
                  <div className="compact-money-input"><input aria-label={`Số tiền của ${user.name}`} type="text" inputMode="numeric" value={formatMoneyInput(amounts[user.id] ?? 0)} onChange={(event) => setAmounts((current) => ({ ...current, [user.id]: parseMoneyInput(event.target.value) }))} placeholder="0" /><span>đ</span></div>
                </div>
              </div>
            ))}
          </div>
          <div className="allocation-total"><span>Tổng đã phân bổ</span><strong>{formatVnd(allocatedAmount)}</strong><em className={difference === 0 ? "balanced" : ""}>{difference === 0 ? "Đã khớp" : `Chênh ${difference > 0 ? "+" : ""}${formatVnd(difference)}`}</em></div>
        </section>
      ) : null}

      {error ? <div className="editor-error" role="alert">! {error}</div> : null}
      <div className="editor-footer">
        <Link className="secondary-button" href="/collections">Hủy</Link>
        <div>
          {initial?.status !== "PUBLISHED" ? <button className="secondary-button" type="button" disabled={isPending} onClick={() => save("DRAFT")}>Lưu bản nháp</button> : null}
          <button className="primary-button preview-button" type="button" onClick={openPreview}>Xem trước <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg></button>
        </div>
      </div>
    </div>
  );
}
