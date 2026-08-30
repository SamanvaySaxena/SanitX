[CmdletBinding()]
param(
    [int]$BackendPort = 7000,
    [int]$FrontendPort = 3000,
    [switch]$NoPortCleanup
)

$ErrorActionPreference = "Stop"

$RootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$WebDir = Join-Path $RootDir "web"

function Import-DotEnv {
    param([Parameter(Mandatory = $true)][string]$Path)

    $loaded = @{}

    if (-not (Test-Path -LiteralPath $Path)) {
        Write-Warning "No .env file found at $Path"
        return $loaded
    }

    foreach ($line in Get-Content -LiteralPath $Path) {
        $trimmed = $line.Trim()

        if (-not $trimmed -or $trimmed.StartsWith("#")) {
            continue
        }

        if ($trimmed -match "^\s*([^#=]+?)\s*=\s*(.*)\s*$") {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()

            if (
                ($value.StartsWith('"') -and $value.EndsWith('"')) -or
                ($value.StartsWith("'") -and $value.EndsWith("'"))
            ) {
                $value = $value.Substring(1, $value.Length - 2)
            }

            [Environment]::SetEnvironmentVariable($name, $value, "Process")
            $loaded[$name] = $value
        }
    }

    return $loaded
}

function Stop-ProcessesOnPorts {
    param([Parameter(Mandatory = $true)][int[]]$Ports)

    $processIds = Get-NetTCPConnection -LocalPort $Ports -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique |
        Where-Object { $_ -and $_ -ne $PID }

    foreach ($processId in $processIds) {
        try {
            $process = Get-Process -Id $processId -ErrorAction Stop
            Write-Host "Stopping existing local process $($process.Id) ($($process.ProcessName)) on app port..."
            Stop-Process -Id $processId -Force
        }
        catch {
            Write-Warning "Could not stop process $processId. It may already be closed."
        }
    }
}

function Receive-ServiceOutput {
    param([Parameter(Mandatory = $true)]$Job)

    $previousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"

    try {
        Receive-Job -Job $Job -ErrorAction Continue *>&1 | ForEach-Object {
            Write-Host "[$($Job.Name)] $_"
        }
    }
    finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }
}

if (-not (Test-Path -LiteralPath $WebDir)) {
    throw "Could not find the frontend folder at $WebDir"
}

Set-Location -LiteralPath $RootDir
$backendEnv = Import-DotEnv -Path (Join-Path $RootDir ".env")

if (-not $NoPortCleanup) {
    Stop-ProcessesOnPorts -Ports @($BackendPort, $FrontendPort)
}

$backendEnv["SANITX_CORS_ORIGINS"] = "http://localhost:$FrontendPort"
$backendEnv["SANITX_BACKEND_HOST"] = "127.0.0.1"
$backendEnv["SANITX_BACKEND_PORT"] = "$BackendPort"
$env:NEXT_PUBLIC_DEMO = "0"
$env:NEXT_PUBLIC_SCAN_ENDPOINT = "http://localhost:$BackendPort/api/scan"
$env:NEXT_PUBLIC_SAMPLE_ENDPOINT_BASE = "http://localhost:$BackendPort/api/samples"

if ($env:GOOGLE_API_KEY) {
    Write-Host "GOOGLE_API_KEY loaded for the backend."
}
else {
    Write-Warning "GOOGLE_API_KEY is not set. Backend live scans may fail."
}

$backendJob = Start-Job -Name "SanitXBackend" -ScriptBlock {
    param($RootDir, $BackendPort, $BackendEnv)

    foreach ($entry in $BackendEnv.GetEnumerator()) {
        [Environment]::SetEnvironmentVariable($entry.Key, $entry.Value, "Process")
    }

    Set-Location -LiteralPath $RootDir
    python -m uvicorn main:app --host 127.0.0.1 --port $BackendPort
} -ArgumentList $RootDir, $BackendPort, $backendEnv

$frontendJob = Start-Job -Name "SanitXFrontend" -ScriptBlock {
    param($WebDir, $FrontendPort, $BackendPort)

    $env:NEXT_PUBLIC_DEMO = "0"
    $env:NEXT_PUBLIC_SCAN_ENDPOINT = "http://localhost:$BackendPort/api/scan"
    $env:NEXT_PUBLIC_SAMPLE_ENDPOINT_BASE = "http://localhost:$BackendPort/api/samples"

    Set-Location -LiteralPath $WebDir
    npm.cmd run dev -- --port $FrontendPort
} -ArgumentList $WebDir, $FrontendPort, $BackendPort

Write-Host ""
Write-Host "SanitX is starting."
Write-Host "Frontend: http://localhost:$FrontendPort"
Write-Host "Backend:  http://localhost:$BackendPort"
Write-Host "Press Ctrl+C in this terminal to stop both."
Write-Host ""

$jobs = @($backendJob, $frontendJob)

try {
    while ($true) {
        foreach ($job in $jobs) {
            Receive-ServiceOutput -Job $job

            if ($job.State -in @("Completed", "Failed", "Stopped")) {
                Receive-ServiceOutput -Job $job
                throw "$($job.Name) exited with state $($job.State)."
            }
        }

        Start-Sleep -Milliseconds 500
    }
}
finally {
    Write-Host ""
    Write-Host "Stopping SanitX services..."

    foreach ($job in $jobs) {
        if ($job.State -eq "Running") {
            Stop-Job -Job $job -ErrorAction SilentlyContinue
        }
        Remove-Job -Job $job -Force -ErrorAction SilentlyContinue
    }
}
