import { Copy, Loader2, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { copyTextToClipboard } from '@/shared/lib/copy-to-clipboard'
import { BoolField } from '@/shared/components/BoolField'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  getWindowsAutopilotAgent,
  getWindowsEnrollmentProvisioning,
  updateWindowsEnrollmentProvisioning,
  uploadWindowsAutopilotAgent,
  type WindowsEnrollmentProvisioningSettings,
} from '@/features/windows/api/windows-api'
import { toast } from 'sonner'

function buildBootstrapCommand(origin: string): string {
  const enrollUrl = `${origin.replace(/\/+$/, '')}/api/windows/enroll`
  return `powershell -NoProfile -ExecutionPolicy Bypass -Command "Invoke-RestMethod -Uri '${enrollUrl}' | Invoke-Expression"`
}

function formatFileSize(bytes?: number): string {
  if (bytes == null || bytes <= 0) {
    return '—'
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatUploadedAt(value?: string): string {
  if (!value) {
    return '—'
  }
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) {
    return value
  }
  return new Date(parsed).toLocaleString()
}

export function WindowsEnrollmentPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [provisioningDraft, setProvisioningDraft] = useState<WindowsEnrollmentProvisioningSettings>({
    createLocalAdmin: false,
    adminUsername: 'Admin',
    adminPassword: '',
  })

  const bootstrapCommand = buildBootstrapCommand(
    typeof window !== 'undefined' ? window.location.origin : '',
  )

  const agentQuery = useQuery({
    queryKey: ['windows', 'autopilot-agent'],
    queryFn: getWindowsAutopilotAgent,
  })

  const provisioningQuery = useQuery({
    queryKey: ['windows', 'enrollment-provisioning'],
    queryFn: getWindowsEnrollmentProvisioning,
  })

  useEffect(() => {
    if (provisioningQuery.data) {
      setProvisioningDraft(provisioningQuery.data)
    }
  }, [provisioningQuery.data])

  const uploadMutation = useMutation({
    mutationFn: uploadWindowsAutopilotAgent,
    onSuccess: (status) => {
      queryClient.setQueryData(['windows', 'autopilot-agent'], status)
      toast.success(t('windows.enrollmentPage.agentUploadSuccess'))
    },
    onError: () => {
      toast.error(t('windows.enrollmentPage.agentUploadError'))
    },
    onSettled: () => {
      setUploading(false)
    },
  })

  const provisioningMutation = useMutation({
    mutationFn: updateWindowsEnrollmentProvisioning,
    onSuccess: (settings) => {
      queryClient.setQueryData(['windows', 'enrollment-provisioning'], settings)
      setProvisioningDraft(settings)
      toast.success(t('windows.enrollmentPage.provisioningSaveSuccess'))
    },
    onError: () => {
      toast.error(t('windows.enrollmentPage.provisioningSaveError'))
    },
  })

  const handleCopy = async () => {
    try {
      await copyTextToClipboard(bootstrapCommand)
      toast.success(t('windows.enrollmentPage.copySuccess'))
    } catch {
      toast.error(t('windows.enrollment.copyFailed'))
    }
  }

  const handleFileSelected = async (file?: File | null) => {
    if (!file) {
      return
    }
    if (!file.name.toLowerCase().endsWith('.exe')) {
      toast.error(t('windows.enrollmentPage.agentUploadInvalidType'))
      return
    }
    setUploading(true)
    uploadMutation.mutate(file)
  }

  const handleSaveProvisioning = () => {
    if (provisioningDraft.createLocalAdmin) {
      if (!provisioningDraft.adminUsername.trim()) {
        toast.error(t('windows.enrollmentPage.provisioningUsernameRequired'))
        return
      }
      if (!provisioningDraft.adminPassword.trim()) {
        toast.error(t('windows.enrollmentPage.provisioningPasswordRequired'))
        return
      }
    }

    provisioningMutation.mutate({
      createLocalAdmin: provisioningDraft.createLocalAdmin,
      adminUsername: provisioningDraft.adminUsername.trim(),
      adminPassword: provisioningDraft.adminPassword,
    })
  }

  const agent = agentQuery.data

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('windows.enrollmentPage.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('windows.enrollmentPage.subtitle')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('windows.enrollmentPage.agentCardTitle')}</CardTitle>
          <CardDescription>{t('windows.enrollmentPage.agentCardDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={agent?.configured ? 'default' : 'secondary'}>
              {agent?.configured
                ? t('windows.enrollmentPage.agentPublished')
                : t('windows.enrollmentPage.agentMissing')}
            </Badge>
            {agentQuery.isLoading && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Loader2 className="size-3 animate-spin" />
                {t('windows.enrollmentPage.agentLoading')}
              </span>
            )}
          </div>

          {agent?.configured ? (
            <dl className="grid gap-3 rounded-lg border bg-muted/20 p-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">{t('windows.enrollmentPage.agentFileName')}</dt>
                <dd className="font-medium">{agent.fileName ?? 'singularity-agent.exe'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t('windows.enrollmentPage.agentVersion')}</dt>
                <dd className="font-medium">{agent.version?.trim() || t('windows.enrollmentPage.agentVersionUnknown')}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t('windows.enrollmentPage.agentFileSize')}</dt>
                <dd className="font-medium">{formatFileSize(agent.fileSize)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t('windows.enrollmentPage.agentUploadedAt')}</dt>
                <dd className="font-medium">{formatUploadedAt(agent.uploadedAt)}</dd>
              </div>
            </dl>
          ) : (
            <p className="rounded-lg border border-dashed bg-muted/10 p-4 text-sm text-muted-foreground">
              {t('windows.enrollmentPage.agentMissingHint')}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".exe,application/octet-stream"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]
                void handleFileSelected(file)
                event.target.value = ''
              }}
            />
            <Button
              type="button"
              variant="secondary"
              className="gap-2"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              {agent?.configured
                ? t('windows.enrollmentPage.agentReplaceButton')
                : t('windows.enrollmentPage.agentUploadButton')}
            </Button>
            {agent?.publicUrl ? (
              <p className="text-xs text-muted-foreground break-all">{agent.publicUrl}</p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('windows.enrollmentPage.provisioningCardTitle')}</CardTitle>
          <CardDescription>{t('windows.enrollmentPage.provisioningCardDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {provisioningQuery.isLoading ? (
            <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {t('windows.enrollmentPage.provisioningLoading')}
            </div>
          ) : (
            <>
              <BoolField
                id="windows-enrollment-create-local-admin"
                label={t('windows.enrollmentPage.provisioningEnabled')}
                hint={t('windows.enrollmentPage.provisioningEnabledHint')}
                checked={provisioningDraft.createLocalAdmin}
                onCheckedChange={(checked) =>
                  setProvisioningDraft((current) => ({ ...current, createLocalAdmin: checked }))
                }
              />

              {provisioningDraft.createLocalAdmin ? (
                <div className="grid gap-4 rounded-lg border bg-muted/20 p-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="windows-enrollment-admin-username">
                      {t('windows.enrollmentPage.provisioningUsername')}
                    </Label>
                    <Input
                      id="windows-enrollment-admin-username"
                      value={provisioningDraft.adminUsername}
                      onChange={(event) =>
                        setProvisioningDraft((current) => ({
                          ...current,
                          adminUsername: event.target.value,
                        }))
                      }
                      autoComplete="off"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="windows-enrollment-admin-password">
                      {t('windows.enrollmentPage.provisioningPassword')}
                    </Label>
                    <Input
                      id="windows-enrollment-admin-password"
                      type="password"
                      value={provisioningDraft.adminPassword}
                      onChange={(event) =>
                        setProvisioningDraft((current) => ({
                          ...current,
                          adminPassword: event.target.value,
                        }))
                      }
                      autoComplete="new-password"
                    />
                  </div>
                </div>
              ) : null}

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  disabled={provisioningMutation.isPending || provisioningQuery.isLoading}
                  onClick={handleSaveProvisioning}
                >
                  {provisioningMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      {t('windows.enrollmentPage.provisioningSaving')}
                    </>
                  ) : (
                    t('windows.enrollmentPage.provisioningSave')
                  )}
                </Button>
                {provisioningDraft.createLocalAdmin ? (
                  <p className="text-xs text-muted-foreground">
                    {t('windows.enrollmentPage.provisioningRebootHint')}
                  </p>
                ) : null}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div className="space-y-1.5">
            <CardTitle>{t('windows.enrollmentPage.cardTitle')}</CardTitle>
            <CardDescription>{t('windows.enrollmentPage.cardDescription')}</CardDescription>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="shrink-0 gap-1.5"
            onClick={() => void handleCopy()}
          >
            <Copy className="size-4" />
            {t('windows.enrollmentPage.copyCommand')}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <pre className="overflow-x-auto rounded-lg border bg-muted/40 p-4 text-xs leading-relaxed sm:text-sm">
            <code className="block min-w-max whitespace-pre">{bootstrapCommand}</code>
          </pre>

          <div className="rounded-lg border border-dashed bg-muted/20 p-4 text-sm leading-relaxed text-muted-foreground">
            {t('windows.enrollmentPage.instructions')}
          </div>

          <p className="text-xs text-muted-foreground">{t('windows.enrollmentPage.agentBinaryHint')}</p>
        </CardContent>
      </Card>
    </div>
  )
}
