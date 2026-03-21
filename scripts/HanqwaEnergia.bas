' ============================================================
' ENERGÍA REAL METER SOL DEL NORTE - HANQWA
' Script VBA - replica lógica de InformesNocturnos.tsx
'
' INSTRUCCIONES:
'   1. Abrir el archivo CSV/Excel con los datos de Hanqwa en Excel
'   2. En el archivo, ir a: Herramientas > Macros > Editor de VBA
'   3. Insertar un módulo nuevo y pegar este código
'   4. Ejecutar la macro "ProcesarHanqwa"
' ============================================================

Option Explicit

' ── Punto de entrada ──────────────────────────────────────
Sub ProcesarHanqwa()
    Dim ref1Str As String, ref2Str As String

    ref1Str = InputBox("Ingrese valor de referencia 1 (ref1):", "Referencia 1")
    If Trim(ref1Str) = "" Then Exit Sub

    ref2Str = InputBox("Ingrese valor de referencia 2 (ref2):", "Referencia 2")
    If Trim(ref2Str) = "" Then Exit Sub

    If Not IsNumeric(ref1Str) Or Not IsNumeric(ref2Str) Then
        MsgBox "Los valores de referencia deben ser numéricos.", vbCritical
        Exit Sub
    End If

    Dim opcion As Integer
    opcion = MsgBox("¿Qué desea generar?" & Chr(13) & Chr(13) & _
                    "SÍ  →  Meter Hanqwa (columnas A–H, 2 decimales)" & Chr(13) & _
                    "NO  →  CEN Hanqwa   (A–B + fórmula horaria en C)", _
                    vbYesNo + vbQuestion, "Tipo de salida")

    If opcion = vbYes Then
        Call GenerarMeterHanqwa(CDbl(ref1Str), CDbl(ref2Str))
    Else
        Call GenerarCENHanqwa(CDbl(ref1Str), CDbl(ref2Str))
    End If
End Sub

' ── Utilidad: reformatear fecha ────────────────────────────
' "3/18/2026 3:45:00.000 AM"  →  "3/18/2026 3:45"
Function ReformatearFecha(dateStr As String) As String
    Dim partes() As String
    partes = Split(Trim(dateStr), " ")
    If UBound(partes) < 1 Then
        ReformatearFecha = dateStr
        Exit Function
    End If
    Dim horaPartes() As String
    horaPartes = Split(partes(1), ":")
    ReformatearFecha = partes(0) & " " & horaPartes(0) & ":" & horaPartes(1)
End Function

' ── Utilidad: redondear como Math.round de JS ─────────────
Function RondearJS(v As Double) As Long
    RondearJS = CLng(Int(v + 0.5))
End Function

' ── Buscar fila que contiene ref1 Y ref2 (cualquier columna) ─
' Replica: filtrarPorReferencia() de InformesNocturnos.tsx
' Devuelve el número de fila Excel (1-based), o -1 si no la encuentra.
Function BuscarFilaReferencia(ws As Worksheet, ref1 As Double, ref2 As Double) As Long
    Dim ultimaFila As Long
    Dim ultimaCol  As Long
    ultimaFila = ws.Cells(ws.Rows.Count, 1).End(xlUp).Row
    ultimaCol  = ws.Cells(1, ws.Columns.Count).End(xlToLeft).Column

    Dim r1 As Long: r1 = RondearJS(ref1)
    Dim r2 As Long: r2 = RondearJS(ref2)

    Dim i As Long, j As Long
    Dim ok1 As Boolean, ok2 As Boolean

    For i = 1 To ultimaFila
        ok1 = False: ok2 = False
        For j = 1 To ultimaCol
            Dim cellStr As String
            cellStr = Trim(CStr(ws.Cells(i, j).Value))
            If IsNumeric(cellStr) Then
                Dim cellVal As Long
                cellVal = RondearJS(CDbl(cellStr))
                If cellVal = r1 Then ok1 = True
                If cellVal = r2 Then ok2 = True
            End If
            If ok1 And ok2 Then
                BuscarFilaReferencia = i
                Exit Function
            End If
        Next j
    Next i

    BuscarFilaReferencia = -1
End Function

' ── Utilidad: eliminar hoja si ya existe ──────────────────
Sub EliminarHojaSiExiste(nombre As String)
    On Error Resume Next
    Application.DisplayAlerts = False
    ThisWorkbook.Sheets(nombre).Delete
    Application.DisplayAlerts = True
    On Error GoTo 0
End Sub

