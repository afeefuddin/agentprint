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

export function Brand({ compact = false, className = "" }: { compact?: boolean; className?: string }) {
  return (
    <Link href="/" className={`inline-flex items-center ${className}`} aria-label="Agentprint home">
      {compact ? (
        <BrandMark className="block size-7" />
      ) : (
        <Image
          className="block h-7 w-[126px] max-desktop:h-[23px] max-desktop:w-[104px]"
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
