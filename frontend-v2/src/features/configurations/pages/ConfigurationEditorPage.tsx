import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { ArrowLeft } from 'lucide-react'
import { ConfigurationApplicationsTab } from '@/features/configurations/components/editor/ConfigurationApplicationsTab'
import { ConfigurationCommonTab } from '@/features/configurations/components/editor/ConfigurationCommonTab'
import { ConfigurationDesignTab } from '@/features/configurations/components/editor/ConfigurationDesignTab'
import { ConfigurationFilesTab } from '@/features/configurations/components/editor/ConfigurationFilesTab'
import { ConfigurationMdmTab } from '@/features/configurations/components/editor/ConfigurationMdmTab'
import {
  useConfigurationApplicationsQuery,
  useConfigurationQuery,
  useUpsertConfigurationMutation,
} from '@/features/configurations/hooks/use-configurations'
import type { Configuration } from '@/features/configurations/types/configuration'
import type { ConfigurationApplication } from '@/features/configurations/types/configuration'
import { prepareConfigurationForSave } from '@/features/configurations/utils/configuration-app-utils'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'

interface ConfigurationEditorPageProps {
  configId: number
}

export function ConfigurationEditorPage({ configId }: ConfigurationEditorPageProps) {
  const { t } = useTranslation()
  const { data: configuration, isLoading, error } = useConfigurationQuery(configId)
  const { data: configurationApplications, isLoading: appsLoading } =
    useConfigurationApplicationsQuery(configId)
  const upsertMutation = useUpsertConfigurationMutation()

  const [draft, setDraft] = useState<Configuration | null>(null)
  const [applications, setApplications] = useState<ConfigurationApplication[]>([])

  useEffect(() => {
    if (configuration) {
      setDraft(structuredClone(configuration))
    }
  }, [configuration])

  useEffect(() => {
    if (configurationApplications) {
      setApplications(configurationApplications)
    }
  }, [configurationApplications])

  const handleChange = (patch: Partial<Configuration>) => {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev))
  }

  const handleApplicationsChange = (nextApplications: ConfigurationApplication[]) => {
    setApplications(nextApplications)
    setDraft((prev) => (prev ? { ...prev, applications: nextApplications } : prev))
  }

  const handleSave = async () => {
    if (!draft?.name.trim()) {
      return
    }

    const payload = prepareConfigurationForSave({
      ...draft,
      applications,
    })

    if (
      payload.mainAppId != null &&
      payload.mainAppId > 0 &&
      !payload.applications?.some(
        (app) => app.action === 1 && app.usedVersionId === payload.mainAppId
      )
    ) {
      toast.error(t('configurations.editor.invalidMainApp'))
      return
    }

    try {
      await upsertMutation.mutateAsync(payload)
      toast.success(t('configurations.editor.saved'))
    } catch {
      toast.error(t('configurations.editor.saveError'))
    }
  }

  if (isLoading || appsLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (error != null || !configuration || !draft) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-card p-8 text-center">
        <p className="text-sm text-destructive">{t('common.loadError')}</p>
        <Button type="button" variant="outline" className="mt-3" render={<Link to="/configurations" />}>
          {t('configurations.editor.backToList')}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button type="button" variant="ghost" size="icon-sm" render={<Link to="/configurations" />}>
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{draft.name}</h1>
            <p className="text-sm text-muted-foreground">{t('configurations.editor.subtitle')}</p>
          </div>
        </div>
        <Button
          type="button"
          disabled={upsertMutation.isPending || !draft.name.trim()}
          onClick={() => void handleSave()}
        >
          {upsertMutation.isPending ? t('common.saving') : t('common.save')}
        </Button>
      </div>

      <Tabs defaultValue="mdm">
        <TabsList className="flex-wrap">
          <TabsTrigger value="common">{t('configurations.editor.tabs.common')}</TabsTrigger>
          <TabsTrigger value="design">{t('configurations.editor.tabs.design')}</TabsTrigger>
          <TabsTrigger value="applications">
            {t('configurations.editor.tabs.applications')}
          </TabsTrigger>
          <TabsTrigger value="mdm">{t('configurations.editor.tabs.mdm')}</TabsTrigger>
          <TabsTrigger value="files">{t('configurations.editor.tabs.files')}</TabsTrigger>
        </TabsList>

        <TabsContent value="common">
          <ConfigurationCommonTab draft={draft} onChange={handleChange} />
        </TabsContent>
        <TabsContent value="design">
          <ConfigurationDesignTab draft={draft} onChange={handleChange} />
        </TabsContent>
        <TabsContent value="applications">
          <ConfigurationApplicationsTab
            draft={draft}
            applications={applications}
            onChange={handleChange}
            onApplicationsChange={handleApplicationsChange}
          />
        </TabsContent>
        <TabsContent value="mdm">
          <ConfigurationMdmTab
            draft={draft}
            applications={applications}
            onChange={handleChange}
            onApplicationsChange={handleApplicationsChange}
          />
        </TabsContent>
        <TabsContent value="files">
          <ConfigurationFilesTab draft={draft} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
