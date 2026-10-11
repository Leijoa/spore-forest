# 開發流程：比照 BIBI DICE

2026-10-11 阿雷要求。本文件採用 BIBI DICE 的工作包接力與記憶分層，依孢子森林的純 HTML／Pages 架構調整驗收；不搬入 Steam、手機商店或 Electron 發行步驟。

## 1. 收斂工作包

韻西讀 SYNC、AGENTS 與任務相關規格，對照實際程式；簡述範圍、預期玩家行為、完成條件與驗證。工作包按 TASK_TEMPLATE 填寫，每批約五項變更以內，限定檔案與不涵蓋的功能。重大數值、存檔、發布等先核對已有授權，僅缺少必要決定時向阿雷確認。

## 2. 接力實作

大型包交阿扣，韻西不重做實作與測試。阿扣只改工作包指定檔案，保留其他人的工作；不得自行 commit／push／發布。發現產品決策缺口回報，不套用其他專案玩法。

非阻塞入口（在遊戲根目錄執行）：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/collab-claude.ps1 -Topic residents-v1 -MessageFile docs/tasks/residents-v1.md -Mode acceptEdits
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/collab-claude.ps1 -Topic residents-v1 -Receive
```

上例的工作包檔案尚未建立；完成規格與所需授權後再派工。唯讀規格／審閱使用 `-Mode plan`，實作才用 `acceptEdits`。預算 US$5；不得用權限繞過參數。相同主題續接同 session，不因單次工具等待結束或 stale 標記就宣稱失敗，不自動重送。

對話與 session／原始結果只存本專案忽略目錄，正式驗收濃縮到工作包及 SYNC。CLI 已安裝不代表訂閱／登入可用；實際派工失敗時記下原因，不重試消耗預算。Codex 接手按 AGENTS 例外規則明說範圍。

## 3. 驗證與差異審查

| 級別 | 適用 | 必做 |
|---|---|---|
| 內容核對 | 純文件／文案 | 真實內容、連結、差異與 git diff --check |
| 聚焦檢查 | 小修正 | 相關測試及直接呼叫端；需要時目視 |
| 整批閘門 | 一般功能／交付 | `node scripts/verify.cjs`，目前兩套共 70 項 |
| UI／存檔專項 | UI 或資料變動 | 320／390px、桌面；鍵盤與減少動態；舊檔／非法輸入／重開／匯出匯入／轉生保留 |

阿扣交差異摘要、PASS／FAIL、反證與未解問題；韻西審變更及直接呼叫端、權威計算與所有相關 UI，正常缺陷退回阿扣修正。只有修正、失敗或未解疑點才重跑；收尾跑一次整批閘門。數值模擬需配玩家體驗判斷。

## 4. 製作人試玩與發布

先交具體候選版與已完成驗收，讓阿雷確認感受。取得該批所需發布授權後，韻西提交繁體中文摘要、推 main、確認 Pages 工作成功及正式內容已更新。已有同批授權可繼續，不重複詢問。審查或試玩失敗就留在候選版，不宣稱上線。

## 5. 結案與下一步

更新一次 CHANGELOG，SYNC 記實際狀態、結果、阻斷與精確續接點；必要時更新遊戲規格。完成回覆末尾必須依 EXPANSION_PLAN 指出下一個優先工作包，並區分建議、已核准與已實作。

目前優先：試玩微調 → 居民分工規格 → 阿扣實作／驗收 → 韻西審查／阿雷試玩 → 授權發布。慶典與裝飾後續分批。
