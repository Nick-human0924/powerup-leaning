# 数据结构与版本

可执行定义位于 `src/lib/schema.ts`，schema_version=`1.0.0`。全量快照存IndexedDB `andy-english-companion/snapshots`，文件Blob在独立blobs表。

Material（书名/册次/版本）→ SourceAsset（文件hash与存储引用）→ SourcePage（PDF实际页序、独立印刷页、图像来源、OCR状态）→ Unit/Section → Skill → PracticeTask。

LessonSession以实际日期（可未知）、时长、教材页与知识点描述一次真正上过的课。PracticeSession记录parent/child、实际开始/结束与题目。Observation追加关联知识点，可关联练习或课次；含原话证据、结果、提示/看过答案、来源、人工确认和时间。ParentNote保留可编辑转写原话与确认后观察ID。AudioAsset独立跟踪录音授权和转写状态；缺服务时仅保存音频未分析。ImportJob记录状态、0–1进度、错误、候选与完成时间。Audit保留版本/发布/删除记录。

outcome为independent、prompted、miss、not_tested、unverified；最后两者不等同miss。录入入口和schema引用校验防止无来源历史。Unit/Section印刷页范围为[number,number]或null；SourcePage的未知页序/印刷页为null，不能借用上传日期/文件名猜测。

稳定ID：文件/页hash使用SHA256；技能使用教材、单元、类型、规范表达确定性ID。新教材不修改前端常量，不清空档案。技能版本修改保留旧题及审计；相同ID备份合并保留本机已有实体，新增历史追加。导入前校验全部引用与唯一ID，失败整笔回滚。

V2/V3迁移映射 practice_sessions、lesson_links、raw_parent_notes 及嵌套observations；旧kid映射child、skip映射not_tested、提示记录不得独立。未知技能保留legacy待核对来源。JSON备份不包含二进制附件，缺文件必须显示缺失而非伪造预览。
