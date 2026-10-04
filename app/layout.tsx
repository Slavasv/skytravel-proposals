import type { Metadata, Viewport } from "next";
// Шрифты вшиты локально через fontsource — билд НЕ ходит в Google Fonts.
// Переменные --font-geist-sans/-mono/-montserrat заданы в globals.css.
import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import "@fontsource-variable/montserrat";
import "./globals.css";

export const metadata: Metadata = {
  title: "Travel System",
  description: "Travel System",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
