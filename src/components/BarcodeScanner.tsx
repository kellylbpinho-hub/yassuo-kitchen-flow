import { useEffect, useRef, useState, useCallback } from "react";
import Quagga from "@ericblade/quagga2";
import { X, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BarcodeScannerProps {
  onDetected: (code: string) => void;
  onClose: () => void;
}

export function BarcodeScanner({ onDetected, onClose }: BarcodeScannerProps) {
  const scannerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const detectedRef = useRef(false);

  // Check HTTPS
  const isSecure =
    window.location.protocol === "https:" ||
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";

  const handleDetected = useCallback(
    (result: any) => {
      const code = result?.codeResult?.code;
      if (!code || detectedRef.current) return;

      // Require multiple consistent reads for accuracy
      const decodedCodes = result?.codeResult?.decodedCodes || [];
      const avgError =
        decodedCodes.reduce((sum: number, c: any) => sum + (c.error || 0), 0) /
        (decodedCodes.length || 1);
      if (avgError > 0.15) return;

      detectedRef.current = true;
      Quagga.stop();
      onDetected(code);
    },
    [onDetected]
  );

  useEffect(() => {
    if (!isSecure) return;
    if (!scannerRef.current) return;

    Quagga.init(
      {
        inputStream: {
          type: "LiveStream",
          target: scannerRef.current,
          constraints: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: "environment",
          },
          area: { top: "25%", right: "10%", bottom: "25%", left: "10%" },
        },
        locator: {
          halfSample: true,
          patchSize: "medium",
        },
        decoder: {
          readers: ["ean_reader", "ean_8_reader", "upc_reader", "upc_e_reader", "code_128_reader"],
        },
        locate: true,
        frequency: 10,
      },
      (err) => {
        if (err) {
          console.error("Quagga init error:", err);
          if (
            String(err).includes("NotAllowedError") ||
            String(err).includes("Permission")
          ) {
            setError(
              "Permissão da câmera negada. No Chrome Android: Configurações → Configurações do site → Câmera → Permitir."
            );
          } else {
            setError("Erro ao acessar a câmera: " + String(err));
          }
          return;
        }
        Quagga.start();
        setStarted(true);
      }
    );

    Quagga.onDetected(handleDetected);

    return () => {
      Quagga.offDetected(handleDetected);
      if (started || !error) {
        try { Quagga.stop(); } catch {}
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSecure]);

  if (!isSecure) {
    return (
      <div className="fixed inset-0 z-50 bg-background/95 flex items-center justify-center p-6">
        <div className="glass-card p-6 max-w-sm text-center space-y-4">
          <Camera className="h-12 w-12 text-warning mx-auto" />
          <h2 className="text-lg font-display font-bold text-foreground">
            HTTPS Necessário
          </h2>
          <p className="text-sm text-muted-foreground">
            Para usar a câmera, abra o app em link seguro (HTTPS).
          </p>
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-card border-b border-border">
        <h2 className="text-lg font-display font-bold text-foreground">
          Escanear Código de Barras
        </h2>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Scanner area */}
      <div className="flex-1 relative overflow-hidden bg-black">
        {error ? (
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <div className="glass-card p-6 max-w-sm text-center space-y-3">
              <p className="text-sm text-destructive">{error}</p>
              <Button variant="outline" onClick={onClose}>
                Fechar
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div ref={scannerRef} className="w-full h-full [&>video]:w-full [&>video]:h-full [&>video]:object-cover [&>canvas]:hidden" />
            {/* Scan guide overlay */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute inset-0 border-[60px] border-black/50 sm:border-[80px]" />
              <div className="absolute top-[60px] left-[60px] right-[60px] bottom-[60px] sm:top-[80px] sm:left-[80px] sm:right-[80px] sm:bottom-[80px] border-2 border-primary rounded-lg" />
              <div className="absolute bottom-4 left-0 right-0 text-center">
                <span className="text-xs text-primary-foreground bg-primary/80 px-3 py-1 rounded-full">
                  Aponte para o código de barras
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
