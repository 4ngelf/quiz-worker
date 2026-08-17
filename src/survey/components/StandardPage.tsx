import { children } from "solid-js";
import type { ParentProps } from "solid-js";

import Footer from "./Footer.tsx";

import "./StandardPage.css";

export default (props: ParentProps) => {
  const getChildren = children(() => props.children);
  return (
    <div class="standard-page-layout">
      <main>{getChildren()}</main>
      <Footer />
    </div>
  );
};
