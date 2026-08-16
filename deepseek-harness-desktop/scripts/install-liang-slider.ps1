# Optional: install Liang-Saint-Slider for DeepSeek Harness Desktop (Windows)
# Requires a desktop build that supports desktop-extra-plugins.json
$ErrorActionPreference = 'Stop'
$dsh = Join-Path $env:USERPROFILE '.dsh'
$dest = Join-Path $dsh 'extra-plugins\dsh-plugin-liang-calibrator'
$manifest = Join-Path $dsh 'desktop-extra-plugins.json'

New-Item -ItemType Directory -Force -Path (Split-Path $dest) | Out-Null
if (Test-Path $dest) {
  git -C $dest pull --ff-only
} else {
  git clone https://github.com/BruzWJ/Liang-Saint-Slider.git $dest
}

$entry = @{
  id   = 'liang-calibrator'
  name = 'dsh-plugin-liang-calibrator'
  path = 'extra-plugins/dsh-plugin-liang-calibrator'
}

$list = @()
if (Test-Path $manifest) {
  try { $list = @(Get-Content $manifest -Raw | ConvertFrom-Json) } catch { $list = @() }
}
if ($list -isnot [System.Array]) { $list = @($list) }
$list = @($list | Where-Object { $_.name -ne $entry.name })
$list += $entry
($list | ConvertTo-Json -Depth 5) | Set-Content -Encoding utf8 $manifest

Write-Host "OK: cloned/updated -> $dest"
Write-Host "OK: wrote -> $manifest"
Write-Host "请完全退出并重启 DeepSeek Harness Desktop。"
