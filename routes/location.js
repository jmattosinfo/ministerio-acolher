// routes/location.js
// API de países, estados/províncias e cidades usando country-state-city
const { Country, State, City } = require('country-state-city');
const express = require('express');
const router = express.Router();

// ─── GET /api/location/countries ─────────────────────────────────────────
// Retorna todos os países: [{ value, label, lat, lng }]
router.get('/countries', (req, res) => {
    try {
        const paises = Country.getAllCountries().map(c => ({
            value: c.isoCode,
            label: c.name,
            phonecode: c.phonecode,
            lat: c.latitude ? parseFloat(c.latitude) : null,
            lng: c.longitude ? parseFloat(c.longitude) : null
        }));
        res.json({ ok: true, dados: paises });
    } catch (err) {
        console.error('❌ Erro ao carregar países:', err.message);
        res.status(500).json({ ok: false, mensagem: 'Erro ao carregar países.' });
    }
});

// ─── GET /api/location/countries/coordinates ────────────────────────────
// Retorna apenas coordenadas dos países para uso no mapa
router.get('/countries/coordinates', (req, res) => {
    try {
        const dados = Country.getAllCountries()
            .filter(c => c.latitude && c.longitude)
            .map(c => ({
                value: c.isoCode,
                label: c.name,
                lat: parseFloat(c.latitude),
                lng: parseFloat(c.longitude)
            }));
        res.json({ ok: true, dados });
    } catch (err) {
        console.error('❌ Erro ao carregar coordenadas:', err.message);
        res.status(500).json({ ok: false, mensagem: 'Erro ao carregar coordenadas.' });
    }
});

// ─── GET /api/location/states/:countryCode ──────────────────────────────
// Retorna os estados/províncias de um país: [{ value, label }]
router.get('/states/:countryCode', (req, res) => {
    try {
        const { countryCode } = req.params;
        const estados = State.getStatesOfCountry(countryCode.toUpperCase());
        if (!estados || estados.length === 0) {
            return res.json({ ok: true, dados: [] });
        }
        const resultado = estados.map(e => ({
            value: e.isoCode,
            label: e.name
        }));
        res.json({ ok: true, dados: resultado });
    } catch (err) {
        console.error('❌ Erro ao carregar estados:', err.message);
        res.status(500).json({ ok: false, mensagem: 'Erro ao carregar estados.' });
    }
});

// ─── GET /api/location/cities/:countryCode/:stateCode ───────────────────
// Retorna as cidades de um estado: string[]
router.get('/cities/:countryCode/:stateCode', (req, res) => {
    try {
        const { countryCode, stateCode } = req.params;
        const cidades = City.getCitiesOfState(countryCode.toUpperCase(), stateCode.toUpperCase());
        if (!cidades || cidades.length === 0) {
            return res.json({ ok: true, dados: [] });
        }
        // Extrai apenas os nomes das cidades (sem duplicatas)
        const nomes = [...new Set(cidades.map(c => c.name).filter(Boolean))].sort();
        res.json({ ok: true, dados: nomes });
    } catch (err) {
        console.error('❌ Erro ao carregar cidades:', err.message);
        res.status(500).json({ ok: false, mensagem: 'Erro ao carregar cidades.' });
    }
});

module.exports = router;
