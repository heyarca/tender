// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { Toaster, dismissToast, toast, useToast } from "@/components/ui/toast";
import { CommandPalette, matchesHotkey, parseHotkey, useHotkey } from "../command-palette";
import { PageContainer } from "../page-container";
import { SidebarNav, useScrollSpy } from "../sidebar-nav";
import { TenderLogo } from "../tender-logo";
import { TenderMark } from "../tender-mark";
import { TopNav } from "../top-nav";

beforeAll(() => {
  // jsdom lacks these browser APIs, which cmdk and Base UI call.
  Element.prototype.scrollIntoView ??= function scrollIntoView() {};
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
});

afterEach(() => {
  act(() => dismissToast());
  cleanup();
  vi.restoreAllMocks();
});

function keydown(init: KeyboardEventInit, target: EventTarget = window) {
  const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init });
  act(() => {
    target.dispatchEvent(event);
  });
  return event;
}

describe("Kbd", () => {
  it("renders one chip per key", () => {
    render(<KbdGroup keys={["⌘", "K"]} />);
    expect(screen.getByText("⌘").tagName).toBe("KBD");
    expect(screen.getByText("K").className).toContain("bg-muted");
  });

  it("accepts custom children", () => {
    render(<Kbd>Esc</Kbd>);
    expect(screen.getByText("Esc").className).toContain("font-mono");
  });
});

describe("TenderMark and TenderLogo", () => {
  it("labels the standalone mark", () => {
    render(<TenderMark />);
    expect(screen.getByRole("img", { name: "Tender" })).toBeTruthy();
  });

  it("hides the mark from assistive tech next to the wordmark", () => {
    const { container } = render(<TenderLogo />);
    expect(screen.getByText("tender")).toBeTruthy();
    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    expect(screen.queryByRole("img")).toBeNull();
  });
});

describe("PageContainer", () => {
  it("renders a main column with the OpenRouter page padding", () => {
    render(<PageContainer>Body</PageContainer>);
    const main = screen.getByRole("main");
    expect(main.className).toContain("md:max-w-7xl");
    expect(main.className).toContain("lg:px-6");
  });
});

describe("TopNav", () => {
  const links = [
    { label: "Markets", href: "/markets/sf-weather" },
    { label: "Providers", href: "/markets/sf-weather#providers" },
  ];

  it("marks the active link and opens search", () => {
    const onSearch = vi.fn();
    render(
      <TopNav
        links={links}
        activeHref="/markets/sf-weather"
        onSearch={onSearch}
        actions={<button type="button">Run request</button>}
      />,
    );
    const nav = screen.getByRole("navigation", { name: "Main" });
    const active = nav.querySelector('a[aria-current="page"]');
    expect(active?.textContent).toBe("Markets");
    expect(active?.className).toContain("text-accent-foreground");
    expect(screen.getByRole("link", { name: "Tender home" })).toBeTruthy();

    fireEvent.click(screen.getAllByRole("button", { name: "Search" })[0]);
    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole("button", { name: "Run request" }).length).toBeGreaterThan(0);
  });
});

describe("SidebarNav", () => {
  it("renders groups, anchors, buttons, and the active item", () => {
    const onClick = vi.fn();
    render(
      <SidebarNav
        groups={[
          { label: "Markets", items: [{ label: "Bitcoin Price", onClick }] },
          {
            label: "On this page",
            items: [
              { label: "Providers", href: "#providers", active: true },
              { label: "Activity", href: "#activity", trailing: "12" },
            ],
          },
        ]}
      />,
    );
    expect(screen.getByRole("group", { name: "On this page" })).toBeTruthy();
    const active = screen.getByRole("link", { name: "Providers" });
    expect(active.getAttribute("aria-current")).toBe("location");
    expect(active.className).toContain("bg-accent");
    expect(screen.getByRole("link", { name: /Activity/ }).textContent).toContain("12");

    fireEvent.click(screen.getByRole("button", { name: "Bitcoin Price" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe("useScrollSpy", () => {
  function Spy({ ids }: { ids: string[] }) {
    const active = useScrollSpy(ids, { offset: 100 });
    return <output>{active}</output>;
  }

  it("starts at the first id and follows the last section past the offset", async () => {
    const tops: Record<string, number> = { a: 40, b: 90, c: 400 };
    const sections = Object.keys(tops).map((id) => {
      const element = document.createElement("section");
      element.id = id;
      element.getBoundingClientRect = () => ({ top: tops[id] }) as DOMRect;
      document.body.appendChild(element);
      return element;
    });
    // Run frames synchronously. Returning 0 keeps the hook's "no frame pending" state.
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 0;
    });

    render(<Spy ids={["a", "b", "c"]} />);
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("b"));

    tops.c = 80;
    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });
    expect(screen.getByRole("status").textContent).toBe("c");
    for (const section of sections) section.remove();
  });
});

describe("hotkeys", () => {
  it("parses combos and matches ⌘ or Ctrl for mod", () => {
    expect(parseHotkey("mod+K")).toMatchObject({ key: "k", mod: true, shift: false });
    expect(matchesHotkey(new KeyboardEvent("keydown", { key: "k", metaKey: true }), "mod+k")).toBe(true);
    expect(matchesHotkey(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }), "mod+k")).toBe(true);
    expect(matchesHotkey(new KeyboardEvent("keydown", { key: "k" }), "mod+k")).toBe(false);
    expect(matchesHotkey(new KeyboardEvent("keydown", { key: "k", metaKey: true, shiftKey: true }), "mod+k")).toBe(
      false,
    );
    // Physical key match for non-Latin layouts.
    expect(matchesHotkey(new KeyboardEvent("keydown", { key: "ㅏ", code: "KeyK", metaKey: true }), "mod+k")).toBe(true);
    expect(matchesHotkey(new KeyboardEvent("keydown", { key: "Escape" }), "esc")).toBe(true);
  });

  function HotkeyProbe({ onHit }: { onHit: () => void }) {
    useHotkey(["mod+k", "/"], onHit);
    return <input aria-label="Query" />;
  }

  it("fires on window and skips plain keys inside text fields", () => {
    const onHit = vi.fn();
    render(<HotkeyProbe onHit={onHit} />);

    const event = keydown({ key: "k", metaKey: true });
    expect(onHit).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);

    keydown({ key: "/" });
    expect(onHit).toHaveBeenCalledTimes(2);

    const input = screen.getByRole("textbox", { name: "Query" });
    keydown({ key: "/" }, input);
    expect(onHit).toHaveBeenCalledTimes(2);
    keydown({ key: "k", ctrlKey: true }, input);
    expect(onHit).toHaveBeenCalledTimes(3);
  });
});

