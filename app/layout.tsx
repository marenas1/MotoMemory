import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MotoMemory — GS750 Dashboard",
  description: "A focused personal maintenance dashboard for a 1981 Suzuki GS750.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
