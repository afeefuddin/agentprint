import Image from "next/image";
import { cx, profileAvatarClass } from "@/lib/ui";

function initials(name: string) {
  return name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

export function ProfileAvatar({
  handle,
  name,
  updatedAt,
  className
}: {
  handle: string;
  name: string;
  updatedAt?: string | Date | null;
  className?: string;
}) {
  const version = updatedAt ? new Date(updatedAt).getTime() : null;
  return (
    <span className={cx(profileAvatarClass, "relative overflow-hidden", className)} aria-hidden="true">
      {version ? (
        <Image
          src={`/v1/profiles/${encodeURIComponent(handle)}/avatar?v=${version}`}
          alt=""
          fill
          sizes="76px"
          unoptimized
          className="object-cover"
        />
      ) : initials(name)}
    </span>
  );
}