' ── OPCIÓN 1: Meter Hanqwa ─────────────────────────────────
' Replica: descargarMeterHanqwa() de InformesNocturnos.tsx
'
'   - Filtra 96 filas desde la siguiente a la fila de referencia
'   - Columnas A–H (1–8)
'   - Col A : fecha reformateada
'   - Cols B–H : número con formato #,##0.00
Sub GenerarMeterHanqwa(ref1 As Double, ref2 As Double)
    Dim wsSrc As Worksheet
    Set wsSrc = ActiveSheet

    Dim filaRef As Long
    filaRef = BuscarFilaReferencia(wsSrc, ref1, ref2)
    If filaRef = -1 Then
        MsgBox "No se encontró ninguna fila con los dos valores de referencia.", vbCritical
        Exit Sub
    End If

    Call EliminarHojaSiExiste("Meter_Hanqwa")
    Dim wsDest As Worksheet
    Set wsDest = ThisWorkbook.Sheets.Add(After:=ThisWorkbook.Sheets(ThisWorkbook.Sheets.Count))
    wsDest.Name = "Meter_Hanqwa"

    ' ── Headers (fila 1 del origen) ──
    Dim c As Long
    For c = 1 To 8
        wsDest.Cells(1, c).Value = wsSrc.Cells(1, c).Value
    Next c

    ' ── 96 filas de datos ──
    Dim filaOrigen  As Long
    Dim filaDestino As Long
    filaDestino = 2

    For filaOrigen = filaRef + 1 To filaRef + 96
        ' Col A – fecha reformateada
        wsDest.Cells(filaDestino, 1).Value = _
            ReformatearFecha(CStr(wsSrc.Cells(filaOrigen, 1).Value))

        ' Cols B–H – numérico con 2 decimales
        For c = 2 To 8
            Dim raw As String
            raw = Trim(CStr(wsSrc.Cells(filaOrigen, c).Value))
            If IsNumeric(raw) Then
                wsDest.Cells(filaDestino, c).Value = CDbl(raw)
            Else
                wsDest.Cells(filaDestino, c).Value = 0
            End If
            wsDest.Cells(filaDestino, c).NumberFormat = "#,##0.00;-#,##0.00"
        Next c

        filaDestino = filaDestino + 1
    Next filaOrigen

    wsDest.Columns("A:H").AutoFit

    MsgBox "Hoja 'Meter_Hanqwa' generada: " & (filaDestino - 2) & " filas.", vbInformation
End Sub

' ── OPCIÓN 2: CEN Hanqwa ───────────────────────────────────
' Replica: descargarCENHanqwa() de InformesNocturnos.tsx
'
'   - Filtra 96 filas desde la siguiente a la fila de referencia
'   - Solo columnas A y B (fecha + kWh)
'   - Columna C ("kWh hora"): fórmula =SUM(B_inicio:B_fin)/1000
'     cada 4 filas (cada hora = 4 intervalos de 15 min)
'   - Oculta filas donde C está vacía (quedan visibles 24 filas horarias)
'   - AutoFiltro sobre A1:C97
Sub GenerarCENHanqwa(ref1 As Double, ref2 As Double)
    Dim wsSrc As Worksheet
    Set wsSrc = ActiveSheet

    Dim filaRef As Long
    filaRef = BuscarFilaReferencia(wsSrc, ref1, ref2)
    If filaRef = -1 Then
        MsgBox "No se encontró ninguna fila con los dos valores de referencia.", vbCritical
        Exit Sub
    End If

    Call EliminarHojaSiExiste("CEN_Hanqwa")
    Dim wsDest As Worksheet
    Set wsDest = ThisWorkbook.Sheets.Add(After:=ThisWorkbook.Sheets(ThisWorkbook.Sheets.Count))
    wsDest.Name = "CEN_Hanqwa"

    ' ── Headers ──
    wsDest.Cells(1, 1).Value = wsSrc.Cells(1, 1).Value   ' Fecha
    wsDest.Cells(1, 2).Value = wsSrc.Cells(1, 2).Value   ' kWh
    wsDest.Cells(1, 3).Value = "kWh hora"

    ' ── 96 filas de datos ──
    Dim filaOrigen  As Long
    Dim filaDestino As Long
    filaDestino = 2

    Dim idxBase As Long   ' índice 0-based dentro del bloque de 96

    For filaOrigen = filaRef + 1 To filaRef + 96
        idxBase = filaOrigen - (filaRef + 1)   ' 0, 1, 2, ..., 95

        ' Col A – fecha reformateada
        wsDest.Cells(filaDestino, 1).Value = _
            ReformatearFecha(CStr(wsSrc.Cells(filaOrigen, 1).Value))

        ' Col B – kWh numérico
        Dim rawB As String
        rawB = Trim(CStr(wsSrc.Cells(filaOrigen, 2).Value))
        If IsNumeric(rawB) Then
            wsDest.Cells(filaDestino, 2).Value = CDbl(rawB)
        Else
            wsDest.Cells(filaDestino, 2).Value = 0
        End If
        wsDest.Cells(filaDestino, 2).NumberFormat = "#,##0.00;-#,##0.00"

        ' Col C – fórmula horaria cada 4 filas
        ' Condición: (idxBase + 1) Mod 4 = 0  →  filas 4, 8, 12, ..., 96
        If (idxBase + 1) Mod 4 = 0 Then
            Dim startRow As Long
            startRow = filaDestino - 3
            wsDest.Cells(filaDestino, 3).Formula = _
                "=SUM(B" & startRow & ":B" & filaDestino & ")/1000"
            wsDest.Cells(filaDestino, 3).NumberFormat = "#,##0.00;-#,##0.00"
        End If

        filaDestino = filaDestino + 1
    Next filaOrigen

    ' ── AutoFiltro ──
    wsDest.Range("A1:C" & (filaDestino - 1)).AutoFilter

    ' ── Ocultar filas sin fórmula en C (filas de 15 min intermedias) ──
    Dim i As Long
    For i = 2 To filaDestino - 1
        If IsEmpty(wsDest.Cells(i, 3)) Or wsDest.Cells(i, 3).Value = "" Then
            wsDest.Rows(i).Hidden = True
        End If
    Next i

    wsDest.Columns("A:C").AutoFit

    MsgBox "Hoja 'CEN_Hanqwa' generada: 24 filas horarias visibles.", vbInformation
End Sub
