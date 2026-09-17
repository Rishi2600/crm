"use client"

// Hand-written replacement for shadcn/ui's sonner.tsx.
//
// FLAG: shadcn's version reads the theme from next-themes, which this app
// deliberately does not use. The theme here is the `.dark` class that the
// pre-paint script in src/app/layout.tsx and ThemeToggle put on <html>. It
// is watched with a MutationObserver so toasts already on screen follow a
// theme switch.

import * as React from "react"
import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

function useDocumentTheme(): "light" | "dark" {
  // Starts as "light" on the server and the first client render so hydration
  // matches; the effect corrects it straight away.
  const [theme, setTheme] = React.useState<"light" | "dark">("light")

  React.useEffect(() => {
    const root = document.documentElement
    const read = () => setTheme(root.classList.contains("dark") ? "dark" : "light")
    read()
    const observer = new MutationObserver(read)
    observer.observe(root, { attributes: true, attributeFilter: ["class"] })
    return () => observer.disconnect()
  }, [])

  return theme
}

const Toaster = ({ ...props }: ToasterProps) => {
  const theme = useDocumentTheme()

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:border-border group-[.toaster]:bg-card group-[.toaster]:text-foreground",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
