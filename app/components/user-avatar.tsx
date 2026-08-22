"use client";

import Image from "next/image";
import { useState } from "react";

type UserAvatarProps = {
  name: string;
  avatarKey: string | null;
  className: string;
  toneIndex?: number;
};

export function UserAvatar({ name, avatarKey, className, toneIndex = 0 }: UserAvatarProps) {
  const [failedAvatarKey, setFailedAvatarKey] = useState<string | null>(null);
  const hasImage = Boolean(avatarKey && avatarKey !== failedAvatarKey);

  return (
    <span className={`${className} tone-${toneIndex % 5} ${hasImage ? "has-image" : ""}`}>
      {hasImage && avatarKey ? (
        <Image
          src={`/api/avatars/${encodeURIComponent(avatarKey)}`}
          alt=""
          width={96}
          height={96}
          unoptimized
          onError={() => setFailedAvatarKey(avatarKey)}
        />
      ) : name.slice(0, 1).toUpperCase()}
    </span>
  );
}
