import axios from 'axios';

export interface TranslationResult {
  translation: string;
  explanation: string;
}

export const translateWord = async (
  word: string,
  apiUrl: string,
  apiKey: string,
  sourceLanguage: string = 'auto',
): Promise<TranslationResult> => {
  try {
    if (!apiUrl || !apiKey) {
      throw new Error('LLM API URL and Key must be configured in settings');
    }

    const prompt = `Translate the word "${word}" to Spanish and provide a brief explanation in ${sourceLanguage}. Format your response as JSON with keys "translation" and "explanation".`;

    const response = await axios.post(
      apiUrl,
      {
        model: 'gpt-4',
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        timeout: 10000,
      },
    );

    const content = response.data.choices[0].message.content;
    const parsed = JSON.parse(content);

    return {
      translation: parsed.translation || 'Translation not available',
      explanation: parsed.explanation || 'Explanation not available',
    };
  } catch (error) {
    console.error('Translation error:', error);
    return {
      translation: 'Error',
      explanation: 'Failed to translate. Check your API settings.',
    };
  }
};
