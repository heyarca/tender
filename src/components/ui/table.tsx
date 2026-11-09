"use client";

import * as React from "react";
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";

import { cn } from "@/lib/utils";

import { Tooltip } from "./tooltip";

/*
 * Table primitives replicating OpenRouter's `or-table`:
 * framed white surface, 10px × 12px cells (16px at the row edges), 13px muted headers,
 * right-aligned numeric columns with a 10px faint unit, hover and selected row washes,
 * and a horizontal scroll container that fades the clipped edge.
 */

export type TableDensity = "regular" | "compact";
export type TableAlign = "left" | "center" | "right";
export type SortDirection = "asc" | "desc";

type TablePart = "head" | "body" | "foot";

const DensityContext = React.createContext<TableDensity>("regular");
const PartContext = React.createContext<TablePart>("body");

const cellPadding: Record<TableDensity, string> = {
  regular: "px-3 py-2.5 first:pl-4 last:pr-4",
  compact: "px-2.5 py-1.5 first:pl-3 last:pr-3",
};

const alignClass: Record<TableAlign, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

export interface TableProps extends React.ComponentProps<"table"> {
  /** Wrap in the bordered `rounded-lg` white frame. Defaults to true. */
  framed?: boolean;
  density?: TableDensity;
  /** Class for the outer frame. */
  containerClassName?: string;
  /** Class for the horizontal scroll container. */
  scrollClassName?: string;
}

export function Table({
  framed = true,
  density = "regular",
  className,
  containerClassName,
  scrollClassName,
  ...props
}: TableProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => {
      const max = el.scrollWidth - el.clientWidth;
      if (el.scrollLeft > 1) el.dataset.overflowStart = "";
      else delete el.dataset.overflowStart;
      if (max - el.scrollLeft > 1) el.dataset.overflowEnd = "";
      else delete el.dataset.overflowEnd;
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(el);
    if (el.firstElementChild) observer?.observe(el.firstElementChild);
    return () => {
      el.removeEventListener("scroll", update);
      observer?.disconnect();
    };
  }, []);

  const table = (
    <div
      ref={scrollRef}
      data-slot="table-scroll"
      className={cn(
        "relative w-full overflow-x-auto [scrollbar-width:thin]",
        "data-overflow-end:mask-r-from-[calc(100%-3rem)] data-overflow-start:mask-l-from-[calc(100%-3rem)]",
        scrollClassName,
      )}
    >
      <DensityContext.Provider value={density}>
        <table
          data-slot="table"
          data-density={density}
          className={cn("w-full caption-bottom border-collapse text-body", className)}
          {...props}
        />
      </DensityContext.Provider>
    </div>
  );

  if (!framed) return table;
  return (
    <div
      data-slot="table-frame"
      className={cn(
        "w-full min-w-0 overflow-hidden rounded-lg border border-border bg-card text-card-foreground",
        containerClassName,
      )}
    >
      {table}
    </div>
  );
}

export function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <PartContext.Provider value="head">
      <thead data-slot="table-header" className={className} {...props} />
    </PartContext.Provider>
  );
}

export function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <PartContext.Provider value="body">
      <tbody
        data-slot="table-body"
        className={cn("[&>tr:last-child>*]:border-b-0", className)}
        {...props}
      />
    </PartContext.Provider>
  );
}

export function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <PartContext.Provider value="foot">
      <tfoot
        data-slot="table-footer"
        className={cn("bg-muted font-medium [&>tr:last-child>*]:border-b-0", className)}
        {...props}
      />
    </PartContext.Provider>
  );
}

export interface TableRowProps extends React.ComponentProps<"tr"> {
  /** Selected wash (`bg-selected`), exposed as `data-state="selected"`. */
  selected?: boolean;
  /** Muted background (`bg-muted`), like OpenRouter's `or-table__row--muted`. */
  muted?: boolean;
  /** Pointer cursor for clickable rows. */
  interactive?: boolean;
  /** Disable the hover wash. */
  static?: boolean;
}

export function TableRow({
  selected = false,
  muted = false,
  interactive = false,
  static: isStatic = false,
  className,
  ...props
}: TableRowProps) {
  const part = React.useContext(PartContext);
  return (
    <tr
      data-slot="table-row"
      data-state={selected ? "selected" : undefined}
      className={cn(
        "transition-colors duration-quick",
        part === "body" && !isStatic && "hover:bg-card-hover",
        muted && "bg-muted hover:bg-muted",
        selected && "bg-selected hover:bg-selected",
        interactive && "cursor-pointer",
        className,
      )}
      {...props}
    />
  );
}

export interface TableHeadProps extends Omit<React.ComponentProps<"th">, "align"> {
  align?: TableAlign;
  /** Unit suffix after the label, 10px faint (for example "/M" or "ms"). */
  unit?: React.ReactNode;
  /** Explanation shown on hover; the label gets a dotted underline. */
  tooltip?: React.ReactNode;
  /** Current sort direction of this column; `false` when sortable but not sorted. */
  sort?: SortDirection | false;
  /** Makes the header a sort button. */
  onSort?: () => void;
}

