"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { UserAvatar } from "@/app/components/user-avatar";
import { formatVnd } from "@/lib/money";

type ClientUserSummary = {
  id: string;
  name: string;
  avatarKey: string | null;
  debtCount: number;
  outstanding: number;
  recentlyPaid: boolean;
};

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/đ/gi, "d")
    .toLocaleLowerCase("vi")
    .trim();
}

export function ClientUserList({ users }: { users: ClientUserSummary[] }) {
  const [query, setQuery] = useState("");
  const normalizedQuery = normalizeSearch(query);
  const filteredUsers = useMemo(
    () => normalizedQuery ? users.filter((user) => normalizeSearch(user.name).includes(normalizedQuery)) : users,
    [normalizedQuery, users],
  );

  return (
    <>
      <div className="client-user-search">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
        <input aria-label="Tìm người dùng theo tên" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm theo tên..." autoComplete="off" />
        {query ? <button type="button" aria-label="Xóa nội dung tìm kiếm" onClick={() => setQuery("")}>×</button> : null}
      </div>

      <section className="client-user-list" aria-label="Danh sách người dùng">
        {filteredUsers.map((user, index) => (
          <Link className="client-user-card" href={`/client/${user.id}`} key={user.id}>
            <UserAvatar name={user.name} avatarKey={user.avatarKey} className="client-user-avatar" toneIndex={index} />
            <span className="client-user-name">
              <span className="client-user-title">
                <strong>{user.name}</strong>
                {user.recentlyPaid ? <span className="client-recent-payment">Thanh toán gần đây</span> : null}
              </span>
              <small>{user.debtCount ? `${user.debtCount} buổi chưa thanh toán` : "Không còn khoản nào cần trả"}</small>
            </span>
            <span className={`client-user-debt ${user.debtCount ? "has-debt" : "clear"}`}>
              <strong>{user.debtCount ? formatVnd(user.outstanding) : "Hết nợ"}</strong>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
            </span>
          </Link>
        ))}
        {!users.length ? <div className="client-empty"><h2>Chưa có người dùng</h2><p>Danh sách sẽ xuất hiện sau khi admin thêm người.</p></div> : null}
        {users.length && !filteredUsers.length ? <div className="client-empty client-search-empty"><h2>Không tìm thấy tên này</h2><p>Thử nhập một tên khác.</p></div> : null}
      </section>
    </>
  );
}
