"use client";

// Rows a table shows instead of data: placeholders while loading, and a
// single message row when there is nothing to list.

import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { TableCell, TableRow } from "@/components/ui/table";

export function TableSkeletonRows({ columns, rows = 6 }: { columns: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, r) => (
        <TableRow key={r} className="hover:bg-transparent">
          {Array.from({ length: columns }, (_, c) => (
            <TableCell key={c} className="px-4 py-3">
              {c === 0 ? (
                <div className="flex items-center gap-3">
                  <Skeleton className="size-7 rounded-full" />
                  <Skeleton className="h-4 w-32" />
                </div>
              ) : (
                <Skeleton className="h-4 w-full max-w-24" />
              )}
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

export function TableMessageRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={colSpan} className="px-4 py-10 text-center text-xs text-muted-foreground">
        {children}
      </TableCell>
    </TableRow>
  );
}
