import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { ArrowLeft } from 'lucide-react'
import {
  useConfigurationQuery,
  useUpsertConfigurationMutation,
} from '@/features/configurations/hooks/use-configurations'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

interface ConfigurationEditorPageProps {
  configId: number
}

function PlaceholderTab({ messageKey }: { messageKey: string }) {
  const { t } = useTranslation()

  return (
    <Card>
      <CardContent className="p-8 text-center text-sm text-muted-foreground">
        {t(messageKey)}
      </CardContent>
    </Card>
  )
}

export function ConfigurationEditorPage({ configId }: ConfigurationEditorPageProps) {
  const { t } = useTranslation()
  const { data: configuration, isLoading, error } = useConfigurationQuery(configId)
  const upsertMutation = useUpsertConfigurationMutation()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [password, setPassword] = useState('')

  useEffect(() => {
    if (configuration) {
      setName(configuration.name ?? '')
      setDescription(configuration.description ?? '')
      setPassword(typeof configuration.password === 'string' ? configuration.password : '')
    }
  }, [configuration])

  const handleSave = async () => {
    if (!configuration || !name.trim()) {
      return
    }

    try {
      await upsertMutation.mutateAsync({
        ...configuration,
        name: name.trim(),
        description: description.trim() || undefined,
        password: password || undefined,
      })
      toast.success(t('configurations.editor.saved'))
    } catch {
      toast.error(t('configurations.editor.saveError'))
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (error != null || !configuration) {
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
            <h1 className="text-2xl font-semibold tracking-tight">{configuration.name}</h1>
            <p className="text-sm text-muted-foreground">{t('configurations.editor.subtitle')}</p>
          </div>
        </div>
        <Button
          type="button"
          disabled={upsertMutation.isPending || !name.trim()}
          onClick={() => void handleSave()}
        >
          {upsertMutation.isPending ? t('common.saving') : t('common.save')}
        </Button>
      </div>

      <Tabs defaultValue="common">
        <TabsList>
          <TabsTrigger value="common">{t('configurations.editor.tabs.common')}</TabsTrigger>
          <TabsTrigger value="design">{t('configurations.editor.tabs.design')}</TabsTrigger>
          <TabsTrigger value="applications">
            {t('configurations.editor.tabs.applications')}
          </TabsTrigger>
          <TabsTrigger value="mdm">{t('configurations.editor.tabs.mdm')}</TabsTrigger>
          <TabsTrigger value="files">{t('configurations.editor.tabs.files')}</TabsTrigger>
        </TabsList>

        <TabsContent value="common">
          <Card>
            <CardHeader>
              <CardTitle>{t('configurations.editor.commonTitle')}</CardTitle>
              <CardDescription>{t('configurations.editor.commonDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="config-name">{t('configurations.editor.fields.name')}</Label>
                <Input
                  id="config-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="config-description">
                  {t('configurations.editor.fields.description')}
                </Label>
                <Textarea
                  id="config-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="resize-none"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="config-password">
                  {t('configurations.editor.fields.password')}
                </Label>
                <Input
                  id="config-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <Label>{t('configurations.editor.fields.qrCodeKey')}</Label>
                <Input value={configuration.qrCodeKey ?? '—'} readOnly disabled />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="design">
          <PlaceholderTab messageKey="configurations.editor.placeholder" />
        </TabsContent>
        <TabsContent value="applications">
          <PlaceholderTab messageKey="configurations.editor.placeholder" />
        </TabsContent>
        <TabsContent value="mdm">
          <PlaceholderTab messageKey="configurations.editor.placeholder" />
        </TabsContent>
        <TabsContent value="files">
          <PlaceholderTab messageKey="configurations.editor.placeholder" />
        </TabsContent>
      </Tabs>
    </div>
  )
}
