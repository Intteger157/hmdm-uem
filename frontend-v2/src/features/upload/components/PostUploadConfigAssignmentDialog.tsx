import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { assignConfigProfileApps, fetchConfigProfileApps } from '@/features/windows/applications/api/windows-applications-api'
import type { ProfileAppAssignment } from '@/features/windows/applications/types/software-app'
import { fetchWindowsConfigProfiles } from '@/features/windows/configurations/api/windows-configurations-api'
import {
  assignProfileFileDeployments,
  fetchProfileFileDeployments,
} from '@/features/windows/files/api/windows-files-api'
import type { ProfileFileDeploymentRule } from '@/features/windows/files/types/stored-file'
import { usePostUploadAssignmentStore } from '@/features/upload/store/post-upload-assignment-store'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { FlatSelect } from '@/components/ui/flat-select'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

function dedupeAppAssignments(items: ProfileAppAssignment[]): ProfileAppAssignment[] {
  const seen = new Set<number>()
  const result: ProfileAppAssignment[] = []
  for (const item of items) {
    if (seen.has(item.appId)) {
      continue
    }
    seen.add(item.appId)
    result.push(item)
  }
  return result
}

function defaultFileDestination(fileName: string): string {
  const safeName = fileName.replace(/[<>:"|?*]/g, '_')
  return `C:\\ProgramData\\SingularityMDM\\${safeName}`
}

export function PostUploadConfigAssignmentDialog() {
  const { t } = useTranslation()
  const request = usePostUploadAssignmentStore((state) => state.request)
  const dismiss = usePostUploadAssignmentStore((state) => state.dismiss)
  const [configurations, setConfigurations] = useState<Array<{ id: number; name: string }>>([])
  const [loadingConfigs, setLoadingConfigs] = useState(false)
  const [selectedProfileId, setSelectedProfileId] = useState('')
  const [isAssigning, setIsAssigning] = useState(false)

  const isOpen = request != null
  const isApplication = request?.kind === 'application'

  useEffect(() => {
    if (!isOpen) {
      setSelectedProfileId('')
      setIsAssigning(false)
      return
    }

    let cancelled = false
    setLoadingConfigs(true)

    void fetchWindowsConfigProfiles()
      .then((response) => {
        if (cancelled) {
          return
        }
        setConfigurations(response.items.map((profile) => ({ id: profile.id, name: profile.name })))
      })
      .catch(() => {
        if (!cancelled) {
          toast.error(t('postUploadAssignment.loadConfigurationsError'))
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingConfigs(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [isOpen, t])

  const configOptions = useMemo(
    () =>
      configurations.map((profile) => ({
        value: String(profile.id),
        label: profile.name,
      })),
    [configurations],
  )

  const handleAssign = async () => {
    if (!request) {
      return
    }

    const profileId = Number(selectedProfileId)
    if (!Number.isInteger(profileId) || profileId <= 0) {
      return
    }

    setIsAssigning(true)
    try {
      if (request.kind === 'application') {
        const current = await fetchConfigProfileApps(profileId)
        const merged = dedupeAppAssignments([
          ...(current.assignments ?? current.appIds?.map((appId) => ({ appId })) ?? []),
          { appId: request.resourceId },
        ])
        await assignConfigProfileApps(profileId, { assignments: merged })
        toast.success(t('postUploadAssignment.assignApplicationSuccess'))
      } else {
        const current = await fetchProfileFileDeployments(profileId)
        const fileName = request.resourceName
        const nextRule: ProfileFileDeploymentRule = {
          fileId: request.resourceId,
          destinationPath: defaultFileDestination(fileName),
          unzip: fileName.toLowerCase().endsWith('.zip'),
        }
        const alreadyLinked = current.some((rule) => rule.fileId === request.resourceId)
        const items = alreadyLinked ? current : [...current, nextRule]
        await assignProfileFileDeployments(profileId, items)
        toast.success(t('postUploadAssignment.assignFileSuccess'))
      }
      dismiss()
    } catch {
      toast.error(t('postUploadAssignment.assignError'))
    } finally {
      setIsAssigning(false)
    }
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          dismiss()
        }
      }}
    >
      <DialogContent
        className={cn(
          'border-white/10 bg-[#111] sm:max-w-md',
          'duration-300 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95',
          'data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
        )}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <CheckCircle2 className="size-5 shrink-0 text-emerald-400" aria-hidden />
            {isApplication
              ? t('postUploadAssignment.applicationTitle')
              : t('postUploadAssignment.fileTitle')}
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
            {isApplication
              ? t('postUploadAssignment.applicationBody', { name: request?.resourceName ?? '' })
              : t('postUploadAssignment.fileBody', { name: request?.resourceName ?? '' })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-1">
          <Label htmlFor="post-upload-config-select">{t('postUploadAssignment.configurationLabel')}</Label>
          {loadingConfigs ? (
            <div className="flex h-9 items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {t('common.loading')}
            </div>
          ) : configOptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('postUploadAssignment.noConfigurations')}</p>
          ) : (
            <FlatSelect
              id="post-upload-config-select"
              value={selectedProfileId}
              onChange={setSelectedProfileId}
              options={configOptions}
              placeholder={t('postUploadAssignment.configurationPlaceholder')}
            />
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" disabled={isAssigning} onClick={dismiss}>
            {t('postUploadAssignment.skip')}
          </Button>
          <Button
            type="button"
            disabled={isAssigning || !selectedProfileId || configOptions.length === 0}
            className="bg-gradient-to-r from-blue-600 to-violet-600 text-white hover:from-blue-500 hover:to-violet-500"
            onClick={() => void handleAssign()}
          >
            {isAssigning ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {t('postUploadAssignment.assigning')}
              </>
            ) : (
              t('postUploadAssignment.assign')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
