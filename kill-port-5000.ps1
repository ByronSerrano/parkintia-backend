# Script para matar todos los procesos que están usando el puerto 5000

Write-Host "🔍 Buscando procesos en el puerto 5000..." -ForegroundColor Cyan

$connections = netstat -ano | findstr :5000 | findstr LISTENING

if ($connections) {
    $pids = @()
    foreach ($line in $connections) {
        $parts = $line -split '\s+' | Where-Object { $_ -ne '' }
        $pid = $parts[-1]
        if ($pid -match '^\d+$' -and $pids -notcontains $pid) {
            $pids += $pid
        }
    }
    
    Write-Host "📋 Procesos encontrados: $($pids -join ', ')" -ForegroundColor Yellow
    
    foreach ($pid in $pids) {
        try {
            $process = Get-Process -Id $pid -ErrorAction Stop
            Write-Host "⚠️  Matando proceso: $($process.ProcessName) (PID: $pid)" -ForegroundColor Red
            Stop-Process -Id $pid -Force
            Write-Host "✅ Proceso $pid terminado" -ForegroundColor Green
        } catch {
            Write-Host "❌ No se pudo terminar el proceso $pid" -ForegroundColor Red
        }
    }
    
    Write-Host "`n✨ Puerto 5000 liberado" -ForegroundColor Green
} else {
    Write-Host "✅ No hay procesos usando el puerto 5000" -ForegroundColor Green
}
