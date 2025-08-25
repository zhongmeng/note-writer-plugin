import { Plugin, MarkdownView, Notice } from 'obsidian';

export default class NoteWriterPlugin extends Plugin {
  async onload() {
    this.addCommand({
      id: 'write-table-to-note',
      name: '将表格数据写入笔记',
      callback: () => this.writeDataToNote({}),
    });

    this.registerDomEvent(window, 'message', (event: MessageEvent) => {
      if (event.data.type === 'write-to-note') {
        this.writeDataToNote(event.data.payload);
      }
    });

    new Notice('Note Writer Plugin 已加载');
  }

  async writeDataToNote(payload: any) {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeView) {
      new Notice('无活跃笔记');
      return;
    }

    const file = activeView.file;
    if (!file) return;

    let content = await this.app.vault.read(file);
    const expenses = payload.expenses || [];
    let total = expenses.reduce((sum: number, exp: any) => sum + (exp.amount || 0), 0);

    let table = '\n## 支出记录（从表格写入）\n\n| 日期 | 描述 | 金额 | 类别 |\n|------|------|------|------|\n';
    expenses.forEach((exp: any) => {
      table += `| ${exp.date} | ${exp.description} | ${exp.amount} | ${exp.category} |\n`;
    });
    table += `| **总计** | | **${total.toFixed(2)}** | |\n`;

    const marker = '## 支出记录（从表格写入）';
    const markerIndex = content.indexOf(marker);
    if (markerIndex !== -1) {
      const endIndex = content.indexOf('\n##', markerIndex + 1) || content.length;
      content = content.slice(0, markerIndex) + table + content.slice(endIndex);
    } else {
      content += table;
    }

    await this.app.vault.modify(file, content);
    new Notice('数据已写入笔记');
  }
}