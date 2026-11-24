export interface SearchResultItem {
  title: string;
  url: string;
  content: string;
  source?: string;
}

export interface WebSearchResponse {
  success: boolean;
  provider: 'free_public' | 'searxng' | 'ollama_web' | 'auto' | 'none';
  query: string;
  results: SearchResultItem[];
  error?: string;
}

/**
 * Searches using Free Public Web Engine (DuckDuckGo Instant Answers & Wikipedia)
 * Requires ZERO configuration, NO API keys, and NO downloads.
 */
export async function searchWithFreePublic(query: string): Promise<WebSearchResponse> {
  const results: SearchResultItem[] = [];

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    // 1. Query DuckDuckGo Instant Answer API
    const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const ddgRes = await fetch(ddgUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'PC-Diagnostic-Assistant/1.0' }
    });

    if (ddgRes.ok) {
      const data: any = await ddgRes.json();
      if (data.AbstractText) {
        results.push({
          title: data.Heading || query,
          url: data.AbstractURL || 'https://duckduckgo.com',
          content: data.AbstractText,
          source: data.AbstractSource || 'DuckDuckGo'
        });
      }
      if (Array.isArray(data.RelatedTopics)) {
        for (const item of data.RelatedTopics.slice(0, 3)) {
          if (item.Text && item.FirstURL) {
            results.push({
              title: item.Text.slice(0, 60) + '...',
              url: item.FirstURL,
              content: item.Text,
              source: 'DuckDuckGo Topics'
            });
          }
        }
      }
    }

    // 2. Query Wikipedia API (Portuguese / International fallback)
    const wikiUrl = `https://pt.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=&format=json&srlimit=3`;
    const wikiRes = await fetch(wikiUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'PC-Diagnostic-Assistant/1.0' }
    });

    if (wikiRes.ok) {
      const wikiData: any = await wikiRes.json();
      const wikiItems = wikiData?.query?.search || [];
      for (const item of wikiItems) {
        const cleanSnippet = (item.snippet || '')
          .replace(/<span class="searchmatch">/g, '')
          .replace(/<\/span>/g, '')
          .replace(/&quot;/g, '"');

        results.push({
          title: item.title,
          url: `https://pt.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, '_'))}`,
          content: cleanSnippet,
          source: 'Wikipedia'
        });
      }
    }

    clearTimeout(timeout);

    return {
      success: results.length > 0,
      provider: 'free_public',
      query,
      results: results.slice(0, 5)
    };
  } catch (err: any) {
    return {
      success: results.length > 0,
      provider: 'free_public',
      query,
      results: results.slice(0, 5),
      error: `Busca pública gratuita: ${err.message}`
    };
  }
}

/**
 * Searches using SearXNG (Local or Remote instance)
 * Formats: GET {searxngUrl}/search?q=...&format=json
 */
export async function searchWithSearXNG(query: string, searxngUrl = process.env.SEARXNG_URL || 'http://127.0.0.1:8080'): Promise<WebSearchResponse> {
  const cleanUrl = searxngUrl.replace(/\/+$/, '');
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const target = `${cleanUrl}/search?q=${encodeURIComponent(query)}&format=json&language=pt-BR&safesearch=1`;
    const res = await fetch(target, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'PCDiagnosticHub/1.0'
      }
    });
    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`SearXNG respondeu com status ${res.status}: ${res.statusText}`);
    }

    const data: any = await res.json();
    const rawResults = data.results || [];
    const results: SearchResultItem[] = rawResults.slice(0, 5).map((r: any) => ({
      title: r.title || 'Sem título',
      url: r.url || '',
      content: r.content || r.snippet || '',
      source: 'SearXNG Local'
    }));

    return {
      success: results.length > 0,
      provider: 'searxng',
      query,
      results
    };
  } catch (err: any) {
    return {
      success: false,
      provider: 'searxng',
      query,
      results: [],
      error: `SearXNG indisponível (${err.message}).`
    };
  }
}

/**
 * Searches using Ollama Native Web Search API (POST https://ollama.com/api/web_search)
 */
export async function searchWithOllamaWeb(query: string, apiKey = process.env.OLLAMA_API_KEY): Promise<WebSearchResponse> {
  if (!apiKey) {
    return {
      success: false,
      provider: 'ollama_web',
      query,
      results: [],
      error: 'Chave de API do Ollama (OLLAMA_API_KEY) não configurada.'
    };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const res = await fetch('https://ollama.com/api/web_search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey.trim()}`
      },
      body: JSON.stringify({
        query: query,
        max_results: 5
      }),
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`Ollama Web Search API retornou status ${res.status}: ${res.statusText}`);
    }

    const data: any = await res.json();
    const rawResults = data.results || data.data || [];
    const results: SearchResultItem[] = rawResults.slice(0, 5).map((r: any) => ({
      title: r.title || r.name || 'Resultado de Busca',
      url: r.url || r.link || '',
      content: r.content || r.snippet || r.text || '',
      source: 'Ollama Web Search'
    }));

    return {
      success: results.length > 0,
      provider: 'ollama_web',
      query,
      results
    };
  } catch (err: any) {
    return {
      success: false,
      provider: 'ollama_web',
      query,
      results: [],
      error: `Ollama Web Search falhou (${err.message}).`
    };
  }
}

/**
 * Unified Search Manager supporting Free Public, SearXNG, Ollama Web Search API, or Auto-Fallback
 */
export async function performWebSearch(params: {
  query: string;
  provider?: 'free_public' | 'searxng' | 'ollama_web' | 'auto' | 'none';
  searxngUrl?: string;
  ollamaApiKey?: string;
}): Promise<WebSearchResponse> {
  const { query, provider = 'none', searxngUrl, ollamaApiKey } = params;

  if (provider === 'none') {
    return { success: false, provider: 'none', query, results: [] };
  }

  if (provider === 'free_public') {
    return await searchWithFreePublic(query);
  }

  if (provider === 'searxng') {
    return await searchWithSearXNG(query, searxngUrl);
  }

  if (provider === 'ollama_web') {
    return await searchWithOllamaWeb(query, ollamaApiKey);
  }

  // Auto Mode:
  // 1. Try local SearXNG if available
  const searxRes = await searchWithSearXNG(query, searxngUrl);
  if (searxRes.success && searxRes.results.length > 0) {
    return searxRes;
  }

  // 2. Try Ollama Web if API key provided
  if (ollamaApiKey) {
    const ollamaRes = await searchWithOllamaWeb(query, ollamaApiKey);
    if (ollamaRes.success && ollamaRes.results.length > 0) {
      return ollamaRes;
    }
  }

  // 3. Fallback to free public web search (zero-config, works everywhere)
  const freeRes = await searchWithFreePublic(query);
  if (freeRes.success && freeRes.results.length > 0) {
    return freeRes;
  }

  return {
    success: false,
    provider: 'auto',
    query,
    results: [],
    error: `Nenhuma busca retornou resultados no momento.`
  };
}
