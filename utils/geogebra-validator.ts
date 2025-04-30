// GeoGebra命令验证器
export class GeoGebraValidator {
  // 已知的GeoGebra命令列表
  private static readonly VALID_COMMANDS = new Set([
    // 基本元素
    "Point", "Vector", "Segment", "Line", "Ray", "Circle", "Ellipse", "Polygon", "RegularPolygon",
    // 函数和曲线
    "Slope", "Function", "Curve", "ParametricCurve", "PolarCurve",
    // 动画和交互
    "Slider", "StartAnimation", "SetAnimationSpeed", "SetConditionToShowObject", "SetTrace", "Locus",
    // 高级功能
    "Sequence", "List", "If", "Text", "RunClickScript",
    // 其他常用命令
    "Intersect", "Midpoint", "Distance", "Angle", "Area", "Perimeter", "Length", "Reflect", "Rotate", "Translate", "Dilate"
  ])

  // 验证单个命令
  private static validateCommand(command: string): { isValid: boolean; error?: string } {
    // 提取命令名称（第一个单词）
    const commandName = command.split(/[\(\s,]/)[0].trim()
    
    // 检查是否是已知命令
    if (!this.VALID_COMMANDS.has(commandName)) {
      return {
        isValid: false,
        error: `未知的GeoGebra命令: ${commandName}`
      }
    }

    return { isValid: true }
  }

  // 验证命令块
  public static validateCommands(commands: string[]): { isValid: boolean; errors: string[] } {
    const errors: string[] = []
    
    for (const command of commands) {
      const result = this.validateCommand(command)
      if (!result.isValid && result.error) {
        errors.push(result.error)
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  // 从文本中提取GeoGebra命令
  public static extractCommands(text: string): string[] {
    const commands: string[] = []
    const regex = /```geogebra\n([\s\S]*?)```/g
    let match

    while ((match = regex.exec(text)) !== null) {
      const commandBlock = match[1]
      const commandLines = commandBlock.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
      commands.push(...commandLines)
    }

    return commands
  }
} 