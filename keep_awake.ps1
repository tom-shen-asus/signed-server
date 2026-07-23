<#
  Keep the computer awake (no reboot required).
  While this script is running, the computer will not enter Sleep or Modern Standby,
  helping prevent Wi-Fi from disconnecting after a Remote Desktop session ends.

  Usage:
      Open a separate PowerShell window on the target computer and run:

      powershell -ExecutionPolicy Bypass -File keep_awake.ps1

  To stop:
      Press Ctrl+C in that PowerShell window.
      The normal power behavior will be restored immediately.
#>

$src = @"
using System;
using System.Runtime.InteropServices;

public static class Awake
{
    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern uint SetThreadExecutionState(uint esFlags);
}
"@

Add-Type -TypeDefinition $src

# Flags:
# ES_CONTINUOUS      = 0x80000000
# ES_SYSTEM_REQUIRED = 0x00000001
# ES_AWAYMODE_REQUIRED = 0x00000040

$CONT = [uint32]'0x80000000'
$SYS  = [uint32]'0x00000001'
$AWAY = [uint32]'0x00000040'

$flags = $CONT -bor $SYS -bor $AWAY

# Enable keep-awake mode
[void][Awake]::SetThreadExecutionState($flags)

Write-Host "Keep-awake mode is enabled." -ForegroundColor Green
Write-Host "As long as this PowerShell window remains open, the computer will stay awake."
Write-Host "Press Ctrl+C to stop and restore the normal power behavior."

try {
    while ($true) {
        Start-Sleep -Seconds 60

        # Refresh the execution state periodically
        [void][Awake]::SetThreadExecutionState($flags)
    }
}
finally {
    # Restore the default power behavior
    [void][Awake]::SetThreadExecutionState($CONT)

    Write-Host "Keep-awake mode has been disabled."
    Write-Host "The computer has returned to its normal power behavior."
}