import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.220.1/assert/mod.ts";
import { validateImageForPumpFun } from "../validate-image.ts";

Deno.test({
  name: "validateImageForPumpFun - should reject image with invalid dimensions",
  fn() {
    const smallPngBase64 =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

    const [result, error] = validateImageForPumpFun(
      smallPngBase64,
      "test-validate-image",
    );

    assertEquals(result, null);
    assertExists(error);
    assertEquals(error.type, "INVALID_DIMENSIONS");
    assertEquals(
      error.message.includes("1000x1000"),
      true,
      "Error message should mention minimum dimensions",
    );
  },
});

Deno.test({
  name: "validateImageForPumpFun - should reject invalid file type",
  fn() {
    const svgBase64 =
      "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCI+PC9zdmc+";

    const [result, error] = validateImageForPumpFun(
      svgBase64,
      "test-validate-image",
    );

    assertEquals(result, null);
    assertExists(error);
    assertEquals(error.type, "INVALID_TYPE");
    assertEquals(
      error.message.includes("Supported formats"),
      true,
      "Error message should mention supported formats",
    );
  },
});

Deno.test({
  name: "validateImageForPumpFun - should handle invalid base64",
  fn() {
    const invalidBase64 = "not-valid-base64!!!";

    const [result, error] = validateImageForPumpFun(
      invalidBase64,
      "test-validate-image",
    );

    assertEquals(result, null);
    assertExists(error);
    assertEquals(error.type, "INVALID_FORMAT");
  },
});

Deno.test({
  name: "validateImageForPumpFun - should validate data URL format",
  fn() {
    const dataUrlPng =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

    const [result, error] = validateImageForPumpFun(
      dataUrlPng,
      "test-validate-image",
    );

    assertEquals(result, null);
    assertExists(error);
    assertEquals(error.type, "INVALID_DIMENSIONS");
  },
});
