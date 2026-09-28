"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type Theme = "light" | "dark" | "system";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");

  useEffect(() => {
    const stored = localStorage.getItem("kango-theme") as Theme | null;
    const initialTheme = stored || "system";
    setThemeState(initialTheme);
    applyTheme(initialTheme);
  }, []);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem("kango-theme", newTheme);
    applyTheme(newTheme);
  };

  const applyTheme = (theme: Theme) => {
    if (typeof window === "undefined") return;
    const html = document.documentElement;
    if (theme === "system") {
      html.removeAttribute("data-theme");
      html.style.colorScheme = "";
    } else {
      html.setAttribute("data-theme", theme);
      // Barras de rolagem e campos nativos acompanham a escolha manual.
      html.style.colorScheme = theme;
    }
    aplicarCorDaBarra(theme);
  };

  const value: ThemeContextType = { theme, setTheme };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

const COR_DA_BARRA = { light: "#fbfbf7", dark: "#0a0a0a" } as const;

// As <meta name="theme-color"> do layout vêm com media query (seguem o
// sistema). Escolha manual: as duas passam a valer a cor escolhida; volta ao
// "sistema": cada uma recupera a cor da própria media query.
function aplicarCorDaBarra(theme: Theme) {
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((meta) => {
    const doTema = (meta.media ?? "").includes("dark") ? COR_DA_BARRA.dark : COR_DA_BARRA.light;
    meta.content = theme === "system" ? doTema : COR_DA_BARRA[theme];
  });
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme deve ser usado dentro de ThemeProvider");
  }
  return context;
}
