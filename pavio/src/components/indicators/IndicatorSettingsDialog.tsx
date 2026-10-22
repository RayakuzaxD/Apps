import { X } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  INDICATORS,
  defaultParams,
  validateParams,
  type IndicatorConfig,
  type IndicatorParams,
} from '../../domain/indicators/registry'
import { PRICE_SOURCES } from '../../domain/indicators/source'
import styles from './Indicators.module.css'

interface IndicatorSettingsDialogProps {
  config: IndicatorConfig
  onApply: (params: IndicatorParams) => void
  onClose: () => void
}

type Draft = Record<string, string>

function toDraft(params: IndicatorParams): Draft {
  return Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)]))
}

function fromDraft(config: IndicatorConfig, draft: Draft): IndicatorParams {
  const params: IndicatorParams = {}
  for (const def of INDICATORS[config.type].params) {
    const raw = draft[def.key] ?? ''
    params[def.key] =
      def.kind === 'int' || def.kind === 'float'
        ? raw.trim() === ''
          ? Number.NaN
          : Number(raw.replace(',', '.'))
        : raw
  }
  return params
}

export function IndicatorSettingsDialog({
  config,
  onApply,
  onClose,
}: IndicatorSettingsDialogProps) {
  const def = INDICATORS[config.type]
  const [draft, setDraft] = useState<Draft>(() => toDraft(config.params))
  const params = useMemo(() => fromDraft(config, draft), [config, draft])
  const errors = useMemo(() => validateParams(config.type, params), [config.type, params])
  const valid = Object.keys(errors).length === 0
  const titleId = useId()
  const formRef = useRef<HTMLFormElement>(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  // Só na abertura: foca o primeiro campo e fecha com Escape.
  useEffect(() => {
    formRef.current?.querySelector<HTMLElement>('input, select')?.focus()
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!valid) return
    onApply(params)
    onClose()
  }

  return (
    <div
      className={styles.backdrop}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className={styles.dialogHeader}>
          <h2 className={styles.dialogTitle} id={titleId}>
            {def.name}
          </h2>
          <button type="button" className={styles.iconButton} aria-label="Fechar" onClick={onClose}>
            <X size={14} />
          </button>
        </div>
        <form ref={formRef} onSubmit={submit} noValidate>
          <div className={styles.form}>
            {def.params.map((param) => {
              const id = `${titleId}-${param.key}`
              const error = errors[param.key]
              const value = draft[param.key] ?? ''
              const set = (v: string) => setDraft((d) => ({ ...d, [param.key]: v }))
              return (
                <div className={styles.field} key={param.key}>
                  <label htmlFor={id}>{param.label}</label>
                  {param.kind === 'source' ? (
                    <select id={id} value={value} onChange={(e) => set(e.target.value)}>
                      {PRICE_SOURCES.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  ) : param.kind === 'color' ? (
                    <input
                      id={id}
                      type="color"
                      value={value}
                      onChange={(e) => set(e.target.value)}
                    />
                  ) : (
                    <input
                      id={id}
                      type="number"
                      inputMode={param.kind === 'int' ? 'numeric' : 'decimal'}
                      min={param.min}
                      max={param.max}
                      step={param.kind === 'int' ? 1 : param.step}
                      value={value}
                      aria-invalid={error ? true : undefined}
                      aria-describedby={error ? `${id}-error` : undefined}
                      onChange={(e) => set(e.target.value)}
                    />
                  )}
                  {error && (
                    <p className={styles.error} id={`${id}-error`} role="alert">
                      {error}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
          <div className={styles.dialogFooter}>
            <button
              type="button"
              className={styles.ghost}
              onClick={() => setDraft(toDraft(defaultParams(config.type)))}
            >
              Restaurar padrão
            </button>
            <div className={styles.footerRight}>
              <button type="button" className={styles.button} onClick={onClose}>
                Cancelar
              </button>
              <button type="submit" className={styles.primary} disabled={!valid}>
                Aplicar
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
