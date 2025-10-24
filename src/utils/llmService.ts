import axios from 'axios';

export interface TranslationResult {
  translation: string;
  explanation: string;
}

export const translateWord = async (
  word: string,
  apiUrl: string,
  apiKey: string,
  model: string = '',
  sourceLanguage: string = 'auto',
): Promise<TranslationResult> => {
  try {
    const trimmedUrl = apiUrl?.trim();
    const trimmedKey = apiKey?.trim();
    const trimmedModel = model?.trim();

    if (!trimmedUrl || !trimmedKey || !trimmedModel) {
      throw new Error('LLM API URL, Key, and Model must be configured in settings');
    }

    const prompt = `Translate the word "${word}" to Spanish and provide a brief explanation in ${sourceLanguage}. Format your response as JSON with keys "translation" and "explanation".`;

    const response = await axios.post(
      trimmedUrl,
      {
        model: trimmedModel,
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
          Authorization: `Bearer ${trimmedKey}`,
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
  } catch (error: any) {
    console.error('Translation error:', error);
    console.error('API URL:', apiUrl);
    console.error('API Key:', apiKey);
    const errorMsg = error?.response?.data?.error?.message || error?.message || 'Unknown error';
    return {
      translation: 'Error',
      explanation: `Failed: ${errorMsg}. URL: ${apiUrl}, Key: ${apiKey}`,
    };
  }
};
