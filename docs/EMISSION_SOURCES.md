# Emission Factor Sources

> Complete reference of all emission factors used in CarbonLens, their values, units, and source citations.

---

## Table of Contents

- [Transport](#transport)
- [Energy](#energy)
- [Food](#food)
- [Shopping](#shopping)
- [Waste](#waste)
- [Regional Per-Capita Averages](#regional-per-capita-averages)
- [Methodology Notes](#methodology-notes)
- [Source Documents](#source-documents)

---

## Transport

| Activity | Factor | Unit | Source |
|----------|--------|------|--------|
| Car (petrol, average) | 0.231 | kg CO₂e / km | EPA (2024) |
| Car (diesel) | 0.271 | kg CO₂e / km | EPA (2024) |
| Car (hybrid) | 0.150 | kg CO₂e / km | EPA (2024) |
| Car (electric, grid avg) | 0.053 | kg CO₂e / km | EPA (2024) |
| Bus (urban) | 0.089 | kg CO₂e / passenger-km | IPCC AR6 |
| Train (intercity) | 0.041 | kg CO₂e / passenger-km | IPCC AR6 |
| Subway / Metro | 0.033 | kg CO₂e / passenger-km | IPCC AR6 |
| Domestic flight | 0.255 | kg CO₂e / passenger-km | IPCC AR6 |
| Long-haul flight | 0.195 | kg CO₂e / passenger-km | IPCC AR6 |
| Bicycle | 0.000 | kg CO₂e / km | — |
| Walking | 0.000 | kg CO₂e / km | — |
| Motorcycle | 0.103 | kg CO₂e / km | EPA (2024) |
| Ferry | 0.019 | kg CO₂e / passenger-km | IPCC AR6 |

---

## Energy

| Activity | Factor | Unit | Source |
|----------|--------|------|--------|
| Electricity (US grid avg) | 0.417 | kg CO₂e / kWh | EPA (2024) |
| Electricity (EU avg) | 0.276 | kg CO₂e / kWh | EEA (2023) |
| Electricity (UK avg) | 0.207 | kg CO₂e / kWh | BEIS (2024) |
| Electricity (India avg) | 0.708 | kg CO₂e / kWh | CEA India (2023) |
| Natural gas | 2.042 | kg CO₂e / m³ | EPA (2024) |
| Heating oil | 2.540 | kg CO₂e / litre | EPA (2024) |
| LPG (propane) | 1.510 | kg CO₂e / litre | EPA (2024) |
| Wood / biomass | 0.039 | kg CO₂e / kWh | IPCC AR6 |
| Solar (rooftop) | 0.041 | kg CO₂e / kWh | IPCC AR6 (lifecycle) |

---

## Food

| Activity | Factor | Unit | Source |
|----------|--------|------|--------|
| Beef | 27.0 | kg CO₂e / kg food | Poore & Nemecek (2018) |
| Lamb | 24.0 | kg CO₂e / kg food | Poore & Nemecek (2018) |
| Pork | 7.6 | kg CO₂e / kg food | Poore & Nemecek (2018) |
| Chicken | 6.9 | kg CO₂e / kg food | Poore & Nemecek (2018) |
| Fish (farmed) | 5.1 | kg CO₂e / kg food | Poore & Nemecek (2018) |
| Fish (wild-caught) | 3.5 | kg CO₂e / kg food | Poore & Nemecek (2018) |
| Eggs | 4.8 | kg CO₂e / kg food | Poore & Nemecek (2018) |
| Dairy (milk) | 3.2 | kg CO₂e / litre | Poore & Nemecek (2018) |
| Cheese | 13.5 | kg CO₂e / kg food | Poore & Nemecek (2018) |
| Rice | 2.7 | kg CO₂e / kg food | Poore & Nemecek (2018) |
| Tofu | 2.0 | kg CO₂e / kg food | Poore & Nemecek (2018) |
| Vegetables (avg) | 0.5 | kg CO₂e / kg food | Poore & Nemecek (2018) |
| Fruit (avg) | 0.7 | kg CO₂e / kg food | Poore & Nemecek (2018) |
| Bread | 1.3 | kg CO₂e / kg food | Poore & Nemecek (2018) |
| Nuts | 0.3 | kg CO₂e / kg food | Poore & Nemecek (2018) |

---

## Shopping

| Activity | Factor | Unit | Source |
|----------|--------|------|--------|
| Clothing (average garment) | 10.0 | kg CO₂e / item | WRAP UK (2023) |
| Electronics (smartphone) | 70.0 | kg CO₂e / item | Apple Environmental Reports |
| Electronics (laptop) | 300.0 | kg CO₂e / item | Dell ESG Reports |
| Furniture (average) | 50.0 | kg CO₂e / item | WRAP UK (2023) |
| Paper / books | 1.1 | kg CO₂e / kg | EPA (2024) |
| Plastic products | 3.1 | kg CO₂e / kg | EPA (2024) |

---

## Waste

| Activity | Factor | Unit | Source |
|----------|--------|------|--------|
| Landfill (mixed waste) | 0.587 | kg CO₂e / kg | EPA (2024) |
| Recycling (mixed) | 0.021 | kg CO₂e / kg | EPA (2024) |
| Composting | 0.042 | kg CO₂e / kg | EPA (2024) |
| Incineration | 0.915 | kg CO₂e / kg | EPA (2024) |

---

## Regional Per-Capita Averages

Annual per-capita CO₂e emissions (all sectors):

| Region | Annual kg CO₂e | Source |
|--------|---------------|--------|
| 🌍 World | 4,700 | World Bank (2022) |
| 🇺🇸 United States | 14,700 | World Bank (2022) |
| 🇪🇺 European Union | 6,800 | World Bank (2022) |
| 🇬🇧 United Kingdom | 5,200 | World Bank (2022) |
| 🇮🇳 India | 1,900 | World Bank (2022) |
| 🇨🇳 China | 8,000 | World Bank (2022) |

---

## Methodology Notes

### Global Warming Potentials (GWP)

All factors use **100-year GWP** values from **IPCC AR6 (2021)**:

| Gas | GWP₁₀₀ |
|-----|---------|
| CO₂ | 1 |
| CH₄ (methane) | 27.9 |
| N₂O (nitrous oxide) | 273 |

### Scope

- **Transport**: Direct (Scope 1) tailpipe emissions + upstream fuel (Scope 3, well-to-wheel)
- **Energy**: Grid average emission intensities (Scope 2)
- **Food**: Full lifecycle including land use change (Scope 3, cradle-to-retail)
- **Shopping**: Embodied carbon (Scope 3, cradle-to-gate)
- **Waste**: End-of-life treatment emissions (Scope 3)

### Limitations

1. **Averages only** — Factors are national or global averages; individual variation exists
2. **No Scope 1 food** — Cooking energy is captured under "Energy", not "Food"
3. **No carbon offsets** — The app tracks gross emissions, not net
4. **Annual updates needed** — Grid emission factors change as energy mixes evolve
5. **Simplified categories** — Some nuanced activities are grouped for usability

---

## Source Documents

| # | Source | URL | Accessed |
|---|--------|-----|----------|
| 1 | **US EPA GHG Emission Factors Hub** | [epa.gov/ghgemissions](https://www.epa.gov/ghgemissions) | 2025-05-01 |
| 2 | **IPCC AR6 Working Group III** | [ipcc.ch/report/ar6/wg3](https://www.ipcc.ch/report/ar6/wg3/) | 2025-05-01 |
| 3 | **Poore & Nemecek (2018)** "Reducing food's environmental impacts…" *Science* 360(6392), 987–992 | [doi.org/10.1126/science.aaq0216](https://doi.org/10.1126/science.aaq0216) | 2025-05-01 |
| 4 | **WRAP UK** — Clothing & textiles sustainability reports | [wrap.org.uk](https://wrap.org.uk/) | 2025-05-01 |
| 5 | **World Bank Open Data** — CO₂ emissions per capita | [data.worldbank.org](https://data.worldbank.org/indicator/EN.ATM.CO2E.PC) | 2025-05-01 |
| 6 | **EEA** — European Environment Agency, CO₂ intensity | [eea.europa.eu](https://www.eea.europa.eu/) | 2025-05-01 |
| 7 | **BEIS** — UK Government conversion factors for GHG reporting | [gov.uk](https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2024) | 2025-05-01 |
| 8 | **CEA India** — CO₂ baseline database | [cea.nic.in](https://cea.nic.in/) | 2025-05-01 |

---

*Last updated: 2025-06-15*
