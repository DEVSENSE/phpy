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

    [JSInvokable] // Invoked from JS as Program.GetBackendName()
    public static async Task Analyze(string root, IDictionary<string, string> included, IEnumerable<string> files)
    {
        using var project = new MockProject(root);

        // parse included files:

        foreach (var pair in included)
        {
            if (project.ComposerNodesCollection?.TryHandle(pair.Key, false) == true) // first let composer nodes to handle its files
            {
                // userfiles.Add(
                //     (fullpath, File.ReadAllText(fullpath))
                // );
            }
        }

        // wait for composer packages
        await project.WaitForLoadAsync();

        foreach (var pair in included)
        {
            project.Add(pair.Value, pair.Key, out var errors, postponeAnalysis: true/*analyze once all files are parsed*/);
        }

        // analyze and collect diagnostics
        project.AnalyseToDo();

        foreach (var fname in files)
        {
            // // ignore errors in /vendor/ ... expected
            // if (project.ComposerNodesCollection?.IsVendorFile(project.ProjectDir, file.FileName, out _, out _))
            // {
            //     continue;
            // }

            var file = project.GetNode(fname);
            if (file == null)
            {
                Console.WriteLine($"'{fname}' has not been parsed, ignoring ...");
                continue;
            }

            file.Ast.ContainingSourceUnit.TryGetProperty(typeof(CommonError[]), out var errorsObj);
            if (errorsObj is CommonError[] errors && errors.Length != 0)
            {
                foreach (var error in errors)
                {
                    Console.WriteLine($"[{error.ErrorInfo.ErrorCode}] {error} at {file.FileName}:{file.Ast.ContainingSourceUnit.GetLineFromPosition(error.Span.Start)}");
                }
            }
        }
    }
}

class MockProject : ProjectContainer
{
    public MockProject(string root)
    {
        this.ProjectDir = root;
    }

    protected override bool ContentServiceCanWatch => false; // not needed // not supported on nodeJS

    internal class ProjectManualReferences : IProjectReferences
    {
        public IEnumerable<IReference> References => new IReference[] { ManualNodes.AllReferencedExtensionsNode };

#pragma warning disable CS0067
        public event EventHandler<RefrencesChangedEventArgs> ReferencesChanged;
#pragma warning restore CS0067
    }

    public override string ProjectName => "PROJECT";

    public override string ProjectDir { get; }

    public override ErrorAnalysisSettings.Flags WarningFlags => base.WarningFlags;

    protected override bool EnableComposerNodes { get; } = false;

    public override LanguageFeatures LanguageFeatures => LanguageFeatures.Php84Set | LanguageFeatures.ShortOpenTags;

    protected override IEnumerable<IProjectReferences> ResolveReferences()
    {
        yield return new ProjectManualReferences(); // references with PHP manual 
        yield return new ComposerReferencesProvider().GetReferences(this);
    }

    public async Task WaitForLoadAsync(CancellationToken cancellation = default)
    {
        // output resolved references,
        // and "wakeup" the lazy references resolution
        foreach (var r in this.References.OfType<IProjectFolder>())
        {
            // 
        }

        // wait for parsing the packages and caching
        for (; ; )
        {
            if (this.IsLoadPending || ComposerReferencesSetup.PendingWorkers > 0)
            {
                await Task.Delay(100);
            }
            else
            {
                break;
            }
        }
    }

    // list of files to be analyzed
    // analyze after each file is added, so other tables could be updated and analysis runs in order
    private HashSet<GlobalCodeNode> _todo_analysis = new HashSet<GlobalCodeNode>();

    public MockProject(string dir = null, bool enableComposerNodes = false)
    {
        this.ProjectDir = dir;
        this.EnableComposerNodes = enableComposerNodes;

        // force initialize framework providers
        this.UpdateFrameworks();
    }

    public void AnalyseToDo()
    {
        _todo_analysis.Foreach(node => Analysis.AnalyseNode(node));
        _todo_analysis.Clear();
    }

    public override void EnqueueNode(IFileInfo file)
    {
        _todo_analysis.Add((GlobalCodeNode)file);
    }

    public override void EnqueueNodes(IEnumerable<IFileInfo> files, bool isreanalysis)
    {
        // ignore // invoked by background thread for lazy analysis
        // we already added every node to _todo_analysis in {EnqueueNode}
    }

    public override void UpdateAnalysisErrors(IFileInfo node, CommonError[] erritems)
    {
        ((IPropertyCollection)node.Ast.ContainingSourceUnit)
            .SetProperty(erritems);
    }

    public CommonError[] GetAnalysisErrors(IFileInfo node) =>
        ((IPropertyCollection)node.Ast.ContainingSourceUnit)
            .GetProperty<CommonError[]>()
        ?? Array.Empty<CommonError>();

    /// <summary>
    /// Parse and add file to the project.
    /// </summary>
    public GlobalCodeNode Add(string code, string fname, out IReadOnlyList<CommonError> parse_errors, bool postponeAnalysis = false)
    {
        // // projection ?
        // if (fname.EndsWith(".blade.php", StringComparison.Ordinal))
        // {
        //     code = BladeParserTests.TransformBladeTemplate(code);
        // }

        //
        var errors = new ErrorSink();
        var unit = new AstSourceUnit(code, fname, LanguageFeatures);
        using (var factory = new PhpNodesFactory(unit, errors, LanguageFeatures))
        {
            unit.Parse(factory, errors, null);

            parse_errors = errors.Errors();

            // add & analyze
            return this.Add(unit, code, factory, postponeAnalysis);
        }
    }

    /// <summary>
    /// Add source unit to the container, and set properties as expected by analysis.
    /// </summary>
    public GlobalCodeNode Add(AstSourceUnit unit, string code, PhpNodesFactory sink, bool postponeAnalysis = false)
    {
        if (unit == null) throw new ArgumentNullException(nameof(unit));
        if (unit.Ast == null) throw new InvalidOperationException("Ast is null.");

        //if (projection != null)
        //{
        //    unit.SetProperty<TextProjection>(projection);
        //}

        AstHelpers.FinalizeSourceUnitProperties(unit, this, sink, null);

        //// used by INodeSpan and navigation features to obtain the source location (span mapped to primary buffer in case of projection).
        //// this also maps position to the current snapshot version
        //unit.SetProperty<Nodes.ISpanMapping>(unit);

        //// add the node span service
        //// NOTE: add more services as a single object if needed
        //unit.SetProperty(NodeSpanFactory.Instance); // so far, used by code sense to create span for label and variable nodes correctly

        //
        var node = GlobalCodeNode.GetNode(unit.Ast);
        this.UpdateNode(node, code, ContainerUpdateFlags.Added | ContainerUpdateFlags.ChangedInEditor/*force quick analysis*/);

        if (!postponeAnalysis)
        {
            this.AnalyseToDo();
        }

        return node;
    }
}