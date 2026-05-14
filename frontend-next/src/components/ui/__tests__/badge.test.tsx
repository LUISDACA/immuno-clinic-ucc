import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { Badge } from "@/components/ui/badge";

describe("Badge", () => {
  it("renders its children", () => {
    render(<Badge>Aprobada</Badge>);
    expect(screen.getByText("Aprobada")).toBeInTheDocument();
  });

  it("applies the success variant classes", () => {
    render(<Badge variant="success">Activa</Badge>);
    const el = screen.getByText("Activa");
    expect(el.className).toMatch(/emerald/);
  });

  it("applies the destructive variant classes", () => {
    render(<Badge variant="destructive">Rechazada</Badge>);
    const el = screen.getByText("Rechazada");
    expect(el.className).toMatch(/red-/);
  });

  it("uses the default variant when none is provided", () => {
    render(<Badge>Default</Badge>);
    const el = screen.getByText("Default");
    expect(el.className).toMatch(/bg-primary/);
  });
});
