// utils/geocode.js
// Módulo compartilhado de geocoding via Nominatim (OpenStreetMap)
const https = require('https');

// Cache em memória para não repetir chamadas à API para a mesma cidade
const geocodeCache = new Map();

/**
 * Extrai a UF (sigla do estado) de uma string de localização.
 * Aceita formatos como "Cidade – UF", "Cidade - UF", "UF", ou "Cidade, UF".
 */
function extrairUFdaString(localizacao) {
    if (!localizacao || typeof localizacao !== 'string') return null;
    const trimmed = localizacao.trim();
    if (!trimmed) return null;

    // Tenta separar por "–" (em dash), "-" (hífen) ou "," (vírgula)
    const partes = trimmed.split(/[–,\s-]+/).map(s => s.trim()).filter(Boolean);
    if (partes.length > 1) {
        const uf = partes[partes.length - 1].toUpperCase();
        if (/^[A-Z]{2}$/.test(uf)) return uf;
    }
    // Se a string inteira for uma UF válida
    const upper = trimmed.toUpperCase();
    if (/^[A-Z]{2}$/.test(upper)) return upper;

    return null;
}

/**
 * Tenta enriquecer a localização: se o usuário digitou apenas o nome da cidade
 * (ex.: "São Paulo"), consulta a Nominatim API para descobrir a UF e retorna
 * "Cidade – UF". Se já houver UF ou se a API falhar, retorna o valor original.
 */
function enriquecerLocalizacao(raw) {
    return new Promise((resolve) => {
        if (!raw || typeof raw !== 'string') return resolve(raw);

        const trimmed = raw.trim();
        if (!trimmed) return resolve(raw);

        // Se já contém uma UF reconhecível
        if (extrairUFdaString(trimmed)) return resolve(trimmed);

        // Verifica cache
        const chave = trimmed.toUpperCase();
        if (geocodeCache.has(chave)) {
            const uf = geocodeCache.get(chave);
            return resolve(uf ? `${trimmed} – ${uf}` : trimmed);
        }

        // Faz chamada à Nominatim API
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(trimmed + ', Brasil')}&format=json&limit=1&accept-language=pt`;

        const req = https.get(url, {
            headers: {
                'User-Agent': 'MinisterioAcolher/1.0 (https://ministerioacolher.org)',
                'Accept-Language': 'pt-BR,pt;q=0.9'
            },
            timeout: 4000
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const results = JSON.parse(data);
                    if (results && results.length > 0) {
                        let ufEncontrada = null;

                        // Tenta extrair UF do display_name
                        // Ex: "São Paulo, Região Imediata de São Paulo, ..., São Paulo, Região Sudeste, 01001-000, Brasil"
                        const displayName = results[0].display_name || '';
                        const partesNome = displayName.split(', ');
                        for (const parte of partesNome) {
                            const p = parte.trim().toUpperCase();
                            if (/^[A-Z]{2}$/.test(p) && p !== 'BR') {
                                ufEncontrada = p;
                                break;
                            }
                        }

                        // Fallback: tenta pegar do endereço detalhado (quando disponível)
                        if (!ufEncontrada && results[0].address) {
                            const addr = results[0].address;
                            ufEncontrada = (addr['ISO3166-2-lvl4'] || '').replace('BR-', '') ||
                                           addr.statecode || '';
                            if (ufEncontrada) ufEncontrada = ufEncontrada.toUpperCase();
                        }

                        // Fallback: pega o state do endereço e tenta converter para sigla
                        if (!ufEncontrada && results[0].address && results[0].address.state) {
                            const nomeEstado = results[0].address.state.toUpperCase();
                            ufEncontrada = estadoParaSigla(nomeEstado);
                        }

                        geocodeCache.set(chave, ufEncontrada || null);
                        return resolve(ufEncontrada ? `${trimmed} – ${ufEncontrada}` : trimmed);
                    }
                } catch (e) {
                    // Falha ao parsear JSON
                }
                geocodeCache.set(chave, null);
                resolve(trimmed);
            });
        });

        req.on('error', () => {
            geocodeCache.set(chave, null);
            resolve(trimmed);
        });

        req.on('timeout', () => {
            req.destroy();
            geocodeCache.set(chave, null);
            resolve(trimmed);
        });
    });
}

/**
 * Tenta resolver o nome de uma cidade para a UF (sigla do estado),
 * usando cache e Nominatim API. Retorna a UF ou null.
 */
function resolverCidadeParaUF(cidadeNome) {
    return new Promise((resolve) => {
        if (!cidadeNome || typeof cidadeNome !== 'string') return resolve(null);

        const trimmed = cidadeNome.trim();
        if (!trimmed) return resolve(null);

        // Verifica se já é uma UF
        const uf = extrairUFdaString(trimmed);
        if (uf) return resolve(uf);

        const chave = `RESOLVE:${trimmed.toUpperCase()}`;
        if (geocodeCache.has(chave)) {
            return resolve(geocodeCache.get(chave));
        }

        // Reusa a função de enriquecer, que já faz a chamada à API
        enriquecerLocalizacao(trimmed).then(enriquecido => {
            const ufResolvida = extrairUFdaString(enriquecido);
            geocodeCache.set(chave, ufResolvida);
            resolve(ufResolvida);
        });
    });
}

/**
 * Mapa de nomes de estados brasileiros para siglas (fallback para quando
 * a Nominatim retorna o nome completo do estado em vez da sigla).
 */
function estadoParaSigla(nome) {
    const mapa = {
        'ACRE': 'AC', 'ALAGOAS': 'AL', 'AMAPÁ': 'AP', 'AMAPA': 'AP',
        'AMAZONAS': 'AM', 'BAHIA': 'BA', 'CEARÁ': 'CE', 'CEARA': 'CE',
        'DISTRITO FEDERAL': 'DF', 'ESPÍRITO SANTO': 'ES', 'ESPIRITO SANTO': 'ES',
        'GOIÁS': 'GO', 'GOIAS': 'GO', 'MARANHÃO': 'MA', 'MARANHAO': 'MA',
        'MATO GROSSO': 'MT', 'MATO GROSSO DO SUL': 'MS',
        'MINAS GERAIS': 'MG', 'PARÁ': 'PA', 'PARA': 'PA',
        'PARAÍBA': 'PB', 'PARAIBA': 'PB', 'PARANÁ': 'PR', 'PARANA': 'PR',
        'PERNAMBUCO': 'PE', 'PIAUÍ': 'PI', 'PIAUI': 'PI',
        'RIO DE JANEIRO': 'RJ', 'RIO GRANDE DO NORTE': 'RN',
        'RIO GRANDE DO SUL': 'RS', 'RONDÔNIA': 'RO', 'RONRONIA': 'RO',
        'RORAIMA': 'RR', 'SANTA CATARINA': 'SC',
        'SÃO PAULO': 'SP', 'SAO PAULO': 'SP', 'SERGIPE': 'SE', 'TOCANTINS': 'TO'
    };
    return mapa[nome] || null;
}

module.exports = {
    extrairUFdaString,
    enriquecerLocalizacao,
    resolverCidadeParaUF,
    geocodeCache
};
