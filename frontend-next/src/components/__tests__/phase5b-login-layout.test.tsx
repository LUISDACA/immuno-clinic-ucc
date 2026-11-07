import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import AuthLayout from "@/app/(auth)/layout";
import LoginPage from "@/app/(auth)/login/page";
import { useAuthStore } from "@/lib/auth/store";

vi.mock("@/components/brand", () => ({
  UccBrandBackground: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  UccLogo: ({ size }: { size?: number }) => (
    <span aria-label="Universidad Cooperativa de Colombia" data-size={size} />
  ),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

beforeEach(() => {
  useAuthStore.setState({
    isAuthenticated: false,
    isHydrated: true,
    isLoading: false,
    errorMessage: null,
    role: null,
    mustChangePassword: false,
  });
});

afterEach(cleanup);

it("composes the Flutter-aligned login card without changing shared auth content", () => {
  render(
    <AuthLayout>
      <LoginPage />
    </AuthLayout>,
  );

  const card = screen.getByText("Bienvenido").closest(".auth-login-card");
  expect(card).toHaveClass("rounded-3xl");
  expect(screen.getByRole("heading", { level: 1, name: "Bienvenido" })).toBeInTheDocument();
  expect(card?.querySelector('[data-size="118"]')).toBeInTheDocument();
  expect(screen.getByLabelText("Correo electrónico")).toHaveClass("h-[52px]");
  expect(screen.getByLabelText("Correo electrónico")).toHaveAttribute("placeholder", " ");
  expect(screen.getByLabelText("Contraseña")).toHaveClass("h-[52px]");
  expect(screen.getByLabelText("Contraseña")).toHaveAttribute("placeholder", " ");
  expect(document.querySelectorAll(".auth-floating-label")).toHaveLength(2);
  expect(document.querySelectorAll('.auth-floating-field[data-filled="false"]')).toHaveLength(2);
  const email = screen.getByLabelText("Correo electrónico");
  fireEvent.change(email, { target: { value: "synthetic@example.invalid" } });
  expect(email.closest(".auth-floating-field")).toHaveAttribute("data-filled", "true");
  fireEvent.change(email, { target: { value: "" } });
  expect(email.closest(".auth-floating-field")).toHaveAttribute("data-filled", "false");
  expect(screen.getByRole("button", { name: "Ingresar" })).toHaveClass(
    "min-h-[52px]",
  );

  // The CSS hides this shared header only when the login marker is present.
  expect(document.querySelector(".auth-brand-header")).toBeInTheDocument();
  expect(document.querySelector(".auth-layout-content")).toHaveClass("max-w-md");
});
