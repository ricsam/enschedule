import type { Monaco } from "@monaco-editor/react";
import MonacoEditor from "@monaco-editor/react";
import { Box } from "@mui/material";
import Ajv from "ajv";
import React from "react";
import { Theme, useTheme } from "~/utils/theme-provider";

const ajv = new Ajv();

export function Editor({
  jsonSchema,
  example,
  getValueRef,
  setIsValid,
  height,
}: {
  jsonSchema: Record<string, unknown>;
  example: unknown;
  getValueRef: React.MutableRefObject<undefined | (() => string)>;
  setIsValid: (valid: boolean) => void;
  height?: number;
}) {
  const editorRef = React.useRef<
    ReturnType<Monaco["editor"]["create"]> | undefined
  >(undefined);
  const [validate] = React.useState(() => ajv.compile(jsonSchema));

  const initialValue = JSON.stringify(example, null, 2);

  getValueRef.current = () => {
    return editorRef.current?.getValue() || initialValue;
  };

  function handleEditorWillMount(monaco: Monaco) {
    monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
      validate: true,
      schemas: [
        {
          uri: "",
          fileMatch: ["*"],
          schema: jsonSchema,
        },
      ],
    });
  }
  const [theme] = useTheme();
  const calculatedHeight = height ?? initialValue.split("\n").length * 18;
  return (
    <MonacoEditor
      language="json"
      theme={theme === Theme.LIGHT ? "light" : "vs-dark"}
      height={`${calculatedHeight}px`}
      value={initialValue}
      beforeMount={handleEditorWillMount}
      onMount={(editor, monaco) => {
        editorRef.current = editor;
      }}
      loading={<EditorLoading />}
      onChange={(value) => {
        if (value) {
          try {
            const result = validate(JSON.parse(value));
            if (!result) {
              setIsValid(false);
            } else {
              setIsValid(true);
            }
          } catch (err) {
            setIsValid(false);
          }
        } else {
          setIsValid(false);
        }
      }}
    />
  );
}

function EditorLoading() {
  return <div data-testid="monaco-loading"></div>;
}

export function ReadOnlyEditor({
  example,
  lang,
  wordWrap,
  withLineNumbers,
}: {
  example: string;
  lang: string;
  wordWrap?: Exclude<
    React.ComponentProps<typeof MonacoEditor>["options"],
    undefined
  >["wordWrap"];
  withLineNumbers?: boolean;
}) {
  const [appTheme] = useTheme();
  const editorTheme = appTheme === Theme.LIGHT ? "light" : "vs-dark";
  const height = example.split("\n").length * 18 + 1;
  return (
    <Box
      sx={{
        ".monaco-editor, .monaco-editor-background, .monaco-editor .inputarea.ime-input":
          {
            backgroundColor: "transparent",
          },
      }}
    >
      <MonacoEditor
        language={lang}
        theme={editorTheme}
        height={`${height}px`}
        value={example}
        loading={<EditorLoading />}
        beforeMount={(monaco) => {
          monaco.languages.typescript.typescriptDefaults.addExtraLib(
            `
            type JobDefinition = {
              dataSchema: ZodType;
              id: string;
              title: string;
              description: string;
              job: (data: { url: string }) => Promise<void> | void;
              example: { url: string };
            };
            declare const scheduler: {
              registerJob: (job: JobDefinition) => void;
            }
            declare const z: Zod;
          
          `,
            "global.d.ts"
          );
        }}
        className="read-only-editor"
        options={
          withLineNumbers
            ? {
                selectionHighlight: false,
                hideCursorInOverviewRuler: true,
                readOnly: true,
                minimap: {
                  enabled: false,
                },
                scrollBeyondLastLine: false,
              }
            : {
                selectionHighlight: false,
                hideCursorInOverviewRuler: true,
                overviewRulerBorder: false,
                overviewRulerLanes: 0,
                occurrencesHighlight: false,
                foldingHighlight: false,
                wordWrap: wordWrap,
                lineNumbersMinChars: 1,
                guides: {
                  indentation: false,
                  highlightActiveIndentation: false,
                },
                glyphMargin: false,
                folding: false,
                lineDecorationsWidth: 0,
                renderLineHighlight: "none",
                scrollbar: {
                  alwaysConsumeMouseWheel: false,
                  vertical: "hidden",
                  horizontal: "hidden",
                },
                readOnly: true,
                lineNumbers: "off",
                minimap: {
                  enabled: false,
                },
                scrollBeyondLastLine: false,
              }
        }
      />
    </Box>
  );
}
