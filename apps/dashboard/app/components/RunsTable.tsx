import type { PublicJobRun } from "@enschedule/types";
import Button from "@mui/material/Button";
import MuiLink from "@mui/material/Link";
import type { SerializeFrom } from "@remix-run/node";
import { Link as RemixLink, useFetcher } from "@remix-run/react";
import type { ColumnDef } from "@tanstack/react-table";
import { createColumnHelper } from "@tanstack/react-table";
import { produce } from "immer";
import React from "react";
import { ExpandableTable } from "~/components/Table";
import { createContext } from "~/utils/createContext";
import { formatDate } from "~/utils/formatDate";
import { useTable } from "./EnhancedTableToolbar";
import RunPage from "./RunPage";

type RowData = SerializeFrom<PublicJobRun>;

const columnHelper = createColumnHelper<RowData>();

const columns: ColumnDef<RowData, any>[] = [
  columnHelper.accessor("id", {
    cell: (info) => {
      const runId = info.row.original.id;
      return (
        <MuiLink
          to={`${runId}`}
          data-testid="run-link"
          component={RemixLink}
          onClick={(ev) => {
            ev.stopPropagation();
          }}
        >
          {info.getValue()}
        </MuiLink>
      );
    },
    header: "Id",
  }),
  columnHelper.accessor("startedAt", {
    cell: (info) => {
      const value = info.getValue();
      return formatDate(new Date(value), false).label;
    },
    header: "Started",
  }),
  {
    cell: ({ row, getValue }) => {
      return (
        <>
          {getValue()}
          ms
        </>
      );
    },
    enableSorting: true,
    header: "Duration",
    id: "duration",
    accessorFn: (run) => {
      return (
        new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()
      );
    },
  },
  columnHelper.accessor("finishedAt", {
    cell: (info) => {
      const value = info.getValue();
      return formatDate(new Date(value), false).label;
    },
    header: "Completed",
  }),
  columnHelper.accessor("scheduledToRunAt", {
    cell: (info) => {
      const value = info.getValue();
      return formatDate(new Date(value), false).label;
    },
    header: "Scheduled for",
  }),
  columnHelper.accessor("stdout", {
    cell: (info) => {
      const value = info.getValue();
      return String(!!value);
    },
    header: "Has stdout",
  }),
  columnHelper.accessor("stderr", {
    cell: (info) => {
      const value = info.getValue();
      return String(!!value);
    },
    header: "Has stderr",
  }),
];

export default function RunsTable({
  runs,
}: SerializeFrom<{
  runs: PublicJobRun[];
}>) {
  return (
    <ExpandableTable
      id="RunsTable"
      rows={runs}
      title="Runs"
      columns={columns}
      ToolbarWrapper={ToolbarWrapper}
      renderRow={(row) => {
        const run = row.original;
        return <RunPage run={run} schedule={run.jobSchedule} />;
      }}
      msButtons={<MsButtons />}
    />
  );
}

const [useMsActions, MsActionsProvider] = createContext(
  (props: { onDelete: () => void }) => props.onDelete,
  "MsActions"
);

function ToolbarWrapper({ children }: { children: React.ReactNode }) {
  const { table, setRowSelection, setPage } = useTable();
  const fetcher = useFetcher<{ deletedIds: number[] }>();

  const deleteRun = () => {
    const formData = new FormData();
    const selectedIds: string[] = [];
    const selectedIndexes: number[] = [];

    table.getSelectedRowModel().rows.forEach(({ original: { id }, index }) => {
      selectedIds.push(id);
      selectedIndexes.push(index);
    });

    selectedIds.forEach((selected) => {
      formData.append("run", String(selected));
    });
    formData.set("action", "delete");
    setPage(0);
    setRowSelection(
      produce((ob) => {
        selectedIndexes.forEach((index) => {
          delete ob[index];
        });
      })
    );
    fetcher.submit(formData, { method: "post", action: "/runs?index" });
  };

  return <MsActionsProvider onDelete={deleteRun}>{children}</MsActionsProvider>;
}

function MsButtons() {
  const deleteRun = useMsActions();
  return (
    <>
      <Button
        variant="text"
        color="inherit"
        data-testid="ms-delete"
        onClick={() => {
          deleteRun();
        }}
      >
        Delete
      </Button>
    </>
  );
}
