// Программа «Зарплата» для Windows: открывает веб-версию в отдельном окне Microsoft Edge (режим приложения, без вкладок и адресной строки).
// Данные хранятся на этом компьютере, в своём профиле %LOCALAPPDATA%\Zarplata — отдельно от обычного браузера. Интерфейс обновляется сам вместе с сайтом.
// Сборка: tools\build-desktop.ps1 (компилятор C# из .NET Framework 4, есть в любой Windows 10/11).
using System;
using System.Diagnostics;
using System.IO;
using System.Windows.Forms;
using Microsoft.Win32;

static class Program
{
    const string Url = "https://jlifeisgood.github.io/zarplata/";

    [STAThread]
    static void Main()
    {
        string edge = FindEdge();
        if (edge == null)
        {
            MessageBox.Show("Для работы нужен браузер Microsoft Edge. Он есть в Windows 10 и 11; если его удалили, установите с microsoft.com/edge.\n\nСейчас откроется сайт в браузере по умолчанию.",
                "Зарплата", MessageBoxButtons.OK, MessageBoxIcon.Information);
            Process.Start(Url);
            return;
        }
        string profile = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Zarplata");
        Directory.CreateDirectory(profile);
        string args = "--app=\"" + Url + "\" --user-data-dir=\"" + profile + "\" --no-first-run --no-default-browser-check --window-size=560,920";
        Process.Start(new ProcessStartInfo(edge, args) { UseShellExecute = false });
    }

    static string FindEdge()
    {
        foreach (RegistryKey root in new[] { Registry.LocalMachine, Registry.CurrentUser })
        {
            using (RegistryKey k = root.OpenSubKey(@"SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\msedge.exe"))
            {
                string p = k != null ? k.GetValue(null) as string : null;
                if (!string.IsNullOrEmpty(p) && File.Exists(p)) return p;
            }
        }
        foreach (string dir in new[] { Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles) })
        {
            string p = Path.Combine(dir, @"Microsoft\Edge\Application\msedge.exe");
            if (File.Exists(p)) return p;
        }
        return null;
    }
}
