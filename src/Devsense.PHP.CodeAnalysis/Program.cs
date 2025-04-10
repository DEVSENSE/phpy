using System;
using Bootsharp;
using System.Threading.Tasks;
using PHP.VisualStudio.Language.Nodes.Project.Containers;
using Devsense.PHP.Nodes.Providers;
using Devsense.PHP.Nodes.Project;
using PHP.VisualStudio.Language.Nodes.Builtin;
using System.Collections.Generic;
using Devsense.PHP.ControlFlow.Analysis.Errors;
using Devsense.PHP.Syntax;
using PHP.VisualStudio.Language.Nodes.Composer.References;
using System.Threading;
using System.Linq;
using PHP.VisualStudio.Language.Nodes.Ast;
using PHP.VisualStudio.Language.Ast;
using PHP.VisualStudio.Language.Nodes.Project;
using System.IO;
using Devsense.PHP.Text;

public static partial class Program
{
    public static void Main()
    {
        //OnMainInvoked($"Hello {GetFrontendName()}, .NET here!");

        // setup composer project behavior:
        ComposerReferencesSetup.CoolDownTime = TimeSpan.Zero;
        ComposerReferencesSetup.FileChangeCoolDownTime = TimeSpan.Zero;
        ComposerReferencesSetup.EnableOnlineCache = false;
    }

    //[JSEvent] // Used in JS as Program.onMainInvoked.subscribe(..)
    //public static partial void OnMainInvoked(string message);

    //[JSFunction] // Set in JS as Program.getFrontendName = () => ..
    //public static partial string GetFrontendName();
}