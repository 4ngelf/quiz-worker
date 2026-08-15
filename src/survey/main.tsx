// TODO: Missing features
// - [ ] Success page
// - [ ] Monitoring page
// - [ ] etc

//# Imports

import { onMount } from "solid-js";
import { render } from "solid-js/web";
import { Route, Router, useNavigate } from "@solidjs/router";
import "./index.css";
import App from "./App.tsx";

//# Routes

const AppRoutes = () => (
  <Router>
    <Route path="/" component={InProgress("Main")} />
    <Route path="/survey/:survey_id" matchFilters={{ survey_id: /^\d+$/ }} component={App} />
    <Route path="/survey/success" component={InProgress("Success")} />
    <Route path="/private/admin" component={InProgress("Admin and telemetry")} />
    <Route path="*404" component={GotoMain} />
  </Router>
);

const GotoMain = () => {
  const navigate = useNavigate();
  onMount(() => {
    navigate("/", { replace: true });
  });
  return null;
};

const InProgress = (name: string) => (() => <h1>{name} page in progress....</h1>);

//# Render

const root_element = document.getElementById("root");
if (!root_element) throw new Error("Cannot find root element");

render(() => <AppRoutes />, document.getElementById("root")!);
