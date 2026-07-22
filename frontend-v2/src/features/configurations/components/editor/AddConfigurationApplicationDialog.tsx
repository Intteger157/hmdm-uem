import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ApplicationFormDialog } from '@/features/applications/components/ApplicationFormDialog'
import { ConfigurationAppSearchInput } from '@/features/configurations/components/editor/ConfigurationAppSearchInput'
import type { Configuration } from '@/features/configurations/types/configuration'
import type { ConfigurationApplication } from '@/features/configurations/types/configuration'
import {
  formatConfigurationAppLabel,
  isInstallOptionAvailable,
  isRemoveOptionAvailable,
} from '@/features/configurations/utils/configuration-app-utils'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'

interface AddConfigurationApplicationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  configuration: Configuration
  applications: ConfigurationApplication[]
  onAdd: (app: ConfigurationApplication) => void
}

export function AddConfigurationApplicationDialog({
  open,
  onOpenChange,
  configuration,
  applications,
  onAdd,
}: AddConfigurationApplicationDialogProps) {
  const { t } = useTranslation()
  const [selected, setSelected] = useState<ConfigurationApplication | undefined>()
  const [action, setAction] = useState<number>(1)
  const [showIcon, setShowIcon] = useState<boolean>(true)
  const [newAppOpen, setNewAppOpen] = useState(false)

  useEffect(() => {
    if (open) {
      setSelected(undefined)
      setAction(1)
      setShowIcon(true)
    }
  }, [open])

  const availableCount = useMemo(
    () => applications.filter((app) => app.action === 0 && !app.actionChanged).length,
    [applications]
  )

  const handleSelect = (app: ConfigurationApplication) => {
    setSelected(app)
    setAction(1)
    setShowIcon(Boolean(app.showIcon ?? true))
  }

  const handleAdd = () => {
    if (!selected) {
      return
    }

    onAdd({
      ...selected,
      action,
      showIcon: action === 1 ? showIcon : selected.showIcon,
      actionChanged: true,
      remove: action === 2,
      usedVersionId: selected.usedVersionId ?? selected.latestVersion,
    })
    onOpenChange(false)
  }

  const handleNewAppSaved = (app: ConfigurationApplication) => {
    setNewAppOpen(false)
    onAdd(app)
    onOpenChange(false)
  }

  const installAvailable = selected ? isInstallOptionAvailable(selected) : true
  const removeAvailable = selected ? isRemoveOptionAvailable(selected) : false

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('configurations.editor.addApplicationTitle')}</DialogTitle>
            <DialogDescription>
              {t('configurations.editor.addApplicationDescription', { name: configuration.name })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('applications.columns.name')}</Label>
              <ConfigurationAppSearchInput
                apps={applications}
                mode="available"
                selected={selected}
                placeholder={t('configurations.editor.searchApplication')}
                onSelect={handleSelect}
              />
              {availableCount === 0 && (
                <p className="text-xs text-muted-foreground">
                  {t('configurations.editor.noAvailableAppsHint')}
                </p>
              )}
            </div>

            {selected && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="add-app-action">{t('configurations.editor.actionColumn')}</Label>
                  <NativeSelect
                    id="add-app-action"
                    className="h-9 px-3"
                    value={action}
                    onChange={(e) => setAction(Number(e.target.value))}
                  >
                    <option value={1}>
                      {installAvailable
                        ? t('configurations.editor.actionInstall')
                        : t('configurations.editor.actionAllow')}
                    </option>
                    <option value={0}>
                      {installAvailable
                        ? t('configurations.editor.actionNotInstall')
                        : t('configurations.editor.actionProhibit')}
                    </option>
                    {removeAvailable && (
                      <option value={2}>{t('configurations.editor.actionRemove')}</option>
                    )}
                  </NativeSelect>
                </div>

                {action === 1 && (
                  <div className="space-y-2">
                    <Label htmlFor="add-app-show-icon">{t('configurations.editor.iconColumn')}</Label>
                    <NativeSelect
                      id="add-app-show-icon"
                      className="h-9 px-3"
                      value={showIcon ? '1' : '0'}
                      onChange={(e) => setShowIcon(e.target.value === '1')}
                    >
                      <option value="1">{t('configurations.editor.showIconOption')}</option>
                      <option value="0">{t('configurations.editor.hideIconOption')}</option>
                    </NativeSelect>
                  </div>
                )}

                <p className="text-sm text-muted-foreground">
                  {formatConfigurationAppLabel(selected)}
                  {selected.pkg ? ` (${selected.pkg})` : ''}
                </p>
              </>
            )}
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <Button type="button" variant="outline" onClick={() => setNewAppOpen(true)}>
              {t('configurations.editor.newAppButton')}
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="button" disabled={!selected} onClick={handleAdd}>
                {t('common.add')}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ApplicationFormDialog
        open={newAppOpen}
        onOpenChange={setNewAppOpen}
        closeOnSave
        onSavedForConfiguration={handleNewAppSaved}
      />
    </>
  )
}
