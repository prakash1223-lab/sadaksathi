# Run this as Administrator to fix localhost resolution
$hostsPath = "C:\Windows\System32\drivers\etc\hosts"
$content = Get-Content $hostsPath -Raw

# Add localhost entries if not already present (uncommented)
if ($content -notmatch '^127\.0\.0\.1\s+localhost') {
    $content = $content.TrimEnd()
    $content += "`r`n127.0.0.1`tlocalhost`r`n::1`t`t`tlocalhost`r`n"
    Set-Content -Path $hostsPath -Value $content -Encoding ASCII
    Write-Host "SUCCESS: localhost entries added to hosts file"
} else {
    Write-Host "localhost already configured"
}

# Flush DNS cache
ipconfig /flushdns
Write-Host "DNS cache flushed. Try http://localhost:5173 now."
