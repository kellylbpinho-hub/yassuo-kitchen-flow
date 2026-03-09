

## Plano: Substituir ícone Y por texto "Yassuo App" estilizado

### Alterações

**1. Sidebar — `src/components/AppLayout.tsx` (linhas 129-135)**
- Remover `<img src={logoY}>` e o import de `logoY`
- Substituir por: `<h1 className="text-lg font-sans font-bold tracking-tight"><span className="text-white">Yassuo</span> <span className="text-destructive">App</span></h1>`

**2. Header Mobile — `src/components/AppLayout.tsx` (linhas 219-221)**
- Remover `<img src={logoY}>` 
- Substituir por texto: `<span className="text-lg font-sans font-bold tracking-tight"><span className="text-white">Yassuo</span> <span className="text-destructive">App</span></span>`

**3. Login — `src/pages/Login.tsx` (linhas 35-37)**
- Já tem o padrão correto (`Yassuo` + `App` em primary/vermelho)
- Ajustar fonte para `font-sans` (Inter) em vez de `font-display` (Space Grotesk), e aumentar tamanho para `text-4xl` para dar destaque

**4. PDFs — `src/lib/pdfExport.ts`**
- Sem alteração. O logo PNG continua referenciado apenas nos cabeçalhos PDF (o arquivo `src/assets/logo-y.png` permanece no projeto)

**5. Limpeza**
- Remover import `logoY` do AppLayout (já não será usado lá)
- Manter `src/assets/logo-y.png` no projeto para uso futuro nos PDFs

### Detalhes técnicos
- Fonte: `font-sans` (Inter, já configurada no Tailwind)
- Cores: `text-white` para "Yassuo", `text-destructive` (vermelho da marca) para "App"
- O favicon permanece como está (ícone Y na aba do navegador)

