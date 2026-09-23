import { useMemo, useState } from 'react'
import { ArrowUpRight, Check, ChevronRight, CircleHelp, CloudDownload, Code2, FolderArchive, Globe2, Image as ImageIcon, Layers3, LockKeyhole, Menu, Play, Radio, ShieldCheck, Sparkles, X } from 'lucide-react'
import './index.css'

type CloneMode = 'basic' | 'advanced'
type JobStatus = 'idle' | 'running' | 'done' | 'error'

const features = [
  { icon: Code2, title: 'HTML limpo', text: 'Capture o markup da página atual para estudar, testar e prototipar.' },
  { icon: Layers3, title: 'Estrutura no mapa', text: 'Visualize uma arquitetura de páginas antes de exportar um projeto.' },
  { icon: ShieldCheck, title: 'Uso responsável', text: 'Clonar não transfere direitos. Use apenas sites seus ou autorizados.' },
]
const steps = [
  ['01', 'Cole uma URL', 'Insira o endereço da página que você controla ou tem permissão para analisar.'],
  ['02', 'Escolha o modo', 'Basic para uma página. Avançado para mapear estrutura, assets e rotas.'],
  ['03', 'Exporte e continue', 'Baixe um pacote inicial e evolua o projeto localmente ou na Vercel.'],
]

