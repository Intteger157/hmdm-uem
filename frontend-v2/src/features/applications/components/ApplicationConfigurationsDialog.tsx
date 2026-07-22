import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  isInstallOptionAvailable,
  isRemoveOptionAvailable,
  type Application,
  type ApplicationConfigurationLink,
} from '@/features/applications/api/applications-api'
import {
  useApplicationConfigurationsQuery,
  useUpdateApplicationConfigurationsMutation,
} from '@/features/applications/hooks/use-applications'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

interface ApplicationConfigurationsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  application: Application | null
}

type ConfigurationRow = ApplicationConfigurationLink & { selected?: boolean }

const BULK_ACTION_NONE = -1

function getActionOptions(application: Application, t: (key: string) => string) {
  const installAvailable = isInstallOptionAvailable(application)
  const removeAvailable = isRemoveOptionAvailable(application)

  const options = [
    {
      value: 1,
      label: installAvailable
        ? t('configurations.editor.actionInstall')
        : t('configurations.editor.actionAllow'),
    },
    {
      value: 0,
      label: installAvailable
        ? t('configurations.editor.actionNotInstall')
        : t('configurations.editor.actionProhibit'),
    },
  ]

  if (removeAvailable) {
    options.push({
      value: 2,
      label: t('configurations.editor.actionRemove'),
    })
  }

  return options
}

export function ApplicationConfigurationsDialog({
  open,
  onOpenChange,
  application,
}: ApplicationConfigurationsDialogProps) {
  const { t } = useTranslation()
  const { data, isLoading } = useApplicationConfigurationsQuery(application?.id)
  const updateMutation = useUpdateApplicationConfigurationsMutation()
  const [links, setLinks] = useState<ConfigurationRow[]>([])
  const [bulkAction, setBulkAction] = useState(BULK_ACTION_NONE)
  const [selectAll, setSelectAll] = useState(false)

  useEffect(() => {
    if (data) {
      setLinks(data.map((link) => ({ ...link })))
      setBulkAction(BULK_ACTION_NONE)
      setSelectAll(false)
    }
  }, [data])

  const actionOptions = useMemo(
    () => (application ? getActionOptions(application, t) : []),
    [application, t]
  )

  const sortedLinks = useMemo(
    () => [...links].sort((a, b) => (a.configurationName ?? '').localeCompare(b.configurationName ?? '')),
    [links]
  )

  const handleActionChange = (configurationId: number | undefined, action: number) => {
    if (configurationId == null) {
      return
    }

    setLinks((prev) =>
      prev.map((item) =>
        item.configurationId === configurationId
          ? {
              ...item,
              action,
              remove: action === 2,
              notify: true,
            }
          : item
      )
    )
    setBulkAction(BULK_ACTION_NONE)
  }

  const handleSelectAllChange = (checked: boolean) => {
    setSelectAll(checked)
    setLinks((prev) => prev.map((item) => ({ ...item, selected: checked })))
  }

  const handleBulkActionChange = (action: number) => {
    setBulkAction(action)
    if (action === BULK_ACTION_NONE) {
      return
    }

    setLinks((prev) =>
      prev.map((item) =>
        item.selected && item.action !== action
          ? {
              ...item,
              action,
              remove: action === 2,
              notify: true,
            }
          : item
      )
    )
  }

  const handleSave = async () => {
    if (!application?.id) {
      return
    }

    try {
      await updateMutation.mutateAsync({
        applicationId: application.id,
        configurations: links.map(({ selected: _selected, ...link }) => ({
          ...link,
          notify: true,
        })),
      })
      toast.success(t('applications.configurations.saved'))
      onOpenChange(false)
    } catch {
      toast.error(t('applications.configurations.error'))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>{t('applications.configurations.title')}</DialogTitle>
          <DialogDescription>{t('applications.configurations.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="app-config-name">{t('applications.configurations.application')}</Label>
            <Input
              id="app-config-name"
              disabled
              value={
                application
                  ? `${application.name} (${application.version ?? '—'})`
                  : ''
              }
            />
          </div>

          {isLoading ? (
            <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
          ) : sortedLinks.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('applications.configurations.empty')}</p>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/20 p-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectAll}
                    onChange={(e) => handleSelectAllChange(e.target.checked)}
                  />
                  {t('applications.configurations.selectAll')}
                </label>
                <select
                  className="flex h-9 min-w-[180px] rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  value={bulkAction}
                  onChange={(e) => handleBulkActionChange(Number(e.target.value))}
                >
                  <option value={BULK_ACTION_NONE}>
                    {t('applications.configurations.bulkAction')}
                  </option>
                  {actionOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="max-h-96 overflow-y-auto rounded-lg border">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 border-b bg-muted/40 text-muted-foreground">
                    <tr>
                      <th className="w-10 px-3 py-3" />
                      <th className="px-4 py-3 font-medium">
                        {t('configurations.editor.actionColumn')}
                      </th>
                      <th className="px-4 py-3 font-medium">
                        {t('applications.configurations.configuration')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedLinks.map((link) => (
                      <tr key={link.configurationId} className="border-b last:border-b-0">
                        <td className="px-3 py-3">
                          <input
                            type="checkbox"
                            checked={link.selected === true}
                            onChange={(e) => {
                              setSelectAll(false)
                              setLinks((prev) =>
                                prev.map((item) =>
                                  item.configurationId === link.configurationId
                                    ? { ...item, selected: e.target.checked }
                                    : item
                                )
                              )
                            }}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <select
                            className="flex h-9 w-full min-w-[160px] rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                            value={link.action ?? 0}
                            onChange={(e) =>
                              handleActionChange(link.configurationId, Number(e.target.value))
                            }
                          >
                            {actionOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3">{link.configurationName ?? link.configurationId}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            disabled={updateMutation.isPending || !application?.id || sortedLinks.length === 0}
            onClick={() => void handleSave()}
          >
            {updateMutation.isPending ? t('common.saving') : t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
