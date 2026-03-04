import type { Metadata } from "next";
import { Fraunces, Rethink_Sans } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import SyncProvider from "@/components/SyncProvider";
import Sidebar from "@/components/Sidebar";
import FeedbackWidget from "@/components/FeedbackWidget";
import Chatbot from "@/components/Chatbot";
import FloatingPanelProvider from "@/components/FloatingPanels";
import SplashScreen from "@/components/SplashScreen";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

const rethinkSans = Rethink_Sans({
  subsets: ["latin"],
  variable: "--font-rethink",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Flytrap",
  description: "Trend monitoring, analysis, and prediction for Cornett",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${rethinkSans.variable}`} suppressHydrationWarning>
      <body style={{ background: "var(--bg)", minHeight: "100vh", margin: 0 }}>
        <ThemeProvider>
          <SyncProvider>
            <SplashScreen>
              <div className="app-shell">
                <Sidebar />
                <main className="main-content">
                  {children}
                </main>
              </div>
              <FloatingPanelProvider>
                <Chatbot />
                <FeedbackWidget />
              </FloatingPanelProvider>
            </SplashScreen>
          </SyncProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
