# Crea las 2 cuentas de prueba (CLIENTE y PROVEEDOR) para la revisión de Meta App Review
# llamando directamente al backend de producción (Render).
#
# Requisitos que ya valida el backend (ver app/schemas/user.py y app/schemas/provider.py):
#   - Password: minimo 8 caracteres, 1 mayuscula, 1 minuscula, 1 numero.
#   - Phone: formato chileno +56 9 XXXX XXXX (ej: +56912345678).
#   - Run (solo proveedor): RUT chileno con digito verificador valido (ej: 12345678-5).
#
# IMPORTANTE: el backend exige verificar el correo (email_verified = true) antes de poder
# iniciar sesion. Despues de correr este script, revisa el buzon de cada correo y haz clic
# en el enlace de verificacion que te llegue.
#
# Uso: edita las variables de abajo con datos REALES y ejecuta:
#   powershell -ExecutionPolicy Bypass -File .\scripts\create-meta-review-accounts.ps1

$ApiBase = 'https://backend-bapp.onrender.com/api/v1'

# ── Cuenta CLIENTE (ya existe: solo se valida el login) ───────────────────────
$ClientEmail    = 'anayen@gmail.com'
$ClientPassword = 'Securepassword12'

# ── Cuenta PROVEEDOR ──────────────────────────────────────────────────────────
$ProviderEmail    = 'ricjimenezcl@gmail.com'
$ProviderPassword = 'Securepassword12'
$ProviderFullName = 'Revisor Meta Proveedor'
$ProviderPhone    = '+56981291163'
$ProviderRun      = '12345678-5'   # RUT de prueba con digito verificador valido
$ProviderBio      = 'Cuenta de prueba para revision de Meta App Review.'

function Invoke-Registration {
    param(
        [string]$Url,
        [hashtable]$Body,
        [string]$Label
    )

    Write-Host "`n=== Registrando $Label ===" -ForegroundColor Cyan
    $json = $Body | ConvertTo-Json
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)

    $request = [System.Net.HttpWebRequest]::Create($Url)
    $request.Method = 'POST'
    $request.ContentType = 'application/json'
    $request.ContentLength = $bytes.Length
    $reqStream = $request.GetRequestStream()
    $reqStream.Write($bytes, 0, $bytes.Length)
    $reqStream.Close()

    try {
        $resp = $request.GetResponse()
        $reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
        $text = $reader.ReadToEnd()
        Write-Host "OK: $Label creado correctamente." -ForegroundColor Green
        Write-Host $text
    } catch [System.Net.WebException] {
        Write-Host "ERROR creando $Label (HTTP $([int]$_.Exception.Response.StatusCode))" -ForegroundColor Red
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        Write-Host $reader.ReadToEnd()
    }
}

function Test-Login {
    param(
        [string]$Email,
        [string]$Password,
        [string]$Role,
        [string]$Label
    )

    Write-Host "`n=== Probando login $Label ($Email) ===" -ForegroundColor Cyan
    $json = @{ username = $Email; password = $Password; role = $Role } | ConvertTo-Json
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)

    $request = [System.Net.HttpWebRequest]::Create("$ApiBase/auth/login")
    $request.Method = 'POST'
    $request.ContentType = 'application/json'
    $request.ContentLength = $bytes.Length
    $reqStream = $request.GetRequestStream()
    $reqStream.Write($bytes, 0, $bytes.Length)
    $reqStream.Close()

    try {
        $resp = $request.GetResponse()
        $reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
        Write-Host "OK: login valido para $Label." -ForegroundColor Green
        Write-Host $reader.ReadToEnd()
    } catch [System.Net.WebException] {
        Write-Host "ERROR login $Label (HTTP $([int]$_.Exception.Response.StatusCode))" -ForegroundColor Red
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        Write-Host $reader.ReadToEnd()
    }
}

Test-Login -Email $ClientEmail -Password $ClientPassword -Role 'CLIENT' -Label 'CLIENTE'
Test-Login -Email $ProviderEmail -Password $ProviderPassword -Role 'PROVIDER' -Label 'PROVEEDOR'

Write-Host "`n=== Siguiente paso ===" -ForegroundColor Yellow
Write-Host "1. Revisa el buzon de cada correo y haz clic en el enlace de verificacion."
Write-Host "2. Inicia sesion como PROVEEDOR y sube el documento de identidad + selfie en 'Verificar identidad'."
Write-Host "3. Avisa cuando lo hayas hecho para darte el SQL exacto que aprueba la verificacion en la base de datos de Render."
