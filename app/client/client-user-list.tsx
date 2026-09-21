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
      <label className="input input-lg client-user-search w-full border-base-300 bg-base-100 shadow-sm">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
        <input aria-label="Tìm người dùng theo tên" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm theo tên..." autoComplete="off" />
        {query ? <button className="btn btn-circle btn-ghost btn-sm" type="button" aria-label="Xóa nội dung tìm kiếm" onClick={() => setQuery("")}>×</button> : null}
      </label>

      <ul className="list client-user-list rounded-box border border-base-300 bg-base-100 p-2 shadow-sm" aria-label="Danh sách người dùng">
        {filteredUsers.map((user, index) => (
          <li className="list-row p-0" key={user.id}>
            <Link className="list-col-grow client-user-card" href={`/client/${user.id}`}>
              <UserAvatar name={user.name} avatarKey={user.avatarKey} className="client-user-avatar" toneIndex={index} />
              <span className="client-user-name">
                <span className="client-user-title">
                  <strong>{user.name}</strong>
                  {user.recentlyPaid ? <span className="badge badge-success badge-soft badge-sm client-recent-payment">Thanh toán gần đây</span> : null}
                </span>
                <small>{user.debtCount ? `${user.debtCount} khoản chưa thanh toán` : "Không còn khoản nào cần trả"}</small>
              </span>
              <span className={`client-user-debt ${user.debtCount ? "has-debt" : "clear"}`}>
                <span className={`badge badge-soft ${user.debtCount ? "badge-error" : "badge-success"}`}>
                  {user.debtCount ? formatVnd(user.outstanding) : "Hết nợ"}
                </span>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
              </span>
            </Link>
          </li>
        ))}
        {!users.length ? <li className="client-empty"><h2>Chưa có người dùng</h2><p>Danh sách sẽ xuất hiện sau khi admin thêm người.</p></li> : null}
        {users.length && !filteredUsers.length ? <li className="client-empty client-search-empty"><h2>Không tìm thấy tên này</h2><p>Thử nhập một tên khác.</p></li> : null}
      </ul>
    </>
  );
}
