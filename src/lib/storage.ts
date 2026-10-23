/** localStorage seguro: nunca quebra a tela (modo privado, WebView, etc.). */
export function loadPref<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`munilalog:${key}`);
    return raw === null ? fallback : { ...((typeof fallback === 'object' && !Array.isArray(fallback)) ? fallback : {}), ...JSON.parse(raw) } as T;
  } catch {
    return fallback;
  }
}

export function loadPrefRaw<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`munilalog:${key}`);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function savePref(key: string, value: unknown) {
  try {
    localStorage.setItem(`munilalog:${key}`, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}
