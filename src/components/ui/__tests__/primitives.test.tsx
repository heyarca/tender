// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Badge, StatusDot } from "../badge";
import { Button, ButtonLink } from "../button";
import { CopyButton } from "../copy-button";
import { EmptyState } from "../empty-state";
import { ProviderLogo } from "../provider-logo";
import { Section } from "../section";
import { SegmentedControl } from "../segmented-control";
import { StatCard } from "../stat-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableSubheadRow } from "../table";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("Button", () => {
  it("defaults to type=button and applies variant and size classes", () => {
    render(
      <Button variant="primary" size="sm">
        Run request
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Run request" });
    expect(button.getAttribute("type")).toBe("button");
    expect(button.className).toContain("bg-primary");
    expect(button.className).toContain("h-7");
  });

  it("lets className override recipe classes", () => {
    render(<Button className="px-4">API</Button>);
    const button = screen.getByRole("button", { name: "API" });
    expect(button.className).toContain("px-4");
    expect(button.className).not.toContain("px-3");
  });

  it("renders ButtonLink as an anchor", () => {
    render(
      <ButtonLink href="/markets/btc-usd" variant="ghost">
        Bitcoin Price
      </ButtonLink>,
    );
    const link = screen.getByRole("link", { name: "Bitcoin Price" });
    expect(link.getAttribute("href")).toBe("/markets/btc-usd");
    expect(link.className).toContain("text-muted-foreground");
  });
});

describe("Badge and StatusDot", () => {
  it("maps tones to token classes", () => {
    render(
      <>
        <Badge tone="warning">Too slow</Badge>
        <Badge variant="text" tone="positive">
          Best price
        </Badge>
      </>,
    );
    expect(screen.getByText("Too slow").className).toContain("bg-warning-bg");
    expect(screen.getByText("Best price").className).toContain("text-positive-text");
    expect(screen.getByText("Best price").className).not.toContain("bg-");
  });

  it("is decorative unless labelled", () => {
    const { container } = render(<StatusDot tone="positive" />);
    expect(container.firstElementChild?.getAttribute("aria-hidden")).toBe("true");
    render(<StatusDot tone="negative" label="Unavailable" />);
    expect(screen.getByRole("img", { name: "Unavailable" })).toBeTruthy();
  });
});

function Percentiles({ onChange }: { onChange?: (value: string) => void }) {
  const [value, setValue] = useState("p50");
  return (
    <SegmentedControl
      aria-label="Latency percentile"
      value={value}
      onValueChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
      items={[
        { value: "p50", label: "P50" },
        { value: "p75", label: "P75" },
        { value: "p95", label: "P95", disabled: true },
      ]}
    />
  );
}

describe("SegmentedControl", () => {
  it("exposes a radiogroup with the checked item", () => {
    render(<Percentiles />);
    const group = screen.getByRole("radiogroup", { name: "Latency percentile" });
    expect(group).toBeTruthy();
    expect(screen.getByRole("radio", { name: "P50" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("radio", { name: "P75" }).getAttribute("aria-checked")).toBe("false");
  });

  it("selects on click and reports the typed value", () => {
    const onChange = vi.fn();
    render(<Percentiles onChange={onChange} />);
    fireEvent.click(screen.getByRole("radio", { name: "P75" }));
    expect(onChange).toHaveBeenCalledWith("p75");
    expect(screen.getByRole("radio", { name: "P75" }).getAttribute("aria-checked")).toBe("true");
  });

  it("marks the indicator ready after measuring", () => {
    const { container } = render(<Percentiles />);
    const indicator = container.querySelector("[data-segmented-indicator]");
    expect(indicator?.hasAttribute("data-ready")).toBe(true);
  });
});

describe("Table", () => {
  it("renders sortable headers with aria-sort and units", () => {
    const onSort = vi.fn();
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Provider</TableHead>
            <TableHead align="right" unit="/M" sort="asc" onSort={onSort}>
              Bid
            </TableHead>
            <TableHead align="right" sort={false} onSort={() => {}}>
              Latency
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow selected>
            <TableCell>Together</TableCell>
            <TableCell numeric>$18.00</TableCell>
            <TableCell numeric>210 ms</TableCell>
          </TableRow>
          <TableSubheadRow colSpan={3}>Not eligible under this policy:</TableSubheadRow>
        </TableBody>
      </Table>,
    );
    const headers = screen.getAllByRole("columnheader");
    expect(headers[0].hasAttribute("aria-sort")).toBe(false);
    expect(headers[1].getAttribute("aria-sort")).toBe("ascending");
    expect(headers[2].getAttribute("aria-sort")).toBe("none");
    expect(headers[1].textContent).toContain("/M");

    fireEvent.click(screen.getByRole("button", { name: /Bid/ }));
    expect(onSort).toHaveBeenCalledTimes(1);

    const row = screen.getByText("Together").closest("tr");
    expect(row?.getAttribute("data-state")).toBe("selected");
    expect(screen.getByText("$18.00").className).toContain("text-right");
    expect(screen.getByText("Not eligible under this policy:").closest("td")?.getAttribute("colspan")).toBe("3");
  });
});

describe("CopyButton", () => {
  it("copies and swaps to a check for 1.5 s", async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    const onCopied = vi.fn();

    render(<CopyButton value="weather/san-francisco" label="Copy identifier" onCopied={onCopied} />);
    const button = screen.getByRole("button", { name: "Copy identifier" });
    await act(async () => {
      fireEvent.click(button);
    });
    expect(writeText).toHaveBeenCalledWith("weather/san-francisco");
    expect(onCopied).toHaveBeenCalledWith("weather/san-francisco");
    expect(button.getAttribute("data-copied")).toBe("true");
    expect(button.getAttribute("aria-label")).toBe("Copied");

    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(button.getAttribute("data-copied")).toBe("false");
    expect(button.getAttribute("aria-label")).toBe("Copy identifier");
  });
});

describe("Display primitives", () => {
  it("ProviderLogo falls back to the first letter", () => {
    const { container, rerender } = render(<ProviderLogo name="Nebius" />);
    expect(container.textContent).toBe("N");
    rerender(<ProviderLogo name="Together" src="/providers/together.png" decorative={false} />);
    expect(screen.getByRole("img", { name: "Together" })).toBeTruthy();
    expect(container.querySelector("img")?.getAttribute("src")).toBe("/providers/together.png");
  });

  it("StatCard renders label, value, unit, and sub-line", () => {
    render(<StatCard label="P95 latency" value="210" unit="ms" sub="Last 30 samples" tone="positive" />);
    expect(screen.getByText("P95 latency")).toBeTruthy();
    expect(screen.getByText("ms").className).toContain("text-muted-foreground");
    expect(screen.getByText("Last 30 samples")).toBeTruthy();
  });

  it("Section labels itself with its heading", () => {
    render(
      <Section id="providers" title="Providers" description="Providers bid to serve this market.">
        body
      </Section>,
    );
    const region = screen.getByRole("region", { name: "Providers" });
    expect(region.id).toBe("providers");
    expect(region.querySelector('[data-slot="section-body"]')?.textContent).toBe("body");
  });

  it("EmptyState shows title and description", () => {
    render(<EmptyState title="No requests yet" description="Run a request to see the result." />);
    expect(screen.getByText("No requests yet")).toBeTruthy();
    expect(screen.getByText("Run a request to see the result.")).toBeTruthy();
  });
});
