Add-Type -AssemblyName System.IO.Compression.FileSystem

$zipPath = "C:\Users\pc\.gemini\antigravity\scratch\delish-bakes-order-production.zip"
$zip = [System.IO.Compression.ZipFile]::OpenRead($zipPath)

$hasEnv = ($zip.Entries | Where-Object { $_.FullName -eq '.env' })
$hasEnvExample = ($zip.Entries | Where-Object { $_.FullName -eq '.env.example' })
$hasNodeModules = ($zip.Entries | Where-Object { $_.FullName -like 'node_modules/*' })
$hasOutput = ($zip.Entries | Where-Object { $_.FullName -like '.output/*' })
$hasGit = ($zip.Entries | Where-Object { $_.FullName -like '.git/*' })
$srcEntries = ($zip.Entries | Where-Object { $_.FullName -like 'src/*' })
$supabaseEntries = ($zip.Entries | Where-Object { $_.FullName -like 'supabase/*' })
$testEntries = ($zip.Entries | Where-Object { $_.FullName -like 'test/*' })
$hasPackageJson = ($zip.Entries | Where-Object { $_.FullName -eq 'package.json' })
$hasPackageLock = ($zip.Entries | Where-Object { $_.FullName -eq 'package-lock.json' })
$hasBunLock = ($zip.Entries | Where-Object { $_.FullName -eq 'bun.lock' })

$zip.Dispose()

Write-Host "=== ZIP VERIFICATION REPORT ==="
Write-Host "Contains .env (Real secret): $([bool]$hasEnv)"
Write-Host "Contains .env.example: $([bool]$hasEnvExample)"
Write-Host "Contains node_modules: $([bool]$hasNodeModules)"
Write-Host "Contains .output (build artifacts): $([bool]$hasOutput)"
Write-Host "Contains .git: $([bool]$hasGit)"
Write-Host "Number of src/ files: $($srcEntries.Count)"
Write-Host "Number of supabase/ files: $($supabaseEntries.Count)"
Write-Host "Number of test/ files: $($testEntries.Count)"
Write-Host "Contains package.json: $([bool]$hasPackageJson)"
Write-Host "Contains package-lock.json: $([bool]$hasPackageLock)"
Write-Host "Contains bun.lock: $([bool]$hasBunLock)"
