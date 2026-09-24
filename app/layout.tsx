import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Casa in due",
  description: "Compiti, spese e confronti pratici per la vita di casa",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
