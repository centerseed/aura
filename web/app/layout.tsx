import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { GoogleAnalytics } from "@next/third-parties/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Zentropy - 讓一切井然有序",
  description: "AI 驅動的知識治理系統，將混亂轉化為清晰的第二大腦",
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW" style={{ overscrollBehavior: "none" }} suppressHydrationWarning>
      <body
        className={`${inter.className} antialiased`}
        style={{ overscrollBehavior: "none" }}
      >
        <Providers>
          {children}
        </Providers>

        {/* Global footer with privacy/terms links for Google verification */}
        <footer className="fixed bottom-0 left-0 right-0 bg-transparent pointer-events-none">
          <div className="flex justify-center gap-4 text-xs opacity-0 pointer-events-auto">
            <a href="/privacy" className="hover:underline">
              隱私政策 Privacy Policy
            </a>
            <span>·</span>
            <a href="/terms" className="hover:underline">
              服務條款 Terms of Service
            </a>
          </div>
        </footer>
      </body>
      {process.env.NEXT_PUBLIC_GA_ID && (
        <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID} />
      )}
    </html>
  );
}
