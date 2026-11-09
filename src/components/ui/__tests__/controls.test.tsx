// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Checkbox } from "../checkbox";
import { Field, FieldDescription, FieldError, FieldLabel } from "../field";
import { Input } from "../input";
import { NumberField } from "../number-field";
import { Select } from "../select";
import { Switch } from "../switch";
import { Tooltip } from "../tooltip";

afterEach(() => cleanup());

function MaxLatency({ onChange }: { onChange: (value: number | null) => void }) {
  const [value, setValue] = useState<number | null>(400);
  return (
    <NumberField
      aria-label="Max P95 latency"
      value={value}
      onValueChange={(next) => {
        setValue(next);
        onChange(next);
      }}
      step={10}
      min={0}
      max={1000}
      suffix="ms"
    />
  );
}

describe("NumberField", () => {
  it("steps with the arrow keys and the stepper buttons", () => {
    const onChange = vi.fn();
    render(<MaxLatency onChange={onChange} />);
    const input = screen.getByRole("textbox", { name: "Max P95 latency" });
    expect((input as HTMLInputElement).value).toBe("400");
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(onChange).toHaveBeenLastCalledWith(410);
    expect(screen.getByText("ms")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Increase" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Decrease" })).toBeTruthy();
  });

  it("marks the input invalid", () => {
    render(<NumberField aria-label="Max price" value={1} onValueChange={() => {}} invalid prefix="$" />);
    expect(screen.getByRole("textbox", { name: "Max price" }).getAttribute("aria-invalid")).toBe("true");
  });
});

describe("Field", () => {
  it("labels and describes its control", () => {
    render(
      <Field invalid>
        <FieldLabel>Request label</FieldLabel>
        <Input placeholder="checkout-weather" />
        <FieldDescription>Shown in activity.</FieldDescription>
        <FieldError>Use letters and dashes.</FieldError>
      </Field>,
    );
    const input = screen.getByRole("textbox", { name: "Request label" });
    expect(input.getAttribute("aria-describedby")).toBeTruthy();
    expect(screen.getByText("Use letters and dashes.")).toBeTruthy();
  });
});

describe("Switch and Checkbox", () => {
  it("report checked changes", () => {
    const onSwitch = vi.fn();
    const onCheck = vi.fn();
    render(
      <>
        <Switch aria-label="Auto-run" checked={false} onCheckedChange={onSwitch} />
        <Checkbox aria-label="Pin provider" checked={false} onCheckedChange={onCheck} />
      </>,
    );
    fireEvent.click(screen.getByRole("switch", { name: "Auto-run" }));
    expect(onSwitch).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByRole("checkbox", { name: "Pin provider" }));
    expect(onCheck).toHaveBeenCalledWith(true);
  });
});

describe("Select", () => {
  it("shows the selected option's label in the trigger", () => {
    render(
      <Select
        aria-label="Routing preference"
        value="lowest-cost"
        onValueChange={() => {}}
        items={[
          { value: "lowest-cost", label: "Lowest cost" },
          { value: "lowest-latency", label: "Lowest latency" },
        ]}
      />,
    );
    const trigger = screen.getByRole("combobox", { name: "Routing preference" });
    expect(trigger.textContent).toContain("Lowest cost");
  });

  it("shows the placeholder without a value", () => {
    render(
      <Select
        aria-label="Provider"
        value={null}
        placeholder="Choose a provider"
        onValueChange={() => {}}
        items={[{ value: "together", label: "Together", image: "/providers/together.png" }]}
      />,
    );
    expect(screen.getByRole("combobox", { name: "Provider" }).textContent).toContain("Choose a provider");
  });
});

describe("Tooltip", () => {
  it("renders the trigger untouched when there is no content", () => {
    render(
      <Tooltip content={null}>
        <span>Latency</span>
      </Tooltip>,
    );
    expect(screen.getByText("Latency").hasAttribute("data-popup-open")).toBe(false);
  });
});
