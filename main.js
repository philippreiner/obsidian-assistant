const { Plugin, PluginSettingTab, App, Setting } = require('obsidian');


class OpenAISummaryPlugin extends Plugin {
  async onload() {
    this.addCommand({
      id: 'create-flashcard',
      name: 'Flashcard for file',
      callback: () => this.summarizeNote(),
    });

    this.addSettingTab(new OpenAISummarySettingTab(this.app, this));
    this.settings = await this.loadData() || { apiKey: '', prompt: 'Create short flashcards for:', folderPath: '07-learning' };
  }


  async saveSettings() {
    await this.saveData(this.settings);
  }

  async summarizeNote() {
    const currentFile = this.app.workspace.getActiveFile();
  
    if (!this.settings.apiKey || this.settings.apiKey.trim() === '') {
      console.warn('OpenAI API key not set. Please configure it in the plugin settings.');
      return;
    }
  
    if (!this.settings.folderPath || this.settings.folderPath.trim() === '') {
      console.warn('Folder path not set. Please configure it in the plugin settings.');
      return;
    }
  
    if (!currentFile) {
      return;
    }
  
    const editor = this.app.workspace.activeLeaf.view.sourceMode.cmEditor;
    const cursorPosition = editor.getCursor();
    const placeholderText = 'Generating Flashcard...';
    editor.replaceRange(placeholderText, cursorPosition);
  
    this.createSummary(currentFile, cursorPosition, placeholderText).catch((error) => {
      console.error('Error creating summary:', error);
      editor.replaceRange('', { line: cursorPosition.line, ch: cursorPosition.ch - placeholderText.length }, cursorPosition);
    });
  }

  async createSummary(currentFile, cursorPosition, placeholderText) {
    const apiKey = this.settings.apiKey;
    const fileContent = await this.app.vault.read(currentFile);
    const summary = await this.sendToOpenAI(fileContent, apiKey);

    // Remove the "Generating Flashcard" placeholder text
    const editor = this.app.workspace.activeLeaf.view.sourceMode.cmEditor;
    editor.replaceRange('', { line: cursorPosition.line, ch: cursorPosition.ch }, { line: cursorPosition.line, ch: cursorPosition.ch + placeholderText.length });
  
    if (summary) {
      const currentMonth = new Date().toISOString().slice(0, 7);
      const summaryFolderPath = `${this.settings.folderPath}/${currentMonth}`;
      const summaryFileName = `Flashcard-${currentFile.basename}.md`;
      const summaryFilePath = `${summaryFolderPath}/${summaryFileName}`;
  
      const link = `[[${summaryFilePath}|Learning Flashcard]]`;
      const editor = this.app.workspace.activeLeaf.view.sourceMode.cmEditor;
      editor.replaceRange(link, cursorPosition);
      editor.focus();
  
      const taggedSummary = summary + `\n\n#learning #learning/${currentMonth}`;
      const existingSummaryFile = this.app.vault.getAbstractFileByPath(summaryFilePath);
  
      if (!this.app.vault.getAbstractFileByPath(summaryFolderPath)) {
        await this.app.vault.createFolder(summaryFolderPath);
      }
  
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
    const my_prompt = this.settings.prompt.trim();
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

class OpenAISummarySettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'Setup Flashcard Generation' });

    new Setting(containerEl)
      .setName('API Key')
      .setDesc('Enter your OpenAI API key')
      .addText((text) => text
        .setPlaceholder('Enter API key')
        .setValue(this.plugin.settings.apiKey)
        .onChange(async (value) => {
          this.plugin.settings.apiKey = value;
          await this.plugin.saveSettings();
        }));
    new Setting(containerEl)
      .setName('Folder path')
      .setDesc('where to create the files')
      .addText((text) => text
        .setPlaceholder('/path/')
        .setValue(this.plugin.settings.folderPath)
        .onChange(async (value) => {
          this.plugin.settings.folderPath = value;
          await this.plugin.saveSettings();
        }));
    
      new Setting(containerEl)
        .setName('Prompt')
        .setDesc('How to create flashcards')
        .addTextArea((textarea) => textarea
          .setPlaceholder('Create short memorable flashcards')
          .setValue(this.plugin.settings.prompt)
          .onChange(async (value) => {
            this.plugin.settings.prompt = value;
            await this.plugin.saveSettings();
          }));
        
  }
}



module.exports = OpenAISummaryPlugin;
