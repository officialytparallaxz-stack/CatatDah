import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CatatDah",
  description: "Catat pemasukan dan pengeluaran dengan mudah",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
