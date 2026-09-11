import { createPluginRegistration, type PluginBatchRegistrations } from "@embedpdf/core";
import { AnnotationPluginPackage, LockModeType } from "@embedpdf/plugin-annotation/react";
import { DocumentManagerPluginPackage } from "@embedpdf/plugin-document-manager/react";
import { ExportPluginPackage } from "@embedpdf/plugin-export/react";
import { HistoryPluginPackage } from "@embedpdf/plugin-history/react";
import { InteractionManagerPluginPackage } from "@embedpdf/plugin-interaction-manager/react";
import { RenderPluginPackage } from "@embedpdf/plugin-render/react";
import { ScrollPluginPackage } from "@embedpdf/plugin-scroll/react";
import { SelectionPluginPackage } from "@embedpdf/plugin-selection/react";
import { SignatureMode, SignaturePluginPackage } from "@embedpdf/plugin-signature/react";
import { ViewportPluginPackage } from "@embedpdf/plugin-viewport/react";
import { ZoomMode, ZoomPluginPackage } from "@embedpdf/plugin-zoom/react";
import { SIGNATURE_SIZE } from "./signature";
import { COLOURS, LINK_CATEGORY, TOOL_OVERRIDES } from "./tools";

export function pluginsFor(name: string, bytes: Uint8Array): PluginBatchRegistrations {
  return [
    createPluginRegistration(DocumentManagerPluginPackage, {
      initialDocuments: [{ buffer: bytes.slice().buffer, name }],
      maxDocuments: 1,
    }),
    createPluginRegistration(ViewportPluginPackage, { viewportGap: 16 }),
    createPluginRegistration(ScrollPluginPackage),
    createPluginRegistration(RenderPluginPackage),
    createPluginRegistration(ZoomPluginPackage, { defaultZoomLevel: ZoomMode.FitWidth }),
    createPluginRegistration(InteractionManagerPluginPackage),
    createPluginRegistration(SelectionPluginPackage),
    createPluginRegistration(HistoryPluginPackage),
    createPluginRegistration(AnnotationPluginPackage, {
      annotationAuthor: "",
      colorPresets: COLOURS.map(({ value }) => value),
      tools: TOOL_OVERRIDES,
      locked: { type: LockModeType.Include, categories: [LINK_CATEGORY] },
      autoOpenLinks: false,
    }),
    createPluginRegistration(SignaturePluginPackage, {
      mode: SignatureMode.SignatureOnly,
      defaultSize: SIGNATURE_SIZE,
    }),
    createPluginRegistration(ExportPluginPackage),
  ];
}
