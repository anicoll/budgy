import { describe, expect, it } from "vitest";
import { isYou, objectName, possessive, verb } from "./names";

describe("names", () => {
  it("treats You as the reader", () => {
    expect(isYou("You")).toBe(true);
    expect(isYou(" you ")).toBe(true);
    expect(isYou("Youssef")).toBe(false);
  });
  it("picks the possessive", () => {
    expect(possessive("You")).toBe("your");
    expect(possessive("You", true)).toBe("Your");
    expect(possessive("Sam")).toBe("Sam's");
  });
  it("picks the object and verb", () => {
    expect(objectName("You")).toBe("you");
    expect(objectName("Sam")).toBe("Sam");
    expect(verb("You", "retires", "retire")).toBe("retire");
    expect(verb("Sam", "retires", "retire")).toBe("retires");
  });
});
