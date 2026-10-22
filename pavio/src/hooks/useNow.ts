import { useEffect, useState } from 'react'

/** Horário atual em segundos, atualizado a cada `everyMs` (para "vela em formação"). */
export function useNow(everyMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now() / 1000)
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now() / 1000), everyMs)
    return () => window.clearInterval(id)
  }, [everyMs])
  return now
}
