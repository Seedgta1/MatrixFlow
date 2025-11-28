import { GoogleGenAI } from "@google/genai";
import { MatrixNode } from "../types";

// Helper to sanitize tree for token limit (only send structure relevant info)
const simplifyTree = (node: MatrixNode, depth: number = 0): any => {
  if (depth > 4) return { summary: `${node.totalDownline} more users below` }; // Prune deep trees for prompt
  return {
    username: node.username,
    level: node.level,
    personalUtilities: node.utilities?.length || 0,
    personalUtilityTypes: node.utilities?.map(u => u.type).join(', '),
    directChildren: node.children.length,
    totalDownline: node.totalDownline,
    totalGroupUtilities: node.totalUtilities,
    children: node.children.map(c => simplifyTree(c, depth + 1))
  };
};

export const analyzeNetwork = async (rootNode: MatrixNode): Promise<string> => {
  if (!process.env.API_KEY) {
    return "API Key mancante. Configura l'ambiente per utilizzare l'IA.";
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const simplifiedData = simplifyTree(rootNode);

    const prompt = `
      Sei un top leader e analista esperto di Network Marketing nel settore Energia (Luce e Gas). 
      Analizza la seguente struttura di una matrice forzata 10x10.
      
      Dati della rete (formato JSON semplificato):
      ${JSON.stringify(simplifiedData, null, 2)}

      Fornisci un report strategico (max 120 parole) in italiano:
      1. Stato della rete (crescita persone vs produzione contratti/utenze).
      2. Il rapporto tra Luce e Gas (se visibile) o la saturazione delle utenze personali.
      3. Consiglio tattico per l'utente "${rootNode.username}" per aumentare il fatturato.
      
      Tono: Energetico, professionale, orientato ai risultati.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "Impossibile generare l'analisi al momento.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Si è verificato un errore durante l'analisi della rete.";
  }
};

export const extractBillData = async (base64Data: string, mimeType: string): Promise<{ provider?: string, type?: 'Luce' | 'Gas', error?: string }> => {
  if (!process.env.API_KEY) {
    return { error: "API Key mancante" };
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Construct the multimodal request
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Data,
              mimeType: mimeType
            }
          },
          {
            text: `
              Analizza questa immagine/documento (bolletta o contratto energia).
              Il tuo compito è estrarre:
              1. Il nome del fornitore/gestore (es. Enel, Eni, A2A, Edison, ecc).
              2. Il tipo di fornitura: "Luce" (Energia Elettrica) o "Gas".

              Rispondi SOLO con un JSON valido in questo formato, senza markdown o spiegazioni aggiuntive:
              {
                "provider": "Nome Trovato",
                "type": "Luce" o "Gas" o null
              }
              Se non trovi il dato, metti null o stringa vuota.
            `
          }
        ]
      }
    });

    const text = response.text || "{}";
    // Clean markdown code blocks if present
    const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    try {
      const data = JSON.parse(jsonStr);
      return {
        provider: data.provider || undefined,
        type: (data.type === 'Luce' || data.type === 'Gas') ? data.type : undefined
      };
    } catch (e) {
      console.error("Failed to parse Gemini JSON response", text);
      return { error: "Formato risposta non valido" };
    }

  } catch (error) {
    console.error("Gemini Bill Extraction Error:", error);
    return { error: "Errore durante l'analisi del documento" };
  }
};