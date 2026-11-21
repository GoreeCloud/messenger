import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import App from "../src/App";

describe("accessibility of the unauthenticated entry point", () => {
  const markup = () => renderToStaticMarkup(createElement(App));

  it("uses a main landmark with an explicitly labeled login section", () => {
    const html = markup();
    expect(html).toContain("<main");
    expect(html).toContain('aria-label="Connect to homeserver"');
    expect(html).toContain("<h1");
    expect(html).toContain('aria-label="Connect to homeserver"');
  });

  it("associates login labels with identifiers and uses masked credentials", () => {
    const html = markup();
    expect(html).toContain('for="server"');
    expect(html).toContain('id="server"');
    expect(html).toContain('for="username"');
    expect(html).toContain('id="username"');
    expect(html).toContain('for="password"');
    expect(html).toContain('id="password"');
    expect(html).toContain('type="password"');
    expect(html).toContain('type="password"');
  });

  it("marks decorative branding as hidden from assistive technologies", () => {
    const html = markup();
    expect(html).toContain('class="brand-mark" aria-hidden="true"');
    expect(html).toContain("Development preview");
  });
});
