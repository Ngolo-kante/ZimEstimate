"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CheckCircle, Info, Warning, XCircle, CircleNotch } from "@phosphor-icons/react"

// Light only: the app has no dark mode. Colours come from the app's tokens.
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <>
    <Sonner
      theme="light"
      offset="calc(24px + env(safe-area-inset-bottom, 0px))"
      mobileOffset="calc(16px + env(safe-area-inset-bottom, 0px))"
      className="toaster group"
      icons={{
        success: <CheckCircle className="size-4" weight="fill" />,
        info: <Info className="size-4" weight="fill" />,
        warning: <Warning className="size-4" weight="fill" />,
        error: <XCircle className="size-4" weight="fill" />,
        loading: <CircleNotch className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--color-surface)",
          "--normal-text": "var(--color-text)",
          "--normal-border": "var(--color-border)",
          "--border-radius": "var(--radius-lg)",
        } as React.CSSProperties
      }
      {...props}
    />
    <style jsx global>{`
      [data-sonner-toaster] { --mobile-offset-bottom: calc(16px + env(safe-area-inset-bottom, 0px)); }
      @media (max-width: 767px) {
        body:has(.project-mobile-dock, .mobile-bottom-nav) [data-sonner-toaster] {
          --offset-bottom: calc(88px + env(safe-area-inset-bottom, 0px)) !important;
          --mobile-offset-bottom: calc(88px + env(safe-area-inset-bottom, 0px)) !important;
        }
      }
      [data-sonner-toaster] [data-sonner-toast] {
        transition: transform 200ms cubic-bezier(0.23, 1, 0.32, 1), opacity 200ms cubic-bezier(0.23, 1, 0.32, 1);
      }
      [data-sonner-toaster] [data-sonner-toast][data-removed="true"] { transition-duration: 150ms; }
      [data-sonner-toaster] [data-close-button] { min-width: 44px; min-height: 44px; }
      [data-sonner-toaster] [data-button] { min-height: 44px; font-size: 12px; }
      @media (prefers-reduced-motion: reduce) {
        [data-sonner-toaster], [data-sonner-toaster] [data-sonner-toast] { animation: none !important; transition: opacity 150ms !important; }
      }
    `}</style>
    </>
  )
}

export { Toaster }
