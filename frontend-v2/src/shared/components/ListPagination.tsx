import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'

interface ListPaginationProps {
  pageNum: number
  totalPages: number
  totalItems: number
  from: number
  to: number
  disabled?: boolean
  onPageChange: (page: number) => void
}

export function ListPagination({
  pageNum,
  totalPages,
  totalItems,
  from,
  to,
  disabled,
  onPageChange,
}: ListPaginationProps) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">
        {t('common.paginationSummary', { from, to, total: totalItems })}
      </p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pageNum <= 1 || disabled}
          onClick={() => onPageChange(Math.max(1, pageNum - 1))}
        >
          {t('common.prevPage')}
        </Button>
        <span className="text-sm text-muted-foreground">
          {t('common.pageOf', { page: pageNum, total: totalPages })}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pageNum >= totalPages || disabled}
          onClick={() => onPageChange(pageNum + 1)}
        >
          {t('common.nextPage')}
        </Button>
      </div>
    </div>
  )
}
