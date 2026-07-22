import { useEffect, useMemo, useState } from 'react'

interface UsePaginatedListResult<T> {
  pageItems: T[]
  pageNum: number
  setPageNum: (page: number | ((prev: number) => number)) => void
  totalItems: number
  totalPages: number
  from: number
  to: number
}

/** Client-side search filter + pagination for list pages. */
export function usePaginatedList<T>(
  items: T[],
  searchValue: string,
  matcher: (item: T, query: string) => boolean,
  pageSize = 20,
): UsePaginatedListResult<T> {
  const [pageNum, setPageNum] = useState(1)

  const filtered = useMemo(() => {
    const query = searchValue.trim().toLowerCase()
    if (!query) {
      return items
    }
    return items.filter((item) => matcher(item, query))
  }, [items, searchValue, matcher])

  const totalItems = filtered.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))

  useEffect(() => {
    setPageNum(1)
  }, [searchValue])

  useEffect(() => {
    if (pageNum > totalPages) {
      setPageNum(totalPages)
    }
  }, [pageNum, totalPages])

  const pageItems = useMemo(
    () => filtered.slice((pageNum - 1) * pageSize, pageNum * pageSize),
    [filtered, pageNum, pageSize],
  )

  return {
    pageItems,
    pageNum,
    setPageNum,
    totalItems,
    totalPages,
    from: totalItems === 0 ? 0 : (pageNum - 1) * pageSize + 1,
    to: Math.min(pageNum * pageSize, totalItems),
  }
}
