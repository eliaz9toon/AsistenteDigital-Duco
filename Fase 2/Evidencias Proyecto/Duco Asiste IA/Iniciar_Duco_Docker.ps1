$ErrorActionPreference = 'Stop'

function Invoke-DucoDocker {
    & docker @args
    if ($LASTEXITCODE -ne 0) {
        throw "Docker termino con codigo $LASTEXITCODE. Revisa los mensajes anteriores."
    }
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw 'Instala Docker Desktop y abre una terminal nueva.'
}

Push-Location -LiteralPath $PSScriptRoot
try {
    Invoke-DucoDocker info --format '{{.OSType}}'
    Invoke-DucoDocker compose version
    $envFile = Join-Path $PSScriptRoot '.env'
    if (-not (Test-Path -LiteralPath $envFile)) {
        $sysPassword = 'Duco_' + [guid]::NewGuid().ToString('N').Substring(0, 23)
        $appPassword = 'Duco_' + [guid]::NewGuid().ToString('N').Substring(0, 23)
        $stream = [IO.File]::Open($envFile, [IO.FileMode]::CreateNew)
        try {
            $writer = New-Object IO.StreamWriter($stream)
            try {
                $writer.WriteLine("DUCO_DOCKER_SYS_PASSWORD=$sysPassword")
                $writer.WriteLine("DUCO_DOCKER_APP_PASSWORD=$appPassword")
            } finally {
                $writer.Dispose()
            }
        } finally {
            $stream.Dispose()
        }
        Write-Host 'Se creo el archivo .env con credenciales locales.'
    }

    Invoke-DucoDocker compose up --build -d --wait --wait-timeout 600 oracle ollama duco dashboard
    Invoke-DucoDocker compose run --rm --no-deps ollama-model

    $health = Invoke-RestMethod -Uri 'http://127.0.0.1:8765/api/duco/health' -TimeoutSec 10
    if ($health.service -ne 'duco-admin') { throw 'La API de Duco no respondio como se esperaba.' }
    $null = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:6080/vnc.html' -TimeoutSec 15

    Write-Host 'Duco web: http://127.0.0.1:8765/duco'
    Write-Host 'Dashboard: http://127.0.0.1:6080/vnc.html?autoconnect=true'
} finally {
    Pop-Location
}
