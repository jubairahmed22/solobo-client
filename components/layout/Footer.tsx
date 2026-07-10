import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { COMPANY } from "@/lib/entity/company";
import { FooterTicker } from "./FooterTicker";

const COLUMNS = [
  {
    title: "Shop",
    links: [
      { label: "New Arrivals", href: "/all-products?sort=newest" },
      { label: "All Products", href: "/all-products" },
      { label: "Sale", href: "/offers" },
      { label: "Brands", href: "/brands" },
    ],
  },
  {
    title: "Collections",
    links: [
      { label: "Sportswear", href: "/category/sportswear" },
      { label: "Casualwear", href: "/category/casualwear" },
      { label: "Activewear", href: "/category/activewear" },
      { label: "Accessories", href: "/category/accessories" },
    ],
  },
  {
    title: "Account",
    links: [
      { label: "Sign In", href: "/login" },
      { label: "Join Now", href: "/register" },
      { label: "My Orders", href: "/account/orders" },
      { label: "Wishlist", href: "/wishlist" },
    ],
  },
  {
    title: "Help",
    links: [
      { label: "Contact", href: "/contact" },
      { label: "FAQ", href: "/faq" },
      { label: "Shipping", href: "/shipping" },
      { label: "Returns", href: "/returns" },
    ],
  },
] as const;

export function Footer() {
  return (
    <footer className="mt-8 bg-ink text-paper">
      <FooterTicker />

      {/* Thin accent rule */}
      <div className="h-px w-full bg-white/10" />

      <div className="container-screen py-4 md:py-10">
        <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-5 md:gap-6">
          {/* Brand column */}
          <div className="col-span-2 flex flex-col gap-3 md:col-span-1">
            <Link href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
              <Image src="/logo.png" alt="" aria-hidden width={36} height={36} className="rounded-full" />
              <span className="text-xl font-black uppercase tracking-widest text-paper sm:text-2xl">{COMPANY.name}</span>
            </Link>
            <p className="text-sm leading-relaxed text-neutral-400">
              Performance sportswear &amp; casualwear — built for every level.
            </p>
            <div className="mt-2 flex gap-3">
              <a
                href="https://instagram.com/solobobd"
                target="_blank"
                rel="noopener noreferrer"
                className="text-neutral-400 hover:text-accent transition-colors text-sm font-medium"
              >
                Instagram
              </a>
              <a
                href="https://facebook.com/solobobd"
                target="_blank"
                rel="noopener noreferrer"
                className="text-neutral-400 hover:text-accent transition-colors text-sm font-medium"
              >
                Facebook
              </a>
            </div>
          </div>

          {/* Nav columns */}
          {COLUMNS.map((col) => (
            <nav key={col.title} aria-label={col.title} className="flex flex-col gap-2">
              <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-500">
                {col.title}
              </h3>
              <ul className="flex flex-col gap-1.5">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-neutral-400 transition-colors hover:text-accent"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-4 flex flex-col items-start justify-between gap-2 border-t border-white/10 pt-4 text-xs text-neutral-500 md:mt-8 md:flex-row md:items-center md:pt-5">
          <p>© {new Date().getFullYear()} {COMPANY.name}. All rights reserved.</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 md:gap-x-4 md:gap-y-2">
            <Link href="/privacy" className="hover:text-neutral-300 transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-neutral-300 transition-colors">Terms</Link>
            <span className="hidden h-3 w-px bg-white/20 md:inline-block" aria-hidden />
            <a
              href="https://www.enveria.io/"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-neutral-300"
            >
              Powered by <span className="font-semibold text-neutral-400">enveria.io</span>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
