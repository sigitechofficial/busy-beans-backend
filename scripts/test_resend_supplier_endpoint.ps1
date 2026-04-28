param(
  [string]$Url = "https://testingbb.trimworldwide.com/api/v1/admin/order-management/resend-unopened-supplier-emails",
  [int]$MinHours = 24,
  [int]$MaxRetry = 3,
  [string]$BearerToken = ""
)

$body = @{
  minHours = $MinHours
  maxRetry = $MaxRetry
} | ConvertTo-Json

$headers = @{}
if ($BearerToken -and $BearerToken.Trim() -ne "") {
  $headers["Authorization"] = "Bearer $BearerToken"
}

Write-Host "Testing endpoint: $Url"
Write-Host "Payload: $body"
if ($headers.ContainsKey("Authorization")) {
  Write-Host "Auth: Bearer token provided"
} else {
  Write-Host "Auth: none"
}

try {
  $resp = Invoke-RestMethod -Method Post -Uri $Url -Body $body -ContentType "application/json" -Headers $headers
  Write-Host "HTTP_STATUS: 200"
  $resp | ConvertTo-Json -Depth 10
}
catch {
  if ($_.Exception.Response) {
    $status = [int]$_.Exception.Response.StatusCode
    Write-Host "HTTP_STATUS: $status"
    $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
    $reader.ReadToEnd()
  } else {
    Write-Host ("REQUEST_ERROR: " + $_.Exception.Message)
  }
}

