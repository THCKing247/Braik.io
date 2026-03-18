/**
 * Declarations for packages used at runtime that lack or omit type definitions.
 * Ensures the project builds on Netlify/CI without installing optional type packages.
 */

declare module "@capacitor/cli" {
  export interface CapacitorConfig {
    appId?: string
    appName?: string
    webDir?: string
    server?: { url?: string; cleartext?: boolean }
    [key: string]: unknown
  }
}

declare module "pdf-parse" {
  const pdfParse: (dataBuffer: Buffer) => Promise<{ text: string; numpages: number; info?: unknown }>
  export default pdfParse
}

declare module "mammoth" {
  function extractRawText(options: { buffer: Buffer }): Promise<{ value: string }>
  function convertToHtml(options: { buffer: Buffer }): Promise<{ value: string }>
}

declare module "twilio" {
  interface Twilio {
    (accountSid: string, authToken: string): {
      messages: {
        create(options: {
          body: string
          from: string
          to: string
          [key: string]: unknown
        }): Promise<{ sid: string; [key: string]: unknown }>
      }
    }
  }
  const twilio: Twilio
  export default twilio
}
