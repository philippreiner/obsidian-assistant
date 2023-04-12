const { Plugin } = require('obsidian');

class OpenAISummaryPlugin extends Plugin {
  async onload() {
    this.addCommand({
      id: 'create-flashcard',
      name: 'Create Flashcard for file',
      callback: () => this.summarizeNote(),
    });
  }

  async summarizeNote() {
    const openAI_API_KEY = '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';
    const currentFile = this.app.workspace.getActiveFile();
    const summaryFolderPath = '07-learning';

    if (!currentFile) {
      return;
    }

    const summaryFileName = `${currentFile.basename}-flashcard.md`;
    const summaryFilePath = `${summaryFolderPath}/${summaryFileName}`;

    const link = `[[${summaryFilePath}|Learning Flashcard]]`;
    const fileContent = await this.app.vault.read(currentFile);
    const updatedContent = fileContent + `\n ${link}`;
    await this.app.vault.modify(currentFile, updatedContent);

    this.createSummary(currentFile, summaryFilePath, openAI_API_KEY).catch((error) => {
      console.error('Error creating summary:', error);
    });
  }

  async createSummary(currentFile, summaryFilePath, apiKey) {
    const fileContent = await this.app.vault.read(currentFile);
    const summary = await this.sendToOpenAI(fileContent, apiKey);
  
    if (summary) {
      const taggedSummary = summary + '\n\n#learning';
      const existingSummaryFile = this.app.vault.getAbstractFileByPath(summaryFilePath);
  
      if (existingSummaryFile) {
        await this.app.vault.modify(existingSummaryFile, taggedSummary);
      } else {
        await this.app.vault.create(summaryFilePath, taggedSummary);
      }
    } else {
      console.error('Failed to get summary from OpenAI API.');
    }
  }
  

  async sendToOpenAI(content, apiKey) {
    const my_prompt = "Write (multiple) flashcards that summarize relevant key items from content. Each flashcard must have 3 lines: A short question, then a single ? and a third line with just the answer not longer than 2 sentences. Example: ```What are Flashcards?\n?\nSummaries for Learning\n``` Never use sources, related items, links, topics and common knowledge for flashcards. Correct facts if needed. If the content is short, try to find one more flashcard that with a relevant question. Questions are not numbered! The Content: ";
    const requestOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        messages: [
          {
            role: "system",
            content: `You're a teacher that creates short and memorable flashcards for spaced repetition learning.`
          },
          {
          role: "user",
          content: `${my_prompt} \n\n${content}`
        }],
        max_tokens: 512,
        model: "gpt-3.5-turbo",
        temperature: 0.8,
        frequency_penalty: 0.1
      }),
    };

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', requestOptions);
      const data = await response.json();

      if (data.choices && data.choices.length > 0) {
        return data.choices[0].message.content.trim();
      }
    } catch (error) {
      console.error('Error fetching summary:', error);
    }

    return null;
  }
}

module.exports = OpenAISummaryPlugin;
