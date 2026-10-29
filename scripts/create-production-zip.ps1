$ErrorActionPreference = "Stop"

$srcDir = "C:\Users\pc\.gemini\antigravity\scratch\delish-bakes-order"
$desktopZipPath = "C:\Users\pc\Desktop\delish-bakes-order-production.zip"
$scratchZipPath = "C:\Users\pc\.gemini\antigravity\scratch\delish-bakes-order-production.zip"

if (Test-Path $desktopZipPath) { Remove-Item $desktopZipPath -Force }
if (Test-Path $scratchZipPath) { Remove-Item $scratchZipPath -Force }

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$zip = [System.IO.Compression.ZipFile]::Open($desktopZipPath, [System.IO.Compression.ZipArchiveMode]::Create)
$compressionLevel = [System.IO.Compression.CompressionLevel]::Optimal

$excludeDirs = @('.git', '.output', '.wrangler', '.tanstack', '.lovable', 'node_modules')
$excludeFiles = @('.env', '.env.local', '.env.production', '.env.development')

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

# Copy to scratch directory as well
Copy-Item -Path $desktopZipPath -Destination $scratchZipPath -Force

$zipItem = Get-Item $desktopZipPath
$hash = (Get-FileHash -Path $desktopZipPath -Algorithm SHA256).Hash

Write-Host "Created Production ZIP successfully!"
Write-Host "Desktop Path: $($desktopZipPath)"
Write-Host "Scratch Path: $($scratchZipPath)"
Write-Host "Files bundled: $count"
Write-Host "Size: $([math]::Round($zipItem.Length / 1MB, 2)) MB ($($zipItem.Length) bytes)"
Write-Host "SHA256: $hash"
