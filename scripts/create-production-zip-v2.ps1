$ErrorActionPreference = "Stop"

$srcDir = "C:\Users\pc\.gemini\antigravity\scratch\delish-bakes-order"
$artifactZip = "C:\Users\pc\.gemini\antigravity\brain\7a9f2f72-796d-4f08-8691-606ef2984577\delish-bakes-order-production.zip"
$scratchZip  = "C:\Users\pc\.gemini\antigravity\scratch\delish-bakes-order-production.zip"
$desktopZip  = "C:\Users\pc\Desktop\delish-bakes-order-production.zip"

if (Test-Path $artifactZip) { Remove-Item $artifactZip -Force }
if (Test-Path $scratchZip)  { Remove-Item $scratchZip -Force }
if (Test-Path $desktopZip)  { Remove-Item $desktopZip -Force }

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$zip = [System.IO.Compression.ZipFile]::Open($artifactZip, [System.IO.Compression.ZipArchiveMode]::Create)
$compressionLevel = [System.IO.Compression.CompressionLevel]::Optimal

$excludeDirs = @('.git', '.output', '.wrangler', '.tanstack', '.lovable', 'node_modules', '.nitro', '.stryker-tmp', '.temp')
$excludeFiles = @('.env', '.env.local', '.env.production', '.env.development', '.env.test', 'desktop.ini')

$count = 0
Get-ChildItem -Path $srcDir -Recurse -Force | ForEach-Object {
    $item = $_
    if ($item.PSIsContainer) { return }

    $relPath = $item.FullName.Substring($srcDir.Length + 1)
    $relParts = $relPath.Split([System.IO.Path]::DirectorySeparatorChar)

    $skip = $false
    foreach ($part in $relParts) {
        if ($excludeDirs -contains $part) {
            $skip = $true
            break
        }
    }
    if ($excludeFiles -contains $item.Name) {
        $skip = $true
    }
    if ($item.Extension -eq ".log" -or $item.Extension -eq ".zip") {
        $skip = $true
    }
    if ($item.Name.StartsWith(".env.") -and $item.Name -ne ".env.example") {
        $skip = $true
    }

    if (-not $skip) {
        $entryName = $relPath.Replace('\', '/')
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $item.FullName, $entryName, $compressionLevel) | Out-Null
        $count++
    }
}

$zip.Dispose()

# Copy to scratch and desktop paths
Copy-Item -Path $artifactZip -Destination $scratchZip -Force
Copy-Item -Path $artifactZip -Destination $desktopZip -Force

# Verify no .env or secret files inside
$reader = [System.IO.Compression.ZipFile]::OpenRead($artifactZip)
$entries = $reader.Entries
$leaks = @($entries | Where-Object { $_.FullName -match "(^|/)\.env(\.|$)" -and $_.FullName -notmatch "\.env\.example$" })
$totalCount = $entries.Count
$reader.Dispose()

if ($leaks.Count -gt 0) {
    Write-Error "Security failure: leaked env files found in zip."
    exit 1
}

$fileItem = Get-Item $artifactZip
$hash = (Get-FileHash -Path $artifactZip -Algorithm SHA256).Hash
$mb = [math]::Round($fileItem.Length / 1MB, 2)

Write-Output "SUCCESS: Production ZIP created"
Write-Output "Artifact: $artifactZip"
Write-Output "Scratch:  $scratchZip"
Write-Output "Desktop:  $desktopZip"
Write-Output "Files:    $totalCount"
Write-Output "SizeMB:   $mb"
Write-Output "SHA256:   $hash"
