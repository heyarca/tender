import { ProviderLogo } from "@/components/ui/provider-logo";
import { getProvider } from "@/lib/registry";

/** Provider logo and name from the registry. Unknown ids show the id. */
export function ProviderName({ providerId }: { providerId: string }) {
  const provider = getProvider(providerId);
  const name = provider?.name ?? providerId;
  return (
    <span className="flex min-w-0 items-center gap-2.5 text-foreground">
      <ProviderLogo src={provider?.logo || null} name={name} size={20} />
      <span className="truncate text-xs">{name}</span>
    </span>
  );
}
