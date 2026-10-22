import { useTickers } from '../../hooks/useTickers'
import { useSettingsStore } from '../../store/settingsStore'
import { useWatchlistStore } from '../../store/watchlistStore'
import { validateNewSymbol } from './validateNewSymbol'
import { Watchlist } from './Watchlist'

export function WatchlistPanel() {
  const symbols = useWatchlistStore((s) => s.symbols)
  const add = useWatchlistStore((s) => s.add)
  const remove = useWatchlistStore((s) => s.remove)
  const current = useSettingsStore((s) => s.symbol)
  const setSymbol = useSettingsStore((s) => s.setSymbol)
  const tickers = useTickers(symbols)

  return (
    <Watchlist
      symbols={symbols}
      tickers={tickers}
      current={current}
      onSelect={setSymbol}
      onRemove={remove}
      onAdd={async (input) => {
        const result = await validateNewSymbol(input, useWatchlistStore.getState().symbols)
        if ('error' in result) return result.error
        add(result.symbol)
        return null
      }}
    />
  )
}
