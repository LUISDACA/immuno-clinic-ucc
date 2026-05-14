import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

describe("Card", () => {
  it("renders all parts together", () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Título</CardTitle>
          <CardDescription>Una descripción</CardDescription>
        </CardHeader>
        <CardContent>Contenido</CardContent>
      </Card>,
    );

    expect(screen.getByText("Título")).toBeInTheDocument();
    expect(screen.getByText("Una descripción")).toBeInTheDocument();
    expect(screen.getByText("Contenido")).toBeInTheDocument();
  });

  it("forwards className to the Card root", () => {
    const { container } = render(
      <Card className="my-custom-class">
        <CardContent>X</CardContent>
      </Card>,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toMatch(/my-custom-class/);
  });
});
