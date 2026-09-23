import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { CategorySource, MenuItemSource } from "@/lib/menu-translations";

const TARGET_LANGUAGE_NAMES: Record<string, string> = {
  en: "British English",
  es: "Spanish (Spain)",
  de: "German",
};

const SYSTEM_PROMPT = `You translate the menu of "Duecento Grammi", a Neapolitan gourmet pizzeria in Marcianise (Caserta, Italy), from Italian for foreign guests reading the menu on their phone.

Guidelines:
- Keep proper pizza and dish names in Italian (e.g. "Margherita", "Diavola", "Montanara", "Frittatina la Ciociara"). Translate names that are just generic descriptions (e.g. "Patatine fritte" -> "French fries", "Acqua naturale" -> "Still water").
- Keep traditional Italian products that have no real equivalent in Italian, adding a short clarification in parentheses the first time it helps a foreign guest: e.g. "friarielli (Neapolitan broccoli rabe)", "'nduja (spicy spreadable Calabrian salami)", "fior di latte (cow's milk mozzarella)". Common words (mozzarella, ricotta, parmesan, prosciutto) need no clarification.
- Ingredients: return a comma-separated list with the same ingredients in the same order. Never add, drop or merge ingredients: guests with allergies rely on this list.
- Descriptions: natural, concise menu English. No marketing additions, no emojis unless the Italian has them.
- If a field is empty in Italian, return an empty string for it.
- Return exactly one entry per input id, with the same id.`;

const TranslationResultSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      nome: z.string(),
      descrizione: z.string(),
      ingredienti: z.string(),
    }),
  ),
  categories: z.array(
    z.object({
      id: z.string(),
      nome: z.string(),
    }),
  ),
});

export type MenuTranslationResult = z.infer<typeof TranslationResultSchema>;

export class MenuTranslationRefusedError extends Error {}

export const isMenuTranslatorConfigured = () =>
  Boolean(process.env.ANTHROPIC_API_KEY?.trim());

/** Traduce un gruppo di piatti e categorie in una sola chiamata a Claude. */
export const translateMenuBatch = async (
  locale: string,
  items: Array<{ id: string } & MenuItemSource>,
  categories: Array<{ id: string } & CategorySource>,
): Promise<MenuTranslationResult> => {
  const client = new Anthropic();
  const language = TARGET_LANGUAGE_NAMES[locale] ?? locale;

  const response = await client.messages.parse({
    model: "claude-opus-5",
    max_tokens: 16000,
    // Traduzione di testi brevi: poco ragionamento basta e risponde prima.
    output_config: {
      effort: "low",
      format: zodOutputFormat(TranslationResultSchema),
    },
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Translate into ${language}. Input (JSON):\n${JSON.stringify(
          { items, categories },
          null,
          2,
        )}`,
      },
    ],
  });

  if (response.stop_reason === "refusal") {
    throw new MenuTranslationRefusedError(
      response.stop_details?.explanation ?? "Traduzione rifiutata dal modello.",
    );
  }
  if (!response.parsed_output) {
    throw new Error(
      `Risposta di traduzione non valida (stop_reason: ${response.stop_reason}).`,
    );
  }

  return response.parsed_output;
};
