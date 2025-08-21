import { tool, DataStreamWriter } from 'ai'
import { z } from 'zod'

interface ReplaceSlotContentProps {
  dataStream: DataStreamWriter
}

const PROJECT_ID = process.env.PROJECT_ID!
const API_TOKEN = process.env.API_TOKEN!
const BASE_URL = process.env.REPLACE_SLOT_CONTENT_API_URL!

const replaceSlotSchema = z.object({
  component: z.string().describe('The Plasmic component name'),
  slot: z.string().describe('The slot name to override'),
  content: z.string().describe('The new content to inject into the slot'),
  hydrate: z.boolean().optional().default(true),
  embedHydrate: z.boolean().optional().default(true),
  mode: z.enum(['preview', 'published']).optional().default('preview'),
})

export const replaceSlotContent = ({ dataStream }: ReplaceSlotContentProps) =>
  tool({
    description:
      "Replace a slot's content in a Plasmic component using the Codegen REST API and return rendered HTML.",
    parameters: replaceSlotSchema,
    execute: async ({
      component,
      slot,
      content,
      hydrate,
      embedHydrate,
      mode,
    }: z.infer<typeof replaceSlotSchema>) => {
      try {
        // Build query
        const componentProps = JSON.stringify({ [slot]: content })
        const queryParams = new URLSearchParams({
          componentProps,
          mode,
          ...(hydrate ? { hydrate: '1' } : {}),
          ...(embedHydrate ? { embedHydrate: '1' } : {}),
        })

        const url = `${BASE_URL}/${PROJECT_ID}/${component}?${queryParams.toString()}`

        const res = await fetch(url, {
          headers: {
            'x-plasmic-api-project-tokens': `${PROJECT_ID}:${API_TOKEN}`,
          },
        })

        if (!res.ok) {
          throw new Error(
            `Plasmic API error: ${res.status} ${await res.text()}`
          )
        }

        const { html } = await res.json()

        dataStream.writeData({ type: 'component', content: component })
        dataStream.writeData({ type: 'slot', content: slot })
        dataStream.writeData({ type: 'html', content: html })

        return {
          message: `Replaced slot "${slot}" in component "${component}".`,
          html,
        }
      } catch (err: any) {
        return { error: err.message ?? String(err) }
      }
    },
  })
