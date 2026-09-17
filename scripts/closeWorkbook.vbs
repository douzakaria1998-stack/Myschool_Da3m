On Error Resume Next
Set xl = GetObject(, "Excel.Application")
If Err.Number = 0 Then
    For Each wb In xl.Workbooks
        If InStr(wb.FullName, "New folder (2)") > 0 Then
            WScript.Echo "Closing: " & wb.FullName
            wb.Close False
        End If
    Next
Else
    WScript.Echo "Excel not running or accessible"
End If
