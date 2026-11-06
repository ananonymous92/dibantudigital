import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "DibantuDigital — Meta Ads Report",
    template: "%s · DibantuDigital",
  },
  description:
    "Laporan Meta Ads otomatis: tarik data langsung dari akun Meta atau import file Ads Manager, lengkap dengan ROAS, hook rate, dan AI Insights.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className={`${jakarta.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
