import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ConfigurationApplication } from '@/features/configurations/types/configuration'
import {
  filterAvailableAppsForAdd,
  filterInstallableConfigApps,
  formatConfigurationAppLabel,
} from '@/features/configurations/utils/configuration-app-utils'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface ConfigurationAppSearchInputProps {
  apps: ConfigurationApplication[]
  selected?: ConfigurationApplication
  onSelect: (app: ConfigurationApplication) => void
  disabled?: boolean
  placeholder?: string
  id?: string
  /** installable = action Install (MDM tab); available = unassigned apps (Add dialog). */
  mode?: 'installable' | 'available'
  emptyMessageKey?: string
}

export function ConfigurationAppSearchInput({
  apps,
  selected,
  onSelect,
  disabled = false,
  placeholder,
  id,
  mode = 'installable',
  emptyMessageKey,
}: ConfigurationAppSearchInputProps) {
  const { t } = useTranslation()
  const containerRef = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (selected) {
      setQuery(formatConfigurationAppLabel(selected))
    }
  }, [selected])

  const filteredApps = useMemo(() => {
    if (mode === 'available') {
      return filterAvailableAppsForAdd(apps, query)
    }
    return filterInstallableConfigApps(apps, query)
  }, [apps, mode, query])

  const emptyMessage =
    emptyMessageKey ??
    (mode === 'available'
      ? 'configurations.editor.noAvailableApps'
      : 'configurations.editor.noInstallableApps')

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false)
        if (selected) {
          setQuery(formatConfigurationAppLabel(selected))
        }
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [selected])

  return (
    <div ref={containerRef} className="relative">
      <Input
        id={id}
        value={query}
        disabled={disabled}
        placeholder={placeholder ?? t('configurations.editor.searchApplication')}
        autoComplete="off"
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value)
          setOpen(true)
        }}
      />

      {open && !disabled && (
        <div className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-md border bg-popover shadow-md">
          {filteredApps.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">{t(emptyMessage)}</p>
          ) : (
            filteredApps.map((app) => (
              <button
                key={app.usedVersionId ?? app.latestVersion ?? `${app.id}-${app.pkg}`}
                type="button"
                className={cn(
                  'flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-muted',
                  selected?.usedVersionId === app.usedVersionId && 'bg-muted'
                )}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onSelect(app)
                  setQuery(formatConfigurationAppLabel(app))
                  setOpen(false)
                }}
              >
                <span className="font-medium">{formatConfigurationAppLabel(app)}</span>
                {app.pkg && (
                  <span className="font-mono text-xs text-muted-foreground">{app.pkg}</span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
