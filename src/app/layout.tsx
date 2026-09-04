import type { Metadata, Viewport } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
import { AmbientField } from "@/components/graphics/AmbientField";
import "./globals.css";

/**
 * Three voices, not one. Fraunces carries the editorial hero moments — it
 * has a real optical-size axis, so it gets sharper and more characterful as
 * it gets larger instead of just scaling up a body font. Geist stays the
 * interface voice (legible at UI sizes, never decorative). Geist Mono is the
 * system/signal voice: figures, identifiers, timestamps, evidence — used
 * sparingly, never as the default.
 */
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["opsz", "SOFT", "WONK"],
  style: ["normal", "italic"],
  display: "swap",
});

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "ARIE — Decision Console",
  description:
    "Adaptive Revenue Intelligence Engine: ARIE decides whether another provider call is worth making at all, then shows you every reason it stopped where it did.",
};

export const viewport: Viewport = {
  themeColor: "#08090b",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geist.variable} ${geistMono.variable} ${fraunces.variable} h-full`}
    >
      <body className="relative flex min-h-full flex-col">
        <AmbientField />
        {children}
      </body>
    </html>
  );
}
