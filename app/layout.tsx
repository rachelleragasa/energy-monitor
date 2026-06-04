import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Leituras de Energia",
  description: "Monitor de consumo de energia elétrica",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt">
      <body>{children}</body>
    </html>
  );
}
