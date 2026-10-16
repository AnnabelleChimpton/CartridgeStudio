// CodeMirror lives in its own chunk, loaded the first time code is shown.
// Until then the code is shown as plain text.

import { Suspense, lazy } from "react";
import type { BasicEditorProps } from "./BasicEditor.tsx";
import "./code.css";

const BasicEditor = lazy(() => import("./BasicEditor.tsx"));

export function LazyBasicEditor(props: BasicEditorProps) {
  return (
    <Suspense
      fallback={
        <pre className="basic-editor loading" aria-busy="true" data-testid={props.testId}>
          {props.value}
        </pre>
      }
    >
      <BasicEditor {...props} />
    </Suspense>
  );
}