function App() {
  const [mode, setMode] = useState<CloneMode>('basic')
  const [url, setUrl] = useState('')
  const [status, setStatus] = useState<JobStatus>('idle')
  const [message, setMessage] = useState('')
  const [showMenu, setShowMenu] = useState(false)
  const ModeIcon = mode === "basic" ? Code2 : FolderArchive
  const modeCopy = useMemo(() => mode === 'basic'
    ? { title: 'Uma página. Zero ruído.', text: 'Capture o HTML da URL escolhida e receba uma base estática para prototipar.', icon: Code2 }
    : { title: 'A visão completa do projeto.', text: 'Mapeie páginas, assets e dependências de uma propriedade que você administra.', icon: FolderArchive }, [mode])

  const handleClone = () => {
    const candidate = url.trim()
    if (!candidate) { setStatus('error'); setMessage('Cole uma URL válida para iniciar a análise.'); return }
    try { new URL(candidate) } catch { setStatus('error'); setMessage('O endereço precisa começar com https:// ou http://.'); return }
    setStatus('running'); setMessage(mode === 'basic' ? 'Preparando captura HTML…' : 'Mapeando a estrutura de páginas…')
    window.setTimeout(() => { setStatus('done'); setMessage(mode === 'basic' ? 'Prévia pronta. O download gera um HTML estático inicial.' : 'Mapa pronto. O modo avançado apresenta a estrutura para exportação local.') }, 1200)
  }
  const downloadStarter = () => {
    const safeHost = (() => { try { return new URL(url).hostname } catch { return 'meu-projeto' } })()
    const html = `<!doctype html>\n<html lang="pt-BR">\n<head>\n  <meta charset="UTF-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n  <title>Clone autorizado — ${safeHost}</title>\n</head>\n<body>\n  <!-- Base gerada pelo Terradagaroa Crackers para ${safeHost} -->\n  <main><h1>Projeto iniciado</h1><p>Substitua este conteúdo pelo HTML autorizado da sua página.</p></main>\n</body>\n</html>`
    const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([html], { type: 'text/html' })); link.download = `${safeHost}-starter.html`; link.click(); URL.revokeObjectURL(link.href)
  }
  return <div className="app-shell">
    <header className="topbar"><a href="#top" className="brand" aria-label="Terradagaroa Crackers início"><img src="/terradagaroa-logo.png" alt="Logo Terradagaroa" /><span>TERRADAGAROA <b>CRACKERS</b></span></a><nav className={showMenu ? 'nav-links open' : 'nav-links'}><a href="#workspace" onClick={() => setShowMenu(false)}>Workspace</a><a href="#como-funciona" onClick={() => setShowMenu(false)}>Como funciona</a><a href="#responsabilidade" onClick={() => setShowMenu(false)}>Responsabilidade</a></nav><div className="topbar-actions"><div className="status-dot"><span /> Local-first</div><button className="icon-button mobile-menu" onClick={() => setShowMenu(!showMenu)} aria-label="Abrir menu">{showMenu ? <X size={19} /> : <Menu size={19} />}</button></div></header>
    <main id="top">
      <section className="hero container"><div className="hero-copy"><div className="eyebrow"><Radio size={14} /> Ferramenta local para builders</div><h1>Seu próximo site<br /><em>começa aqui.</em></h1><p className="hero-text">Uma bancada rápida para transformar páginas autorizadas em pontos de partida editáveis. Sem login, sem banco, sem API.</p><div className="hero-actions"><a href="#workspace" className="primary-button">Abrir workspace <ArrowUpRight size={17} /></a><a href="#como-funciona" className="text-link">Ver como funciona <ChevronRight size={16} /></a></div><div className="hero-note"><LockKeyhole size={14} /> Feito para uso autorizado e prototipagem</div></div><div className="hero-art" aria-label="Marca Terradagaroa"><div className="art-ring ring-one" /><div className="art-ring ring-two" /><div className="art-card"><img src="/terradagaroa-logo.png" alt="Terradagaroa" /><span>EST. 2026</span></div><div className="art-caption"><span>01</span><span>BUILD / BREAK / REBUILD</span></div></div></section>
      <section id="workspace" className="workspace-section container"><div className="section-kicker"><span>01</span> WORKSPACE</div><div className="workspace-grid"><div className="workspace-card"><div className="card-header"><div><span className="card-label">START A CLONE</span><h2>Escolha seu ponto de partida.</h2></div><Sparkles size={22} className="muted-icon" /></div><div className="mode-switch" role="tablist" aria-label="Modo de clonagem"><button className={mode === 'basic' ? 'mode-tab active' : 'mode-tab'} onClick={() => setMode('basic')} role="tab" aria-selected={mode === 'basic'}><Code2 size={18} /><span><strong>Basic clone</strong><small>Uma página</small></span>{mode === 'basic' && <Check size={16} />}</button><button className={mode === 'advanced' ? 'mode-tab active' : 'mode-tab'} onClick={() => setMode('advanced')} role="tab" aria-selected={mode === 'advanced'}><FolderArchive size={18} /><span><strong>Avançado clone</strong><small>Mapa do projeto</small></span>{mode === 'advanced' && <Check size={16} />}</button></div><div className="mode-explainer"><div className="explainer-icon"><ModeIcon size={21} /></div><div><strong>{modeCopy.title}</strong><p>{modeCopy.text}</p></div></div><label className="url-label" htmlFor="site-url">URL DA PÁGINA</label><div className={status === 'error' ? 'url-input error' : 'url-input'}><Globe2 size={18} /><input id="site-url" value={url} onChange={(event) => { setUrl(event.target.value); setStatus('idle'); setMessage('') }} placeholder="https://seu-site.com/pagina" /><button onClick={handleClone} disabled={status === 'running'}>{status === 'running' ? 'Analisando…' : 'Analisar'} <Play size={15} fill="currentColor" /></button></div>{message && <div className={status === 'error' ? 'feedback error-text' : status === 'done' ? 'feedback success-text' : 'feedback'}>{status === 'done' && <Check size={15} />}{message}</div>}<div className="card-footer"><span><LockKeyhole size={13} /> Não armazenamos sua URL</span><span>HTTPS recomendado</span></div></div><aside className="preview-card"><div className="preview-top"><span className="live-pill"><span /> PREVIEW</span><span>0{mode === 'basic' ? 1 : 6} / {mode === 'basic' ? 'PAGE' : 'ROUTES'}</span></div><div className="preview-window"><div className="preview-dots"><i /><i /><i /><span>terradagaroa.local</span></div><div className="preview-content"><div className="preview-lines"><b /><b /><b /><b /><b /></div><div className="preview-visual"><ImageIcon size={27} /><span>{status === 'done' ? 'Análise concluída' : 'Sua prévia aparece aqui'}</span></div><div className="preview-lines short"><b /><b /><b /></div></div></div><div className="preview-bottom"><div><span>STATUS</span><strong>{status === 'running' ? 'PROCESSANDO' : status === 'done' ? 'PRONTO PARA EXPORTAR' : 'AGUARDANDO URL'}</strong></div>{status === 'done' && <button className="download-button" onClick={downloadStarter}><CloudDownload size={16} /> Baixar starter</button>}</div></aside></div></section>
      <section className="feature-strip container" id="responsabilidade">{features.map(({ icon: Icon, title, text }) => <article key={title}><Icon size={20} /><div><h3>{title}</h3><p>{text}</p></div></article>)}</section>
      <section id="como-funciona" className="how-section container"><div className="section-kicker"><span>02</span> COMO FUNCIONA</div><div className="how-heading"><h2>Do endereço ao<br /><em>primeiro commit.</em></h2><p>Um fluxo direto, pensado para quem quer sair da referência e chegar rápido em uma base de código própria.</p></div><div className="steps">{steps.map(([number, title, text]) => <div className="step" key={number}><span className="step-number">{number}</span><div><h3>{title}</h3><p>{text}</p></div></div>)}</div></section>
      <section className="disclaimer container"><CircleHelp size={18} /><p><strong>Nota de responsabilidade:</strong> o Terradagaroa Crackers é uma ferramenta de prototipagem e análise local. Não copie conteúdo, marca, código proprietário ou assets de terceiros sem autorização.</p></section>
    </main><footer className="footer container"><div className="footer-brand"><img src="/terradagaroa-logo.png" alt="" /><span>Desenvolvido pela<br /><strong>Terra da Garoa no iOS</strong></span></div><span className="footer-copy">© 2026 TERRADAGAROA CRACKERS</span><a href="#top">Voltar ao topo ↑</a></footer>
  </div>
}
export default App
