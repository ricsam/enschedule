import Button from "@mui/material/Button";
import { useFetcher } from "@remix-run/react";
import { produce } from "immer";
import React from "react";
import { createContext } from "~/utils/createContext";
import { useTable } from "./EnhancedTableToolbar";

export const createMsButtons = ({
  Buttons,
  /**
   * Form action, like `/runs?index`
   */
  formAction,
}: {
  Buttons?: React.ComponentType<{
    submit: (
      /**
       * action like `run | delete`
       */
      action: string
    ) => void;
    children?: React.ReactNode;
  }>;
  formAction: string;
}) => {
  const [useMsActions, MsActionsProvider] = createContext(
    (props: {
      onSubmit: (
        /**
         * action like `run | delete`
         */
        action: string
      ) => void;
    }) => props.onSubmit,
    "MsActions"
  );

  function ToolbarWrapper({ children }: { children: React.ReactNode }) {
    const { table, setRowSelection, setPage } = useTable();
    const fetcher = useFetcher<{ deletedIds: number[] }>();

    const onSubmit = (action: string) => {
      const formData = new FormData();
      const selectedIds: string[] = [];
      const selectedIndexes: number[] = [];

      table
        .getSelectedRowModel()
        .rows.forEach(({ original: { id }, index }) => {
          selectedIds.push(id);
          selectedIndexes.push(index);
        });

      selectedIds.forEach((selected) => {
        formData.append("id", String(selected));
      });
      formData.set("action", action);
      setPage(0);
      setRowSelection(
        produce((ob) => {
          selectedIndexes.forEach((index) => {
            delete ob[index];
          });
        })
      );
      fetcher.submit(formData, { method: "post", action: formAction });
    };

    return (
      <MsActionsProvider onSubmit={onSubmit}>{children}</MsActionsProvider>
    );
  }

  function MsButtons() {
    const onSubmit = useMsActions();
    return (
      <>
        {Buttons ? <Buttons submit={onSubmit} /> : null}
        <Button
          variant="text"
          color="inherit"
          data-testid="ms-delete"
          onClick={() => {
            onSubmit("delete");
          }}
        >
          Delete
        </Button>
      </>
    );
  }
  return {
    ToolbarWrapper,
    MsButtons,
  };
};
