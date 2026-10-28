import { createBrowserRouter, Navigate } from "react-router";

import { AccountPage } from "../features/account/AccountPage";
import { AdminsPage } from "../features/admins/AdminsPage";
import { LoginPage } from "../features/auth/LoginPage";
import { CategoriesPage } from "../features/categories/CategoriesPage";
import { DictionariesPage } from "../features/dictionaries/DictionariesPage";
import { EasyDropPage } from "../features/suppliers/EasyDropPage";
import { ProductFormPage } from "../features/products/ProductFormPage";
import { ProductsPage } from "../features/products/ProductsPage";
import { AdminLayout, OwnerOnly } from "./AdminLayout";

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  {
    element: <AdminLayout />,
    children: [
      { index: true, element: <Navigate to="/products" replace /> },
      { path: "products", element: <ProductsPage /> },
      { path: "products/new", element: <ProductFormPage mode="create" /> },
      { path: "products/:id", element: <ProductFormPage mode="edit" /> },
      { path: "categories", element: <CategoriesPage /> },
      { path: "dictionaries", element: <DictionariesPage /> },
      { path: "suppliers/easydrop", element: <EasyDropPage /> },
      {
        path: "admins",
        element: (
          <OwnerOnly>
            <AdminsPage />
          </OwnerOnly>
        ),
      },
      { path: "account", element: <AccountPage /> },
      { path: "*", element: <Navigate to="/products" replace /> },
    ],
  },
]);
