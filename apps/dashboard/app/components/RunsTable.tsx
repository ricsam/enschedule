import type { PublicJobRun } from "@enschedule/types";
import Button from "@mui/material/Button";
import { produce } from "immer";
import MuiLink from "@mui/material/Link";
import type { SerializeFrom } from "@remix-run/node";
import { Link as RemixLink, useFetcher } from "@remix-run/react";
import type { ColumnDef } from "@tanstack/react-table";
import { createColumnHelper } from "@tanstack/react-table";
import React from "react";
import { ExpandableTable } from "~/components/Table";
import { formatDate } from "~/utils/formatDate";
import { useSelected } from "./EnhancedTableToolbar";
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
      renderRow={(row) => {
        const run = row.original;
        return <RunPage run={run} schedule={run.jobSchedule} />;
      }}
      msButtons={<MsButtons />}
    />
  );
}

function MsButtons() {
  const { table, setRowSelection } = useSelected();
  const fetcher = useFetcher<{ deletedIds: number[] }>();
  const [selectedIndexes, setSelectedIndexes] = React.useState<
    undefined | number[]
  >();

  const deleteRun = () => {
    const formData = new FormData();
    const selectedIds: string[] = [];
    const selectedIndexes: number[] = [];
    setSelectedIndexes(selectedIndexes);

    table.getSelectedRowModel().rows.forEach(({ original: { id }, index }) => {
      selectedIds.push(id);
      selectedIndexes.push(index);
    });

    selectedIds.forEach((selected) => {
      formData.append("run", String(selected));
    });
    formData.set("action", "delete");
    fetcher.submit(formData, { method: "post", action: "/runs?index" });
  };
  React.useEffect(() => {
    if (selectedIndexes && fetcher.state === "idle") {
      setRowSelection(
        produce((ob) => {
          selectedIndexes.forEach((index) => {
            delete ob[index];
          });
        })
      );
      setSelectedIndexes(undefined);
    }
  }, [fetcher.state, selectedIndexes, setRowSelection]);

  return (
    <>
      <Button
        variant="text"
        color="inherit"
        onClick={() => {
          deleteRun();
        }}
      >
        Delete
      </Button>
    </>
  );
}
