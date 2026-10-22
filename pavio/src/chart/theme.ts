export interface ChartTheme {
  background: string
  text: string
  grid: string
  border: string
  crosshair: string
  up: string
  down: string
  fontFamily: string
}

function cssVar(styles: CSSStyleDeclaration, name: string, fallback: string): string {
  return styles.getPropertyValue(name).trim() || fallback
}

/** Lê as cores do gráfico dos tokens CSS ativos (claro ou escuro). */
export function readChartTheme(root: HTMLElement = document.documentElement): ChartTheme {
  const s = getComputedStyle(root)
  return {
    background: cssVar(s, '--surface', '#ffffff'),
    text: cssVar(s, '--text-muted', '#6b665d'),
    grid: cssVar(s, '--grid', '#ebe8e1'),
    border: cssVar(s, '--border', '#dedad2'),
    crosshair: cssVar(s, '--text-muted', '#6b665d'),
    up: cssVar(s, '--up', '#1fb37a'),
    down: cssVar(s, '--down', '#e5484d'),
    fontFamily: cssVar(s, '--font-sans', 'system-ui, sans-serif'),
  }
}
