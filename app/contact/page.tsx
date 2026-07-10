import type { Metadata } from "next";
import * as React from "react";
import { Mail, Phone, MessageCircle, MapPin, Facebook, Instagram, Youtube } from "lucide-react";
import { PolicyLayout, PolicyEmpty } from "@/components/layout/PolicyLayout";
import { contentMetadata } from "@/lib/seo/metadata";
import { getSiteSettings } from "@/lib/siteSettings.server";
import { COMPANY } from "@/lib/entity/company";

export const revalidate = 300;

export const metadata: Metadata = contentMetadata({
  title: "Contact Us",
  description: `Get in touch with ${COMPANY.name} - email, phone, WhatsApp and social.`,
  path: "/contact",
});

function waLink(raw?: string): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D+/g, "");
  return digits.length >= 6 ? `https://wa.me/${digits}` : null;
}

export default async function ContactPage() {
  const settings = await getSiteSettings();
  const c = settings?.contact;
  const wa = waLink(c?.whatsapp ?? c?.phone);
  const hasAny = !!(c?.email || c?.phone || c?.whatsapp || c?.address || c?.facebook || c?.instagram || c?.youtube);

  return (
    <PolicyLayout
      title="Contact Us"
      intro={settings?.shortDescription || "We'd love to hear from you. Reach us through any of the channels below."}
    >
      {!hasAny ? (
        <PolicyEmpty note="Contact details haven't been published yet." />
      ) : (
        <div className="flex flex-col gap-1.5">
          {c?.email ? (
            <ContactRow icon={<Mail className="h-[18px] w-[18px]" />} label="Email" value={c.email} href={`mailto:${c.email}`} />
          ) : null}
          {c?.phone ? (
            <ContactRow icon={<Phone className="h-[18px] w-[18px]" />} label="Phone" value={c.phone} href={`tel:${c.phone.replace(/\s+/g, "")}`} />
          ) : null}
          {wa ? (
            <ContactRow
              icon={<MessageCircle className="h-[18px] w-[18px]" />}
              label="WhatsApp"
              value={c?.whatsapp ?? c?.phone ?? ""}
              href={wa}
              external
            />
          ) : null}
          {c?.address ? (
            <ContactRow icon={<MapPin className="h-[18px] w-[18px]" />} label="Address" value={c.address} />
          ) : null}

          {(c?.facebook || c?.instagram || c?.youtube) ? (
            <div className="mt-2 flex items-center gap-1.5">
              {c?.facebook ? <Social href={c.facebook} label="Facebook"><Facebook className="h-[20px] w-[20px]" /></Social> : null}
              {c?.instagram ? <Social href={c.instagram} label="Instagram"><Instagram className="h-[20px] w-[20px]" /></Social> : null}
              {c?.youtube ? <Social href={c.youtube} label="YouTube"><Youtube className="h-[20px] w-[20px]" /></Social> : null}
            </div>
          ) : null}
        </div>
      )}
    </PolicyLayout>
  );
}

function ContactRow({
  icon,
  label,
  value,
  href,
  external,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  href?: string;
  external?: boolean;
}) {
  const body = (
    <>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/20 text-ink">
        {icon}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">{label}</span>
        <span className="truncate text-sm text-ink">{value}</span>
      </span>
    </>
  );
  const cls = "flex items-center gap-2 rounded-xl border border-neutral-200 p-2";
  if (!href) return <div className={cls}>{body}</div>;
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className={`${cls} transition-colors hover:border-ink`}
    >
      {body}
    </a>
  );
}

function Social({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="inline-flex h-[40px] w-[40px] items-center justify-center rounded-full border border-neutral-200 text-neutral-600 transition-colors hover:border-ink hover:text-ink"
    >
      {children}
    </a>
  );
}
