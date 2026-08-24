$ErrorActionPreference = "Stop"
$DownloadBase = "https://agentprint.tech/releases/latest"
$InstallDir = if ($env:AGENTPRINT_INSTALL_DIR) { $env:AGENTPRINT_INSTALL_DIR } else { Join-Path $env:LOCALAPPDATA "Agentprint\bin" }
$Architecture = if ([System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture -eq "Arm64") { "arm64" } else { "amd64" }
$Archive = "agentprint-windows-$Architecture.zip"
$Temporary = Join-Path ([System.IO.Path]::GetTempPath()) ("agentprint-" + [guid]::NewGuid())

try {
  New-Item -ItemType Directory -Path $Temporary | Out-Null
  Invoke-WebRequest "$DownloadBase/$Archive" -OutFile (Join-Path $Temporary $Archive)
  Expand-Archive (Join-Path $Temporary $Archive) -DestinationPath $Temporary
  New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
  Copy-Item (Join-Path $Temporary "agentprint.exe") (Join-Path $InstallDir "agentprint.exe") -Force
  $UserPath = [Environment]::GetEnvironmentVariable("Path", "User")
  if (($UserPath -split ";") -notcontains $InstallDir) {
    [Environment]::SetEnvironmentVariable("Path", (($UserPath.TrimEnd(";") + ";" + $InstallDir).TrimStart(";")), "User")
  }
  Write-Host "Installed Agentprint to $InstallDir"
  Write-Host "Open a new terminal and run: agentprint login"
}
finally {
  if (Test-Path $Temporary) { Remove-Item -Recurse -Force $Temporary }
}
