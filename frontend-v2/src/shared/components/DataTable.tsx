import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import {
  DATA_TABLE_CLASS,
  DATA_TABLE_WRAPPER_CLASS,
} from '@/shared/layout/page-layout'

interface DataTableProps {
  children: ReactNode
  className?: string
  tableClassName?: string
}

export function DataTable({ children, className, tableClassName }: DataTableProps) {
  return (
    <div className={cn(DATA_TABLE_WRAPPER_CLASS, className)}>
      <table className={cn(DATA_TABLE_CLASS, tableClassName)}>{children}</table>
    </div>
  )
}
