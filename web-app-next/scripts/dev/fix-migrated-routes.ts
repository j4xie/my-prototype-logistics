#!/usr/bin/env tsx
/**
 * Day 6: 修复迁移后API路由的ESLint错误
 * 批量修复未使用参数的警告
 */

import fs from 'fs'
import { glob } from 'glob'

/**
 * 修复单个文件的ESLint错误
 */
function fixFile(filePath: string): boolean {
  try {
    const content = fs.readFileSync(filePath, 'utf-8')

    // 检查是否是迁移后的文件
    if (!content.includes('MIGRATED TO MSW')) {
      return false
    }

    // 添加eslint-disable注释并改为_request
    let fixedContent = content.replace(
      /export async function (GET|POST|PUT|DELETE|PATCH)\(request: NextRequest\)/g,
      '// eslint-disable-next-line @typescript-eslint/no-unused-vars\nexport async function $1(_request: NextRequest)'
    )

    // 如果已经修改过，再替换已经存在的_request
    if (fixedContent === content) {
      fixedContent = content.replace(
        /export async function (GET|POST|PUT|DELETE|PATCH)\(_request: NextRequest\)/g,
        '// eslint-disable-next-line @typescript-eslint/no-unused-vars\nexport async function $1(_request: NextRequest)'
      )
    }

    if (fixedContent !== content) {
      fs.writeFileSync(filePath, fixedContent)
      console.log(`✅ 修复: ${filePath}`)
      return true
    }

    return false
  } catch (error) {
    console.error(`❌ 修复失败: ${filePath}`, error)
    return false
  }
}

/**
 * 主函数
 */
async function main() {
  try {
    console.log('\n🔧 修复迁移后API路由ESLint错误')
    console.log('=' .repeat(50))

    const apiFiles = await glob('src/app/api/**/route.ts', { cwd: process.cwd() })
    let fixedCount = 0

    console.log(`📁 扫描 ${apiFiles.length} 个API路由文件...`)

    for (const file of apiFiles) {
      if (fixFile(file)) {
        fixedCount++
      }
    }

    console.log(`\n📊 修复完成`)
    console.log(`修复文件数: ${fixedCount}`)
    console.log(`总文件数: ${apiFiles.length}`)

    if (fixedCount > 0) {
      console.log('\n✅ 所有ESLint错误已修复!')
    } else {
      console.log('\n📋 没有发现需要修复的文件')
    }

  } catch (error) {
    console.error('\n❌ 修复失败:', error)
    process.exit(1)
  }
}

// 执行修复
main()
