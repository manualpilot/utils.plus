import { useState } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import { ShareStateProvider, useInitialHashState, useRegisterShareState, useShareStateContext } from "../src/common/share-state";
import { render, screen, userEvent, waitFor } from "./test-utils";

describe("useInitialHashState", () => {
  beforeEach(() => {
    hashDuringRender = null;
    history.replaceState(null, "", "/codec");
  });

  it("restores shared state on mount", () => {
    setHash({ input: "shared" });
    render(<Probe />);

    expect(screen.getByTestId("value")).toHaveTextContent("shared");
  });

  it("leaves the hash intact during render", () => {
    setHash({ input: "shared" });
    render(<Probe />);

    expect(hashDuringRender).not.toBe("");
  });

  it("keeps the hash in the URL after commit", async () => {
    setHash({ input: "shared" });
    render(<Probe />);

    await waitFor(() => expect(readHash()).toEqual({ input: "shared" }));
    expect(window.location.pathname).toBe("/codec");
  });

  it("falls back to defaults for an unreadable hash", () => {
    history.replaceState(null, "", "/codec#not-valid-state");
    render(<Probe />);

    expect(screen.getByTestId("value")).toHaveTextContent("default");
  });
});

describe("useRegisterShareState", () => {
  beforeEach(() => {
    history.replaceState(null, "", "/codec");
  });

  it("leaves the URL clean until the state moves", async () => {
    render(<Editable />);

    await waitFor(() => expect(screen.getByTestId("value")).toHaveTextContent("default"));
    expect(window.location.hash).toBe("");
  });

  it("writes the current state to the hash as it changes", async () => {
    render(<Editable />);

    await userEvent.click(screen.getByRole("button", { name: "append" }));
    await waitFor(() => expect(readHash()).toEqual({ input: "default!" }));

    await userEvent.click(screen.getByRole("button", { name: "append" }));
    await waitFor(() => expect(readHash()).toEqual({ input: "default!!" }));
  });

  it("keeps tracking a state that arrived through a share link", async () => {
    setHash({ input: "shared" });
    render(<Editable />);

    await userEvent.click(screen.getByRole("button", { name: "append" }));
    await waitFor(() => expect(readHash()).toEqual({ input: "shared!" }));
  });

  it("leaves a field the view has no use for out of the link", async () => {
    render(<Scoped />);

    await userEvent.click(screen.getByRole("button", { name: "append" }));
    await waitFor(() => expect(readHash()).toEqual({ input: "default!" }));
  });

  it("stops tracking a state too big for a usable link", async () => {
    render(<Editable seed={"x".repeat(80 * 1024)} />);

    await userEvent.click(screen.getByRole("button", { name: "append" }));
    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(window.location.hash).toBe("");
  });

  it("survives a state JSON cannot represent", async () => {
    render(<Unencodable />);

    await userEvent.click(screen.getByRole("button", { name: "append" }));
    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(screen.getByTestId("value")).toHaveTextContent("default!");
    expect(window.location.hash).toBe("");
  });
});

describe("clearHash", () => {
  beforeEach(() => {
    history.replaceState(null, "", "/codec");
  });

  it("takes the fragment off and leaves it off", async () => {
    render(<Clearable />);

    await userEvent.click(screen.getByRole("button", { name: "append" }));
    await waitFor(() => expect(readHash()).toEqual({ input: "default!" }));

    await userEvent.click(screen.getByRole("button", { name: "clear" }));
    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(window.location.hash).toBe("");
  });

  it("tracks the state again once it moves", async () => {
    render(<Clearable />);

    await userEvent.click(screen.getByRole("button", { name: "append" }));
    await userEvent.click(screen.getByRole("button", { name: "clear" }));

    await userEvent.click(screen.getByRole("button", { name: "append" }));
    await waitFor(() => expect(readHash()).toEqual({ input: "default!!" }));
  });
});

let hashDuringRender: string | null = null;

function Probe() {
  const state = useInitialHashState<{ input?: string }>();
  hashDuringRender = window.location.hash;
  return <div data-testid="value">{state?.input ?? "default"}</div>;
}

function Editable({ seed }: { seed?: string }) {
  return (
    <ShareStateProvider>
      <EditableProbe seed={seed} />
    </ShareStateProvider>
  );
}

function EditableProbe({ seed }: { seed?: string }) {
  const initialState = useInitialHashState<{ input?: string }>();
  const [input, setInput] = useState(initialState?.input ?? seed ?? "default");

  useRegisterShareState(() => ({ input }));

  return (
    <>
      <div data-testid="value">{input.length > 100 ? `${input.length} chars` : input}</div>
      <button onClick={() => setInput((current) => `${current}!`)}>append</button>
    </>
  );
}

function Scoped() {
  return (
    <ShareStateProvider>
      <ScopedProbe />
    </ShareStateProvider>
  );
}

function ScopedProbe() {
  const [input, setInput] = useState("default");

  useRegisterShareState(() => ({ input, outOfScope: undefined }));

  return (
    <>
      <div data-testid="value">{input}</div>
      <button onClick={() => setInput((current) => `${current}!`)}>append</button>
    </>
  );
}

function Unencodable() {
  return (
    <ShareStateProvider>
      <UnencodableProbe />
    </ShareStateProvider>
  );
}

function UnencodableProbe() {
  const [input, setInput] = useState("default");

  useRegisterShareState(() => ({ input, nope: 1n }));

  return (
    <>
      <div data-testid="value">{input}</div>
      <button onClick={() => setInput((current) => `${current}!`)}>append</button>
    </>
  );
}

function Clearable() {
  return (
    <ShareStateProvider>
      <ClearableProbe />
    </ShareStateProvider>
  );
}

function ClearableProbe() {
  const [input, setInput] = useState("default");
  const [, bump] = useState(0);
  const ctx = useShareStateContext();

  useRegisterShareState(() => ({ input }));

  const clear = () => {
    ctx?.clearHash();
    bump((count) => count + 1);
  };

  return (
    <>
      <div data-testid="value">{input}</div>
      <button onClick={() => setInput((current) => `${current}!`)}>append</button>
      <button onClick={clear}>clear</button>
    </>
  );
}

function encode(state: Record<string, unknown>) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(state))))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function setHash(state: Record<string, unknown>) {
  history.replaceState(null, "", `/codec#${encode(state)}`);
}

function readHash() {
  let b64 = window.location.hash.slice(1).replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4) b64 += "=";
  return JSON.parse(decodeURIComponent(escape(atob(b64))));
}
