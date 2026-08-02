import Link from "next/link";
import Image from "next/image";

export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <Image
      className={className}
      src="/brand/agentprint-mark.svg"
      alt=""
      width={32}
      height={32}
      unoptimized
    />
  );
}

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="brand" aria-label="Agentprint home">
      {compact ? (
        <BrandMark className="brand-mark" />
      ) : (
        <Image
          className="brand-lockup"
          src="/brand/agentprint-lockup.svg"
          alt=""
          width={360}
          height={80}
          priority
          unoptimized
        />
      )}
    </Link>
  );
}
