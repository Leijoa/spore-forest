<#
.SYNOPSIS
  韻西（Codex）呼叫阿扣（Claude Code）的非阻塞協作腳本。

.DESCRIPTION
  每個主題（-Topic）延續 Claude session，並把雙方發言 append 到共用對話檔。

  預設由隱藏工作程序執行 claude -p，啟動端立即返回，不讓外層工具的單次等待
  上限把正常慢回覆誤判成失敗。稍後以同 Topic 加 -Receive 收件。

  -Wait 僅供需要同步結果的人工工具；一般正式協作
  不應使用 -Wait。

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/collab-claude.ps1 -Topic collab-flow -Message "阿扣，請唯讀審查。"

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/collab-claude.ps1 -Topic collab-flow -Receive

.NOTES
  預算上限預設 US$5.00。stale 只表示需要人工判斷，不會自動停止或重送工作。
#>
param(
  [Parameter(Mandatory = $true)][string]$Topic,
  [string]$Message,
  [string]$MessageFile,
  [ValidateSet('plan', 'default', 'acceptEdits')][string]$Mode = 'plan',
  [double]$MaxBudgetUsd = 5.00,
  [ValidateRange(1, 1440)][int]$StaleMinutes = 20,
  [switch]$Fresh,
  [switch]$Receive,
  [switch]$Wait,
  [switch]$Worker
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$utf8 = New-Object System.Text.UTF8Encoding($false)
$safeTopic = ($Topic -replace '[^\w\-]', '_')
$dialogueDir = Join-Path $root 'docs/ai-collaboration/dialogue'
$handoffDir = Join-Path $root 'tmp/handoff'
$dialogueFile = Join-Path $dialogueDir "$safeTopic.md"
$stateFile = Join-Path $handoffDir "$safeTopic.claude-status.json"
$sessionFile = Join-Path $handoffDir "$safeTopic.claude-session"
$lastFile = Join-Path $handoffDir "$safeTopic.claude-last.md"
$promptFile = Join-Path $handoffDir "$safeTopic.claude-prompt.txt"
$stdoutFile = Join-Path $handoffDir "$safeTopic.claude-stdout.txt"
$stderrFile = Join-Path $handoffDir "$safeTopic.claude-stderr.txt"
$resultFile = Join-Path $handoffDir "$safeTopic.claude-result.json"
$relDialogue = "docs/ai-collaboration/dialogue/$safeTopic.md"

foreach ($dir in @($dialogueDir, $handoffDir)) {
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
}

function Write-AtomicText([string]$Path, [string]$Text) {
  $tempPath = "$Path.$([guid]::NewGuid().ToString('N')).tmp"
  [System.IO.File]::WriteAllText($tempPath, $Text, $utf8)
  try {
    if (Test-Path -LiteralPath $Path) {
      $backupPath = "$Path.replace-backup"
      if (Test-Path -LiteralPath $backupPath) { [System.IO.File]::Delete($backupPath) }
      [System.IO.File]::Replace($tempPath, $Path, $backupPath)
      [System.IO.File]::Delete($backupPath)
    }
    else {
      [System.IO.File]::Move($tempPath, $Path)
    }
  }
  finally {
    if (Test-Path -LiteralPath $tempPath) { [System.IO.File]::Delete($tempPath) }
  }
}

function Write-State($State) {
  $State.updatedAtUtc = [DateTimeOffset]::UtcNow.ToString('o')
  Write-AtomicText $stateFile (($State | ConvertTo-Json -Depth 6) + "`r`n")
}

function Read-State {
  if (-not (Test-Path $stateFile)) { return $null }
  return (Get-Content -Raw -Encoding UTF8 $stateFile | ConvertFrom-Json)
}

function Read-OptionalText([string]$Path) {
  if (-not (Test-Path $Path)) { return '' }
  return [System.IO.File]::ReadAllText($Path, [System.Text.Encoding]::UTF8).Trim()
}

function Get-ElapsedMinutes($State) {
  $started = [DateTimeOffset]::Parse([string]$State.startedAtUtc)
  return ([DateTimeOffset]::UtcNow - $started).TotalMinutes
}

function Test-WorkerAlive($State) {
  if (-not $State.workerPid) { return $false }
  return $null -ne (Get-Process -Id ([int]$State.workerPid) -ErrorAction SilentlyContinue)
}

function Complete-Reply($State, [string]$Text) {
  Write-AtomicText $lastFile ($Text + "`r`n")
  $marker = "<!-- request:$($State.requestId) response -->"
  $dialogueText = Read-OptionalText $dialogueFile
  if (-not $dialogueText.Contains($marker)) {
    $stamp = Get-Date -Format 'yyyy-MM-dd HH:mm'
    $entry = "`r`n### [$stamp] 阿扣 $marker`r`n$Text`r`n"
    [System.IO.File]::AppendAllText($dialogueFile, $entry, $utf8)
  }
  $State.state = 'completed'
  $State.completedAtUtc = [DateTimeOffset]::UtcNow.ToString('o')
  $State.error = $null
  Write-State $State
  return $Text
}

function Receive-Reply([switch]$Quiet) {
  $state = Read-State
  if (-not $state) {
    if (-not $Quiet) { Write-Host "錯誤：主題「$Topic」沒有可收取的阿扣工作。" }
    return [pscustomobject]@{ state = 'failed'; text = $null; error = '找不到工作狀態。' }
  }

  if ($state.state -eq 'completed' -and (Test-Path $lastFile)) {
    return [pscustomobject]@{
      state = 'completed'
      text = Read-OptionalText $lastFile
      error = $null
    }
  }

  if (Test-Path $resultFile) {
    try {
      $workerResult = Get-Content -Raw -Encoding UTF8 $resultFile | ConvertFrom-Json
      if ([int]$workerResult.exitCode -eq 0) {
        $reply = Read-OptionalText $stdoutFile
        if ($reply) {
          $text = Complete-Reply $state $reply
          return [pscustomobject]@{ state = 'completed'; text = $text; error = $null }
        }
        $state.state = 'failed'
        $state.error = 'Claude CLI 已正常結束，但沒有輸出文字回覆。'
      }
      else {
        $detail = Read-OptionalText $stderrFile
        if (-not $detail) { $detail = Read-OptionalText $stdoutFile }
        if (-not $detail) { $detail = [string]$workerResult.error }
        if (-not $detail) { $detail = "Claude CLI 結束碼：$($workerResult.exitCode)" }
        if ($detail.Length -gt 4000) { $detail = $detail.Substring(0, 4000) }
        $state.state = if ($detail -match '(?i)(workspace trust|not logged in|authentication|authenticate|approval required|需要.*(?:登入|驗證|核准|輸入))') {
          'needs_attention'
        }
        else { 'failed' }
        $state.error = $detail
      }
    }
    catch {
      $state.state = 'failed'
      $state.error = "無法解析工作結果：$($_.Exception.Message)"
    }
    Write-State $state
    if (-not $Quiet) {
      Write-Host "阿扣狀態：$($state.state)"
      Write-Host $state.error
    }
    return [pscustomobject]@{ state = [string]$state.state; text = $null; error = [string]$state.error }
  }

  $elapsed = Get-ElapsedMinutes $state
  $workerAlive = Test-WorkerAlive $state

  if ($state.state -eq 'starting' -and -not $state.workerPid -and $elapsed -lt [double]$state.staleMinutes) {
    $state.state = 'running'
    $state.error = $null
  }
  elseif (-not $workerAlive) {
    $state.state = 'failed'
    $state.error = '背景工作程序已結束，但沒有留下結果檔。'
  }
  elseif ($elapsed -ge [double]$state.staleMinutes) {
    $state.state = 'stale'
    $state.error = "已執行 $([math]::Round($elapsed, 1)) 分鐘，需人工判斷；未自動停止或重送。"
  }
  else {
    $state.state = 'running'
    $state.error = $null
  }
  Write-State $state

  if (-not $Quiet) {
    Write-Host "阿扣狀態：$($state.state)（已執行 $([math]::Round($elapsed, 1)) 分鐘）"
    if ($state.error) { Write-Host $state.error }
  }
  return [pscustomobject]@{
    state = [string]$state.state
    text = $null
    error = [string]$state.error
  }
}

if ($Worker) {
  $state = Read-State
  if (-not $state) { exit 2 }

  $claude = Get-Command claude.exe -ErrorAction SilentlyContinue
  if (-not $claude) { $claude = Get-Command claude -ErrorAction SilentlyContinue }
  if (-not $claude) {
    $result = [pscustomobject]@{
      exitCode = 3
      completedAtUtc = [DateTimeOffset]::UtcNow.ToString('o')
      error = '找不到 claude.exe，請確認 Claude Code CLI 已安裝並在 PATH。'
    }
    Write-AtomicText $resultFile (($result | ConvertTo-Json) + "`r`n")
    exit 3
  }

  try {
    $budgetText = ([double]$state.maxBudgetUsd).ToString([System.Globalization.CultureInfo]::InvariantCulture)
    $arguments = @('-p')
    if ([bool]$state.isNewSession) {
      $arguments += @('--session-id', [string]$state.sessionId)
    }
    else {
      $arguments += @('--resume', [string]$state.sessionId)
    }
    $arguments += @('--permission-mode', [string]$state.mode, '--max-budget-usd', $budgetText)

    $process = Start-Process -FilePath $claude.Source -ArgumentList $arguments `
      -RedirectStandardInput $promptFile `
      -RedirectStandardOutput $stdoutFile `
      -RedirectStandardError $stderrFile `
      -WorkingDirectory $root -WindowStyle Hidden -Wait -PassThru
    $result = [pscustomobject]@{
      exitCode = $process.ExitCode
      completedAtUtc = [DateTimeOffset]::UtcNow.ToString('o')
      error = $null
    }
  }
  catch {
    $result = [pscustomobject]@{
      exitCode = -1
      completedAtUtc = [DateTimeOffset]::UtcNow.ToString('o')
      error = $_.Exception.Message
    }
  }
  Write-AtomicText $resultFile (($result | ConvertTo-Json) + "`r`n")
  exit ([int]$result.exitCode)
}

if ($Receive) {
  $received = Receive-Reply
  if ($received.state -eq 'completed') {
    Write-Output $received.text
    exit 0
  }
  if ($received.state -eq 'failed') { exit 1 }
  exit 0
}

if (-not $Message) {
  if (-not $MessageFile) {
    Write-Host '錯誤：啟動工作需要 -Message 或 -MessageFile；收件請使用 -Receive。'
    exit 2
  }
  if (-not (Test-Path $MessageFile)) {
    Write-Host "錯誤：找不到訊息檔：$MessageFile"
    exit 2
  }
  $Message = [System.IO.File]::ReadAllText((Resolve-Path $MessageFile).Path, [System.Text.Encoding]::UTF8)
}

$claude = Get-Command claude.exe -ErrorAction SilentlyContinue
if (-not $claude) { $claude = Get-Command claude -ErrorAction SilentlyContinue }
if (-not $claude) {
  Write-Host '錯誤：找不到 claude.exe，請確認 Claude Code CLI 已安裝並在 PATH。'
  exit 3
}

$previous = Read-State
if ($previous -and @('running', 'needs_attention', 'stale') -contains [string]$previous.state) {
  if ($Fresh -and -not (Test-WorkerAlive $previous)) {
    foreach ($path in @($stateFile, $sessionFile, $lastFile, $promptFile, $stdoutFile, $stderrFile, $resultFile)) {
      if (Test-Path -LiteralPath $path) { [System.IO.File]::Delete($path) }
    }
    $previous = $null
  }
  else {
    $recovery = if (Test-WorkerAlive $previous) {
      '既有工作程序仍在執行；請先收件或由人工判斷是否終止。腳本不會自動停止或重送。'
    }
    else {
      '既有工作程序已不在；確認可捨棄舊狀態後，以 -Fresh 明確重開新 session。'
    }
    Write-Host "拒絕重複啟動：主題「$Topic」仍為 $($previous.state)。$recovery"
    exit 4
  }
}

if (-not (Test-Path $dialogueFile)) {
  $header = "# 協作對話：$Topic`r`n`r`n> 韻西（Codex）↔ 阿扣（Claude Code）持續協作紀錄。append-only，勿改舊內容。`r`n"
  [System.IO.File]::WriteAllText($dialogueFile, $header, $utf8)
}

if ($Fresh -and (Test-Path $sessionFile)) { [System.IO.File]::Delete($sessionFile) }
$resumeSessionId = if (Test-Path $sessionFile) {
  [System.IO.File]::ReadAllText($sessionFile, [System.Text.Encoding]::ASCII).Trim()
}
else { $null }
$sessionId = if ($resumeSessionId) { $resumeSessionId } else { [guid]::NewGuid().ToString() }
$requestId = [guid]::NewGuid().ToString()
$stamp = Get-Date -Format 'yyyy-MM-dd HH:mm'
$marker = "<!-- request:$requestId -->"
$entry = "`r`n---`r`n### [$stamp] 韻西 $marker`r`n$Message`r`n"
[System.IO.File]::AppendAllText($dialogueFile, $entry, $utf8)

$promptBuilder = New-Object System.Text.StringBuilder
[void]$promptBuilder.AppendLine("你是阿扣（Claude Code），正在與韻西（Codex）就主題「$Topic」持續協作。製作人是雷爪獅。")
[void]$promptBuilder.AppendLine("完整對話紀錄在 $relDialogue（append-only）。不要改寫該檔歷史。")
if (-not $resumeSessionId) {
  [void]$promptBuilder.AppendLine('這是本主題第一回合；若需要背景，先讀 SYNC.md、AGENTS.md 與該對話檔。')
}
[void]$promptBuilder.AppendLine('遵守專案規則：繁體中文、不擅自 commit/push。資訊不足時直接列為需製作人確認，不要等待互動式輸入。')
[void]$promptBuilder.AppendLine('完成本回合後，直接以一則完整文字結論結束；不要呼叫 ExitPlanMode 或 AskUserQuestion。')
[void]$promptBuilder.AppendLine('')
[void]$promptBuilder.AppendLine('韻西這回合的訊息：')
[void]$promptBuilder.AppendLine($Message)
Write-AtomicText $promptFile $promptBuilder.ToString()

foreach ($path in @($stdoutFile, $stderrFile, $resultFile, $lastFile)) {
  if (Test-Path -LiteralPath $path) { [System.IO.File]::Delete($path) }
}

$startedAtUtc = [DateTimeOffset]::UtcNow.ToString('o')
$state = [pscustomobject][ordered]@{
  schemaVersion = 2
  topic = $Topic
  requestId = $requestId
  sessionId = $sessionId
  isNewSession = -not [bool]$resumeSessionId
  workerPid = $null
  startedAtUtc = $startedAtUtc
  updatedAtUtc = $startedAtUtc
  completedAtUtc = $null
  staleMinutes = $StaleMinutes
  state = 'starting'
  mode = $Mode
  maxBudgetUsd = $MaxBudgetUsd
  error = $null
}
[System.IO.File]::WriteAllText($sessionFile, $sessionId, [System.Text.Encoding]::ASCII)
Write-State $state

$powershell = (Get-Command powershell.exe).Source
try {
  $workerProcess = Start-Process -FilePath $powershell `
    -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ('"' + $PSCommandPath + '"'), '-Topic', $safeTopic, '-Worker') `
    -WorkingDirectory $root -WindowStyle Hidden -PassThru
  $state.workerPid = $workerProcess.Id
  $state.state = 'running'
  Write-State $state
}
catch {
  $state.state = 'failed'
  $state.error = "無法啟動背景工作程序：$($_.Exception.Message)"
  Write-State $state
  Write-Host $state.error
  exit 1
}

Write-Host "阿扣背景工作已啟動：topic=$Topic、pid=$($state.workerPid)、state=running。"
Write-Host "收件：powershell -NoProfile -ExecutionPolicy Bypass -File scripts/collab-claude.ps1 -Topic $safeTopic -Receive"

if ($Wait) {
  while ($true) {
    Start-Sleep -Seconds 2
    $received = Receive-Reply -Quiet
    if ($received.state -eq 'completed') {
      Write-Output $received.text
      exit 0
    }
    if (@('failed', 'stale', 'needs_attention') -contains $received.state) {
      $finalState = Read-State
      Write-Host "阿扣狀態：$($finalState.state)"
      if ($finalState.error) { Write-Host $finalState.error }
      exit $(if ($finalState.state -eq 'failed') { 1 } else { 5 })
    }
  }
}

exit 0
