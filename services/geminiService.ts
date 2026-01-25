
import { GoogleGenAI } from "@google/genai";
import { Transaction, Account, User } from "../types";

export const getFinancialInsights = async (account: Account, transactions: Transaction[]): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const transactionsContext = transactions.map(t => 
    `${t.date}: ${t.type} of $${t.amount} (${t.comment}) - Status: ${t.status}`
  ).join('\n');

  const prompt = `
    Analyze the following financial transactions for the account "${account.name}".
    Provide 3 concise, actionable insights or observations about spending patterns, 
    account health, or potential issues (like pending approvals).
    Keep it professional and encouraging.

    Transactions:
    ${transactionsContext}
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "Unable to generate insights at this time.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Error connecting to AI service.";
  }
};

export const draftInvitationEmail = async (accountName: string, inviterName: string, inviteeEmail: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `
    Write a short, professional invitation email from ${inviterName} to join an expense tracking account named "${accountName}" on the ExpensifyPro platform.
    Mention that they can monitor transactions, add comments, and approve entries.
    Keep it friendly and clear.
    Target Email: ${inviteeEmail}
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "Failed to generate draft.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Error generating draft.";
  }
};
