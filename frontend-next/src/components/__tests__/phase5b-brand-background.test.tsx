import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { UccBrandBackground } from "../brand";

afterEach(cleanup);

it("keeps content outside the hidden decoration and reachable by keyboard", async () => {
  const user = userEvent.setup();
  const onClick = vi.fn();
  render(
    <UccBrandBackground>
      <button type="button" onClick={onClick}>Continuar</button>
    </UccBrandBackground>,
  );
  const button = screen.getByRole("button", { name: "Continuar" });
  expect(button.closest('[aria-hidden="true"]')).toBeNull();
  await user.tab();
  expect(button).toHaveFocus();
  await user.keyboard("{Enter}");
  expect(onClick).toHaveBeenCalledTimes(1);
});

it("keeps feedback and overlay content outside the clipped decoration", () => {
  render(
    <UccBrandBackground>
      <p role="alert">No fue posible completar la solicitud.</p>
      <div role="dialog" aria-label="Confirmación">Contenido interactivo</div>
    </UccBrandBackground>,
  );
  for (const content of [screen.getByRole("alert"), screen.getByRole("dialog", { name: "Confirmación" })]) {
    expect(content.closest('[aria-hidden="true"]')).toBeNull();
    expect(content.closest(".overflow-hidden")).toBeNull();
    expect(content).toBeVisible();
  }
});
