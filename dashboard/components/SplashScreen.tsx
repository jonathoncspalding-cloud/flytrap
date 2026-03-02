"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";

const STORAGE_KEY = "flytrap-splash-seen";
const SPLASH_DURATION = 4500; // auto-advance after 4.5s
const FADE_DURATION = 800;   // fade-out transition

export default function SplashScreen({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<"checking" | "splash" | "fading" | "done">("checking");

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY)) {
        setPhase("done");
        return;
      }
    } catch {
      setPhase("done");
      return;
    }
    setPhase("splash");
  }, []);

  useEffect(() => {
    if (phase !== "splash") return;
    const timer = setTimeout(() => setPhase("fading"), SPLASH_DURATION);
    return () => clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    if (phase !== "fading") return;
    try { localStorage.setItem(STORAGE_KEY, "1"); } catch {}
    const timer = setTimeout(() => setPhase("done"), FADE_DURATION);
    return () => clearTimeout(timer);
  }, [phase]);

  const dismiss = useCallback(() => {
    if (phase === "splash") setPhase("fading");
  }, [phase]);

  if (phase === "done") return <>{children}</>;
  if (phase === "checking") return null;

  return (
    <>
      <div
        onClick={dismiss}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9999,
          cursor: "pointer",
          opacity: phase === "fading" ? 0 : 1,
          transition: `opacity ${FADE_DURATION}ms ease-out`,
          background: "#0a0a0a",
          overflow: "hidden",
        }}
      >
        {/* Video background */}
        <video
          autoPlay
          loop
          muted
          playsInline
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: 0.4,
          }}
        >
          <source src="/background_video.mp4" type="video/mp4" />
        </video>

        {/* Vignette */}
        <div style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(ellipse at center, rgba(10,10,10,0.05) 0%, rgba(10,10,10,0.8) 100%)",
          pointerEvents: "none",
        }} />

        {/* Centered content */}
        <div style={{
          position: "relative",
          zIndex: 2,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
        }}>

          {/* Illustrated mark — the hero */}
          <div style={{
            position: "relative",
            width: "clamp(220px, 30vw, 380px)",
            height: "clamp(120px, 16vw, 210px)",
            opacity: 0,
            animation: "splash-mark 1.4s ease-out 0.3s forwards",
          }}>
            <Image
              src="/splash-illustrated.png"
              alt="Cornett"
              fill
              style={{ objectFit: "contain" }}
              priority
            />
          </div>

          {/* Gradient line */}
          <div style={{
            width: 60,
            height: 2,
            borderRadius: 1,
            background: "linear-gradient(90deg, #004F22, #FF8200, #E8127A)",
            marginTop: 28,
            opacity: 0,
            animation: "splash-line 1.5s ease-out 1s forwards",
          }} />

          {/* FLYTRAP product name */}
          <div style={{
            fontSize: 14,
            fontWeight: 800,
            letterSpacing: "0.3em",
            textTransform: "uppercase" as const,
            color: "#2a8c4a",
            marginTop: 20,
            opacity: 0,
            animation: "splash-fade-up 1s ease-out 1.2s forwards",
          }}>
            Flytrap
          </div>

          {/* Tagline */}
          <div style={{
            fontSize: 13,
            fontWeight: 400,
            color: "rgba(242, 239, 237, 0.4)",
            marginTop: 10,
            letterSpacing: "0.04em",
            opacity: 0,
            animation: "splash-fade-up 1s ease-out 1.5s forwards",
          }}>
            Cultural Intelligence
          </div>

          {/* Skip hint */}
          <div style={{
            position: "absolute",
            bottom: 40,
            fontSize: 11,
            color: "rgba(242, 239, 237, 0.2)",
            letterSpacing: "0.05em",
            opacity: 0,
            animation: "splash-fade-up 1s ease-out 2.2s forwards",
          }}>
            click anywhere to continue
          </div>
        </div>
      </div>

      <style>{`
        @keyframes splash-mark {
          from {
            opacity: 0;
            transform: scale(0.92) translateY(10px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        @keyframes splash-fade-up {
          from {
            opacity: 0;
            transform: translateY(14px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes splash-line {
          from {
            opacity: 0;
            width: 0;
          }
          to {
            opacity: 1;
            width: 60px;
          }
        }
      `}</style>

      <div style={{ visibility: "hidden" }}>{children}</div>
    </>
  );
}
