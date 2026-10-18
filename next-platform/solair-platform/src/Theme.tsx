import { createContext, useContext, useId, useLayoutEffect, useState, type ReactNode } from "react";
import { Monitor, Moon, Sun } from "lucide-react";

type Preference = "light" | "dark" | "system";
const key = "solair-appearance";
function preference(value: string | null): Preference {
  return value === "light" || value === "dark" ? value : "system";
}
const ThemeContext = createContext<{ theme: Preference; setTheme: (theme: Preference) => void } | null>(null);
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, updateTheme] = useState<Preference>(() => {
    try { return preference(localStorage.getItem(key)); } catch { return "system"; }
  });
  useLayoutEffect(() => {
    const system = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const resolved = theme === "system" ? (system.matches ? "dark" : "light") : theme;
      document.documentElement.dataset.theme = resolved;
      document.documentElement.style.colorScheme = resolved;
    };
    const sync = (event: StorageEvent) => {
      if (event.key === key || event.key === null) updateTheme(preference(event.newValue));
    };
    apply();
    system.addEventListener("change", apply);
    window.addEventListener("storage", sync);
    return () => { system.removeEventListener("change", apply); window.removeEventListener("storage", sync); };
  }, [theme]);
  const setTheme = (value: Preference) => {
    updateTheme(value);
    try { localStorage.setItem(key, value); } catch { /* Appearance still works for this tab. */ }
  };
  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}
export function Appearance() {
  const context = useContext(ThemeContext);
  const group = useId();
  if (!context) return null;
  return <fieldset className="appearance-options">
    <legend>Appearance</legend>
    <div>
      {([["light", "Light", Sun], ["dark", "Dark", Moon], ["system", "System", Monitor]] as const).map(([value, label, Icon]) =>
        <label key={value} className={context.theme === value ? "selected" : ""}>
          <input type="radio" name={group} value={value} checked={context.theme === value} onChange={() => context.setTheme(value)} />
          <Icon size={16} /><span>{label}</span>
        </label>,
      )}
    </div>
  </fieldset>;
}
