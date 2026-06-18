/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { X, Camera, AlertTriangle, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';

interface Props {
  onScan: (code: string) => void;
  onClose: () => void;
}

const BarcodeScannerModal: React.FC<Props> = ({ onScan, onClose }) => {
  const scannerRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanFileError, setScanFileError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [cameraAvailable, setCameraAvailable] = useState<boolean | null>(null);

  const createZXingReader = async () => {
    const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
      import('@zxing/browser'),
      import('@zxing/library'),
    ]);

    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.QR_CODE,
    ]);

    return new BrowserMultiFormatReader(hints);
  };

  useEffect(() => {
    let mounted = true;
    let scanner: any = null;
    let controls: any = null;
    let hasScanned = false;

    const requestCameraAccess = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('getUserMedia tidak tersedia');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
      });
      stream.getTracks().forEach((track) => track.stop());
      return true;
    };

    const initScanner = async () => {
      try {
        if (!mounted) return;

        const canUseCamera = !!(navigator.mediaDevices?.getUserMedia) && window.isSecureContext;
        if (!canUseCamera) {
          setCameraAvailable(false);
          setLoading(false);
          return;
        }

        try {
          await requestCameraAccess();
        } catch (permissionErr: any) {
          console.error('Camera permission error:', permissionErr);
          const denied = permissionErr?.name === 'NotAllowedError'
            || permissionErr?.name === 'PermissionDeniedError'
            || permissionErr?.message?.toLowerCase().includes('permission');

          if (denied) {
            setError(`❌ Akses kamera ditolak.\n\nSilakan izinkan kamera di browser Anda untuk melanjutkan. Jika sudah ditolak sebelumnya, buka pengaturan izin situs dan aktifkan Kamera, lalu tekan COBA LAGI.`);
            setLoading(false);
            return;
          }

          if (permissionErr?.name === 'NotFoundError' || permissionErr?.name === 'DevicesNotFoundError') {
            setCameraAvailable(false);
            setLoading(false);
            return;
          }

          throw permissionErr;
        }

        console.log('✅ Menggunakan ZXing Scanner untuk web');

        scanner = await createZXingReader();
        controls = await scanner.decodeFromConstraints(
          { video: { facingMode: { ideal: 'environment' } } },
          'reader',
          (result: any) => {
            if (!result || hasScanned) return;
            hasScanned = true;
            const decodedText = result.getText();
            onScan(decodedText);
            try {
              controls?.stop?.();
            } catch {}
            onClose();
          }
        );

        scannerRef.current = { scanner, controls };
        setCameraAvailable(true);
        setLoading(false);
      } catch (err: any) {
        if (!mounted) return;
        console.error('Kamera error:', err);

        const canUseCamera = !!(navigator.mediaDevices?.getUserMedia) && window.isSecureContext;
        if (!canUseCamera) {
          setCameraAvailable(false);
          setLoading(false);
          return;
        }

        const details = [] as string[];
        if (err && err.message) details.push(err.message);
        if (err && err.name) details.push(err.name);

        let hint = `❌ Gagal membuka kamera.`;
        hint += `\n\nCatatan umum: Kamera HANYA bekerja di:\n✅ HTTPS (https://...)\n✅ localhost`;
        hint += `\n\nJika browser Anda tidak mendukung getUserMedia, silakan gunakan fitur unggah foto barcode.`;

        if (window.self !== window.top) {
          hint += `\n\nPenyebab lain: Halaman di-embed dalam iframe. Buka langsung di tab baru.`;
        }

        if (!window.isSecureContext) {
          hint += `\n\nPenyebab lain: Situs tidak berada di HTTPS.`;
        }

        hint += `\n\nDetail error: ${details.join(' | ')}`;
        setError(hint);
        setLoading(false);
      }
    };

    initScanner();

    return () => {
      mounted = false;
      try {
        controls?.stop?.();
        scannerRef.current?.controls?.stop?.();
        scannerRef.current?.scanner?.reset?.();
      } catch {}
    };
  }, [onScan, onClose]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    setScanFileError(null);
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const { BrowserMultiFormatReader } = await import('@zxing/browser');
      const { BarcodeFormat, DecodeHintType } = await import('@zxing/library');
      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.CODE_128,
        BarcodeFormat.CODE_39,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
        BarcodeFormat.QR_CODE,
      ]);

      const html5Qrcode = new BrowserMultiFormatReader(hints);
      const imageUrl = URL.createObjectURL(file);
      const result = await html5Qrcode.decodeFromImageUrl(imageUrl);
      URL.revokeObjectURL(imageUrl);
      if (result?.getText()) {
        onScan(result.getText());
        onClose();
      }
    } catch (err: any) {
      console.error('Scan file error:', err);
      setScanFileError('Tidak dapat membaca barcode dari foto. Pastikan foto jelas dan barcode berada di dalam frame.');
    } finally {
      setLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-90/80 backdrop-blur-md"
      />
      
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="relative bg-white w-full max-w-lg rounded-[40px] shadow-2xl overflow-hidden flex flex-col"
      >
        <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-100">
                <Camera size={20} strokeWidth={2.5} />
             </div>
             <div>
                <h2 className="font-black text-lg text-slate-800 tracking-tight leading-none uppercase">Scanner</h2>
                <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest text-[#10B981]">Posisi Barcode di Dalam Kotak</p>
             </div>
          </div>
          <button 
            onClick={onClose} 
            className="w-12 h-12 rounded-2xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-900 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          {error ? (
            <div className="rounded-[24px] border-2 border-red-100 bg-red-50 p-8 text-center">
              <AlertTriangle size={48} className="text-red-400 mx-auto mb-4" />
              <p className="text-sm font-bold text-red-700 mb-6">{error}</p>
              
              <button 
                onClick={() => window.location.reload()} 
                className="w-full bg-red-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2"
              >
                <RefreshCw size={16} /> COBA LAGI
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full bg-[#10B981] text-white py-3 rounded-xl font-bold mt-3"
              >
                Unggah Foto Barcode
              </button>
            </div>
          ) : cameraAvailable === false ? (
            <div className="rounded-[24px] border-2 border-slate-100 bg-slate-50 p-8 text-center space-y-4">
              <Camera size={40} className="text-slate-400 mx-auto" />
              <div>
                <p className="text-sm font-black text-slate-700">Kamera tidak tersedia</p>
                <p className="text-xs text-slate-500 mt-1">Silakan unggah foto barcode atau gunakan browser yang mendukung kamera.</p>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full bg-[#10B981] hover:bg-emerald-600 text-white py-3 rounded-2xl font-black transition-all"
              >
                Unggah Foto Barcode
              </button>
              {scanFileError && (
                <p className="text-[10px] text-red-600 font-bold">{scanFileError}</p>
              )}
            </div>
          ) : (
            <div className="relative overflow-hidden rounded-[24px] border-2 border-slate-100 bg-slate-950 aspect-video shadow-inner">
              <video 
                id="reader" 
                className="w-full h-full object-cover"
                playsInline 
                muted 
                autoPlay
              />
              {loading && (
                <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-sm flex flex-col items-center justify-center text-center p-6 text-white z-10">
                  <Camera size={40} className="text-indigo-400 mb-4 animate-pulse" />
                  <p className="text-sm font-bold">Meminta izin akses kamera...</p>
                  <p className="text-xs text-slate-400 mt-1">Harap klik IZINKAN ketika muncul popup</p>
                </div>
              )}
              {!loading && (
                <div className="absolute inset-0 border-2 border-indigo-500 rounded-[24px] pointer-events-none animate-pulse flex items-center justify-center z-10">
                  <div className="w-48 h-48 border-2 border-dashed border-indigo-400 rounded-lg opacity-60"></div>
                </div>
              )}
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        <div className="p-6 bg-slate-50 flex flex-col items-center gap-2">
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mendukung: EAN-13, CODE-128, QR, DLL</p>
           <p className="text-[9px] font-bold text-blue-400 italic">Pastikan pencahayaan cukup terang</p>
        </div>
      </motion.div>
    </div>
  );
};

export default BarcodeScannerModal;
