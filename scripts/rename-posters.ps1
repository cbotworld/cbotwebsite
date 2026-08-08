$headers = @{
  'apikey' = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im90dmJ5d3R1eXZ1Znh4dmxpenFwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjA3ODk0NywiZXhwIjoyMTAxNjU0OTQ3fQ.WUg--SXP1DAvSXJqinDzorRNkJTGciNnBoK1_80NHB0'
  'Authorization' = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im90dmJ5d3R1eXZ1Znh4dmxpenFwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjA3ODk0NywiZXhwIjoyMTAxNjU0OTQ3fQ.WUg--SXP1DAvSXJqinDzorRNkJTGciNnBoK1_80NHB0'
  'Content-Type' = 'application/json'
}

# Rename the last remaining WhatsApp file to plywood-pioneers
$body = '{"bucketId":"teams","sourceKey":"WhatsApp Image 2026-08-08 at 11.18.44.jpeg","destinationKey":"plywood-pioneers.jpeg"}'
$r = Invoke-RestMethod -Uri 'https://otvbywtuyvufxxvlizqp.supabase.co/storage/v1/object/move' -Method POST -Headers $headers -Body $body
Write-Host "RENAMED: WhatsApp Image 2026-08-08 at 11.18.44.jpeg -> plywood-pioneers.jpeg"

# Final listing
Write-Host "`nFinal bucket contents:"
$body2 = '{"limit":100,"offset":0,"prefix":""}'
$r2 = Invoke-RestMethod -Uri 'https://otvbywtuyvufxxvlizqp.supabase.co/storage/v1/object/list/teams' -Method POST -Headers $headers -Body $body2
$r2 | ForEach-Object { Write-Host "  - $($_.name)" }
