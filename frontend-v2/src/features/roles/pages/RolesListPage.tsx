import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { RoleFormDialog } from '@/features/roles/components/RoleFormDialog'
import { useDeleteRoleMutation, useRolesQuery } from '@/features/roles/hooks/use-roles'
import type { UserRole } from '@/features/roles/api/roles-api'
import { Button } from '@/components/ui/button'
import { ConfirmDeleteDialog } from '@/shared/components/ConfirmDeleteDialog'
import { toast } from 'sonner'

export function RolesListPage() {
  const { t } = useTranslation()
  const { data, isLoading, error, refetch } = useRolesQuery()
  const deleteMutation = useDeleteRoleMutation()

  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<UserRole | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<UserRole | null>(null)

  const handleDelete = async () => {
    if (!deleteTarget?.id) return
    try {
      await deleteMutation.mutateAsync(deleteTarget.id)
      toast.success(t('roles.delete.success'))
      setDeleteTarget(null)
    } catch {
      toast.error(t('roles.delete.error'))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('roles.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('roles.subtitle')}</p>
        </div>
        <Button type="button" onClick={() => { setEditTarget(null); setFormOpen(true) }}>
          <Plus className="mr-1 size-4" />
          {t('roles.add')}
        </Button>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">{t('common.loading')}</p>}
      {error != null && (
        <div className="rounded-lg border border-destructive/40 p-4">
          <p className="text-sm text-destructive">{t('common.loadError')}</p>
          <Button type="button" variant="outline" className="mt-2" onClick={() => void refetch()}>
            {t('common.retry')}
          </Button>
        </div>
      )}

      {!isLoading && error == null && (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">{t('roles.columns.name')}</th>
                <th className="px-4 py-3 font-medium">{t('roles.columns.description')}</th>
                <th className="px-4 py-3 font-medium">{t('roles.columns.permissions')}</th>
                <th className="px-4 py-3 font-medium text-right">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((role) => (
                <tr key={role.id ?? role.name} className="border-b last:border-b-0">
                  <td className="px-4 py-3 font-medium">{role.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{role.description ?? '—'}</td>
                  <td className="px-4 py-3">{role.permissions?.length ?? 0}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button type="button" variant="ghost" size="icon-xs" onClick={() => { setEditTarget(role); setFormOpen(true) }}>
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button type="button" variant="ghost" size="icon-xs" className="text-destructive" disabled={role.superAdmin} onClick={() => setDeleteTarget(role)}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <RoleFormDialog open={formOpen} onOpenChange={setFormOpen} role={editTarget} onSaved={() => void refetch()} />
      <ConfirmDeleteDialog
        open={deleteTarget != null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
        title={t('roles.delete.title')}
        description={t('roles.delete.confirm', { name: deleteTarget?.name ?? '' })}
        isPending={deleteMutation.isPending}
        onConfirm={() => void handleDelete()}
      />
    </div>
  )
}
