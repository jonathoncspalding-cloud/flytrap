"use client";

import { createContext, useContext } from "react";

type Theme = "dark";

const ThemeContext = createContext<{ theme: Theme }>({
  theme: "dark",
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <ThemeContext.Provider value={{ theme: "dark" }}>
      {children}
    </ThemeContext.Provider>
  );
}

/** No-op toggle preserved for any callers — does nothing now */
export function ThemeToggle() {
  return null;
}
