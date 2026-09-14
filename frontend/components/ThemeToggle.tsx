"use client";

import { useTheme } from "./ThemeProvider";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Ativar modo claro" : "Ativar modo escuro"}
      className={cn(
        "relative inline-flex h-9 w-16 items-center rounded-full",
        "bg-cinza-tonal transition-colors",
        "hover:bg-indigo/12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo focus-visible:ring-offset-2"
      )}
    >
      <div
        className={cn(
          "absolute h-7 w-7 rounded-full bg-papel transition-transform duration-200 shadow-sm",
          isDark ? "translate-x-8" : "translate-x-1"
        )}
      />
      <div className={cn("absolute left-1.5 text-indigo", isDark && "opacity-30")}>
        <Sun className="h-4 w-4" />
      </div>
      <div
        className={cn(
          "absolute right-1.5 text-indigo",
          isDark ? "opacity-100" : "opacity-30"
        )}
      >
        <Moon className="h-4 w-4" />
      </div>
    </button>
  );
}
