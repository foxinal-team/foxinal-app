import {
  IconAlertCircle,
  IconPhoto,
} from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { DialogIcon } from "@/components/DialogIcon";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { fsReadImage, invokeErrorMessage, sftpReadImage } from "../api";
import type { FsEntry, ImageContentResult, PaneConnection } from "../types";

type SftpImageViewerModalProps = {
  open: boolean;
  onClose: () => void;
  entry: FsEntry | null;
  connection: PaneConnection;
};

export function SftpImageViewerModal({
  open,
  onClose,
  entry,
  connection,
}: SftpImageViewerModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageData, setImageData] = useState<ImageContentResult | null>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    if (!open || !entry) {
      setImageData(null);
      setError(null);
      setDimensions(null);
      return;
    }

    const targetPath = entry.path;
    let isMounted = true;

    async function load() {
      setLoading(true);
      setError(null);
      setDimensions(null);
      try {
        const result =
          connection.kind === "local"
            ? await fsReadImage(targetPath)
            : await sftpReadImage(connection.sessionId, targetPath);

        if (!isMounted) return;
        setImageData(result);
      } catch (err) {
        if (!isMounted) return;
        setError(invokeErrorMessage(err, "Failed to load image."));
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    void load();
    return () => {
      isMounted = false;
    };
  }, [open, entry?.path, connection.kind, connection.kind === "remote" ? connection.sessionId : "local"]);

  const formatBadge = imageData?.mimeType
    ? imageData.mimeType.replace("image/", "").toUpperCase()
    : "IMAGE";

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent size="wide" showCloseButton className="max-w-[36rem]">
        <DialogHeader>
          <DialogIcon tone="fox">
            <IconPhoto size={20} stroke={1.75} />
          </DialogIcon>
          <div className="min-w-0 flex-1 pr-6">
            <DialogTitle className="truncate text-base font-semibold">
              {entry?.name ?? "Image Viewer"}
            </DialogTitle>
            <DialogDescription className="truncate text-xs font-mono select-all">
              {entry?.path ?? (connection.kind === "local" ? "Local Filesystem" : "Remote SFTP Host")}
            </DialogDescription>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2.5 text-muted-foreground">
            <Spinner className="h-6 w-6 text-fox" />
            <span className="text-xs font-medium">Loading image...</span>
          </div>
        ) : error ? (
          <div className="flex items-start gap-2.5 rounded-[var(--radius-sm)] border border-destructive/30 bg-destructive/10 p-4 text-xs text-destructive my-4">
            <IconAlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold">Unable to display image</p>
              <p className="mt-0.5 text-muted-foreground">{error}</p>
            </div>
          </div>
        ) : imageData ? (
          <div className="flex flex-col gap-3 my-1">
            {/* Centered Image Container */}
            <div className="relative flex items-center justify-center min-h-60 max-h-[62vh] overflow-hidden rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--field-bg)] p-3">
              <img
                src={imageData.dataUrl}
                alt={imageData.name}
                onLoad={(e) => {
                  const img = e.currentTarget;
                  setDimensions({ width: img.naturalWidth, height: img.naturalHeight });
                }}
                className="max-h-[58vh] max-w-full object-contain select-none rounded-[var(--radius-xs)] shadow-(--shadow-sm) transition-all"
              />
            </div>
          </div>
        ) : null}

        {/* Footer info & close */}
        <DialogFooter className="mt-2 flex items-center justify-between sm:justify-between">
          <div className="flex items-center gap-2 text-[0.74rem] text-muted-foreground">
            {dimensions && (
              <span className="font-mono font-medium text-foreground">
                {dimensions.width} × {dimensions.height} px
              </span>
            )}
            {imageData && (
              <>
                {dimensions && <span>•</span>}
                <span>{imageData.sizeLabel}</span>
                <span>•</span>
                <span className="font-semibold text-fox">{formatBadge}</span>
              </>
            )}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={onClose}
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
