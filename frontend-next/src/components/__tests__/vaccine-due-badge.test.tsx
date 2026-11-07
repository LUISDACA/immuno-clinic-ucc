import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { VaccineDueBadge } from "@/components/vaccine-due-badge";

describe("VaccineDueBadge", () => {
  it("represents the backend overdue signal", () => {
    render(
      <VaccineDueBadge
        dueDate="2026-09-27"
        days={-1}
        isOverdue
        isDueToday={false}
      />,
    );

    expect(screen.getByText(/1 dias vencida/)).toBeInTheDocument();
  });

  it("represents the backend due-today signal", () => {
    render(
      <VaccineDueBadge
        dueDate="2026-09-28"
        days={0}
        isOverdue={false}
        isDueToday
      />,
    );

    expect(screen.getByText(/vence hoy/)).toBeInTheDocument();
  });

  it("does not infer overdue status from a negative day count when the signal is absent", () => {
    render(<VaccineDueBadge dueDate="2026-09-27" days={-1} />);

    expect(screen.queryByText(/vencida/)).not.toBeInTheDocument();
  });
});
