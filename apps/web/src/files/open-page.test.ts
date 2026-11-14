import { describe, expect, it } from "vitest";
import { openParamsOf } from "./open-page";

describe("openParamsOf", () => {
  it("reads the link and the name as written", () => {
    const link = "https://archive.example.org/api/freigabe/abc?x=1&y=2";
    expect(openParamsOf(`?url=${encodeURIComponent(link)}&name=${encodeURIComponent("2024.pdf")}`)).toEqual({
      url: link,
      name: "2024.pdf",
    });
    // A name the router would read as JSON stays text.
    expect(openParamsOf("?url=x&name=2024")).toEqual({ url: "x", name: "2024" });
  });

  it("has nothing for a missing or empty parameter", () => {
    expect(openParamsOf("")).toEqual({ url: undefined, name: undefined });
    expect(openParamsOf("?url=&name=")).toEqual({ url: undefined, name: undefined });
  });
});
