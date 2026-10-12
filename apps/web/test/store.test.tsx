import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { AppProvider, useApp } from "../src/state/store.js";
import type { BridgeMessage, BridgePayload } from "@codepet/protocol";

afterEach(cleanup);

import { useEffect } from "react";

function Probe({ msgs }: { msgs: BridgePayload[] }): null {
  const { apply } = useApp();
  useEffect(() => {
    for (const m of msgs) apply(m as BridgeMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

function ChatCount(): JSX.Element {
  const { chat } = useApp();
  return (
    <>
      <span data-testid="n">{chat.length}</span>
      <ul>
        {chat.map((c) => (
          <li key={c.id} data-testid="bubble">
            {c.text}
          </li>
        ))}
      </ul>
    </>
  );
}

describe("store chat (FR-020)", () => {
  it("delta dirakit, final, speak tak tampil", () => {
    render(
      <AppProvider>
        <Probe
          msgs={[
            { type: "agent.text.delta", messageID: "m1", text: "halo " },
            { type: "agent.text.delta", messageID: "m1", text: "<speak>hai</speak>dunia" },
            { type: "agent.text.final", messageID: "m1", text: "" },
          ]}
        />
        <ChatCount />
      </AppProvider>,
    );
    expect(screen.getByTestId("n").textContent).toBe("1");
    expect(screen.getByText("halo dunia")).toBeTruthy();
    expect(screen.queryByText("hai")).toBeNull();
  });

  it("feed item masuk", () => {
    render(
      <AppProvider>
        <Probe msgs={[{ type: "feed.item", item: { id: "c1", kind: "tool", title: "membaca file", status: "running", ts: 1 } }]} />
        <ChatCount />
      </AppProvider>,
    );
    expect(screen.getByTestId("n").textContent).toBe("0");
  });
});
