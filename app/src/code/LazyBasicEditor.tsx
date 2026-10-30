// CodeMirror is code-split; see BasicEditor.tsx

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
