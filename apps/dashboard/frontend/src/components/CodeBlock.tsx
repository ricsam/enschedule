import { ReadOnlyEditor } from "./Editor";

export function CodeBlock({ value, language = "typescript", maxHeight = 480 }: { value: string; language?: string; maxHeight?: number }) {
  return <ReadOnlyEditor value={value} language={language} maxHeight={maxHeight} withLineNumbers={language === "text"} />;
}
