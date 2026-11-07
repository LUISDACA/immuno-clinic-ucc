import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { AxiosError, type AxiosResponse } from "axios";
import LoginPage from "@/app/(auth)/login/page";
import { useAuthStore } from "@/lib/auth/store";
import { login as authLogin } from "@/lib/auth/api";

vi.mock("@/lib/auth/api", () => ({ login: vi.fn(), logout: vi.fn() }));
const storeLogin = useAuthStore.getState().login;

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({
    isAuthenticated: false,
    isHydrated: true,
    isLoading: false,
    errorMessage: null,
    login: storeLogin,
    role: null,
    userId: null,
    email: null,
    mustChangePassword: false,
  });
});
afterEach(cleanup);

it("associates each login validation error with its input", () => {
  render(<LoginPage />);
  fireEvent.submit(document.querySelector("form")!);

  for (const [label, message] of [
    ["Correo electrónico", "Ingresa tu correo"],
    ["Contraseña", "Ingresa tu contraseña"],
  ]) {
    const input = screen.getByLabelText(label);
    expect(input).toHaveAttribute("aria-invalid", "true");
    const descriptionIds = input.getAttribute("aria-describedby")?.split(" ") ?? [];
    expect(descriptionIds.length).toBeGreaterThan(0);
    expect(
      descriptionIds.some((id) => document.getElementById(id)?.textContent === message),
    ).toBe(true);
  }
});

it("announces an authentication error and preserves entered credentials", () => {
  render(<LoginPage />);
  const email = screen.getByLabelText("Correo electrónico");
  const password = screen.getByLabelText("Contraseña");
  fireEvent.change(email, { target: { value: "student@example.invalid" } });
  fireEvent.change(password, { target: { value: "synthetic-password" } });

  act(() => {
  useAuthStore.setState({ errorMessage: "Correo o contraseña incorrectos" });
  });

  expect(screen.getByRole("alert")).toHaveTextContent("Correo o contraseña incorrectos");
  expect(email).toHaveValue("student@example.invalid");
  expect(password).toHaveValue("synthetic-password");
});

it("submits the login form when Enter is pressed in the password field", async () => {
  const user = userEvent.setup();
  const login = vi.fn().mockResolvedValue(undefined);
  useAuthStore.setState({ login });
  render(<LoginPage />);

  await user.type(screen.getByLabelText("Correo electrónico"), "student@example.invalid");
  await user.type(screen.getByLabelText("Contraseña"), "synthetic-password");
  await user.keyboard("{Enter}");

  expect(login).toHaveBeenCalledTimes(1);
  expect(login).toHaveBeenCalledWith("student@example.invalid", "synthetic-password");
});

it("shows the shared Spanish copy for FastAPI 401 and keeps the form draft", async () => {
  const user = userEvent.setup();
  const response = {
    status: 401,
    statusText: "Unauthorized",
    headers: {},
    config: { headers: {} },
    data: { detail: "Invalid email or password" },
  } as AxiosResponse;
  vi.mocked(authLogin).mockRejectedValueOnce(
    new AxiosError("Request failed", "ERR_BAD_REQUEST", undefined, undefined, response),
  );
  render(<LoginPage />);

  await user.type(screen.getByLabelText("Correo electrónico"), "student@example.invalid");
  await user.type(screen.getByLabelText("Contraseña"), "synthetic-password");
  await user.keyboard("{Enter}");

  const alert = await screen.findByRole("alert");
  expect(alert).toHaveTextContent("Correo o contraseña incorrectos");
  expect(alert).not.toHaveTextContent("Invalid email or password");
  expect(screen.getByLabelText("Correo electrónico")).toHaveValue("student@example.invalid");
  expect(screen.getByLabelText("Contraseña")).toHaveValue("synthetic-password");
});
