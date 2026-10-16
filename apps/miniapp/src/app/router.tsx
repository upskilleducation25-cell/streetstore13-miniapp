import { lazy } from "react";
import { createBrowserRouter } from "react-router";

import { AppShell } from "./AppShell";
import { RouteError } from "./RouteError";

// Головна — у стартовому бандлі; решта сторінок завантажується ліниво.
import HomePage from "../pages/HomePage";
const CatalogPage = lazy(() => import("../pages/CatalogPage"));
const SearchPage = lazy(() => import("../pages/SearchPage"));
const ProductPage = lazy(() => import("../pages/ProductPage"));
const CartPage = lazy(() => import("../pages/CartPage"));
const ProfilePage = lazy(() => import("../pages/ProfilePage"));
const NotFoundPage = lazy(() => import("../pages/NotFoundPage"));

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    errorElement: <RouteError />,
    children: [
      { path: "/", element: <HomePage /> },
      { path: "/catalog", element: <CatalogPage /> },
      { path: "/search", element: <SearchPage /> },
      { path: "/p/:id", element: <ProductPage />, handle: { hideNav: true } },
      { path: "/cart", element: <CartPage /> },
      { path: "/profile", element: <ProfilePage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
