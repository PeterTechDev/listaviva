// src/components/provider-card.tsx
import { Link } from "@/i18n/navigation";
import { WhatsAppIcon } from "@/components/whatsapp-icon";

interface ProviderCardProps {
  name: string;
  slug: string;
  photoUrl?: string | null;
  categoryIcon?: string | null;
  bairroName?: string | null;
  description?: string | null;
  whatsapp?: string | null;
  categories?: {
    name_pt: string;
    name_en?: string | null;
    icon?: string | null;
  }[];
  locale: string;
  contactLabel: string;
}

export function ProviderCard({
  name,
  slug,
  photoUrl,
  categoryIcon,
  bairroName,
  description,
  whatsapp,
  categories,
  locale,
  contactLabel,
}: ProviderCardProps) {
  return (
    <div className="bg-surface rounded-xl border border-border overflow-hidden hover:shadow-md transition-shadow">
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoUrl}
          alt={name}
          className="w-full h-40 object-cover"
        />
      ) : (
        <div className="w-full h-40 bg-background flex items-center justify-center">
          <span className="text-4xl">{categoryIcon ?? "🏢"}</span>
        </div>
      )}
      <div className="p-4">
        <Link
          href={`/provider/${slug}`}
          className="font-semibold text-primary hover:text-accent transition-colors"
        >
          {name}
        </Link>
        {bairroName && (
          <p className="text-xs text-accent mt-0.5">📍 {bairroName}</p>
        )}
        {categories && categories.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {categories.map((cat) => (
              <span
                key={cat.name_pt}
                className="text-xs bg-background border border-border text-muted px-2 py-0.5 rounded-full"
              >
                {cat.icon && <span className="mr-1">{cat.icon}</span>}
                {locale === "en" ? (cat.name_en ?? cat.name_pt) : cat.name_pt}
              </span>
            ))}
          </div>
        )}
        {description && (
          <p className="mt-2 text-sm text-muted line-clamp-2">{description}</p>
        )}
        {whatsapp && (
          <a
            href={`https://wa.me/${whatsapp.replace(/\D/g, "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 flex items-center gap-1.5 text-sm font-medium text-whatsapp hover:opacity-80 transition-opacity"
          >
            <WhatsAppIcon />
            {contactLabel}
          </a>
        )}
      </div>
    </div>
  );
}
