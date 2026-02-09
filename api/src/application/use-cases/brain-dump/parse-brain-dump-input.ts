/**
 * ParseBrainDumpInputUseCase - 解析 Brain Dump 輸入
 *
 * Application Layer Use Case
 * 處理 JSON / multipart form-data / 圖片上傳的輸入解析
 * @Product 標記解析
 */

import { prisma } from "@/lib/db"
import { ValidationException } from "@/lib/api-response"
import { understandImage, formatExtractedItemsAsText, validateImage } from "@/lib/image-understanding"

// ============================================================================
// DTOs
// ============================================================================

export interface ParseBrainDumpInputRequest {
  userId: string
  contentType: string
  jsonBody?: any
  formData?: FormData
}

export interface ParseBrainDumpInputResponse {
  text: string
  cleanedText: string
  inputType: "text" | "image" | "image_with_text"
  imageUnderstandingResult: Awaited<ReturnType<typeof understandImage>> | null
  explicitProductId: string | null
  timings: Record<string, number>
}

// ============================================================================
// Use Case
// ============================================================================

export class ParseBrainDumpInputUseCase {
  async execute(
    request: ParseBrainDumpInputRequest
  ): Promise<ParseBrainDumpInputResponse> {
    const timings: Record<string, number> = {}
    let text: string
    let inputType: "text" | "image" | "image_with_text" = "text"
    let imageUnderstandingResult: Awaited<ReturnType<typeof understandImage>> | null = null

    if (request.contentType.includes("multipart/form-data")) {
      const formData = request.formData!
      const imageFile = formData.get("image") as File | null
      const supplementaryText = (formData.get("text") as string) || ""
      inputType = (formData.get("input_type") as typeof inputType) || (imageFile ? "image" : "text")

      if (inputType === "text") {
        text = supplementaryText
      } else {
        if (!imageFile) {
          throw new ValidationException("image is required for image input_type", "image")
        }

        const validation = validateImage(imageFile.size, imageFile.type)
        if (!validation.valid) {
          throw new ValidationException(validation.error!, "image")
        }

        const startImageUnderstanding = Date.now()
        const imageBuffer = Buffer.from(await imageFile.arrayBuffer())
        imageUnderstandingResult = await understandImage(
          imageBuffer,
          imageFile.type,
          supplementaryText || undefined,
        )
        timings["image_understanding"] = Date.now() - startImageUnderstanding

        console.log(`📷 [brain-dump] Image type: ${imageUnderstandingResult.image_type}, items: ${imageUnderstandingResult.extracted_items.length}, confidence: ${imageUnderstandingResult.confidence}`)

        text = formatExtractedItemsAsText(imageUnderstandingResult)
      }
    } else {
      text = request.jsonBody?.text
    }

    if (!text) {
      throw new ValidationException("text is required", "text")
    }

    // 解析 @Product 標記
    const productMentionRegex = /@(\S+)/g
    const matches = Array.from(text.matchAll(productMentionRegex))
    const mentionedProductNames = matches.map(m => m[1])

    let explicitProductId: string | null = null
    let cleanedText = text

    if (mentionedProductNames.length > 0) {
      const matchedProduct = await prisma.product.findFirst({
        where: {
          user_id: request.userId,
          deleted_at: null,
          name: { in: mentionedProductNames, mode: 'insensitive' }
        }
      })

      if (matchedProduct) {
        explicitProductId = matchedProduct.id
        cleanedText = text.replace(productMentionRegex, '').trim()
        console.log(`🎯 [brain-dump] User explicitly mentioned Product: ${matchedProduct.name}`)
      }
    }

    return {
      text,
      cleanedText,
      inputType,
      imageUnderstandingResult,
      explicitProductId,
      timings,
    }
  }
}
