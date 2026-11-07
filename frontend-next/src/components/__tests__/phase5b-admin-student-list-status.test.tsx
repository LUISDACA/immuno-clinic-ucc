import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import Students from "@/app/admin/students/page";
import { getAcademicOptions, listStudents } from "@/lib/api/admin";
import { useAuthStore } from "@/lib/auth/store";
import type { AdminStudentListItem } from "@/lib/api/types";

const navigation = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  params: "",
}));
vi.mock("next/navigation", () => ({
  useRouter: () => navigation,
  useSearchParams: () => new URLSearchParams(navigation.params),
}));
vi.mock("@/lib/api/admin", () => ({
  getAcademicOptions: vi.fn(),
  listStudents: vi.fn(),
  downloadStudentsExport: vi.fn(),
}));

const item = (id: string, status: string): AdminStudentListItem => ({
  id,
  email: `${id}@example.invalid`,
  role: "student",
  is_active: true,
  must_change_password: false,
  created_at: "2026-01-01T00:00:00Z",
  profile: {
    id: `profile-${id}`,
    first_name: id,
    last_name: "Synthetic",
    sex: "female",
    program: "Programa sintético",
    campus: "Sede sintética",
    semester: 1,
  },
  vaccination_status: status as AdminStudentListItem["vaccination_status"],
});

beforeEach(() => {
  vi.clearAllMocks();
  navigation.params = "";
  useAuthStore.setState({ userId: "synthetic-admin", role: "admin" });
  vi.mocked(getAcademicOptions).mockResolvedValue({ programs: [], campuses: [], semesters: Array.from({ length: 10 }, (_, i) => i + 1) });
  vi.mocked(listStudents).mockResolvedValue({
    page: 1,
    page_size: 20,
      total: 4,
    total_pages: 1,
    has_next: false,
    has_previous: false,
    items: [
      item("approved", "approved"),
      item("pending", "pending"),
      item("denied", "denied"),
      item("in-review", "in_review"),
    ],
  });
});
afterEach(cleanup);

it("represents FastAPI in_review as pending without losing the denied status", async () => {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <Students />
    </QueryClientProvider>,
  );

  expect(await screen.findByText("1 aprobados")).toBeVisible();
  expect(screen.getByText("2 pendientes")).toBeVisible();
  expect(screen.getByText("1 denegados")).toBeVisible();
  expect(screen.getAllByText("Denegado")).toHaveLength(2);
  expect(screen.getAllByText("Pendiente")).toHaveLength(5);
});

it("keeps long student names and email addresses readable in the mobile card", async () => {
  const longName = "Nombre sintetico de prueba para verificar el reflujo en pantallas moviles estrechas";
  const longEmail = "student-with-a-deliberately-long-synthetic-address-for-mobile-layout@example.invalid";
  vi.mocked(listStudents).mockResolvedValue({
    page: 1,
    page_size: 20,
    total: 1,
    total_pages: 1,
    has_next: false,
    has_previous: false,
    items: [
      {
        ...item("mobile-student", "approved"),
        email: longEmail,
        profile: {
          ...item("mobile-student", "approved").profile!,
          first_name: longName,
          last_name: "Apellido sintetico extendido",
        },
      },
    ],
  });

  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <Students />
    </QueryClientProvider>,
  );

  const name = await screen.findByText(
    `${longName} Apellido sintetico extendido`,
    { selector: "p" },
  );
  const email = screen.getByText(longEmail, { selector: "p" });
  expect(name).toBeVisible();
  expect(email).toBeVisible();
  expect(name).not.toHaveClass("truncate");
  expect(email).not.toHaveClass("truncate");
});
