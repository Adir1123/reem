import { toBlob } from "html-to-image";
import JSZip from "jszip";

// Snapshots N hidden 1080x1350 nodes (one per slide), zips them with
// caption.txt, and triggers a browser download. Caller mounts the nodes off-
// screen with id={domIdPrefix + slideIndex}; html-to-image rasterizes them
// directly so the export pixels match what's on screen.
export async function exportCarouselZip(opts: {
  domIdPrefix: string; // e.g. "export-slide-"
  slideCount: number;
  caption: string;
  filename: string; // without .zip
}) {
  const { domIdPrefix, slideCount, caption, filename } = opts;

  // Critical: without this the snapshot rasterizes with fallback fonts.
  // We self-host the brand fonts via next/font, so once they've loaded
  // once the browser keeps them ready.
  if (document.fonts && document.fonts.ready) {
    await document.fonts.ready;
  }

  const zip = new JSZip();

  for (let i = 0; i < slideCount; i++) {
    const node = document.getElementById(`${domIdPrefix}${i}`);
    if (!node) {
      throw new Error(`exportCarouselZip: missing node #${domIdPrefix}${i}`);
    }
    const blob = await toBlob(node, {
      pixelRatio: 1,
      width: 1080,
      height: 1350,
      cacheBust: true,
      backgroundColor: "#0a0a0a",
    });
    if (!blob) {
      throw new Error(`exportCarouselZip: snapshot returned null for slide ${i + 1}`);
    }
    zip.file(`slide-${String(i + 1).padStart(2, "0")}.png`, blob);
  }

  zip.file("caption.txt", caption);

  const archive = await zip.generateAsync({ type: "blob" });

  const url = URL.createObjectURL(archive);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Defer revoke so the click finishes the download negotiation first.
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
