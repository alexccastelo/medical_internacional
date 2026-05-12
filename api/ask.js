const { Anthropic } = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');

// Initialize Anthropic client
// It automatically uses the ANTHROPIC_API_KEY environment variable
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || ''
});

// Cache the markdown content so we only read it once per cold start
let markdownContext = '';

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Ensure API key is set
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY não configurada no servidor.' });
  }

  const { question, history = [] } = req.body;

  if (!question) {
    return res.status(400).json({ error: 'A pergunta é obrigatória.' });
  }

  try {
    // Read markdown file if not already cached
    if (!markdownContext) {
      const mdPath = path.join(process.cwd(), 'medicamentos_viagem_internacional.md');
      markdownContext = fs.readFileSync(mdPath, 'utf8');
    }

    const systemPrompt = `Você é o "Assistente de Viagem Médica", um assistente de IA focado em responder dúvidas sobre transporte de medicamentos para a França e Itália baseado EXCLUSIVAMENTE no documento fornecido.

DOCUMENTO DE CONTEXTO:
"""
${markdownContext}
"""

REGRAS DE RESPOSTA:
1. Responda apenas com base nas informações contidas no Documento de Contexto.
2. Se a pergunta não for sobre medicamentos, viagens para França/Itália ou não estiver no documento, diga educadamente que só pode responder a dúvidas relacionadas às regras de medicamentos da viagem.
3. Seja conciso, claro e educado. Use formatação em Markdown (negrito para destaque, listas, etc).
4. Lembre o usuário, quando apropriado, que as regras e dicas não substituem orientações médicas oficiais.`;

    // Construct messages array from history and current question
    const messages = [];
    
    // Add history if any (format: { role: 'user' | 'assistant', content: string })
    if (history && history.length > 0) {
        messages.push(...history);
    }
    
    messages.push({ role: 'user', content: question });

    // Call Anthropic API
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001", // Using latest Haiku model
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages,
      temperature: 0.2, // Low temperature for factual consistency
    });

    const answer = response.content[0].text;

    return res.status(200).json({ answer });
  } catch (error) {
    console.error('Error in ask API:', error);
    return res.status(500).json({ error: `Erro no servidor: ${error.message}` });
  }
}
