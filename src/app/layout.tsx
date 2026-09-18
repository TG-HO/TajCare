import type { Metadata, Viewport } from "next";
import { Montserrat } from "next/font/google";
import { Toaster } from "sonner";
import PWAInstallBanner from "@/components/PWAInstallBanner";
import NavigationProgressLoader from "@/components/NavigationProgressLoader";
import "./globals.css";

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-montserrat",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Taj Care - IT Ticket Management System",
  description: "IT Support and Ticket Management Portal for Taj Gasoline",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Taj Care",
  },
};

export const viewport: Viewport = {
  themeColor: "#0F172A",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={montserrat.variable}>
      <body className={`${montserrat.className} antialiased bg-[#F8FAFC] text-[#0F172A]`}>
        <NavigationProgressLoader />
        {children}
        <PWAInstallBanner />
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
