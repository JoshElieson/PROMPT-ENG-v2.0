import { LayoutGrid } from "lucide-react";
import { LayoutPicker } from "@/components/layout/LayoutPicker";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function LayoutMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          title="Layouts"
          className="group text-muted-foreground hover:bg-panel-elevated/85 hover:text-foreground h-7 w-7 shrink-0 rounded-md"
        >
          <LayoutGrid className="text-muted-foreground group-hover:text-foreground h-4 w-4 transition-colors" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-auto p-2">
        <p className="text-muted px-1 pb-2 text-[10px] font-medium tracking-wider uppercase">
          Layout
        </p>
        <LayoutPicker variant="menu" />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
