import Link from "next/link";
import type * as React from "react";
import { landingStyles as styles } from "./styles";

type Variant = "primary" | "secondary" | "dark" | "glass";
type Size = "md" | "lg";

interface ButtonLookProps {
  variant?: Variant;
  size?: Size;
  /** 20px icon; rendered decoratively. */
  icon?: React.ReactNode;
  iconPosition?: "start" | "end";
  /** Stretch on small screens, natural width from `sm` up. */
  fluid?: boolean;
  className?: string;
  children: React.ReactNode;
}

const variantClass: Record<Variant, string> = {
  primary: styles.buttonPrimary,
  secondary: styles.buttonSecondary,
  dark: styles.buttonDark,
  glass: styles.buttonGlass,
};

function buttonClass({ variant = "primary", size = "md", fluid, className }: ButtonLookProps) {
  return [styles.button, variantClass[variant], size === "lg" ? styles.buttonLg : null, fluid ? styles.buttonFluid : null, className]
    .filter(Boolean)
    .join(" ");
}

function ButtonContent({ icon, iconPosition = "end", children }: ButtonLookProps) {
  const iconNode = icon ? (
    <span className={styles.buttonIcon} aria-hidden="true">
      {icon}
    </span>
  ) : null;
  return (
    <>
      {iconPosition === "start" ? iconNode : null}
      <span className={styles.buttonLabel}>{children}</span>
      {iconPosition === "end" ? iconNode : null}
    </>
  );
}

export type ButtonLinkProps = ButtonLookProps &
  Omit<React.ComponentProps<typeof Link>, "className" | "children">;

/** Link styled as a button: 36/44px, 10–12px radius, xs shadow, press motion, offset focus ring. */
export function ButtonLink({ variant, size, icon, iconPosition, fluid, className, children, ...props }: ButtonLinkProps) {
  return (
    <Link className={buttonClass({ variant, size, fluid, className, children })} {...props}>
      <ButtonContent icon={icon} iconPosition={iconPosition}>
        {children}
      </ButtonContent>
    </Link>
  );
}

export type ButtonProps = ButtonLookProps &
  Omit<React.ComponentProps<"button">, "className" | "children">;

export function Button({ variant, size, icon, iconPosition, fluid, className, children, type = "button", ...props }: ButtonProps) {
  return (
    <button type={type} className={buttonClass({ variant, size, fluid, className, children })} {...props}>
      <ButtonContent icon={icon} iconPosition={iconPosition}>
        {children}
      </ButtonContent>
    </button>
  );
}
