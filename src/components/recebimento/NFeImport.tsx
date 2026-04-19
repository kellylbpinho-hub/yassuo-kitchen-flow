import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileCode2, FileText } from "lucide-react";
import { NFeImportXml } from "./NFeImportXml";
import { NFeImportPdf } from "./NFeImportPdf";
import type { Product } from "./types";

interface NFeImportProps {
  allProducts: Product[];
  defaultUnitId: string;
  onComplete: () => void;
  onCancel: () => void;
}

/**
 * Tela única "Importar NF-e" com tabs XML / PDF.
 * - XML: fluxo automático (parser nativo) — não alterado.
 * - PDF: leitura via pdfjs com fallback para preenchimento manual.
 */
export function NFeImport(props: NFeImportProps) {
  return (
    <div className="glass-card p-5 sm:p-6 max-w-2xl space-y-5">
      <div className="space-y-1">
        <h2 className="font-display font-bold text-foreground text-base sm:text-lg">
          Importar NF-e
        </h2>
        <p className="text-xs text-muted-foreground">
          Escolha o formato do arquivo recebido do fornecedor.
        </p>
      </div>

      <Tabs defaultValue="xml" className="w-full">
        <TabsList className="grid w-full grid-cols-2 h-10">
          <TabsTrigger value="xml" className="gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <FileCode2 className="h-3.5 w-3.5" />
            XML
          </TabsTrigger>
          <TabsTrigger value="pdf" className="gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <FileText className="h-3.5 w-3.5" />
            PDF
          </TabsTrigger>
        </TabsList>

        <TabsContent value="xml" className="mt-5">
          <NFeImportXml {...props} />
        </TabsContent>

        <TabsContent value="pdf" className="mt-5">
          <NFeImportPdf {...props} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
