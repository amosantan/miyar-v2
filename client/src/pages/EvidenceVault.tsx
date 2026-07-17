import { useState, useRef } from "react";
import { useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Upload, FileText, Image, Trash2, Tag, Eye, EyeOff, Link2, FolderOpen } from "lucide-react";
import { toast } from "sonner";

const CATEGORIES = [
  { value: "brief", label: "Brief" },
  { value: "brand", label: "Brand" },
  { value: "budget", label: "Budget" },
  { value: "competitor", label: "Competitor" },
  { value: "inspiration", label: "Inspiration" },
  { value: "material", label: "Material" },
  { value: "sales", label: "Sales" },
  { value: "legal", label: "Legal" },
  { value: "mood_image", label: "Mood Image" },
  { value: "material_board", label: "Material Board" },
  { value: "marketing_hero", label: "Marketing Hero" },
  { value: "generated", label: "Generated" },
  { value: "other", label: "Other" },
];

export default function EvidenceVault() {
  const [, params] = useRoute("/projects/:id/evidence");
  const projectId = Number(params?.id);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadCategory, setUploadCategory] = useState("other");
  const [uploadNotes, setUploadNotes] = useState("");

  const assets = trpc.design.listAssets.useQuery(
    { projectId, category: filterCategory === "all" ? undefined : filterCategory },
    { enabled: !!projectId }
  );

  const uploadMutation = trpc.design.uploadAsset.useMutation({
    onSuccess: () => {
      toast.success("File uploaded", { description: "Asset added to Evidence Vault" });
      assets.refetch();
      setUploadOpen(false);
    },
    onError: (err) => toast.error("Upload failed", { description: err.message }),
  });

  const deleteMutation = trpc.design.deleteAsset.useMutation({
    onSuccess: () => {
      toast.success("Asset deleted");
      assets.refetch();
    },
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File too large", { description: "Maximum 10MB" });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      uploadMutation.mutate({
        projectId,
        filename: file.name,
        mimeType: file.type,
        base64Data: base64,
        category: uploadCategory as any,
        notes: uploadNotes || undefined,
      });
    };
    reader.readAsDataURL(file);
  };

  const getCategoryIcon = (cat: string) => {
    if (["mood_image", "material_board", "marketing_hero", "generated", "inspiration"].includes(cat)) return <Image className="h-4 w-4" />;
    return <FileText className="h-4 w-4" />;
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Evidence Vault</h2>
          <p className="text-muted-foreground">Project documents, references, and generated assets</p>
        </div>
        <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
          <DialogTrigger asChild>
            <Button><Upload className="mr-2 h-4 w-4" /> Upload Asset</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload Asset</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium">Category</label>
                <Select value={uploadCategory} onValueChange={setUploadCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Notes (optional)</label>
                <Textarea value={uploadNotes} onChange={e => setUploadNotes(e.target.value)} placeholder="Describe this asset..." />
              </div>
              <div>
                <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} />
                <Button onClick={() => fileInputRef.current?.click()} disabled={uploadMutation.isPending} className="w-full">
                  {uploadMutation.isPending ? "Uploading..." : "Choose File & Upload"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filter bar */}
      <div className="flex gap-2 flex-wrap">
        <Badge
          variant={filterCategory === "all" ? "default" : "outline"}
          className="cursor-pointer"
          onClick={() => setFilterCategory("all")}
        >
          <FolderOpen className="mr-1 h-3 w-3" /> All
        </Badge>
        {CATEGORIES.map(c => (
          <Badge
            key={c.value}
            variant={filterCategory === c.value ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setFilterCategory(c.value)}
          >
            {c.label}
          </Badge>
        ))}
      </div>

      {/* Assets grid */}
      {assets.isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading assets...</div>
      ) : !assets.data?.length ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FolderOpen className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">No assets yet. Upload project documents, briefs, or inspiration images.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {assets.data.map(asset => (
            <Card key={asset.id} className="group relative">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    {getCategoryIcon(asset.category)}
                    <CardTitle className="text-sm truncate">{asset.filename}</CardTitle>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {asset.storageUrl && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => window.open(asset.storageUrl!, "_blank")}>
                        <Link2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate({ assetId: asset.id })}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <CardDescription className="flex items-center gap-2 text-xs">
                  <Badge variant="secondary" className="text-xs">{asset.category}</Badge>
                  <span>{formatSize(asset.sizeBytes)}</span>
                  {asset.isClientVisible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                </CardDescription>
              </CardHeader>
              {asset.mimeType.startsWith("image/") && asset.storageUrl && (
                <CardContent className="pt-0">
                  <img src={asset.storageUrl} alt={asset.filename} className="w-full h-32 object-cover rounded-md" />
                </CardContent>
              )}
              {asset.notes && (
                <CardContent className="pt-0">
                  <p className="text-xs text-muted-foreground">{asset.notes}</p>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
