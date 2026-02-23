#!/usr/bin/env ts-node

/**
 * System Separation Verification Script
 * 
 * Run this script to verify that Inventory and Documents systems
 * remain properly separated in the codebase.
 * 
 * Usage:
 *   npx ts-node scripts/verify-separation.ts
 * 
 * Or add to package.json:
 *   "scripts": {
 *     "verify:separation": "ts-node scripts/verify-separation.ts"
 *   }
 */

import {
  verifySystemSeparation,
  formatVerificationReport,
} from "../lib/separation-verification"

function main() {
  console.log("Running system separation verification...\n")
  
  const report = verifySystemSeparation()
  const formatted = formatVerificationReport(report)
  
  console.log(formatted)
  
  // Exit with error code if verification failed
  process.exit(report.allPassed ? 0 : 1)
}

if (require.main === module) {
  main()
}
