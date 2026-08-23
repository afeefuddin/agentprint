"use client";

import * as React from "react";
import { Tabs as TabsPrimitive } from "radix-ui";
import { cx } from "@/lib/ui";

function Tabs({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cx("flex flex-col gap-2", className)}
      {...props}
    />
  );
}

function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cx(
        "inline-flex min-h-11 w-fit items-center rounded-full border border-line bg-canvas-deep p-1 text-muted",
        className
      )}
      {...props}
    />
  );
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cx(
        "inline-flex min-h-9 flex-1 cursor-pointer items-center justify-center gap-2 rounded-full border border-transparent px-4 text-xs font-[weight:560] text-muted transition-[color,background-color,border-color,box-shadow] duration-150 hover:text-ink-strong focus-visible:z-[1] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue disabled:pointer-events-none disabled:opacity-50 data-[state=active]:border-line data-[state=active]:bg-panel-raised data-[state=active]:text-ink-strong data-[state=active]:shadow-[0_2px_8px_rgb(40_46_35_/_0.08)] max-tablet:gap-1.5 max-tablet:px-2 [&_svg]:size-4 [&_svg]:shrink-0 data-[state=active]:[&_svg]:text-blue",
        className
      )}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cx("outline-none", className)}
      {...props}
    />
  );
}

export { Tabs, TabsContent, TabsList, TabsTrigger };
