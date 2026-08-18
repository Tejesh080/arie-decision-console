import { describe, expect, it } from "vitest";
import {
  ArieApiError,
  ArieConflictError,
  ArieNotFoundError,
  ArieUnavailableError,
  ArieValidationError,
  errorForResponse,
} from "./errors";

describe("errorForResponse", () => {
  it("maps 404 to ArieNotFoundError", () => {
    expect(errorForResponse(404, "no lead x")).toBeInstanceOf(ArieNotFoundError);
  });

  it("maps 409 to ArieConflictError", () => {
    expect(errorForResponse(409, "conflict")).toBeInstanceOf(ArieConflictError);
  });

  it("maps 422 to ArieValidationError", () => {
    expect(errorForResponse(422, "bad email")).toBeInstanceOf(ArieValidationError);
  });

  it("maps 502/503/0 to ArieUnavailableError", () => {
    expect(errorForResponse(502, "x")).toBeInstanceOf(ArieUnavailableError);
    expect(errorForResponse(503, "x")).toBeInstanceOf(ArieUnavailableError);
    expect(errorForResponse(0, "x")).toBeInstanceOf(ArieUnavailableError);
  });

  it("falls back to the base ArieApiError for anything else, preserving status", () => {
    const err = errorForResponse(500, "boom");
    expect(err).toBeInstanceOf(ArieApiError);
    expect(err.status).toBe(500);
  });

  it("preserves the detail payload for callers that need it", () => {
    const detail = { field: "email" };
    const err = errorForResponse(422, "bad", detail);
    expect(err.detail).toBe(detail);
  });
});
