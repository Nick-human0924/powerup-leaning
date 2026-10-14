# Schema

版本1.0.0的执行定义和引用校验：`src/lib/schema.ts`。V2/V3迁移：`src/lib/migrations.ts`。

`initial-reference.json` 是本机私有种子，被 gitignore 排除。当前本机种子由实际 PDF 核验内容组成；不包含推断授课日期或初始成绩。公开克隆通过 `pnpm setup` 创建合法空白种子，再在应用中导入资料；已有私有种子不会被 setup 覆盖。大附件独立保存，不内嵌 JSON。
