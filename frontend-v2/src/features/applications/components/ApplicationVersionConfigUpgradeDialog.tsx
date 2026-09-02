import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  fetchApplicationConfigurations,
  upgradeApplicationInConfigurations,
  type Application,
  type ApplicationConfigurationLink,
} from '@/features/applications/api/applications-api'
import {
  useAppVersionUpgradeStore,
} from '@/features/applications/store/app-version-upgrade-store'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

export interface ApplicationVersionUpgradePrompt {
  application: Application
  versionLabel: string
}

interface ApplicationVersionConfigUpgradeDialogProps {
  /** When omitted, reads prompt from global store (AppLayout). */
  prompt?: ApplicationVersionUpgradePrompt | null
  onOpenChange?: (open: boolean) => void
}

function isInstalledLink(link: ApplicationConfigurationLink): boolean {
  return link.action === 1
}

export function ApplicationVersionConfigUpgradeDialog({
  prompt: promptProp,
  onOpenChange,
}: ApplicationVersionConfigUpgradeDialogProps = {}) {
  const storePrompt = useAppVersionUpgradeStore((state) => state.prompt)
  const dismissStore = useAppVersionUpgradeStore((state) => state.dismiss)
  const prompt = promptProp !== undefined ? promptProp : storePrompt

  const handleDismiss = () => {
    if (onOpenChange) {
      onOpenChange(false)
    } else {
      dismissStore()
    }
  }
  const { t } = useTranslation()
  const isOpen = prompt != null
  const ignoreCloseUntilRef = useRef(0)

  const [links, setLinks] = useState<ApplicationConfigurationLink[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [notifyDevices, setNotifyDevices] = useState(true)
  const [applying, setApplying] = useState(false)

  useEffect(() => {
    if (isOpen) {
      ignoreCloseUntilRef.current = Date.now() + 600
    }
  }, [isOpen, prompt?.application.id, prompt?.versionLabel])

  useEffect(() => {
    if (!prompt?.application.id) {
      setLinks([])
      setSelectedIds([])
      return
    }

    let cancelled = false
    setLoading(true)
    setLoadError(false)
    setNotifyDevices(true)

    void fetchApplicationConfigurations(prompt.application)
      .then((data) => {
        if (cancelled) {
          return
        }
        const installed = data.filter(isInstalledLink)
        setLinks(installed)
        setSelectedIds(
          installed.filter((link) => link.outdated).map((link) => link.configurationId!)
        )
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError(true)
          setLinks([])
          setSelectedIds([])
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [prompt?.application.id, prompt?.versionLabel])

  const sortedLinks = useMemo(
    () => [...links].sort((a, b) => (a.configurationName ?? '').localeCompare(b.configurationName ?? '')),
    [links]
  )

  const outdatedCount = sortedLinks.filter((link) => link.outdated).length

  const toggleConfig = (configurationId: number, checked: boolean) => {
    setSelectedIds((prev) =>
      checked ? [...prev, configurationId] : prev.filter((id) => id !== configurationId)
    )
  }

  const handleApply = async () => {
    const appId = prompt?.application.id
    if (appId == null || selectedIds.length === 0) {
      return
    }

    setApplying(true)
    try {
      await upgradeApplicationInConfigurations(appId, selectedIds, { notifyDevices })
      toast.success(
        t('applications.versions.upgradeConfigurationsSuccess', { count: selectedIds.length })
      )
      handleDismiss()
    } catch {
      toast.error(t('applications.versions.upgradeConfigurationsError'))
    } finally {
      setApplying(false)
    }
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          if (Date.now() < ignoreCloseUntilRef.current) {
            return
          }
          handleDismiss()
        }
      }}
    >
      <DialogContent className="flex max-h-[min(90vh,640px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="space-y-3 border-b px-6 py-5">
          <DialogTitle className="flex items-start gap-3 text-lg leading-snug">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-500" aria-hidden />
            <span>{t('applications.versions.upgradeDialogTitle')}</span>
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            {t('applications.versions.upgradeDialogDescription', {
              name: prompt?.application.name ?? '',
              version: prompt?.versionLabel ?? '—',
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {t('common.loading')}
            </div>
          ) : loadError ? (
            <p className="py-4 text-sm text-destructive">
              {t('applications.versions.upgradeConfigurationsLoadError')}
            </p>
          ) : sortedLinks.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">
              {t('applications.versions.upgradeConfigurationsEmpty')}
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                {outdatedCount > 0 && (
                  <Badge variant="secondary" className="font-normal">
                    {t('applications.versions.upgradeOutdatedBadge', { count: outdatedCount })}
                  </Badge>
                )}
                <div className="ml-auto flex flex-wrap gap-2 text-xs">
                  <button
                    type="button"
                    className="text-primary underline-offset-2 hover:underline"
                    onClick={() =>
                      setSelectedIds(
                        sortedLinks.filter((l) => l.outdated).map((l) => l.configurationId!)
                      )
                    }
                  >
                    {t('applications.versions.upgradeSelectOutdated')}
                  </button>
                  <span className="text-muted-foreground">·</span>
                  <button
                    type="button"
                    className="text-primary underline-offset-2 hover:underline"
                    onClick={() =>
                      setSelectedIds(sortedLinks.map((l) => l.configurationId!))
                    }
                  >
                    {t('applications.versions.upgradeSelectAll')}
                  </button>
                  <span className="text-muted-foreground">·</span>
                  <button
                    type="button"
                    className="text-muted-foreground underline-offset-2 hover:underline"
                    onClick={() => setSelectedIds([])}
                  >
                    {t('applications.versions.upgradeSelectNone')}
                  </button>
                </div>
              </div>

              <ul className="space-y-1 rounded-lg border bg-muted/15 p-1">
                {sortedLinks.map((link) => {
                  const configId = link.configurationId!
                  const checked = selectedIds.includes(configId)

                  return (
                    <li key={configId}>
                      <label
                        className={cn(
                          'flex cursor-pointer items-start gap-3 rounded-md px-3 py-2.5 transition-colors',
                          checked ? 'bg-primary/10' : 'hover:bg-muted/50'
                        )}
                      >
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={checked}
                          onChange={(e) => toggleConfig(configId, e.target.checked)}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium leading-tight">
                            {link.configurationName ?? configId}
                          </span>
                          {link.outdated ? (
                            <span className="mt-1 block text-xs text-amber-700 dark:text-amber-300">
                              {t('applications.configurations.outdatedVersion', {
                                current: link.currentVersionText ?? '—',
                                latest: link.latestVersionText ?? prompt?.versionLabel ?? '—',
                              })}
                            </span>
                          ) : (
                            <span className="mt-1 block text-xs text-muted-foreground">
                              {t('applications.versions.upgradeCurrentVersion', {
                                version: link.currentVersionText ?? '—',
                              })}
                            </span>
                          )}
                        </span>
                      </label>
                    </li>
                  )
                })}
              </ul>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={notifyDevices}
                  disabled={selectedIds.length === 0}
                  onChange={(e) => setNotifyDevices(e.target.checked)}
                />
                {t('applications.versions.upgradeNotifyDevices')}
              </label>
            </>
          )}
        </div>

        <DialogFooter className="gap-2 border-t bg-muted/20 px-6 py-4 sm:gap-2">
          <Button type="button" variant="outline" disabled={applying} onClick={handleDismiss}>
            {t('applications.versions.upgradeSkip')}
          </Button>
          <Button
            type="button"
            disabled={applying || selectedIds.length === 0 || sortedLinks.length === 0}
            onClick={() => void handleApply()}
          >
            {applying ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {t('applications.versions.upgradeApplying')}
              </>
            ) : (
              t('applications.versions.upgradeApply', { count: selectedIds.length })
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
