import { useSearchParams } from "@remix-run/react";
import type { OnChangeFn, SortingState } from "@tanstack/react-table";
import React from "react";

export const usePagination = (defaultSorting?: SortingState) => {
  const [searchParams, setSearchParams] = useSearchParams();

  const getSorting = (): SortingState => {
    const urlSorting = searchParams.getAll("sorting");
    if (urlSorting) {
      return searchParams.getAll("sorting").map((value) => {
        const [id, sorting] = value.split(".");
        return {
          id,
          desc: sorting === "desc",
        };
      });
    }
    return defaultSorting ?? [];
  };

  const stringifySorting = (sorting: SortingState) => {
    return sorting
      .map((s) => `${s.id}.${s.desc ? "desc" : "asc"}`)
      .sort()
      .join("&");
  };

  const newSorting = getSorting();
  const sortingRef = React.useRef<SortingState>(newSorting);

  if (!sortingRef.current) {
    sortingRef.current = getSorting();
  }

  if (stringifySorting(newSorting) !== stringifySorting(sortingRef.current)) {
    sortingRef.current = newSorting;
  }

  /**
   * 1 indexed in url, 0 indexed in api
   */
  const page: number = Math.max((Number(searchParams.get("page")) || 1) - 1, 0);
  const rowsPerPage: number = Number(searchParams.get("rowsPerPage")) || 25;

  const setSorting: OnChangeFn<SortingState> = (newSortingFn) => {
    let newSorting =
      typeof newSortingFn === "function"
        ? newSortingFn(sortingRef.current)
        : newSortingFn;

    setSearchParams(
      (prevParams) => {
        prevParams.delete("sorting");
        newSorting.forEach((sorting) => {
          prevParams.append(
            "sorting",
            `${sorting.id}.${sorting.desc ? "desc" : "asc"}`
          );
        });
        return prevParams;
      },
      {
        replace: true,
      }
    );
  };

  const setPage = (page: number) => {
    setSearchParams(
      (prevParams) => {
        // 1 indexed in url, 0 index in pagination api
        prevParams.set("page", String(page + 1));
        return prevParams;
      },
      {
        replace: true,
      }
    );
  };
  const setRowsPerPage = (page: number) => {
    setSearchParams(
      (prevParams) => {
        prevParams.set("rowsPerPage", String(page));
        return prevParams;
      },
      {
        replace: true,
      }
    );
  };

  const clearPagination = () => {
    setSearchParams(
      () => {
        return new URLSearchParams();
      },
      {
        replace: true,
      }
    );
  };

  return {
    sorting: sortingRef.current,
    setSorting,
    page,
    setPage,
    rowsPerPage,
    setRowsPerPage,
    clearPagination,
  };
};
