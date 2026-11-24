# PC Diagnostic Hub

Diagnóstico completo do computador num painel só: CPU, GPU, memória, discos, bateria e processos em tempo real, com **IA local (Ollama)** para explicar o que está acontecendo.

> 📸 _Print do painel de monitoramento_

## Sobre

Quando um PC fica lento ou esquenta, a investigação costuma passar por quatro ou cinco programas diferentes: um para temperatura, outro para a saúde do disco, outro para a bateria, mais o Gerenciador de Tarefas. O PC Diagnostic Hub reúne tudo, guarda o histórico das sessões e usa um modelo local para explicar processos e resultados em linguagem simples, sem enviar nada para a nuvem.

## Funcionalidades

- **Monitoramento em tempo real**: carga e temperatura de CPU e GPU (NVIDIA/AMD), RAM e VRAM, com gráficos ao vivo
- **Sessões de diagnóstico**: gravação a cada minuto num banco SQLite local, histórico e exportação em JSON
- **Saúde dos discos**: atributos SMART e contadores de hardware
- **Bateria e energia**: capacidade, desgaste e relatório para impressão
- **Gerenciador de processos** com explicador de executáveis: o que é cada processo e se é seguro encerrar
- **Análise com IA local** via Ollama, com pesquisa na web opcional (SearXNG ou a busca do Ollama)
- **Central de atualizações**: Windows Update pendente, BIOS, driver de vídeo e build do sistema

## Requisitos

- Node.js 20+
- **Windows** para a experiência completa. No Linux e no macOS, as informações de disco, bateria e atualizações são mais limitadas
- [Ollama](https://ollama.com) (opcional), para a análise com IA

## Como rodar

```bash
npm install
cp .env.example .env   # opcional, para a pesquisa na web
npm run dev
```

Abra http://localhost:3000. Para produção: `npm run build && npm start`.

> Para ler todos os sensores de temperatura e as atualizações do Windows, rode o terminal como **Administrador**.

## Autor

Criado por **Guilherme Dill** · [RUNE Projects](https://www.runeprojects.com.br) · [GitHub](https://github.com/guilhermealceu)

## Licença

[MIT](LICENSE)
