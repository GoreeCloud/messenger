import { describe, expect, it } from "vitest";
import { filterLoadedMessages } from "../src/localSearch";

const messages = [
  { id: "$1", body: "Encrypted hello World", sender: "@alice:test" },
  { id: "$2", body: "Backup and restore", sender: "@bob:test" },
  { id: "$3", body: "private CHAT", sender: "@alice:test" },
];

describe("private loaded-message search", () => {
  it("filters only supplied, already loaded messages without networking", () => {
    expect(filterLoadedMessages(messages, "backup").map(x => x.id)).toEqual(["$2"]);
  });
  it("is case-insensitive for bodies and senders", () => {
    expect(filterLoadedMessages(messages, "ALICE").map(x => x.id)).toEqual(["$1", "$3"]);
    expect(filterLoadedMessages(messages, "world").map(x => x.id)).toEqual(["$1"]);
  });
  it("preserves order and does not mutate source arrays on empty queries", () => {
    expect(filterLoadedMessages(messages, "   ")).toEqual(messages);
    expect(filterLoadedMessages(messages, "   ")).not.toBe(messages);
    expect(messages.map(x => x.id)).toEqual(["$1", "$2", "$3"]);
  });
  it("returns an empty result without broadening to a remote search", () => {
    expect(filterLoadedMessages(messages, "absent")).toEqual([]);
  });
  it("caps untrusted programmatic query length", () => {
    expect(() => filterLoadedMessages(messages, "x".repeat(129))).toThrow();
  });
});
