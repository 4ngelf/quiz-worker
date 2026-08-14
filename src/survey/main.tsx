// TODO: Missing features
// - [ ] Success page
// - [ ] Monitoring page
// - [ ] etc

//# Imports

import { render } from "solid-js/web";
import { Route, Router } from "@solidjs/router";
import "./index.css";
import App from "./App.tsx";

//# Routes

const AppRoutes = () => (
  <Router>
    <Route path="/" component={InProgress("Main")} />
    <Route path="/survey/:survey_id" component={App} />
    <Route path="/survey/success" component={InProgress("Success")} />
    <Route path="/private/admin" component={InProgress("Admin and telemetry")} />
  </Router>
);

const InProgress = (name: string) => (() => <h1>{name} page in progress....</h1>);

//# Render

const root_element = document.getElementById("root");
if (!root_element) throw new Error("Cannot find root element");

render(() => <AppRoutes />, document.getElementById("root")!);
