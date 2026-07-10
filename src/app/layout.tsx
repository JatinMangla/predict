import type { Metadata, Viewport } from "next";
import "./globals.css";
import { I18nProvider } from "@/lib/i18n";
import { SwRegister } from "@/components/SwRegister";

export const metadata: Metadata = {
  title: "Kundli Predict",
  description:
    "Offline-first Vedic astrology: kundli, dashas, yogas, predictions, transits and numerology.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Kundli Predict", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#0d1021",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="starfield min-h-screen">
        <I18nProvider>{children}</I18nProvider>
        <SwRegister />
      </body>
    </html>
  );
}
