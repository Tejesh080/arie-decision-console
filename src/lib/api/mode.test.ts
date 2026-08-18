import { afterEach, describe, expect, it, vi } from "vitest";
import { getDataMode } from "./mode";

describe("getDataMode", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults to mock when unset", () => {
    vi.stubEnv("NEXT_PUBLIC_ARIE_DATA_MODE", "");
    expect(getDataMode()).toBe("mock");
  });

  it("returns api only for the exact value 'api'", () => {
    vi.stubEnv("NEXT_PUBLIC_ARIE_DATA_MODE", "api");
    expect(getDataMode()).toBe("api");
  });

  it("falls back to mock for any other value, never guesses api", () => {
    vi.stubEnv("NEXT_PUBLIC_ARIE_DATA_MODE", "API");
    expect(getDataMode()).toBe("mock");
    vi.stubEnv("NEXT_PUBLIC_ARIE_DATA_MODE", "production");
    expect(getDataMode()).toBe("mock");
  });
});
