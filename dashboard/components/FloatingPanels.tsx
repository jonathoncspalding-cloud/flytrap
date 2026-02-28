"use client";

import { createContext, useContext, useState, useCallback } from "react";

type ActivePanel = "chat" | "feedback" | null;

interface FloatingPanelState {
  activePanel: ActivePanel;
  openPanel: (panel: "chat" | "feedback") => void;
  closePanel: () => void;
}

const FloatingPanelContext = createContext<FloatingPanelState>({
  activePanel: null,
  openPanel: () => {},
  closePanel: () => {},
});

export function useFloatingPanel() {
  return useContext(FloatingPanelContext);
}

export default function FloatingPanelProvider({ children }: { children: React.ReactNode }) {
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);

  const openPanel = useCallback((panel: "chat" | "feedback") => {
    setActivePanel(panel);
  }, []);

  const closePanel = useCallback(() => {
    setActivePanel(null);
  }, []);

  return (
    <FloatingPanelContext.Provider value={{ activePanel, openPanel, closePanel }}>
      {children}
    </FloatingPanelContext.Provider>
  );
}
