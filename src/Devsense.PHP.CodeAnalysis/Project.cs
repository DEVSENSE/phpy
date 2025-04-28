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
using Devsense.PHP.Phar;
using Devsense.PHP.Syntax.Ast;
using Devsense.PHP.Nodes;
using Devsense.PHP.ControlFlow;
using PHP.VisualStudio.Language.Nodes.Helpers;
using PHP.VisualStudio.Language.Nodes.Frameworks.Laravel;

public static partial class Project
{
    static MockProject _project = null;

    [JSInvokable]
    public static async Task Initialize(string root)
    {
        Dispose(); // dispose previous project if any

        _project = new MockProject(root);

        await Task.Yield();
    }

    [JSInvokable]
    public static void Dispose()
    {
        if (_project != null)
        {
            _project.Dispose();
            _project = null;
        }
    }

    [JSInvokable]
    public static void AddSourceFile(string fname, string code)
    {
        if (_project.ComposerNodesCollection?.TryHandle(fname, false) == true)
        {
            // 
        }

        _project.Add(code, fname, out var errors);
    }

    [JSInvokable]
    public static bool AddConfigFile(string fname, string content)
    {
        // ide.json
        if (PathUtils.GetFileName(fname.AsSpan()).Equals("ide.json".AsSpan(), StringComparison.Ordinal))
        {
            return _project.TryGetFramework<ILaravelFramework>()?.AddIdeJson(fname, content) == true;
        }

        // phpstan.neon
        // ...

        return false;
    }

    [JSInvokable]
    public static void AddPharFile(string fname, byte[] content)
    {
        _project.Add(PharFile.OpenPharFile(new MemoryStream(content), fname));
    }

    [JSInvokable]
    public static void AnalyseFile(string fname)
    {
        var file = _project.GetNode(fname);
        if (file == null)
        {
            Console.WriteLine($"'{fname}' has not been parsed, ignoring ...");
            return;
        }

        _project.Analysis.AnalyseNode((GlobalCodeNode)file);

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

class MockProject : ProjectContainer
{
    public MockProject(string root)
    {
        this.ProjectDir = root;
    }

    protected override bool ContentServiceCanWatch => false; // not needed // not supported on nodeJS

    protected override IProjectFolderContentService ContentService => null; // no file-system

    internal class ProjectManualReferences : IProjectReferences
    {
        public IEnumerable<IReference> References => new IReference[] { ManualNodes.AllReferencedExtensionsNode };

#pragma warning disable CS0067
        public event EventHandler<RefrencesChangedEventArgs> ReferencesChanged;
#pragma warning restore CS0067
    }

    internal class PharFilesReferences : IProjectReferences
    {
        readonly IProject _project;

        public PharFilesReferences(IProject project)
        {
            _project = project;
        }

        public IReadOnlyList<MockPharProject> PharFiles => _pharFiles;

        readonly List<MockPharProject> _pharFiles = new List<MockPharProject>();

        public void Add(MockPharProject project)
        {
            _pharFiles.Add(project ?? throw new ArgumentNullException(nameof(project)));
            ReferencesChanged?.Invoke(this, new RefrencesChangedEventArgs(_project));
        }

        public IEnumerable<IReference> References => _pharFiles;

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
        yield return _pharReferences;
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

    private PharFilesReferences _pharReferences;

    public MockProject(string dir = null, bool enableComposerNodes = false)
    {
        this.ProjectDir = dir;
        this.EnableComposerNodes = enableComposerNodes;
        _pharReferences = new PharFilesReferences(this);

        // force initialize framework providers
        this.UpdateFrameworks();
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

    public void Add(PharFile phar)
    {
        if (phar != null)
        {
            _pharReferences.Add(
                new MockPharProject(phar)
            );
        }
    }

    /// <summary>
    /// Parse and add file to the project.
    /// </summary>
    public GlobalCodeNode Add(string code, string fname, out IReadOnlyList<CommonError> parse_errors)
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
            return this.Add(unit, code, factory);
        }
    }

    /// <summary>
    /// Add source unit to the container, and set properties as expected by analysis.
    /// </summary>
    public GlobalCodeNode Add(AstSourceUnit unit, string code, PhpNodesFactory sink)
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

        return node;
    }
}

class MockPharProject : PharProjectContainer
{
    sealed class PharEntryFileInfo : IFileInfo
    {
        public string FileName { get; set; }

        public string Code { get; set; }

        public GlobalCode Ast => null;

        public IProject Project { get; set; }

        public IFunctionNode[] Functions => EmptyArray<IFunctionNode>.Instance;

        public IConstantNode[] Constants => EmptyArray<IConstantNode>.Instance;

        public ITypeNode[] Types => EmptyArray<ITypeNode>.Instance;
    }

    public MockPharProject(PharFile file) : base(file)
    {
        Initialize(file);
    }

    protected override IFileInfo CreateNode(string entryPath, string fakeFullPath, string code)
    {
        return new PharEntryFileInfo()
        {
            FileName = fakeFullPath,
            Code = code,
            Project = this,
        };
    }

    protected override string GetContent(IFileInfo node) => (node as PharEntryFileInfo)?.Code;
}