export function TableHead({
  align = "left",
  unit,
  tooltip,
  sort,
  onSort,
  className,
  children,
  ...props
}: TableHeadProps) {
  const density = React.useContext(DensityContext);
  const sortable = typeof onSort === "function";

  const label = (
    <span className="min-w-0">
      <span
        className={cn(
          "whitespace-nowrap text-[13px] font-medium",
          tooltip ? "cursor-help underline decoration-dotted underline-offset-2" : undefined,
        )}
      >
        {children}
        {unit ? (
          <>
            {" "}
            <span className="text-micro font-normal text-faint">{unit}</span>
          </>
        ) : null}
      </span>
    </span>
  );

  let content: React.ReactNode = label;
  if (sortable) {
    const button = (
      <button
        type="button"
        onClick={onSort}
        className={cn(
          "group/sort flex w-full cursor-pointer items-center gap-1 rounded-sm border-0 bg-transparent p-0 text-inherit",
          "transition-colors duration-quick hover:text-foreground",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          align === "right" && "flex-row-reverse",
          align === "center" && "justify-center",
          sort && "text-foreground",
        )}
      >
        {label}
        <SortIcon sort={sort} />
      </button>
    );
    content = tooltip ? <Tooltip content={tooltip}>{button}</Tooltip> : button;
  } else if (tooltip) {
    content = (
      <Tooltip content={tooltip}>
        <span tabIndex={0} className="inline-flex rounded-sm outline-none focus-visible:ring-1 focus-visible:ring-ring">
          {label}
        </span>
      </Tooltip>
    );
  }

  return (
    <th
      scope="col"
      data-slot="table-head"
      aria-sort={sortable ? (sort === "asc" ? "ascending" : sort === "desc" ? "descending" : "none") : undefined}
      className={cn(
        "border-b border-border align-middle font-medium whitespace-nowrap text-muted-foreground",
        cellPadding[density],
        alignClass[align],
        className,
      )}
      {...props}
    >
      {content}
    </th>
  );
}

function SortIcon({ sort }: { sort: SortDirection | false | undefined }) {
  if (sort === "asc") return <ChevronUp aria-hidden="true" className="size-3.5 shrink-0" />;
  if (sort === "desc") return <ChevronDown aria-hidden="true" className="size-3.5 shrink-0" />;
  return (
    <ChevronsUpDown
      aria-hidden="true"
      className="size-3.5 shrink-0 opacity-0 transition-opacity duration-fast ease-smooth-out group-hover/sort:opacity-100 group-focus-visible/sort:opacity-100 motion-reduce:transition-none"
    />
  );
}

export interface TableCellProps extends Omit<React.ComponentProps<"td">, "align"> {
  align?: TableAlign;
  /** Tabular numbers, right-aligned unless `align` is set. */
  numeric?: boolean;
  /** Foreground text instead of the default muted cell color. */
  strong?: boolean;
  /** Allow wrapping (cells are `nowrap` by default). */
  wrap?: boolean;
}

export function TableCell({ align, numeric = false, strong = false, wrap = false, className, ...props }: TableCellProps) {
  const density = React.useContext(DensityContext);
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "border-b border-border align-middle text-muted-foreground",
        wrap ? "whitespace-normal" : "whitespace-nowrap",
        cellPadding[density],
        alignClass[align ?? (numeric ? "right" : "left")],
        numeric && "tabular-nums",
        strong && "text-foreground",
        className,
      )}
      {...props}
    />
  );
}

export interface TableRowHeaderProps extends Omit<React.ComponentProps<"th">, "align"> {
  align?: TableAlign;
  /** Muted text and regular weight, for excluded or inactive rows. */
  muted?: boolean;
}

/** Row label cell (`<th scope="row">`): foreground, medium weight. */
export function TableRowHeader({ align = "left", muted = false, className, ...props }: TableRowHeaderProps) {
  const density = React.useContext(DensityContext);
  return (
    <th
      scope="row"
      data-slot="table-row-header"
      className={cn(
        "border-b border-border align-middle whitespace-nowrap",
        muted ? "font-normal text-muted-foreground" : "font-medium text-foreground",
        cellPadding[density],
        alignClass[align],
        className,
      )}
      {...props}
    />
  );
}

export interface TableSubheadRowProps extends React.ComponentProps<"tr"> {
  /** Number of columns to span. */
  colSpan: number;
  /** Trailing slot after the label (for example an `InfoTooltip`). */
  action?: React.ReactNode;
}

/** Muted divider row inside the body, like OpenRouter's "Not used in Standard routing". */
export function TableSubheadRow({ colSpan, action, className, children, ...props }: TableSubheadRowProps) {
  const density = React.useContext(DensityContext);
  return (
    <tr data-slot="table-subhead-row" className={cn("bg-muted", className)} {...props}>
      <td
        colSpan={colSpan}
        className={cn("border-b border-border text-caption font-medium text-muted-foreground", cellPadding[density], "py-1.5")}
      >
        <div className="flex items-center gap-1.5">
          <span>{children}</span>
          {action}
        </div>
      </td>
    </tr>
  );
}

export function TableCaption({ className, ...props }: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-body text-muted-foreground", className)}
      {...props}
    />
  );
}

export interface TableValueProps extends React.ComponentProps<"span"> {
  /** Muted unit, e.g. " ms" or "s". Include a leading space if you want one. */
  unit?: React.ReactNode;
  /** Render the number muted too (default: foreground number, muted unit). */
  muted?: boolean;
  /**
   * Invisible trailing zeros so that right-aligned values line up on the decimal point,
   * like OpenRouter's price columns (`$0.50` + 2 hidden zeros next to `$0.0065`).
   */
  pad?: number;
}

/** Tabular number with a muted unit: `210` + ` ms`. */
export function TableValue({ unit, muted = false, pad = 0, className, children, ...props }: TableValueProps) {
  return (
    <span
      data-slot="table-value"
      className={cn("tabular-nums", muted ? "text-muted-foreground" : "text-foreground", className)}
      {...props}
    >
      {children}
      {pad > 0 ? (
        <span aria-hidden="true" className="invisible select-none">
          {"0".repeat(pad)}
        </span>
      ) : null}
      {unit !== undefined && unit !== null ? <span className="text-muted-foreground">{unit}</span> : null}
    </span>
  );
}
