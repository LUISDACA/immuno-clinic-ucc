import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Button } from "@/components/ui/button";

describe("Button", () => {
  it("renders its children", () => {
    render(<Button>Aceptar</Button>);
    expect(screen.getByRole("button", { name: "Aceptar" })).toBeInTheDocument();
  });

  it("fires onClick when clicked", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Guardar</Button>);

    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not fire onClick when disabled", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} disabled>
        Bloqueado
      </Button>,
    );

    await user.click(screen.getByRole("button", { name: "Bloqueado" }));

    expect(onClick).not.toHaveBeenCalled();
  });

  it("applies the destructive variant classes", () => {
    render(<Button variant="destructive">Rechazar</Button>);
    const btn = screen.getByRole("button", { name: "Rechazar" });
    expect(btn.className).toMatch(/destructive/);
  });
});
