import MonacoEditor, { type Monaco, type OnMount, useMonaco } from "@monaco-editor/react";
import { Box, Typography, useColorScheme } from "@mui/material";
import Ajv2020 from "ajv/dist/2020";
import React from "react";

const ajv = new Ajv2020({ allErrors: true, strict: false });
let modelCounter = 0;

function editorTheme(mode: string | undefined, systemMode: string | undefined) {
  const resolvedMode = mode === "system" ? systemMode : mode;
  return resolvedMode === "dark" ? "vs-dark" : "light";
}

function editorHeight(value: string, minHeight: number, maxHeight: number) {
  return Math.min(maxHeight, Math.max(minHeight, value.split("\n").length * 19 + 18));
}

function configureJsonSchema(monaco: Monaco, schema: Record<string, unknown> | undefined, modelUri: string) {
  monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
    validate: true,
    enableSchemaRequest: false,
    allowComments: false,
    schemas: schema
      ? [{ uri: `enschedule://schemas/${encodeURIComponent(modelUri)}`, fileMatch: [modelUri], schema }]
      : [],
  });
}

export function JsonEditor({
  value,
  onChange,
  jsonSchema,
  onValidationChange,
  height = 320,
  globalEditorRefName,
  ariaLabel = "JSON editor",
}: {
  value: string;
  onChange: (value: string) => void;
  jsonSchema?: Record<string, unknown>;
  onValidationChange?: (valid: boolean, message?: string) => void;
  height?: number;
  globalEditorRefName?: string;
  ariaLabel?: string;
}) {
  const { mode, systemMode } = useColorScheme();
  const monaco = useMonaco();
  const modelUri = React.useMemo(() => `file:///enschedule/job-data-${++modelCounter}.json`, []);
  const validator = React.useMemo(() => jsonSchema ? ajv.compile(jsonSchema) : undefined, [jsonSchema]);
  React.useEffect(() => {
    if (monaco) configureJsonSchema(monaco, jsonSchema, modelUri);
  }, [jsonSchema, modelUri, monaco]);
  const validate = React.useCallback((next: string) => {
    try {
      const parsed = JSON.parse(next);
      const valid = validator ? !!validator(parsed) : true;
      const message = valid ? undefined : ajv.errorsText(validator?.errors, { separator: "\n" });
      onValidationChange?.(valid, message);
      return valid;
    } catch (error) {
      onValidationChange?.(false, error instanceof Error ? error.message : "Invalid JSON");
      return false;
    }
  }, [onValidationChange, validator]);
  React.useEffect(() => { validate(value); }, [validate, value]);
  const mount: OnMount = (editor, monacoInstance) => {
    configureJsonSchema(monacoInstance, jsonSchema, modelUri);
    if (globalEditorRefName) (window as unknown as Record<string, unknown>)[globalEditorRefName] = editor;
    editor.focus();
  };
  return <Box border="1px solid" borderColor="divider" borderRadius={1} overflow="hidden" aria-label={ariaLabel}>
    <MonacoEditor
      path={modelUri}
      language="json"
      theme={editorTheme(mode, systemMode)}
      height={height}
      value={value}
      onMount={mount}
      onChange={(next) => { const text = next ?? ""; onChange(text); validate(text); }}
      loading={<EditorLoading />}
      options={{
        automaticLayout: true,
        formatOnPaste: true,
        formatOnType: true,
        quickSuggestions: { other: true, comments: false, strings: true },
        suggestOnTriggerCharacters: true,
        wordBasedSuggestions: "off",
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        tabSize: 2,
        insertSpaces: true,
        glyphMargin: false,
        folding: true,
        lineNumbersMinChars: 3,
        ariaLabel,
      }}
    />
  </Box>;
}

export const ReadOnlyEditor = React.memo(function ReadOnlyEditor({
  value,
  language = "typescript",
  withLineNumbers = false,
  minHeight = 60,
  maxHeight = 480,
}: {
  value: string;
  language?: string;
  withLineNumbers?: boolean;
  minHeight?: number;
  maxHeight?: number;
}) {
  const { mode, systemMode } = useColorScheme();
  const modelUri = React.useMemo(() => `file:///enschedule/read-only-${++modelCounter}.${language === "json" ? "json" : language === "typescript" ? "ts" : "txt"}`, [language]);
  return <Box className="read-only-editor" border="1px solid" borderColor="divider" borderRadius={1} overflow="hidden">
    <MonacoEditor
      path={modelUri}
      language={language}
      theme={editorTheme(mode, systemMode)}
      height={editorHeight(value, minHeight, maxHeight)}
      value={value}
      loading={<EditorLoading />}
      options={{
        automaticLayout: true,
        readOnly: true,
        domReadOnly: true,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        scrollbar: { alwaysConsumeMouseWheel: false, vertical: value.split("\n").length * 19 > maxHeight ? "auto" : "hidden" },
        lineNumbers: withLineNumbers ? "on" : "off",
        lineNumbersMinChars: withLineNumbers ? 3 : 0,
        glyphMargin: false,
        folding: false,
        lineDecorationsWidth: withLineNumbers ? 8 : 0,
        renderLineHighlight: "none",
        overviewRulerBorder: false,
        overviewRulerLanes: 0,
        wordWrap: "on",
        padding: { top: 8, bottom: 8 },
      }}
    />
  </Box>;
});

function EditorLoading() {
  return <Box height="100%" display="grid" sx={{ placeItems: "center", bgcolor: "background.default" }} data-testid="monaco-loading"><Typography color="text.secondary">Loading editor…</Typography></Box>;
}
