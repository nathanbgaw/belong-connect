import type { Metadata, Viewport } from "next";
import { Cabin, Marcellus } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const marcellus = Marcellus({ variable: "--font-marcellus", subsets: ["latin"], weight: "400" });
const cabin = Cabin({ variable: "--font-cabin", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Belong Connect", template: "%s · Belong Connect" },
  description:
    "Read any church's website and see what it offers its community — or say what you need and find church help near you. An open-source demo for Project Belong Maryland.",
};

export const viewport: Viewport = { themeColor: "#BF3147" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${marcellus.variable} ${cabin.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <Header />
        <main className="w-full flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
