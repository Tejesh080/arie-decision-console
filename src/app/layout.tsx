import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AmbientField } from "@/components/graphics/AmbientField";
import "./globals.css";

/**
 * One type family in two voices. Geist for interface text and display,
 * Geist Mono for every figure, identifier and threshold — the "data voice".
 * A single family keeps the vertical rhythm consistent between a label and
 * the number under it, which a sans/mono pairing from two foundries never
 * quite manages.
 */
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
    <html lang="en" className={`${geist.variable} ${geistMono.variable} h-full`}>
      <body className="relative flex min-h-full flex-col">
        <AmbientField />
        {children}
      </body>
    </html>
  );
}
