import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import SyncProvider from "@/components/SyncProvider";
import Sidebar from "@/components/Sidebar";
import FeedbackWidget from "@/components/FeedbackWidget";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Flytrap",
  description: "Trend monitoring, analysis, and prediction for Cornett",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body style={{ background: "var(--bg)", minHeight: "100vh", margin: 0 }}>
        <ThemeProvider>
          <SyncProvider>
            <div className="app-shell">
              <Sidebar />
              <main className="main-content">
                {children}
              </main>
            </div>
            <FeedbackWidget />
          </SyncProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
