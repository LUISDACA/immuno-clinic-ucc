import { describe, expect, it } from "vitest";

import {
  doseStatusLabel,
  formatBytes,
  formatDate,
  statusVariant,
  vaccineStatusLabel,
} from "@/lib/format";

describe("formatDate", () => {
  it("returns an em dash for null/undefined/empty", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate(undefined)).toBe("—");
    expect(formatDate("")).toBe("—");
  });

  it("formats a valid date in Colombian locale (dd/mm/yyyy)", () => {
    // Use an explicit local datetime to avoid timezone surprises with
    // bare YYYY-MM-DD inputs (which JS parses as UTC midnight).
    expect(formatDate("2026-04-28T15:00:00")).toBe("28/04/2026");
  });

  it("returns the original string when the input is not a valid date", () => {
    expect(formatDate("not-a-date")).toBe("not-a-date");
  });
});

describe("formatBytes", () => {
  it("renders bytes below 1 KB as B", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
  });

  it("renders KB with one decimal", () => {
    expect(formatBytes(2048)).toBe("2.0 KB");
  });

  it("renders MB with one decimal", () => {
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
  });
});

describe("status labels and variants", () => {
  it("labels vaccine statuses in Spanish", () => {
    expect(vaccineStatusLabel("approved")).toBe("Aprobada");
    expect(vaccineStatusLabel("pending")).toBe("Pendiente");
    expect(vaccineStatusLabel("denied")).toBe("Rechazada");
    expect(vaccineStatusLabel("in_review")).toBe("En revisión");
  });

  it("labels dose statuses in Spanish", () => {
    expect(doseStatusLabel("approved")).toBe("Aprobada");
    expect(doseStatusLabel("denied")).toBe("Rechazada");
  });

  it("maps statuses to badge variants", () => {
    expect(statusVariant("approved")).toBe("success");
    expect(statusVariant("pending")).toBe("warning");
    expect(statusVariant("denied")).toBe("destructive");
    expect(statusVariant("in_review")).toBe("info");
  });
});
