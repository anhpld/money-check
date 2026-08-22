import Image from "next/image";

type UserAvatarProps = {
  name: string;
  avatarKey: string | null;
  className: string;
  toneIndex?: number;
};

export function UserAvatar({ name, avatarKey, className, toneIndex = 0 }: UserAvatarProps) {
  return (
    <span className={`${className} tone-${toneIndex % 5} ${avatarKey ? "has-image" : ""}`}>
      {avatarKey ? (
        <Image
          src={`/api/avatars/${encodeURIComponent(avatarKey)}`}
          alt=""
          width={96}
          height={96}
          unoptimized
        />
      ) : name.slice(0, 1).toUpperCase()}
    </span>
  );
}
