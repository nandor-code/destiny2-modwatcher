import "./App.css";
import { Main } from "./components/Main";
import { Switch, Route } from "react-router-dom";

export const App = () => {
  return (
    <div className="App">
      <Switch>
        <Route exact path="/" render={(props) => <Main {...props} />} />
      </Switch>
    </div>
  );
};
