const { Plugin } = require('obsidian');

class OpenAISummaryPlugin extends Plugin {
  async onload() {
    this.addCommand({
      id: 'summarize-note',
      name: 'Summarize Note using OpenAI API',
      callback: () => this.summarizeNote(),
    });
  }

  async summarizeNote() {
    const openAI_API_KEY = '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';
    const currentFile = this.app.workspace.getActiveFile();

    if (!currentFile) {
      return;
    }

    const fileContent = await this.app.vault.read(currentFile);
    const summary = await this.sendToOpenAI(fileContent, openAI_API_KEY);

    if (summary) {
      const updatedContent = fileContent + '\n\n### Summary\n' + summary;
      await this.app.vault.modify(currentFile, updatedContent);
    } else {
      console.error('Failed to get summary from OpenAI API.');
    }
  }

  async sendToOpenAI(content, apiKey) {
    const requestOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        messages:[{
           role : "assistant",
           content :  `Give a short, precise summary in key items for the following content:\n\n${content}`
      }],
        max_tokens: 512, // adjust this value as needed
        model: "gpt-3.5-turbo",
      }),
    }
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