describe("Dialog", () => {
  it("renders title, description, and footer, and closes from the × button", async () => {
    const onOpenChange = vi.fn();
    render(
      <Dialog open onOpenChange={onOpenChange}>
        <DialogContent title="Reset policy" description="Restore the default limits." footer={<span>Footer</span>}>
          Body
        </DialogContent>
      </Dialog>,
    );
    const dialog = await screen.findByRole("dialog");
    expect(dialog.getAttribute("aria-labelledby")).toBeTruthy();
    expect(screen.getByText("Reset policy").tagName).toBe("H2");
    expect(screen.getByText("Restore the default limits.")).toBeTruthy();
    expect(screen.getByText("Footer")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onOpenChange).toHaveBeenCalled();
    expect(onOpenChange.mock.calls[0][0]).toBe(false);
  });
});

describe("CommandPalette", () => {
  function Palette({ onRun }: { onRun: () => void }) {
    const [open, setOpen] = useState(false);
    return (
      <>
        <span data-testid="palette-state">{open ? "open" : "closed"}</span>
        <CommandPalette
          open={open}
          onOpenChange={setOpen}
          groups={[
            {
              heading: "Markets",
              items: [
                { id: "sf", label: "San Francisco Weather", description: "weather/san-francisco", onSelect: () => {} },
                { id: "market-qqq", label: "Bitcoin Price", keywords: ["crypto"], onSelect: () => {} },
              ],
            },
            { heading: "Actions", items: [{ id: "run", label: "Run request", onSelect: onRun }] },
          ]}
        />
      </>
    );
  }

  it("toggles with ⌘K, filters by label and keywords, and runs the selected item", async () => {
    const onRun = vi.fn();
    render(<Palette onRun={onRun} />);
    const state = screen.getByTestId("palette-state");
    expect(state.textContent).toBe("closed");

    keydown({ key: "k", metaKey: true });
    const input = await screen.findByRole("combobox");
    expect(state.textContent).toBe("open");
    expect(document.activeElement).toBe(input);
    expect(screen.getByText("San Francisco Weather")).toBeTruthy();

    fireEvent.change(input, { target: { value: "crypto" } });
    await waitFor(() => expect(screen.queryByText("San Francisco Weather")).toBeNull());
    expect(screen.getByText("Bitcoin Price")).toBeTruthy();

    // Item ids are not searchable.
    fireEvent.change(input, { target: { value: "qqq" } });
    await waitFor(() => expect(screen.getByText(/No results for/)).toBeTruthy());

    fireEvent.change(input, { target: { value: "run" } });
    await waitFor(() => expect(screen.getByText("Run request")).toBeTruthy());
    fireEvent.click(screen.getByText("Run request"));
    expect(onRun).toHaveBeenCalledTimes(1);
    expect(state.textContent).toBe("closed");
  });
});

describe("toast", () => {
  it("shows a toned toast with an action and supports both call styles", async () => {
    const onUndo = vi.fn();
    function Trigger() {
      const api = useToast();
      return (
        <>
          <button type="button" onClick={() => api({ title: "Policy saved", tone: "positive" })}>
            Direct
          </button>
          <button
            type="button"
            onClick={() =>
              api.toast({
                title: "Switched to DeepInfra",
                description: "Together P95 640 ms exceeds 400 ms.",
                tone: "warning",
                action: { label: "Undo", onClick: onUndo },
              })
            }
          >
            Destructured
          </button>
        </>
      );
    }
    render(
      <>
        <Toaster />
        <Trigger />
      </>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Direct" }));
    expect((await screen.findAllByText("Policy saved")).length).toBeGreaterThan(0);
    expect(await screen.findByRole("img", { name: "Success" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Destructured" }));
    expect((await screen.findAllByText("Switched to DeepInfra")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Together P95 640 ms exceeds 400 ms.").length).toBeGreaterThan(0);
    // Base UI announces high-priority toasts in a separate alert region and hides the visual card from AT.
    expect(await screen.findByRole("img", { name: "Warning", hidden: true })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Undo", hidden: true }));
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it("returns the id and updates a toast in place", async () => {
    render(<Toaster />);
    let id = "";
    act(() => {
      id = toast({ id: "route", title: "Routing to Together", tone: "info" });
    });
    expect(id).toBe("route");
    expect((await screen.findAllByText("Routing to Together")).length).toBeGreaterThan(0);
  });
});
