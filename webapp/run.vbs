Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")
baseDir = fso.GetParentFolderName(WScript.ScriptFullName)
shell.CurrentDirectory = baseDir
shell.Run "pythonw.exe """ & baseDir & "\tray_app.pyw""", 0, False
