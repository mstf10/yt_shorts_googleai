import React, { useState, useEffect } from 'react';
import { Cpu, RefreshCw, CheckCircle2, XCircle, AlertTriangle, ArrowLeft, Zap, Activity, Clock, ShieldCheck, Key, BarChart3, Info } from 'lucide-react';

interface ModelInfo {
  id: string;
  name: string;
  role: string;
  status: 'ok' | 'error' | 'warning' | 'missing';
  working: boolean;
  latencyMs: number;
  message: string;
  quota: {
    rpm: number; // requests per minute
    tpm: number; // tokens per minute
    tpmText: string;
    rpd: number; // requests per day
  };
  usage: {
    usedRPM: number;
    remainingRPM: number;
    usedRPD: number;
    remainingRPD: number;
    usedTPM: number;
    remainingTPM: number;
  };
  googleSpecs: {
    displayName?: string;
    inputTokenLimit: number;
    outputTokenLimit: number;
    version?: string;
  };
}

interface ModelStatusResponse {
  configured: boolean;
  models: ModelInfo[];
  keyType?: string;
}

interface ModelStatusPageProps {
  customGeminiKey: string;
  customPexelsKey: string;
  onBackToStudio: () => void;
  onOpenSettings: () => void;
}

export const ModelStatusPage: React.FC<ModelStatusPageProps> = ({
  customGeminiKey,
  customPexelsKey,
  onBackToStudio,
  onOpenSettings,
}) => {
  const [data, setData] = useState<ModelStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastTestedAt, setLastTestedAt] = useState<Date | null>(null);

  const fetchModelStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/model-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: customGeminiKey }),
      });
      const result = await res.json();
      setData(result);
      setLastTestedAt(new Date());
    } catch (err) {
      console.error('Failed to test model status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchModelStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customGeminiKey]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      
      {/* Top Header Bar with Navigation */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 sm:p-5 rounded-2xl shadow-xl">
        <div className="flex items-center space-x-3">
          <button
            onClick={onBackToStudio}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700 transition active:scale-95 flex items-center gap-1.5 font-bold text-xs cursor-pointer"
            title="Ana Stüdyoya Dön"
          >
            <ArrowLeft className="w-4 h-4 text-red-400" />
            <span>Stüdyoya Dön</span>
          </button>
          <div>
            <h1 className="text-lg sm:text-2xl font-black text-white flex items-center gap-2">
              <Cpu className="w-6 h-6 text-red-500 animate-pulse" />
              Gemini Model ve Kullanım Sayfası
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Sistemde aktif çalışan Gemini modelleri, resmi kota sınırları ve anlık kalan kullanım limitleri
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={fetchModelStatus}
            disabled={loading}
            className="px-4 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg shadow-red-500/20 flex items-center gap-2 transition active:scale-95 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Sorgulanıyor...' : 'Modelleri Canlı Test Et'}</span>
          </button>
        </div>
      </div>

      {/* Key & System Overview Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center space-x-3">
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
            <Key className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium">Aktif API Anahtarı</div>
            <div className="text-sm font-bold text-white flex items-center gap-1.5 mt-0.5">
              {customGeminiKey ? (
                <span className="text-emerald-400 flex items-center gap-1">
                  <ShieldCheck className="w-4 h-4" /> Özel Key (localStorage)
                </span>
              ) : (
                <span className="text-amber-400 flex items-center gap-1">
                  <Activity className="w-4 h-4" /> Sunucu Varsayılan Key
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center space-x-3">
          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium">Son Test Zamanı</div>
            <div className="text-sm font-bold text-white mt-0.5">
              {lastTestedAt ? lastTestedAt.toLocaleTimeString('tr-TR') : 'Henüz test edilmedi'}
            </div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center space-x-3">
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium">Aktif Çalışan Modeller</div>
            <div className="text-sm font-bold text-emerald-400 mt-0.5">
              {data?.models ? `${data.models.filter(m => m.working).length} / ${data.models.length} Model Hazır` : 'Sorgulanıyor...'}
            </div>
          </div>
        </div>
      </div>

      {/* Main Models List */}
      <div className="space-y-4">
        <h2 className="text-base font-bold text-slate-200 flex items-center gap-2">
          <Zap className="w-5 h-5 text-amber-400" />
          Kullanılan Gemini Modelleri, Doğru Kota Limitleri ve Kalan Kullanımlar
        </h2>

        {loading && !data ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-red-500 animate-spin mx-auto" />
            <p className="text-sm font-medium text-slate-300">Gemini modellerine canlı API sorgusu atılarak kalan kullanımlar hesaplanıyor...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {data?.models.map((model) => {
              const isOk = model.working;
              const isRateLimit = model.message.includes('429') || model.message.includes('Kota');

              const rpmPercent = Math.round((model.usage.remainingRPM / model.quota.rpm) * 100);
              const rpdPercent = Math.round((model.usage.remainingRPD / model.quota.rpd) * 100);

              return (
                <div
                  key={model.id}
                  className={`bg-slate-900 border rounded-2xl p-5 flex flex-col justify-between space-y-5 transition shadow-lg relative overflow-hidden ${
                    isOk
                      ? 'border-emerald-500/40 shadow-emerald-950/20'
                      : isRateLimit
                      ? 'border-amber-500/40 shadow-amber-950/20'
                      : 'border-red-500/40 shadow-red-950/20'
                  }`}
                >
                  {/* Top Status Header */}
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-xs font-mono px-2.5 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-slate-300 font-semibold">
                        {model.id}
                      </span>

                      {isOk ? (
                        <span className="flex items-center gap-1 text-xs font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-800/80 px-2.5 py-1 rounded-full">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Aktif / Bağlı (200 OK)
                        </span>
                      ) : isRateLimit ? (
                        <span className="flex items-center gap-1 text-xs font-bold text-amber-400 bg-amber-950/80 border border-amber-800/80 px-2.5 py-1 rounded-full">
                          <AlertTriangle className="w-3.5 h-3.5" /> Kota Bekleme
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs font-bold text-red-400 bg-red-950/80 border border-red-800/80 px-2.5 py-1 rounded-full">
                          <XCircle className="w-3.5 h-3.5" /> Erişilemedi
                        </span>
                      )}
                    </div>

                    <h3 className="text-lg font-black text-white">{model.name}</h3>
                    <p className="text-xs text-slate-400 font-medium mt-1">{model.role}</p>
                  </div>

                  {/* Status Message & Latency */}
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="text-slate-500 font-medium">Tepki Süresi (Gecikme):</span>
                      <span className="font-mono font-bold text-amber-300">
                        {model.latencyMs > 0 ? `${model.latencyMs} ms` : '-'}
                      </span>
                    </div>

                    <div className="text-slate-400 pt-1 border-t border-slate-800/80">
                      <span className="font-semibold text-slate-200">Durum Yanıtı: </span>
                      <span>{model.message}</span>
                    </div>
                  </div>

                  {/* REAL-TIME REMAINING USAGE PROGRESS BOX */}
                  <div className="bg-slate-950/90 p-4 rounded-xl border border-slate-800 space-y-3">
                    <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Activity className="w-4 h-4" /> Anlık Kalan Kullanım (Canlı)
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">Otomatik Sıfırlanır</span>
                    </div>

                    {/* RPM Usage Meter */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-slate-300 font-medium">
                        <span>Dakikalık Kalan İstek (RPM):</span>
                        <span className="font-bold text-amber-400 font-mono">
                          {model.usage.remainingRPM} / {model.quota.rpm} İstek Kalan (%{rpmPercent})
                        </span>
                      </div>
                      <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-amber-400 h-full transition-all duration-300"
                          style={{ width: `${rpmPercent}%` }}
                        />
                      </div>
                    </div>

                    {/* RPD Usage Meter */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-slate-300 font-medium">
                        <span>Günlük Kalan İstek (RPD):</span>
                        <span className="font-bold text-emerald-400 font-mono">
                          {model.usage.remainingRPD.toLocaleString('tr-TR')} / {model.quota.rpd.toLocaleString('tr-TR')} Günlük Kalan (%{rpdPercent})
                        </span>
                      </div>
                      <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-emerald-400 h-full transition-all duration-300"
                          style={{ width: `${rpdPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Official Gemini Quota Limits Table */}
                  <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800/80 space-y-2">
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                      <span>Resmi Google Gemini Kota Limitleri</span>
                      <Info className="w-3.5 h-3.5 text-slate-500" />
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center pt-1">
                      <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                        <div className="text-[10px] text-slate-500 font-semibold">Max Dakikadaki İstek</div>
                        <div className="text-xs font-black text-amber-400 mt-0.5">{model.quota.rpm} RPM</div>
                      </div>

                      <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                        <div className="text-[10px] text-slate-500 font-semibold">Max Dakikadaki Token</div>
                        <div className="text-xs font-black text-blue-400 mt-0.5">{model.quota.tpmText} TPM</div>
                      </div>

                      <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                        <div className="text-[10px] text-slate-500 font-semibold">Max Günlük İstek</div>
                        <div className="text-xs font-black text-emerald-400 mt-0.5">{model.quota.rpd.toLocaleString('tr-TR')} RPD</div>
                      </div>
                    </div>

                    {/* Google API Context Window Specs */}
                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800/80">
                      <span>Girdi (Input Context): <strong className="text-slate-200">{model.googleSpecs?.inputTokenLimit?.toLocaleString('tr-TR') || '1.048.576'} Tokens</strong></span>
                      <span>Çıktı (Output Max): <strong className="text-slate-200">{model.googleSpecs?.outputTokenLimit?.toLocaleString('tr-TR') || '8.192'} Tokens</strong></span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quotas & Usage Detailed Explanation Card */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-3">
        <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
          <Info className="w-4 h-4 text-blue-400" />
          Resmi Gemini Kota Değerleri ve Çalışma Mantığı
        </h3>
        <div className="text-xs text-slate-400 leading-relaxed space-y-2">
          <p>
            • <strong className="text-slate-200">Gemini Flash Senaryo & TTS Modelleri (3.5 Flash Lite, 3.1 Flash Lite, 3.1 Flash TTS):</strong> Ücretsiz Google AI Studio API anahtarlarında bu modeller <span className="text-amber-300 font-bold">15 RPM (Dakikadaki İstek)</span>, <span className="text-blue-300 font-bold">1.000.000 TPM (Dakikadaki Token)</span> ve <span className="text-emerald-300 font-bold">1.500 RPD (Günlük İstek)</span> kotalarına sahiptir.
          </p>
          <p>
            • <strong className="text-slate-200">Gemini Pro Modelleri (2.5 Pro, 2.5 Pro TTS):</strong> Yüksek kaliteli derin mantık ve seslendirme modelleri olup ücretsiz katmanda dakikada <span className="text-amber-300 font-bold">2 RPM</span>, <span className="text-blue-300 font-bold">32.000 TPM</span> ve günlük <span className="text-emerald-300 font-bold">50 RPD</span> ile sınırlandırılmıştır.
          </p>
          <p>
            • <strong className="text-slate-200">Otomatik Yedek Seslendirme (ElevenLabs & Google TTS Fallback):</strong> Gemini seslendirme modellerinde kota aşımı (429) veya geçici bir sorun yaşanması durumunda sistem kesintisiz olarak ElevenLabs API veya yüksek hızlı Google TTS motoruna geçerek seslendirme oluşturmaya devam eder.
          </p>
          <p>
            • <strong className="text-slate-200">Kalan Kullanım Takibi:</strong> Sunucu ve istemci üzerindeki istekler canlı takip edilerek dakikalık ve günlük kalan kullanım çubuklarında eşzamanlı gösterilir. Dakikalık kota her 60 saniyede, günlük kota ise her 24 saatte bir otomatik yenilenir.
          </p>
        </div>
      </div>
    </div>
  );
};
