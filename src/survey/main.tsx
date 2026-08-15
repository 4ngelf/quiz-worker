// TODO: Missing features
// - [ ] Success page
// - [ ] Monitoring page
// - [ ] etc

//# Imports

import { lazy, onMount } from "solid-js";
import { render } from "solid-js/web";
import { Route, Router, useNavigate } from "@solidjs/router";
import "./main.css";

//# Routes

const AppRoutes = () => {
  return (
    <Router>
      <Route path="/" component={lazy(() => import("./pages/Home.tsx"))} />
      <Route
        path="/survey/:survey_id"
        matchFilters={{ survey_id: /^\d+$/ }}
        component={lazy(() => import("./pages/Survey.tsx"))}
      />
      <Route path="/survey/success" component={lazy(() => import("./pages/Success.tsx"))} />
      <Route path="/private/admin" component={InProgress("Admin and telemetry")} />
      <Route path="*404" component={GotoMain} />
    </Router>
  );
};

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
