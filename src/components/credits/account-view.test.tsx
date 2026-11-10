// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ComponentType } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { ApiKeyView } from "@/lib/ledger/types";
import { AccountView } from "./account-view";

vi.mock("./agent-autopay-card", () => ({ AgentAutopayCard: () => null }));
vi.mock("./transactions-grid", () => ({ Transactions: () => null }));
vi.mock("./add-funds-dialog", () => ({ AddFundsDialog: () => null }));
vi.mock("./credits-store", () => ({
  useCreditsStore: (select: (state: object) => unknown) => select({ status: "ready", balanceMicros: 0, revision: 0, generation: 0 }),
  refreshAccount: vi.fn(),
  setAddFundsOpen: vi.fn(),
  errorMessage: async () => "Could not revoke the key.",
}));
vi.mock("@/components/ui/toast", () => ({ toast: vi.fn() }));
vi.mock("@/components/ui/data-grid", () => ({
  DataGrid: ({ rowData, columnDefs }: { rowData: ApiKeyView[]; columnDefs: { colId: string; cellRenderer: ComponentType<object>; cellRendererParams: object }[] }) => (
    <div>{rowData.map((data) => {
      const column = columnDefs.find((item) => item.colId === "revoke")!;
      const Cell = column.cellRenderer;
      return <Cell key={data.id} {...column.cellRendererParams} {...{ data }} />;
    })}</div>
  ),
}));

const key: ApiKeyView = { id: "key/one", label: "Editor", prefix: "abc123", created_at: "2026-11-10T00:00:00Z", last_used_at: null };

beforeAll(() => {
  window.matchMedia ??= ((media: string) => ({ matches: false, media, addEventListener() {}, removeEventListener() {} })) as typeof window.matchMedia;
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function setup(deleteResponse: Promise<Response> = Promise.resolve(new Response(null, { status: 204 }))) {
  const fetcher = vi.fn((_url: string, init?: RequestInit) => init?.method === "DELETE"
    ? deleteResponse
    : Promise.resolve(Response.json({ keys: [key] })));
  vi.stubGlobal("fetch", fetcher);
  render(<AccountView />);
  return fetcher;
}

async function openConfirmation() {
  const trigger = await screen.findByRole("button", { name: "Revoke" });
  trigger.focus();
  fireEvent.click(trigger);
  return screen.findByRole("dialog", { name: "Revoke API key?" });
}

function deletes(fetcher: ReturnType<typeof setup>) {
  return fetcher.mock.calls.filter(([, init]) => init?.method === "DELETE");
}

describe("API key revocation", () => {
  it("names the key and consequences, focuses Cancel, and does nothing on cancel or Escape", async () => {
    const fetcher = setup();
    const dialog = await openConfirmation();
    expect(dialog.getAttribute("aria-describedby")).toBeTruthy();
    expect(within(dialog).getByText(/Editor \(tk_abc123…\).*cannot be undone/)).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: "Cancel" })));
    expect(deletes(fetcher)).toHaveLength(0);
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await openConfirmation();
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(deletes(fetcher)).toHaveLength(0);
  });

  it("sends exactly one deletion after confirmation and blocks repeated confirmation while pending", async () => {
    let finish!: (response: Response) => void;
    const fetcher = setup(new Promise((resolve) => { finish = resolve; }));
    const dialog = await openConfirmation();
    const confirm = within(dialog).getByRole("button", { name: "Revoke key" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(deletes(fetcher)).toEqual([["/api/keys/key%2Fone", { method: "DELETE" }]]);
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(screen.getByRole("dialog")).toBeTruthy();
    await act(async () => finish(new Response(null, { status: 204 })));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(deletes(fetcher)).toHaveLength(1);
  });

  it("keeps the confirmation and error visible after a failed revoke", async () => {
    const fetcher = setup(Promise.resolve(new Response(null, { status: 500 })));
    const dialog = await openConfirmation();
    fireEvent.click(within(dialog).getByRole("button", { name: "Revoke key" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Could not revoke the key.");
    expect((screen.getByRole("button", { name: "Revoke key" }) as HTMLButtonElement).disabled).toBe(false);
    expect(deletes(fetcher)).toHaveLength(1);
  });
});
