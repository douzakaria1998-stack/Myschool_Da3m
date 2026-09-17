try {
    $excel = [System.Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
    Write-Host "Found active Excel application."
    $targetPath = "New folder (2)\قائمة_الطلبة_والأفواج.xlsx"
    foreach ($wb in $excel.Workbooks) {
        Write-Host "Open workbook: $($wb.FullName)"
        if ($wb.FullName.Contains("New folder (2)")) {
            Write-Host "Safely closing $($wb.Name)..."
            $wb.Close($false)
            Write-Host "Closed successfully!"
        }
    }
} catch {
    Write-Host "COM error: $_"
}
