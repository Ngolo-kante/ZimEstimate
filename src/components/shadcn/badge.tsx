import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Slot } from "radix-ui"

const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-4xl border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-all focus-visible:border-sc-ring focus-visible:ring-[3px] focus-visible:ring-sc-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-sc-destructive aria-invalid:ring-sc-destructive/20 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-sc-primary text-sc-primary-foreground [a]:hover:bg-sc-primary/80",
        secondary:
          "bg-sc-secondary text-sc-secondary-foreground [a]:hover:bg-sc-secondary/80",
        destructive:
          "bg-sc-destructive/10 text-sc-destructive focus-visible:ring-sc-destructive/20 [a]:hover:bg-sc-destructive/20",
        outline:
          "border-sc-border text-sc-foreground [a]:hover:bg-sc-muted [a]:hover:text-sc-muted-foreground",
        ghost:
          "hover:bg-sc-muted hover:text-sc-muted-foreground ",
        link: "text-sc-primary underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
