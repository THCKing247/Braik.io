function isRecoverableSchemaError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    return (
      message.includes("does not exist") ||
      message.includes("relation") ||
      message.includes("no such table")
    )
  }
  return false
}

export async function safeAdminDbQuery<T>(query: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await query()
  } catch (error) {
    if (isRecoverableSchemaError(error)) {
      console.warn("Admin DB fallback activated due to missing schema object:", error)
      return fallback
    }
    throw error
  }
}
