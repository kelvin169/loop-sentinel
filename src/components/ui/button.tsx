import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "@radix-ui/react-slot";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 min-h-11 px-4 text-sm font-medium transition-opacity duration-150 ease-out disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.98]",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-fg rounded-sm",
        ghost:
          "bg-transparent text-fg rounded-sm shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-fg)_14%,transparent)]",
        danger: "bg-alarm text-fg rounded-sm",
        subtle: "bg-surface-2 text-fg rounded-sm",
      },
    },
    defaultVariants: { variant: "primary" },
  },
);

export function Button({
  className,
  variant,
  asChild,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant }), className)} {...props} />;
}
