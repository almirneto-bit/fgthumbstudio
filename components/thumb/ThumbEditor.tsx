'use client';

import { useEffect, useRef, useState } from 'react';
import JSZip from 'jszip';
import ThumbCanvas, { renderThumbBlob, type ThumbCanvasHandle } from './ThumbCanvas';
import {
  THUMB_COLORS,
  THUMB_FORMATS,
  createDefaultFields,
  type ImageAdjustment,
  type ThumbFields,
  type ThumbPlatform,
} from '@/lib/thumbTemplate';
import {
  ACTIVE_PROJECT_KEY,
  createProject,
  getProject,
  listProjects,
  saveProject,
  type ThumbProject,
} from '@/lib/thumbStorage';

type EditorTab = 'edit' | 'advanced';

function normalizeProject(project: ThumbProject): ThumbProject {
  const defaults = createDefaultFields();
  return {
    ...project,
    fields: {
      ...defaults,
      ...project.fields,
      instagramImage: { ...defaults.instagramImage, ...project.fields.instagramImage },
      tiktokImage: { ...defaults.tiktokImage, ...project.fields.tiktokImage },
    },
  };
}

function safeFilename(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'thumb';
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function ThumbEditor() {
  const [project, setProject] = useState<ThumbProject | null>(null);
  const [history, setHistory] = useState<ThumbProject[]>([]);
  const [activeTab, setActiveTab] = useState<EditorTab>('edit');
  const [showSafeArea, setShowSafeArea] = useState(false);
  const [saveState, setSaveState] = useState<'loading' | 'saving' | 'saved' | 'error'>('loading');
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const instagramRef = useRef<ThumbCanvasHandle>(null);
  const tiktokRef = useRef<ThumbCanvasHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function restore() {
      try {
        const recent = await listProjects();
        const activeId = localStorage.getItem(ACTIVE_PROJECT_KEY);
        const active = activeId ? await getProject(activeId) : null;
        const next = normalizeProject(active ?? recent[0] ?? createProject());
        if (!cancelled) {
          setProject(next);
          setHistory(recent.map(normalizeProject));
          localStorage.setItem(ACTIVE_PROJECT_KEY, next.id);
          setSaveState('saved');
        }
      } catch {
        if (!cancelled) {
          setProject(createProject());
          setSaveState('error');
          setError('O histórico local não pôde ser carregado, mas o editor continua disponível.');
        }
      }
    }
    restore();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!project || saveState === 'loading') return;
    setSaveState('saving');
    const timeout = window.setTimeout(async () => {
      try {
        const recent = await saveProject(project);
        localStorage.setItem(ACTIVE_PROJECT_KEY, project.id);
        setHistory(recent.map(normalizeProject));
        setSaveState('saved');
      } catch {
        setSaveState('error');
        setError('Não foi possível salvar esta criação no navegador.');
      }
    }, 700);
    return () => window.clearTimeout(timeout);
  }, [project]);

  const updateProject = (recipe: (current: ThumbProject) => ThumbProject) => {
    setProject((current) => current ? { ...recipe(current), updatedAt: Date.now() } : current);
  };

  const setField = <K extends keyof ThumbFields>(key: K, value: ThumbFields[K]) => {
    updateProject((current) => ({ ...current, fields: { ...current.fields, [key]: value } }));
  };

  const updateImage = (platform: ThumbPlatform, patch: Partial<ImageAdjustment>) => {
    const key = platform === 'instagram' ? 'instagramImage' : 'tiktokImage';
    if (!project) return;
    setField(key, { ...project.fields[key], ...patch });
  };

  const onImagePick = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') return;
      updateProject((current) => ({
        ...current,
        fields: {
          ...current.fields,
          imageUrl: reader.result as string,
          instagramImage: { scale: 1, offsetX: 0, offsetY: 0 },
          tiktokImage: { scale: 1, offsetX: 0, offsetY: 0 },
        },
      }));
    };
    reader.onerror = () => setError('Não foi possível ler a imagem selecionada.');
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const newProject = async () => {
    if (!project) return;
    try {
      const recent = await saveProject(project);
      const next = createProject();
      setHistory(recent.map(normalizeProject));
      setProject(next);
      localStorage.setItem(ACTIVE_PROJECT_KEY, next.id);
      setActiveTab('edit');
      setError('');
    } catch {
      setError('Não foi possível salvar a criação atual antes de iniciar outra.');
    }
  };

  const openProject = async (id: string) => {
    if (!project || id === project.id) return;
    try {
      await saveProject(project);
      const saved = await getProject(id);
      if (!saved) return;
      const next = normalizeProject(saved);
      setProject(next);
      localStorage.setItem(ACTIVE_PROJECT_KEY, next.id);
      setError('');
    } catch {
      setError('Não foi possível abrir essa criação.');
    }
  };

  const exportOne = async (platform: ThumbPlatform) => {
    if (!project) return;
    setExporting(true);
    try {
      const handle = platform === 'instagram' ? instagramRef.current : tiktokRef.current;
      const blob = await handle?.exportPng();
      if (!blob) throw new Error('Canvas indisponível.');
      downloadBlob(blob, `${safeFilename(project.name)}-${platform}.png`);
      setError('');
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : 'Falha ao exportar.');
    } finally {
      setExporting(false);
    }
  };

  const exportBoth = async () => {
    if (!project) return;
    setExporting(true);
    try {
      const baseName = safeFilename(project.name);
      const [instagram, tiktok] = await Promise.all([
        renderThumbBlob(project.fields, 'instagram'),
        renderThumbBlob(project.fields, 'tiktok'),
      ]);
      const archive = new JSZip();
      archive.file(`${baseName}-instagram.png`, instagram);
      archive.file(`${baseName}-tiktok.png`, tiktok);
      downloadBlob(await archive.generateAsync({ type: 'blob' }), `${baseName}.zip`);
      setError('');
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : 'Falha ao exportar as thumbs.');
    } finally {
      setExporting(false);
    }
  };

  if (!project) return <div className="thumb-loading">Carregando o editor…</div>;
  const fields = project.fields;

  return (
    <div className="thumb-app">
      <header className="thumb-header">
        <h1>FG Thumb Studio <small>Instagram + TikTok · v01</small></h1>
        <div className="thumb-header-actions">
          <button type="button" className="thumb-secondary-btn" onClick={() => exportOne('instagram')} disabled={exporting}>Instagram</button>
          <button type="button" className="thumb-secondary-btn" onClick={() => exportOne('tiktok')} disabled={exporting}>TikTok</button>
          <button type="button" className="thumb-export-btn" onClick={exportBoth} disabled={exporting}>{exporting ? 'Gerando…' : 'Baixar ambas'}</button>
        </div>
      </header>

      <aside className="thumb-rail" aria-label="Formatos e histórico">
        <div className="thumb-rail-head">
          <div><strong>Criação</strong><small>{saveState === 'saving' ? 'Salvando…' : saveState === 'saved' ? 'Salvo neste navegador' : 'Salvamento indisponível'}</small></div>
          <button type="button" className="thumb-icon-btn" onClick={newProject}>Nova</button>
        </div>
        <input className="thumb-project-name" value={project.name} aria-label="Nome da criação" onChange={(event) => updateProject((current) => ({ ...current, name: event.target.value }))} />

        <div className="thumb-rail-section">
          <div className="thumb-section-head"><span>Saídas simultâneas</span><small>2</small></div>
          <div className="thumb-format-list">
            {(Object.keys(THUMB_FORMATS) as ThumbPlatform[]).map((platform) => {
              const format = THUMB_FORMATS[platform];
              return <div key={platform} className={`thumb-format-card format-${platform}`}><span className="thumb-format-shape" /><strong>{format.name}</strong><small>{format.width} × {format.height}</small></div>;
            })}
          </div>
          <p className="thumb-hint">A mesma imagem e o mesmo texto alimentam os dois formatos.</p>
        </div>

        <div className="thumb-rail-section">
          <div className="thumb-section-head"><span>Últimas criações</span><small>5</small></div>
          <div className="thumb-history-list">
            {history.length === 0 && <p className="thumb-hint">As criações salvas aparecerão aqui.</p>}
            {history.map((saved) => (
              <button key={saved.id} type="button" className={saved.id === project.id ? 'is-active' : ''} onClick={() => openProject(saved.id)}>
                <span>{saved.name}</span><small>{new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(saved.updatedAt)}</small>
              </button>
            ))}
          </div>
        </div>
      </aside>

      <section className="thumb-fields">
        <div className="thumb-tabs" role="tablist" aria-label="Seções do editor">
          <button type="button" role="tab" aria-selected={activeTab === 'edit'} className={activeTab === 'edit' ? 'is-active' : ''} onClick={() => setActiveTab('edit')}>Edição</button>
          <button type="button" role="tab" aria-selected={activeTab === 'advanced'} className={activeTab === 'advanced' ? 'is-active' : ''} onClick={() => setActiveTab('advanced')}>Avançado</button>
        </div>

        {activeTab === 'edit' ? (
          <>
            <div className="thumb-section-head"><span>Conteúdo compartilhado</span></div>
            <label className="thumb-field"><span>Imagem para ambas</span><button type="button" className="thumb-upload" onClick={() => fileInputRef.current?.click()}>Trocar imagem</button><input ref={fileInputRef} type="file" accept="image/*" hidden onChange={(event) => onImagePick(event.target.files?.[0])} /></label>
            <div className="thumb-hairline" />

            <label className="thumb-field thumb-line-field"><span><i style={{ background: THUMB_COLORS[0] }} />Linha 1 · branca</span><input type="text" value={fields.line1} maxLength={36} onChange={(event) => setField('line1', event.target.value)} /></label>
            <label className="thumb-field thumb-line-field"><span><i style={{ background: THUMB_COLORS[1] }} />Linha 2 · laranja</span><input type="text" value={fields.line2} maxLength={36} onChange={(event) => setField('line2', event.target.value)} /></label>
            <label className="thumb-field thumb-line-field"><span><i style={{ background: THUMB_COLORS[2] }} />Linha 3 · branca</span><input type="text" value={fields.line3} maxLength={36} placeholder="Opcional" onChange={(event) => setField('line3', event.target.value)} /></label>
            <p className="thumb-hint">As três linhas usam o mesmo alinhamento pela direita. A última linha fica fixa na base e a seta pode ser ocultada no Avançado.</p>

            <label className="thumb-field thumb-range-field"><span>Tamanho do texto <strong>{fields.fontSize}px</strong></span><input type="range" min="90" max="190" step="1" value={fields.fontSize} onChange={(event) => setField('fontSize', Number(event.target.value))} /></label>
            <div className="thumb-hairline" />

            <div className="thumb-disclosure">
              <label className="thumb-toggle-field"><span><strong>Camada de cor</strong><small>Aplicada sobre a imagem nos dois formatos.</small></span><input type="checkbox" checked={fields.colorOverlayEnabled} onChange={(event) => setField('colorOverlayEnabled', event.target.checked)} /></label>
              {fields.colorOverlayEnabled && <div className="thumb-disclosure-panel"><label className="thumb-field thumb-color-field"><span>Cor</span><input type="color" value={fields.colorOverlay} onChange={(event) => setField('colorOverlay', event.target.value)} /></label><label className="thumb-field thumb-range-field"><span>Opacidade <strong>{fields.colorOverlayOpacity}%</strong></span><input type="range" min="0" max="100" step="1" value={fields.colorOverlayOpacity} onChange={(event) => setField('colorOverlayOpacity', Number(event.target.value))} /></label></div>}
            </div>
            <div className="thumb-hairline" />

            <div className="thumb-disclosure">
              <label className="thumb-toggle-field"><span><strong>Noise</strong><small>Textura aplicada na exportação.</small></span><input type="checkbox" checked={fields.noiseEnabled} onChange={(event) => setField('noiseEnabled', event.target.checked)} /></label>
              {fields.noiseEnabled && <div className="thumb-disclosure-panel"><label className="thumb-field thumb-range-field"><span>Intensidade <strong>{fields.noiseIntensity}%</strong></span><input type="range" min="0" max="100" step="1" value={fields.noiseIntensity} onChange={(event) => setField('noiseIntensity', Number(event.target.value))} /></label><label className="thumb-field thumb-range-field"><span>Tamanho do grão <strong>{fields.noiseSize}px</strong></span><input type="range" min="1" max="12" step="1" value={fields.noiseSize} onChange={(event) => setField('noiseSize', Number(event.target.value))} /></label></div>}
            </div>
          </>
        ) : (
          <>
            <div className="thumb-section-head"><span>Enquadramento por formato</span></div>
            {(Object.keys(THUMB_FORMATS) as ThumbPlatform[]).map((platform) => {
              const key = platform === 'instagram' ? 'instagramImage' : 'tiktokImage';
              const adjustment = fields[key];
              return (
                <div key={platform} className="thumb-adjust-card">
                  <div className="thumb-adjust-head"><strong>{THUMB_FORMATS[platform].name}</strong><button type="button" onClick={() => updateImage(platform, { scale: 1, offsetX: 0, offsetY: 0 })}>Resetar</button></div>
                  <label className="thumb-field thumb-range-field"><span>Zoom <strong>{Math.round(adjustment.scale * 100)}%</strong></span><input type="range" min="1" max="2.5" step="0.01" value={adjustment.scale} onChange={(event) => updateImage(platform, { scale: Number(event.target.value) })} /></label>
                  <div className="thumb-two-col"><label className="thumb-field"><span>Horizontal</span><input type="number" min="-800" max="800" step="5" value={adjustment.offsetX} onChange={(event) => updateImage(platform, { offsetX: Number(event.target.value) })} /></label><label className="thumb-field"><span>Vertical</span><input type="number" min="-1000" max="1000" step="5" value={adjustment.offsetY} onChange={(event) => updateImage(platform, { offsetY: Number(event.target.value) })} /></label></div>
                </div>
              );
            })}

            <label className="thumb-field thumb-range-field"><span>Espaço entre linhas <strong>{fields.lineGap}px</strong></span><input type="range" min="-20" max="60" step="1" value={fields.lineGap} onChange={(event) => setField('lineGap', Number(event.target.value))} /></label>
            <div className="thumb-hairline" />
            <label className="thumb-toggle-field"><span><strong>Mostrar seta</strong><small>Exibe a seta à esquerda da última linha sem alterar o alinhamento do texto.</small></span><input type="checkbox" checked={fields.arrowEnabled} onChange={(event) => setField('arrowEnabled', event.target.checked)} /></label>
            <div className="thumb-hairline" />
            <label className="thumb-toggle-field"><span><strong>Sombra inferior</strong><small>Gradiente escuro na base.</small></span><input type="checkbox" checked={fields.bottomShadowEnabled} onChange={(event) => setField('bottomShadowEnabled', event.target.checked)} /></label>
            <div className="thumb-hairline" />
            <label className="thumb-toggle-field"><span><strong>Sombra superior</strong><small>Gradiente escuro no topo.</small></span><input type="checkbox" checked={fields.topShadowEnabled} onChange={(event) => setField('topShadowEnabled', event.target.checked)} /></label>
            <div className="thumb-hairline" />
            <label className="thumb-toggle-field"><span><strong>Margem de segurança</strong><small>Guia de 88 px visível somente na prévia.</small></span><input type="checkbox" checked={showSafeArea} onChange={(event) => setShowSafeArea(event.target.checked)} /></label>
          </>
        )}

        {error && <p role="alert" className="thumb-error">{error}</p>}
        <p className="thumb-hint">O histórico mantém as cinco criações mais recentes somente neste navegador.</p>
      </section>

      <main className="thumb-stage">
        <ThumbCanvas ref={instagramRef} fields={fields} platform="instagram" showSafeArea={showSafeArea} onError={setError} />
        <ThumbCanvas ref={tiktokRef} fields={fields} platform="tiktok" showSafeArea={showSafeArea} onError={setError} />
      </main>
    </div>
  );
}
