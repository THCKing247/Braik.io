/**
 * System Separation Verification
 * 
 * This module provides explicit checks to ensure Inventory and Documents systems
 * remain properly separated. Run these checks to verify separation integrity.
 * 
 * Separation Requirements:
 * 1. Inventory and Documents must have separate UI components
 * 2. Inventory and Documents must have separate API routes
 * 3. Inventory and Documents must have separate permissions systems
 * 4. No shared components should conflate Inventory and Documents
 * 5. Navigation entries must be separate
 */

import { readFileSync, existsSync } from "fs"
import { join } from "path"

export interface SeparationCheckResult {
  check: string
  passed: boolean
  message: string
  details?: string[]
}

export interface VerificationReport {
  timestamp: Date
  allPassed: boolean
  results: SeparationCheckResult[]
}

/**
 * Verify that Inventory and Documents components don't reference each other
 */
export function checkComponentSeparation(): SeparationCheckResult {
  const checks: string[] = []
  const errors: string[] = []

  try {
    // Check inventory-manager.tsx doesn't reference documents
    const inventoryManagerPath = join(process.cwd(), "components", "inventory-manager.tsx")
    if (existsSync(inventoryManagerPath)) {
      const inventoryContent = readFileSync(inventoryManagerPath, "utf-8")
      // Check for imports or actual usage (not just comments/strings)
      const docReferences = [
        { pattern: /from\s+["'].*documents-manager/i, name: "import from documents-manager" },
        { pattern: /import.*DocumentsManager/i, name: "import DocumentsManager" },
        { pattern: /\/api\/documents/i, name: "API route to /api/documents" },
        { pattern: /getDocumentPermissions/i, name: "getDocumentPermissions function" },
        { pattern: /DocumentPermissions/i, name: "DocumentPermissions interface" },
      ]
      
      docReferences.forEach(({ pattern, name }) => {
        if (pattern.test(inventoryContent)) {
          errors.push(`inventory-manager.tsx contains ${name}`)
        }
      })
      
      checks.push("✓ inventory-manager.tsx checked")
    } else {
      errors.push("inventory-manager.tsx not found")
    }

    // Check documents-manager.tsx doesn't reference inventory
    const documentsManagerPath = join(process.cwd(), "components", "documents-manager.tsx")
    if (existsSync(documentsManagerPath)) {
      const documentsContent = readFileSync(documentsManagerPath, "utf-8")
      // Check for imports or actual usage (not just comments/strings)
      const invReferences = [
        { pattern: /from\s+["'].*inventory-manager/i, name: "import from inventory-manager" },
        { pattern: /import.*InventoryManager/i, name: "import InventoryManager" },
        { pattern: /\/api\/.*inventory/i, name: "API route to /api/.../inventory" },
        { pattern: /getInventoryPermissions/i, name: "getInventoryPermissions function" },
        { pattern: /InventoryPermissions/i, name: "InventoryPermissions interface" },
      ]
      
      invReferences.forEach(({ pattern, name }) => {
        if (pattern.test(documentsContent)) {
          errors.push(`documents-manager.tsx contains ${name}`)
        }
      })
      
      checks.push("✓ documents-manager.tsx checked")
    } else {
      errors.push("documents-manager.tsx not found")
    }
  } catch (error: any) {
    errors.push(`Error checking component separation: ${error.message}`)
  }

  return {
    check: "Component Separation",
    passed: errors.length === 0,
    message: errors.length === 0 
      ? "Inventory and Documents components are properly separated"
      : `Found ${errors.length} separation violation(s)`,
    details: errors.length > 0 ? errors : checks,
  }
}

/**
 * Verify that Inventory and Documents have separate API routes
 */
export function checkAPIRouteSeparation(): SeparationCheckResult {
  const checks: string[] = []
  const errors: string[] = []

  try {
    // Check inventory API route exists and is separate
    const inventoryRoutePath = join(
      process.cwd(),
      "app",
      "api",
      "teams",
      "[teamId]",
      "inventory",
      "route.ts"
    )
    
    if (existsSync(inventoryRoutePath)) {
      const inventoryRouteContent = readFileSync(inventoryRoutePath, "utf-8")
      
      // Verify it uses inventory permissions, not document permissions
      if (!/getInventoryPermissions/i.test(inventoryRouteContent)) {
        errors.push("Inventory API route doesn't use getInventoryPermissions")
      }
      
      if (/getDocumentPermissions/i.test(inventoryRouteContent)) {
        errors.push("Inventory API route incorrectly uses getDocumentPermissions")
      }
      
      checks.push("✓ Inventory API route exists and uses correct permissions")
    } else {
      errors.push("Inventory API route not found")
    }

    // Check documents API route exists and is separate
    const documentsRoutePath = join(process.cwd(), "app", "api", "documents", "route.ts")
    
    if (existsSync(documentsRoutePath)) {
      const documentsRouteContent = readFileSync(documentsRoutePath, "utf-8")
      
      // Verify it uses document permissions, not inventory permissions
      if (!/getDocumentPermissions/i.test(documentsRouteContent)) {
        errors.push("Documents API route doesn't use getDocumentPermissions")
      }
      
      if (/getInventoryPermissions/i.test(documentsRouteContent)) {
        errors.push("Documents API route incorrectly uses getInventoryPermissions")
      }
      
      checks.push("✓ Documents API route exists and uses correct permissions")
    } else {
      errors.push("Documents API route not found")
    }
  } catch (error: any) {
    errors.push(`Error checking API route separation: ${error.message}`)
  }

  return {
    check: "API Route Separation",
    passed: errors.length === 0,
    message: errors.length === 0
      ? "Inventory and Documents have separate API routes"
      : `Found ${errors.length} API route separation violation(s)`,
    details: errors.length > 0 ? errors : checks,
  }
}

/**
 * Verify that Inventory and Documents have separate permissions systems
 */
export function checkPermissionsSeparation(): SeparationCheckResult {
  const checks: string[] = []
  const errors: string[] = []

  try {
    // Check inventory permissions file exists
    const inventoryPermsPath = join(process.cwd(), "lib", "inventory-permissions.ts")
    if (existsSync(inventoryPermsPath)) {
      const inventoryPermsContent = readFileSync(inventoryPermsPath, "utf-8")
      
      // Verify it doesn't reference document permissions
      if (/getDocumentPermissions/i.test(inventoryPermsContent)) {
        errors.push("inventory-permissions.ts incorrectly references document permissions")
      }
      
      if (/DocumentPermissions/i.test(inventoryPermsContent)) {
        errors.push("inventory-permissions.ts incorrectly references DocumentPermissions interface")
      }
      
      checks.push("✓ inventory-permissions.ts exists and is separate")
    } else {
      errors.push("inventory-permissions.ts not found")
    }

    // Check documents permissions file exists
    const documentsPermsPath = join(process.cwd(), "lib", "documents-permissions.ts")
    if (existsSync(documentsPermsPath)) {
      const documentsPermsContent = readFileSync(documentsPermsPath, "utf-8")
      
      // Verify it doesn't reference inventory permissions
      if (/getInventoryPermissions/i.test(documentsPermsContent)) {
        errors.push("documents-permissions.ts incorrectly references inventory permissions")
      }
      
      if (/InventoryPermissions/i.test(documentsPermsContent)) {
        errors.push("documents-permissions.ts incorrectly references InventoryPermissions interface")
      }
      
      checks.push("✓ documents-permissions.ts exists and is separate")
    } else {
      errors.push("documents-permissions.ts not found")
    }
  } catch (error: any) {
    errors.push(`Error checking permissions separation: ${error.message}`)
  }

  return {
    check: "Permissions System Separation",
    passed: errors.length === 0,
    message: errors.length === 0
      ? "Inventory and Documents have separate permissions systems"
      : `Found ${errors.length} permissions separation violation(s)`,
    details: errors.length > 0 ? errors : checks,
  }
}

/**
 * Verify that pages are separate
 */
export function checkPageSeparation(): SeparationCheckResult {
  const checks: string[] = []
  const errors: string[] = []

  try {
    // Check inventory page exists
    const inventoryPagePath = join(process.cwd(), "app", "dashboard", "inventory", "page.tsx")
    if (existsSync(inventoryPagePath)) {
      const inventoryPageContent = readFileSync(inventoryPagePath, "utf-8")
      
      // Verify it uses InventoryManager, not DocumentsManager
      if (!/InventoryManager/i.test(inventoryPageContent)) {
        errors.push("Inventory page doesn't use InventoryManager component")
      }
      
      if (/DocumentsManager/i.test(inventoryPageContent)) {
        errors.push("Inventory page incorrectly uses DocumentsManager component")
      }
      
      checks.push("✓ Inventory page exists and uses correct component")
    } else {
      errors.push("Inventory page not found")
    }

    // Check documents page exists
    const documentsPagePath = join(process.cwd(), "app", "dashboard", "documents", "page.tsx")
    if (existsSync(documentsPagePath)) {
      const documentsPageContent = readFileSync(documentsPagePath, "utf-8")
      
      // Verify it uses DocumentsManager, not InventoryManager
      if (!/DocumentsManager/i.test(documentsPageContent)) {
        errors.push("Documents page doesn't use DocumentsManager component")
      }
      
      if (/InventoryManager/i.test(documentsPageContent)) {
        errors.push("Documents page incorrectly uses InventoryManager component")
      }
      
      checks.push("✓ Documents page exists and uses correct component")
    } else {
      errors.push("Documents page not found")
    }
  } catch (error: any) {
    errors.push(`Error checking page separation: ${error.message}`)
  }

  return {
    check: "Page Separation",
    passed: errors.length === 0,
    message: errors.length === 0
      ? "Inventory and Documents pages are properly separated"
      : `Found ${errors.length} page separation violation(s)`,
    details: errors.length > 0 ? errors : checks,
  }
}

/**
 * Verify navigation entries are separate
 */
export function checkNavigationSeparation(): SeparationCheckResult {
  const checks: string[] = []
  const errors: string[] = []

  try {
    const quickActionsPath = join(process.cwd(), "config", "quickActions.ts")
    if (existsSync(quickActionsPath)) {
      const quickActionsContent = readFileSync(quickActionsPath, "utf-8")
      
      // Verify both inventory and documents entries exist
      const hasInventory = /id:\s*["']inventory["']/i.test(quickActionsContent)
      const hasDocuments = /id:\s*["']documents["']/i.test(quickActionsContent)
      
      if (!hasInventory) {
        errors.push("Quick actions missing inventory entry")
      } else {
        checks.push("✓ Inventory entry found in quick actions")
      }
      
      if (!hasDocuments) {
        errors.push("Quick actions missing documents entry")
      } else {
        checks.push("✓ Documents entry found in quick actions")
      }
      
      // Verify they have separate hrefs
      const inventoryHref = /id:\s*["']inventory["'][^}]*href:\s*["']([^"']+)["']/i.exec(quickActionsContent)
      const documentsHref = /id:\s*["']documents["'][^}]*href:\s*["']([^"']+)["']/i.exec(quickActionsContent)
      
      if (inventoryHref && documentsHref) {
        if (inventoryHref[1] === documentsHref[1]) {
          errors.push("Inventory and Documents share the same href in navigation")
        } else {
          checks.push("✓ Inventory and Documents have separate navigation hrefs")
        }
      }
    } else {
      errors.push("quickActions.ts not found")
    }
  } catch (error: any) {
    errors.push(`Error checking navigation separation: ${error.message}`)
  }

  return {
    check: "Navigation Separation",
    passed: errors.length === 0,
    message: errors.length === 0
      ? "Inventory and Documents have separate navigation entries"
      : `Found ${errors.length} navigation separation violation(s)`,
    details: errors.length > 0 ? errors : checks,
  }
}

/**
 * Run all separation verification checks
 */
export function verifySystemSeparation(): VerificationReport {
  const results: SeparationCheckResult[] = [
    checkComponentSeparation(),
    checkAPIRouteSeparation(),
    checkPermissionsSeparation(),
    checkPageSeparation(),
    checkNavigationSeparation(),
  ]

  const allPassed = results.every((result) => result.passed)

  return {
    timestamp: new Date(),
    allPassed,
    results,
  }
}

/**
 * Format verification report as a readable string
 */
export function formatVerificationReport(report: VerificationReport): string {
  const lines: string[] = []
  
  lines.push("=".repeat(60))
  lines.push("SYSTEM SEPARATION VERIFICATION REPORT")
  lines.push("=".repeat(60))
  lines.push(`Timestamp: ${report.timestamp.toISOString()}`)
  lines.push(`Overall Status: ${report.allPassed ? "✅ PASSED" : "❌ FAILED"}`)
  lines.push("")
  
  report.results.forEach((result) => {
    lines.push(`${result.passed ? "✅" : "❌"} ${result.check}`)
    lines.push(`   ${result.message}`)
    if (result.details && result.details.length > 0) {
      result.details.forEach((detail) => {
        lines.push(`   ${detail}`)
      })
    }
    lines.push("")
  })
  
  lines.push("=".repeat(60))
  
  return lines.join("\n")
}
