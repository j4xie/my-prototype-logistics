/**
 * Excel文件解析工具
 * 用于解析上传的Excel/CSV文件中的手机号码
 */

/**
 * 解析结果接口
 */
export interface ParseResult {
  phoneNumbers: string[];
  errors: string[];
  totalRows: number;
  validRows: number;
  duplicateRows: number;
}

/**
 * 解析配置接口
 */
export interface ParseConfig {
  maxRows?: number;          // 最大行数限制
  allowDuplicates?: boolean; // 是否允许重复
  strictValidation?: boolean; // 是否严格验证手机号格式
}

/**
 * Excel/CSV文件解析器
 */
export class ExcelParser {
  private readonly phoneRegex = /^1[3-9]\d{9}$/; // 中国手机号正则

  /**
   * 解析文件
   */
  async parseFile(file: File, config: ParseConfig = {}): Promise<ParseResult> {
    const {
      maxRows = 1000,
      allowDuplicates = false,
      strictValidation = true
    } = config;

    try {
      console.log('[ExcelParser] 开始解析文件:', file.name, file.type);

      let content: string;
      
      if (file.type.includes('csv') || file.name.endsWith('.csv')) {
        content = await this.readFileAsText(file);
      } else if (file.type.includes('excel') || file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        // 对于Excel文件，这里简化处理，实际项目中可以使用xlsx库
        content = await this.readFileAsText(file);
        console.warn('[ExcelParser] Excel文件被当作文本处理，建议使用CSV格式');
      } else {
        throw new Error('不支持的文件格式，请使用CSV或Excel文件');
      }

      return this.parseContent(content, { maxRows, allowDuplicates, strictValidation });

    } catch (error) {
      console.error('[ExcelParser] 文件解析失败:', error);
      throw error;
    }
  }

  /**
   * 解析文件内容
   */
  private parseContent(content: string, config: ParseConfig): ParseResult {
    const {
      maxRows = 1000,
      allowDuplicates = false,
      strictValidation = true
    } = config;

    const result: ParseResult = {
      phoneNumbers: [],
      errors: [],
      totalRows: 0,
      validRows: 0,
      duplicateRows: 0
    };

    // 分割行
    const lines = content.split('\n').map(line => line.trim()).filter(line => line);
    result.totalRows = lines.length;

    if (lines.length === 0) {
      result.errors.push('文件内容为空');
      return result;
    }

    if (lines.length > maxRows) {
      result.errors.push(`文件行数超出限制 (${lines.length} > ${maxRows})`);
      return result;
    }

    const phoneSet = new Set<string>();
    const phoneList: string[] = [];

    lines.forEach((line, index) => {
      const rowNumber = index + 1;
      
      // 解析当前行的手机号
      const phoneNumbers = this.extractPhoneNumbers(line, strictValidation);
      
      if (phoneNumbers.length === 0) {
        result.errors.push(`第 ${rowNumber} 行：未找到有效手机号`);
        return;
      }

      phoneNumbers.forEach(phone => {
        // 检查重复
        if (phoneSet.has(phone)) {
          result.duplicateRows++;
          if (!allowDuplicates) {
            result.errors.push(`第 ${rowNumber} 行：手机号 ${phone} 重复`);
            return;
          }
        }

        phoneSet.add(phone);
        phoneList.push(phone);
        result.validRows++;
      });
    });

    result.phoneNumbers = phoneList;

    console.log('[ExcelParser] 解析完成:', {
      totalRows: result.totalRows,
      validRows: result.validRows,
      phoneCount: result.phoneNumbers.length,
      errorCount: result.errors.length
    });

    return result;
  }

  /**
   * 从文本行中提取手机号
   */
  private extractPhoneNumbers(line: string, strictValidation: boolean): string[] {
    const phoneNumbers: string[] = [];

    // 尝试多种分割方式
    const separators = [',', ';', '\t', ' ', '|'];
    let cells = [line];

    // 按分隔符分割
    for (const sep of separators) {
      if (line.includes(sep)) {
        cells = line.split(sep).map(cell => cell.trim());
        break;
      }
    }

    // 从每个单元格中提取手机号
    cells.forEach(cell => {
      if (!cell) return;

      if (strictValidation) {
        // 严格模式：整个单元格必须是手机号
        if (this.phoneRegex.test(cell)) {
          phoneNumbers.push(cell);
        }
      } else {
        // 宽松模式：提取单元格中的所有手机号
        const matches = cell.match(/1[3-9]\d{9}/g);
        if (matches) {
          phoneNumbers.push(...matches);
        }
      }
    });

    return phoneNumbers;
  }

  /**
   * 读取文件为文本
   */
  private readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (event) => {
        try {
          const result = event.target?.result as string;
          resolve(result || '');
        } catch (error) {
          reject(new Error('文件读取失败'));
        }
      };
      
      reader.onerror = () => {
        reject(new Error('文件读取错误'));
      };
      
      // 尝试UTF-8编码，如果失败则尝试GBK
      reader.readAsText(file, 'UTF-8');
    });
  }

  /**
   * 验证手机号格式
   */
  isValidPhoneNumber(phone: string): boolean {
    return this.phoneRegex.test(phone);
  }

  /**
   * 批量验证手机号
   */
  validatePhoneNumbers(phones: string[]): { valid: string[]; invalid: string[] } {
    const valid: string[] = [];
    const invalid: string[] = [];

    phones.forEach(phone => {
      if (this.isValidPhoneNumber(phone)) {
        valid.push(phone);
      } else {
        invalid.push(phone);
      }
    });

    return { valid, invalid };
  }

  /**
   * 生成示例CSV内容
   */
  generateSampleCSV(): string {
    const samplePhones = [
      '13800138000',
      '13900139000', 
      '15800158000',
      '18600186000',
      '17700177000'
    ];

    const csvContent = [
      '手机号码',
      ...samplePhones
    ].join('\n');

    return csvContent;
  }

  /**
   * 下载示例CSV文件
   */
  downloadSampleCSV(): void {
    const content = this.generateSampleCSV();
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    link.href = URL.createObjectURL(blob);
    link.download = '手机号导入模板.csv';
    link.click();
    
    URL.revokeObjectURL(link.href);
  }
}

// 创建解析器实例
export const excelParser = new ExcelParser();

// 导出解析器实例
export default excelParser;