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
      } else if (event.data.type === 'read-from-note') {
        this.readDataFromNote();
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
    console.log('接收到的expenses数据:', expenses);
    let total = expenses.reduce((sum: number, exp: any) => sum + (exp.amount || 0), 0);

    let table = '## 支出记录（从表格写入）\n\n| 序号 | 描述 | 时间 | 类别 | 收支类型 | 金额 | 备注 |\n|------|------|------|------|------|------|------|\n';
    expenses.forEach((exp: any) => {
      table += `| ${exp.sequence} | ${exp.description} | ${exp.time} | ${exp.category} | ${exp.incomeType} | ${exp.amount} | ${exp.remarks || ''} |\n`;
    });
    table += `| **总计** | | | | | **${total.toFixed(2)}** | |\n`;

    console.log('生成的表格内容:', table);

    const marker = '## 支出记录（从表格写入）';
    const markerIndex = content.indexOf(marker);
    console.log('标记位置:', markerIndex);
    
    if (markerIndex !== -1) {
      // 找到下一个##标题的位置
      let endIndex = content.indexOf('\n##', markerIndex + marker.length);
      if (endIndex === -1) {
        // 如果没有找到下一个##标题，查找文件末尾
        endIndex = content.length;
      }
      console.log('替换范围:', markerIndex, 'to', endIndex);
      // 替换整个表格部分
      content = content.slice(0, markerIndex) + table + content.slice(endIndex);
    } else {
      // 首次添加表格，确保前面有适当的换行
      if (!content.endsWith('\n\n')) {
        if (!content.endsWith('\n')) {
          content += '\n\n';
        } else {
          content += '\n';
        }
      }
      content += table;
    }

    await this.app.vault.modify(file, content);
    new Notice('数据已写入笔记');
  }

  async readDataFromNote() {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeView) {
      new Notice('无活跃笔记');
      return;
    }

    const file = activeView.file;
    if (!file) return;

    let content = await this.app.vault.read(file);
    const expenses = this.parseExpensesFromContent(content);
    
    // 发送数据到iframe
    const iframes = document.querySelectorAll('iframe');
    iframes.forEach(iframe => {
      if (iframe.contentWindow) {
        iframe.contentWindow.postMessage({
          type: 'note-data-response',
          payload: { expenses }
        }, '*');
      }
    });

    new Notice(`已读取 ${expenses.length} 条记录`);
  }

  parseExpensesFromContent(content: string) {
    const expenses: any[] = [];
    const marker = '## 支出记录（从表格写入）';
    const markerIndex = content.indexOf(marker);
    
    if (markerIndex === -1) {
      return expenses; // 没有找到支出记录表格
    }

    // 查找表格开始位置
    const tableStart = content.indexOf('| 序号 | 描述 | 时间 | 类别 | 收支类型 | 金额 | 备注 |', markerIndex);
    if (tableStart === -1) return expenses;

    // 查找表格结束位置（下一个##标题或文件结尾）
    const nextHeading = content.indexOf('\n##', tableStart);
    const tableEnd = nextHeading !== -1 ? nextHeading : content.length;
    
    const tableContent = content.slice(tableStart, tableEnd);
    const lines = tableContent.split('\n');

    // 跳过表头和分隔线，解析数据行
    for (let i = 2; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('|') && !line.includes('**总计**')) {
        const cells = line.split('|').map(cell => cell.trim()).filter(cell => cell !== '');
        if (cells.length >= 6) {
          expenses.push({
            sequence: cells[0],
            description: cells[1],
            time: cells[2],
            category: cells[3],
            incomeType: cells[4],
            amount: parseFloat(cells[5]) || 0,
            remarks: cells[6] || ''
          });
        }
      }
    }

    return expenses;
  }
}