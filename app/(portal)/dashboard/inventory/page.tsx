import { ComingSoon } from "@/components/portal/coming-soon"
import { Package } from "lucide-react"

export default function InventoryPage() {
  return (
    <ComingSoon
      title="Inventory"
      description="Track uniforms, pads, helmets, and all team equipment. Assign gear to players and get notified when items need to be returned."
      icon={Package}
    />
  )
}
