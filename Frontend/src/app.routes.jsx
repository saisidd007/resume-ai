import { createBrowserRouter } from "react-router-dom";
import Login from "./features/auth/pages/Login";
import Register from "./features/auth/pages/Register";
import Protected from "./features/auth/components/Protected";

import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import Interview from './pages/Interview';
import ReportDetails from './pages/ReportDetails';

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Landing />,
  },
  {
    path: "/login",
    element: <Login />,
  },
  {
    path: "/register",
    element: <Register />,
  },
  {
    path: "/dashboard",
    element: <Protected><Dashboard /></Protected>,
  },
  {
    path: "/interview",
    element: <Protected><Interview /></Protected>,
  },
  {
    path: "/report/:id",
    element: <Protected><ReportDetails /></Protected>,
  },
]);
