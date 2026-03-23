import { sendCoachBPrompt } from "@/lib/braik-ai/openai-client"
import {
  GAME_RECAP_SYSTEM_INSTRUCTIONS,
  gameRecapUserContent,
  type GameRecapFacts,
} from "@/lib/game-recap-build"

export async function generateGameRecapWithOpenAI(facts: GameRecapFacts): Promise<string> {
  return sendCoachBPrompt(GAME_RECAP_SYSTEM_INSTRUCTIONS, gameRecapUserContent(facts))
}
