import { children, Show } from "solid-js";

import type { ParentProps } from "solid-js";

import "./Callout.css";

type Kind =
  | "info"
  | "warning";

const kindToClass = (kind: Kind = "info") => {
  if (kind) return `callout-${kind}`;
  else return "callout-info";
};

export default (props: ParentProps & { title?: string; kind?: Kind }) => {
  const getChildren = children(() => props.children);
  return (
    <div class="callout">
      <Show when={props.title}>
        <span class={`callout-title ${kindToClass(props.kind)}`}>
          {props.title}
        </span>
      </Show>
      {getChildren()}
    </div>
  );
};
