$ErrorActionPreference = "Stop"

$srcDir = "C:\Users\pc\.gemini\antigravity\scratch\delish-bakes-order"
$zipPath = "C:\Users\pc\.gemini\antigravity\scratch\delish-bakes-order-production.zip"

if (Test-Path $zipPath) {
    Remove-Item $zipPath -Force
}

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$zip = [System.IO.Compression.ZipFile]::Open($zipPath, [System.IO.Compression.ZipArchiveMode]::Create)
$compressionLevel = [System.IO.Compression.CompressionLevel]::Optimal

$excludeDirs = @('.git', '.output', '.wrangler', '.tanstack', '.lovable', 'node_modules')
$excludeFiles = @('.env')

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

    if (-not $skip) {
        $entryName = $relPath.Replace('\', '/')
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $item.FullName, $entryName, $compressionLevel) | Out-Null
        $count++
    }
}

$zip.Dispose()

$zipItem = Get-Item $zipPath
Write-Host "Created ZIP file successfully!"
Write-Host "Path: $($zipItem.FullName)"
Write-Host "Files bundled: $count"
Write-Host "Size: $([math]::Round($zipItem.Length / 1MB, 2)) MB ($($zipItem.Length) bytes)"
