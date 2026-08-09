import { Copy, Link2, Loader2, RefreshCw, Upload } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { copyTextToClipboard } from '@/shared/lib/copy-to-clipboard'
import { generateEnrollmentSecret } from '@/shared/lib/generate-enrollment-secret'
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
import { Switch } from '@/components/ui/switch'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import {
  PAGE_FLAT_CARD_CLASS,
  PageContainer,
  PageHeader,
} from '@/shared/layout/page-layout'
import {
  getWindowsAutopilotAgent,
  getWindowsEnrollmentProvisioning,
  getWindowsEnrollmentSecurity,
  updateWindowsEnrollmentProvisioning,
  updateWindowsEnrollmentSecurity,
  uploadWindowsAutopilotAgent,
  type WindowsEnrollmentMode,
  type WindowsEnrollmentProvisioningSettings,
  type WindowsEnrollmentSecuritySettings,
} from '@/features/windows/api/windows-api'
import { toast } from 'sonner'
import { usePermissions } from '@/features/auth/hooks/use-permissions'

const flatCardClassName = PAGE_FLAT_CARD_CLASS

function buildBootstrapCommand(
  origin: string,
  mode: WindowsEnrollmentMode,
  secret: string,
): string {
  const baseUrl = `${origin.replace(/\/+$/, '')}/api/windows/enroll`
  const enrollUrl =
    mode === 'token' && secret.trim()
      ? `${baseUrl}?token=${encodeURIComponent(secret.trim())}`
      : baseUrl
  return `powershell -NoProfile -ExecutionPolicy Bypass -Command "irm '${enrollUrl}' | iex"`
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

interface EnrollmentModeSegmentedControlProps {
  value: WindowsEnrollmentMode
  onChange: (mode: WindowsEnrollmentMode) => void
  tokenLabel: string
  passwordLabel: string
}

function EnrollmentModeSegmentedControl({
  value,
  onChange,
  tokenLabel,
  passwordLabel,
}: EnrollmentModeSegmentedControlProps) {
  const options: { mode: WindowsEnrollmentMode; label: string }[] = [
    { mode: 'token', label: tokenLabel },
    { mode: 'password', label: passwordLabel },
  ]

  return (
    <div
      className="inline-flex rounded-md border border-border p-0.5"
      role="radiogroup"
      aria-label="Enrollment protection mode"
    >
      {options.map(({ mode, label }) => {
        const selected = value === mode
        return (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(mode)}
            className={cn(
              'rounded px-3 py-1.5 text-xs font-medium transition-colors',
              selected
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

export function WindowsEnrollmentPage() {
  const { t } = useTranslation()
  const { canMutate } = usePermissions()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [provisioningDraft, setProvisioningDraft] = useState<WindowsEnrollmentProvisioningSettings>({
    provisioningEnabled: false,
    adminUsername: 'Admin',
    adminPassword: '',
  })
  const [securityDraft, setSecurityDraft] = useState<WindowsEnrollmentSecuritySettings>({
    enrollmentMode: 'token',
    enrollmentSecret: '',
  })

  const agentQuery = useQuery({
    queryKey: ['windows', 'autopilot-agent'],
    queryFn: getWindowsAutopilotAgent,
  })

  const provisioningQuery = useQuery({
    queryKey: ['windows', 'enrollment-provisioning'],
    queryFn: getWindowsEnrollmentProvisioning,
  })

  const securityQuery = useQuery({
    queryKey: ['windows', 'enrollment-security'],
    queryFn: getWindowsEnrollmentSecurity,
  })

  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const savedSecurity = securityQuery.data ?? securityDraft
  const bootstrapCommand = useMemo(
    () =>
      buildBootstrapCommand(
        origin,
        savedSecurity.enrollmentMode,
        savedSecurity.enrollmentSecret,
      ),
    [origin, savedSecurity.enrollmentMode, savedSecurity.enrollmentSecret],
  )

  const securityIsDirty = useMemo(() => {
    if (!securityQuery.data) {
      return securityDraft.enrollmentSecret.trim() !== ''
    }

    return (
      securityDraft.enrollmentMode !== securityQuery.data.enrollmentMode ||
      securityDraft.enrollmentSecret !== securityQuery.data.enrollmentSecret
    )
  }, [securityDraft, securityQuery.data])

  useEffect(() => {
    if (provisioningQuery.data) {
      setProvisioningDraft(provisioningQuery.data)
    }
  }, [provisioningQuery.data])

  useEffect(() => {
    if (securityQuery.data) {
      setSecurityDraft(securityQuery.data)
    }
  }, [securityQuery.data])

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

  const securityMutation = useMutation({
    mutationFn: updateWindowsEnrollmentSecurity,
    onSuccess: (settings) => {
      queryClient.setQueryData(['windows', 'enrollment-security'], settings)
      setSecurityDraft(settings)
      toast.success(t('windows.enrollmentPage.securitySaveSuccess'))
    },
    onError: () => {
      toast.error(t('windows.enrollmentPage.securitySaveError'))
    },
  })

  const handleCopyCommand = async () => {
    try {
      await copyTextToClipboard(bootstrapCommand)
      toast.success(t('windows.enrollmentPage.copySuccess'))
    } catch {
      toast.error(t('windows.enrollment.copyFailed'))
    }
  }

  const handleCopyAgentUrl = async () => {
    const url = agent?.publicUrl?.trim()
    if (!url) {
      return
    }
    try {
      await copyTextToClipboard(url)
      toast.success(t('windows.enrollmentPage.copyUrlSuccess'))
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
    if (provisioningDraft.provisioningEnabled) {
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
      provisioningEnabled: provisioningDraft.provisioningEnabled,
      adminUsername: provisioningDraft.adminUsername.trim(),
      adminPassword: provisioningDraft.adminPassword,
    })
  }

  const handleSaveSecurity = () => {
    if (!securityDraft.enrollmentSecret.trim()) {
      toast.error(t('windows.enrollmentPage.securitySecretRequired'))
      return
    }

    securityMutation.mutate({
      enrollmentMode: securityDraft.enrollmentMode,
      enrollmentSecret: securityDraft.enrollmentSecret.trim(),
    })
  }

  const handleGenerateSecuritySecret = () => {
    setSecurityDraft((current) => ({
      ...current,
      enrollmentSecret: generateEnrollmentSecret(),
    }))
  }

  const agent = agentQuery.data
  const enrollmentInstructions =
    securityDraft.enrollmentMode === 'password'
      ? t('windows.enrollmentPage.instructionsPassword')
      : t('windows.enrollmentPage.instructionsToken')
  const securityModeHint =
    securityDraft.enrollmentMode === 'password'
      ? t('windows.enrollmentPage.securityModePasswordHint')
      : t('windows.enrollmentPage.securityModeTokenHint')

  return (
    <TooltipProvider>
      <PageContainer>
        <PageHeader
          title={t('windows.enrollmentPage.title')}
          description={t('windows.enrollmentPage.subtitle')}
        />

        <Card size="sm" className={flatCardClassName}>
          <CardHeader className="pb-2">
            <CardTitle>{t('windows.enrollmentPage.agentCardTitle')}</CardTitle>
            <CardDescription className="text-xs">
              {t('windows.enrollmentPage.agentCardDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pb-4">
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
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-md border border-border px-3 py-2 text-sm">
                <span>
                  <span className="text-muted-foreground">{t('windows.enrollmentPage.agentFileName')}: </span>
                  <span className="font-medium">{agent.fileName ?? 'singularity-agent.exe'}</span>
                </span>
                <span>
                  <span className="text-muted-foreground">{t('windows.enrollmentPage.agentVersion')}: </span>
                  <span className="font-medium">
                    {agent.version?.trim() || t('windows.enrollmentPage.agentVersionUnknown')}
                  </span>
                </span>
                <span>
                  <span className="text-muted-foreground">{t('windows.enrollmentPage.agentFileSize')}: </span>
                  <span className="font-medium">{formatFileSize(agent.fileSize)}</span>
                </span>
                <span>
                  <span className="text-muted-foreground">{t('windows.enrollmentPage.agentUploadedAt')}: </span>
                  <span className="font-medium">{formatUploadedAt(agent.uploadedAt)}</span>
                </span>
              </div>
            ) : (
              <p className="rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
                {t('windows.enrollmentPage.agentMissingHint')}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2">
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
              {canMutate && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="gap-2"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                  {agent?.configured
                    ? t('windows.enrollmentPage.agentReplaceButton')
                    : t('windows.enrollmentPage.agentUploadButton')}
                </Button>
              )}
              {agent?.publicUrl ? (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        aria-label={t('windows.enrollmentPage.copyUrl')}
                        onClick={() => void handleCopyAgentUrl()}
                      >
                        <Link2 className="size-4" />
                      </Button>
                    }
                  />
                  <TooltipContent>{t('windows.enrollmentPage.copyUrl')}</TooltipContent>
                </Tooltip>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card size="sm" className={flatCardClassName}>
          <CardHeader className="pb-2">
            <CardTitle>{t('windows.enrollmentPage.securityCardTitle')}</CardTitle>
            <CardDescription className="text-xs">
              {t('windows.enrollmentPage.securityCardDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pb-4">
            {securityQuery.isLoading ? (
              <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                {t('windows.enrollmentPage.securityLoading')}
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1.5">
                    <Label className="text-xs">{t('windows.enrollmentPage.securityModeLabel')}</Label>
                    <EnrollmentModeSegmentedControl
                      value={securityDraft.enrollmentMode}
                      onChange={(mode) =>
                        setSecurityDraft((current) => ({ ...current, enrollmentMode: mode }))
                      }
                      tokenLabel={t('windows.enrollmentPage.securityModeToken')}
                      passwordLabel={t('windows.enrollmentPage.securityModePassword')}
                    />
                  </div>
                  <p className="max-w-md text-xs text-muted-foreground sm:text-right">{securityModeHint}</p>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <div className="min-w-0 flex-1 space-y-1">
                    <Label htmlFor="windows-enrollment-secret" className="text-xs">
                      {t('windows.enrollmentPage.securitySecret')}
                    </Label>
                    <Input
                      id="windows-enrollment-secret"
                      type="text"
                      className="font-mono"
                      value={securityDraft.enrollmentSecret}
                      onChange={(event) =>
                        setSecurityDraft((current) => ({
                          ...current,
                          enrollmentSecret: event.target.value,
                        }))
                      }
                      autoComplete="off"
                      spellCheck={false}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="shrink-0 gap-2"
                    onClick={handleGenerateSecuritySecret}
                  >
                    <RefreshCw className="size-4" />
                    {t('windows.enrollmentPage.securityGenerate')}
                  </Button>
                  {canMutate && (
                    <Button
                      type="button"
                      size="sm"
                      className="shrink-0"
                      disabled={!securityIsDirty || securityMutation.isPending || securityQuery.isLoading}
                      onClick={handleSaveSecurity}
                    >
                      {securityMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 size-4 animate-spin" />
                          {t('windows.enrollmentPage.securitySaving')}
                        </>
                      ) : (
                        t('windows.enrollmentPage.securitySave')
                      )}
                    </Button>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card size="sm" className={flatCardClassName}>
          <CardHeader className="pb-2">
            <CardTitle>{t('windows.enrollmentPage.provisioningCardTitle')}</CardTitle>
            <CardDescription className="text-xs">
              {t('windows.enrollmentPage.provisioningCardDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pb-4">
            {provisioningQuery.isLoading ? (
              <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                {t('windows.enrollmentPage.provisioningLoading')}
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-4 rounded-md border border-border px-3 py-2">
                  <div className="min-w-0 space-y-0.5">
                    <label
                      htmlFor="windows-enrollment-create-local-admin"
                      className="text-sm font-medium"
                    >
                      {t('windows.enrollmentPage.provisioningEnabled')}
                    </label>
                    <p className="text-xs text-muted-foreground">
                      {t('windows.enrollmentPage.provisioningEnabledHint')}
                    </p>
                  </div>
                  <Switch
                    id="windows-enrollment-create-local-admin"
                    checked={provisioningDraft.provisioningEnabled}
                    onCheckedChange={(checked) =>
                      setProvisioningDraft((current) => ({ ...current, provisioningEnabled: checked }))
                    }
                    className="mt-0.5"
                  />
                </div>

                {provisioningDraft.provisioningEnabled ? (
                  <div className="grid gap-3 rounded-md border border-border px-3 py-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor="windows-enrollment-admin-username" className="text-xs">
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
                    <div className="space-y-1">
                      <Label htmlFor="windows-enrollment-admin-password" className="text-xs">
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
                  {canMutate && (
                    <Button
                      type="button"
                      size="sm"
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
                  )}
                  {provisioningDraft.provisioningEnabled ? (
                    <p className="text-xs text-muted-foreground">
                      {t('windows.enrollmentPage.provisioningRebootHint')}
                    </p>
                  ) : null}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card size="sm" className={flatCardClassName}>
          <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-2">
            <div className="space-y-1">
              <CardTitle>{t('windows.enrollmentPage.cardTitle')}</CardTitle>
              <CardDescription className="text-xs">
                {t('windows.enrollmentPage.cardDescription')}
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="shrink-0 gap-1.5"
              onClick={() => void handleCopyCommand()}
            >
              <Copy className="size-4" />
              {t('windows.enrollmentPage.copyCommand')}
            </Button>
          </CardHeader>
          <CardContent className="space-y-3 pb-4">
            <pre className="overflow-x-auto rounded-md border border-border bg-background p-3 text-xs leading-relaxed sm:text-sm">
              <code className="block min-w-max whitespace-pre">{bootstrapCommand}</code>
            </pre>

            <div className="rounded-md border border-dashed border-border px-3 py-2 text-xs leading-relaxed text-muted-foreground">
              {enrollmentInstructions}
            </div>

            <p className="text-xs text-muted-foreground">{t('windows.enrollmentPage.agentBinaryHint')}</p>
          </CardContent>
        </Card>
      </PageContainer>
    </TooltipProvider>
  )
}
